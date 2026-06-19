import type { GoogleGenerativeAI } from "@google/generative-ai";
import type { Door, FloorPlan, Room, WallSide } from "./floorplan-schema";
import { regenerateFurniture } from "./furniture.ts";
import { regenerateMaterials } from "./materials.ts";
import { regenerateOpenings } from "./opening-regeneration.ts";
import type { UserType } from "./user-types";

type PrivacyZone = "public" | "private" | "service";
type SiteShape = "rectangle" | "l_shape" | "u_shape" | "courtyard" | "narrow_lot" | "stepped";
type GenerationMode = "fast" | "quality";

interface PlannerRoomSpec {
  id: string;
  type: string;
  label: string;
  zone: PrivacyZone;
  area: number;
  minWidth: number;
  minDepth: number;
  aspectRatio: number;
  requiresWindow: boolean;
  adjacency: string[];
}

export interface PlannerBrief {
  userType: UserType | null;
  projectType: "studio" | "unit" | "family_home" | "villa" | "builder_spec" | "unknown_residential";
  targetAreaSqm: number;
  areaTolerance: number;
  siteShape: SiteShape;
  frontDoorSide: "top" | "bottom" | "left" | "right";
  rooms: PlannerRoomSpec[];
  mustHave: string[];
  niceToHave: string[];
  unsupportedRequests: string[];
}

interface PlannerCandidate {
  id: string;
  rooms: Room[];
  totalArea: number;
  notes: string[];
  footprintOverflowMeters?: number;
  sharedWalls?: SharedWallEvidence[];
  score?: PlannerScore;
}

interface SharedWallEvidence {
  roomA: string;
  roomB: string;
  wallA: WallSide;
  wallB: WallSide;
  sharedLength: number;
  positionA: number;
  positionB: number;
}

interface PlannerScore {
  total: number;
  areaFit: number;
  adjacency: number;
  privacy: number;
  circulation: number;
  daylight: number;
  wetRoomClustering: number;
  buildability: number;
  wallSharing: number;
  roleFit: number;
}

type CandidateStrategy = "graph_zone" | "slicing_tree" | "squarified_area" | "boundary_seed" | "mutated_refinement";

type SpatialSolverBackend = "typescript_hybrid" | "ortools_microservice";
type SpatialSolverStatus = "feasible" | "timeout" | "infeasible";

interface FootprintBounds {
  width: number;
  height: number;
  shape: SiteShape;
}

interface SpatialSolverRequest {
  brief: PlannerBrief;
  mode: GenerationMode;
  timeBudgetMs: number;
  footprint: FootprintBounds;
}

interface SpatialSolverResult {
  backend: SpatialSolverBackend;
  status: SpatialSolverStatus;
  candidates: PlannerCandidate[];
  elapsedMs: number;
  exploredCandidates: number;
  notes: string[];
}

interface SpatialSolver {
  solve(request: SpatialSolverRequest): Promise<SpatialSolverResult> | SpatialSolverResult;
}

export interface PlannerResult {
  floorPlan: FloorPlan;
  rationale: string;
  generationNotes: string[];
  solver: Pick<SpatialSolverResult, "backend" | "status" | "elapsedMs" | "exploredCandidates">;
}

interface GeneratePlannerOptions {
  genAI?: GoogleGenerativeAI;
  modelName?: string;
  userType?: UserType | null;
  mode?: GenerationMode;
}

const GRID = 50;
const MIN_ROOM_METERS = 2;

export async function generatePlannerFloorPlan(
  prompt: string,
  options: GeneratePlannerOptions = {},
): Promise<PlannerResult> {
  const baseBrief = inferBrief(prompt, options.userType ?? null);
  const brief = options.genAI && options.modelName
    ? await refineBriefWithAI(options.genAI, options.modelName, prompt, baseBrief)
    : baseBrief;
  const mode = options.mode ?? "fast";
  const solverRequest = {
    brief,
    mode,
    timeBudgetMs: mode === "quality" ? 4500 : 900,
    footprint: createFootprintBounds(brief),
  } satisfies SpatialSolverRequest;
  const solverResult = await solveWithFallback(solverRequest);
  const candidates = solverResult.candidates;
  const validCandidates = candidates.filter((candidate) => validateCandidate(candidate, brief));

  if (!validCandidates.length) {
    throw new Error(`Planner solver returned ${solverResult.status} with no valid candidates.`);
  }

  const scored = validCandidates
    .map((candidate) => ({ ...candidate, score: scoreCandidate(candidate, brief) }))
    .sort((a, b) => (b.score?.total ?? 0) - (a.score?.total ?? 0));
  const selectedId = options.genAI && options.modelName
    ? await selectCandidateWithAI(options.genAI, options.modelName, prompt, brief, scored.slice(0, 5))
    : null;
  const selected = enforceCriticalAdjacencies(scored.find((candidate) => candidate.id === selectedId) ?? scored[0], brief);
  const floorPlan = assembleFloorPlan(selected, brief, solverResult);
  const rationale = buildRationale(selected, brief, solverResult);

  return {
    floorPlan,
    rationale,
    generationNotes: floorPlan.generationNotes ?? [],
    solver: {
      backend: solverResult.backend,
      status: solverResult.status,
      elapsedMs: solverResult.elapsedMs,
      exploredCandidates: solverResult.exploredCandidates,
    },
  };
}

export function inferBrief(prompt: string, userType: UserType | null = null): PlannerBrief {
  const lower = prompt.toLowerCase();
  const bedroomCount = inferBedroomCount(lower);
  const targetAreaSqm = inferTargetArea(lower, bedroomCount);
  const siteShape = inferSiteShape(lower);
  const rooms = buildRoomProgram(lower, bedroomCount);
  const unsupportedRequests = detectUnsupportedRequests(lower);

  return {
    userType,
    projectType: inferProjectType(lower, bedroomCount),
    targetAreaSqm,
    areaTolerance: Math.max(12, Math.round(targetAreaSqm * 0.12)),
    siteShape,
    frontDoorSide: lower.includes("rear entry") ? "bottom" : "top",
    rooms,
    mustHave: rooms.map((room) => room.type),
    niceToHave: [
      lower.includes("open") ? "open public zone" : "balanced room flow",
      siteShape !== "rectangle" ? `${siteShape.replace("_", "-")} footprint` : "simple footprint",
    ],
    unsupportedRequests,
  };
}

function inferBedroomCount(lower: string): number {
  const explicit = lower.match(/\b([1-4])\s*(?:bed|bedroom|bedrooms)\b/);
  if (explicit) return Number(explicit[1]);
  if (/\bstudio\b/.test(lower)) return 0;
  if (/\bvilla\b|\bfamily\b|\bhome\b|\bhouse\b/.test(lower)) return 3;
  return 2;
}

function inferTargetArea(lower: string, bedroomCount: number): number {
  const requested = lower.match(/\b(\d{2,4})\s*(?:sqm|sq\.?\s*m|m2|m²|square\s+met(?:er|re)s?)\b/i);
  if (requested) return Number(requested[1]);
  if (bedroomCount === 0) return 55;
  if (bedroomCount === 1) return 72;
  if (bedroomCount === 2) return lower.includes("compact") ? 78 : 96;
  if (bedroomCount === 4) return lower.includes("builder") || lower.includes("spec") ? 176 : 190;
  return lower.includes("large") || lower.includes("villa") ? 165 : 135;
}

function inferSiteShape(lower: string): SiteShape {
  if (/\bnarrow|townhouse|terrace|row\s*house\b/.test(lower)) return "narrow_lot";
  if (/\bl[-\s]?shape|courtyard|corner\b/.test(lower)) return "l_shape";
  if (/\bu[-\s]?shape\b/.test(lower)) return "u_shape";
  if (/\bcourtyard\b/.test(lower)) return "courtyard";
  if (/\bstepped|split\s+mass\b/.test(lower)) return "stepped";
  return "rectangle";
}

function inferProjectType(lower: string, bedroomCount: number): PlannerBrief["projectType"] {
  if (bedroomCount === 0) return "studio";
  if (/\bunit|apartment|flat\b/.test(lower)) return "unit";
  if (/\bvilla|luxury|estate\b/.test(lower)) return "villa";
  if (/\bbuilder|spec|marketable|sellable\b/.test(lower)) return "builder_spec";
  if (/\bhome|house|family\b/.test(lower)) return "family_home";
  return "unknown_residential";
}

function buildRoomProgram(lower: string, bedroomCount: number): PlannerRoomSpec[] {
  const rooms: PlannerRoomSpec[] = [];
  const add = (room: Omit<PlannerRoomSpec, "id">) => {
    const existing = rooms.filter((candidate) => candidate.type === room.type).length;
    rooms.push({ ...room, id: existing ? `${room.type}_${existing + 1}` : room.type });
  };

  add(roomSpec("entry", "Entry", "public", 5, 1, ["living"]));

  if (bedroomCount === 0) {
    add(roomSpec("studio", "Living / Bedroom", "public", 24, 1.25, ["kitchen", "bathroom"]));
  } else {
    add(roomSpec("living", "Living Room", "public", lower.includes("large") ? 28 : 22, 1.5, ["entry", "kitchen", "dining"]));
    add(roomSpec("dining", "Dining", "public", 10, 1.3, ["living", "kitchen"]));
  }

  add(roomSpec("kitchen", lower.includes("large kitchen") ? "Large Kitchen" : "Kitchen", "public", lower.includes("large kitchen") ? 16 : 11, 1.4, ["living", "dining"]));

  if (bedroomCount > 0) {
    add(roomSpec("master_bedroom", "Master Bedroom", "private", 17, 1.35, ["ensuite", "hallway"]));
    add(roomSpec("ensuite", "Ensuite", "service", 4, 1, ["master_bedroom"]));
  }

  for (let i = 2; i <= bedroomCount; i += 1) {
    add(roomSpec("bedroom", `Bedroom ${i}`, "private", 12, 1.2, ["hallway", "bathroom"]));
  }

  if (/\bstudy|office\b/.test(lower)) add(roomSpec("study", "Study", "private", 9, 1.2, ["hallway"]));

  add(roomSpec("bathroom", "Bathroom", "service", 6, 1, ["hallway", "bedroom"]));
  add(roomSpec("laundry", "Laundry", "service", 4, 1.6, ["kitchen", "hallway"]));
  add(roomSpec("hallway", "Hallway", "service", bedroomCount >= 3 ? 8 : 5, 2.4, ["entry", "bedroom", "bathroom"]));

  if (/\bgarage|carport|parking\b/.test(lower) || bedroomCount === 4) {
    add(roomSpec("garage", "Garage", "public", 22, 1.35, ["entry", "laundry"]));
  }

  return rooms;
}

function roomSpec(
  type: string,
  label: string,
  zone: PrivacyZone,
  area: number,
  aspectRatio: number,
  adjacency: string[],
): Omit<PlannerRoomSpec, "id"> {
  return {
    type,
    label,
    zone,
    area,
    minWidth: MIN_ROOM_METERS,
    minDepth: MIN_ROOM_METERS,
    aspectRatio,
    requiresWindow: ["living", "studio", "master_bedroom", "bedroom", "study"].includes(type),
    adjacency,
  };
}

function detectUnsupportedRequests(lower: string): string[] {
  const unsupported: string[] = [];
  if (/\bsecond floor|two[-\s]?storey|multi[-\s]?storey|upstairs|stairs\b/.test(lower)) unsupported.push("multi-storey layout");
  if (/\bretail|office building|cafe|restaurant|clinic\b/.test(lower)) unsupported.push("full commercial layout");
  if (/\bstructural|code compliant|permit|construction drawing\b/.test(lower)) unsupported.push("code-certified construction documentation");
  return unsupported;
}

async function refineBriefWithAI(
  genAI: GoogleGenerativeAI,
  modelName: string,
  prompt: string,
  baseBrief: PlannerBrief,
): Promise<PlannerBrief> {
  try {
    const model = genAI.getGenerativeModel({ model: modelName, generationConfig: { responseMimeType: "application/json" } });
    const result = await model.generateContent(`Return only JSON updates for this architectural brief. Do not include coordinates.\nUser prompt: ${prompt}\nBase brief: ${JSON.stringify(baseBrief)}\nSchema: {"targetAreaSqm":number,"siteShape":"rectangle|l_shape|u_shape|courtyard|narrow_lot|stepped","projectType":"studio|unit|family_home|villa|builder_spec|unknown_residential","niceToHave":[string],"unsupportedRequests":[string]}`);
    const parsed = JSON.parse(result.response.text()) as Partial<PlannerBrief>;
    return {
      ...baseBrief,
      projectType: isProjectType(parsed.projectType) ? parsed.projectType : baseBrief.projectType,
      targetAreaSqm: validNumber(parsed.targetAreaSqm) ? parsed.targetAreaSqm : baseBrief.targetAreaSqm,
      siteShape: isSiteShape(parsed.siteShape) ? parsed.siteShape : baseBrief.siteShape,
      niceToHave: stringArray(parsed.niceToHave) ?? baseBrief.niceToHave,
      unsupportedRequests: Array.from(new Set([...baseBrief.unsupportedRequests, ...(stringArray(parsed.unsupportedRequests) ?? [])])),
    };
  } catch (error) {
    console.warn("[AI Planner] Brief refinement failed, using inferred brief:", error instanceof Error ? error.message : String(error));
    return baseBrief;
  }
}

function generateCandidates(brief: PlannerBrief, mode: GenerationMode): PlannerCandidate[] {
  const variants = mode === "quality" ? 120 : 56;
  const strategies: CandidateStrategy[] = ["graph_zone", "slicing_tree", "squarified_area", "boundary_seed", "mutated_refinement"];
  return Array.from({ length: variants }, (_, index) => generateCandidate(brief, index, strategies[index % strategies.length]));
}

async function solveWithFallback(request: SpatialSolverRequest): Promise<SpatialSolverResult> {
  const primarySolver = createSpatialSolver();
  try {
    const result = await primarySolver.solve(request);
    if (result.candidates.length) return result;
    return runTypeScriptFallback(request, `Primary solver returned ${result.status} with no candidates.`);
  } catch (error) {
    return runTypeScriptFallback(request, `Primary solver failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function createSpatialSolver(): SpatialSolver {
  const backend = process.env.SPATIAL_SOLVER_BACKEND?.trim().toLowerCase();
  if (backend === "ortools" || backend === "ortools_microservice") {
    return new OrToolsMicroserviceSpatialSolver(process.env.SPATIAL_SOLVER_URL ?? "http://127.0.0.1:8787/solve");
  }
  return new TypeScriptHybridSpatialSolver();
}

function runTypeScriptFallback(request: SpatialSolverRequest, reason: string): SpatialSolverResult {
  const fallback = new TypeScriptHybridSpatialSolver().solve(request);
  return {
    ...fallback,
    notes: [
      ...fallback.notes,
      reason,
      "Used TypeScript hybrid fallback after spatial solver backend failure.",
    ],
  };
}

class TypeScriptHybridSpatialSolver implements SpatialSolver {
  solve(request: SpatialSolverRequest): SpatialSolverResult {
    const startedAt = Date.now();
    const candidates = generateCandidates(request.brief, request.mode)
      .map((candidate) => annotateFootprintCompliance(candidate, request.footprint));

    return {
      backend: "typescript_hybrid",
      status: candidates.length ? "feasible" : "infeasible",
      candidates,
      elapsedMs: Date.now() - startedAt,
      exploredCandidates: candidates.length,
      notes: [
        `TypeScript hybrid solver explored ${candidates.length} candidates inside a ${request.footprint.shape.replaceAll("_", " ")} footprint envelope.`,
        "Solver boundary is compatible with a future OR-Tools CP-SAT microservice adapter.",
      ],
    };
  }
}

class OrToolsMicroserviceSpatialSolver implements SpatialSolver {
  private readonly endpoint: string;

  constructor(endpoint: string) {
    this.endpoint = endpoint;
  }

  async solve(request: SpatialSolverRequest): Promise<SpatialSolverResult> {
    const startedAt = Date.now();
    const response = await fetch(this.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(serializeSolverRequest(request)),
      signal: AbortSignal.timeout(request.timeBudgetMs + 500),
    });

    if (!response.ok) {
      throw new Error(`OR-Tools solver responded with ${response.status}`);
    }

    const payload = await response.json() as Partial<SpatialSolverResult>;
    const candidates = Array.isArray(payload.candidates)
      ? payload.candidates.map(coercePlannerCandidate).filter((candidate): candidate is PlannerCandidate => candidate !== null)
      : [];

    return {
      backend: "ortools_microservice",
      status: isSpatialSolverStatus(payload.status) ? payload.status : candidates.length ? "feasible" : "infeasible",
      candidates,
      elapsedMs: typeof payload.elapsedMs === "number" ? payload.elapsedMs : Date.now() - startedAt,
      exploredCandidates: typeof payload.exploredCandidates === "number" ? payload.exploredCandidates : candidates.length,
      notes: [
        "OR-Tools microservice adapter returned candidate geometry.",
        ...(stringArray(payload.notes) ?? []),
      ],
    };
  }
}

void OrToolsMicroserviceSpatialSolver;

function serializeSolverRequest(request: SpatialSolverRequest) {
  return {
    brief: request.brief,
    mode: request.mode,
    timeBudgetMs: request.timeBudgetMs,
    footprint: request.footprint,
    grid: GRID,
  };
}

function coercePlannerCandidate(value: unknown): PlannerCandidate | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<PlannerCandidate>;
  const rooms = Array.isArray(candidate.rooms)
    ? candidate.rooms.map(coerceRoom).filter((room): room is Room => room !== null)
    : [];
  if (!rooms.length) return null;

  return {
    id: typeof candidate.id === "string" ? candidate.id : "ortools_candidate",
    rooms,
    totalArea: typeof candidate.totalArea === "number" ? candidate.totalArea : areaOfRooms(rooms),
    notes: stringArray(candidate.notes) ?? [],
    footprintOverflowMeters: typeof candidate.footprintOverflowMeters === "number" ? candidate.footprintOverflowMeters : undefined,
    sharedWalls: coerceSharedWalls((candidate as { sharedWalls?: unknown }).sharedWalls),
  };
}

function coerceSharedWalls(value: unknown): SharedWallEvidence[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const sharedWalls = value.map(coerceSharedWall).filter((sharedWall): sharedWall is SharedWallEvidence => sharedWall !== null);
  return sharedWalls.length ? sharedWalls : undefined;
}

function coerceSharedWall(value: unknown): SharedWallEvidence | null {
  if (!value || typeof value !== "object") return null;
  const sharedWall = value as Partial<SharedWallEvidence>;
  if (typeof sharedWall.roomA !== "string" || typeof sharedWall.roomB !== "string") return null;
  if (!isWallSide(sharedWall.wallA) || !isWallSide(sharedWall.wallB)) return null;
  if (typeof sharedWall.sharedLength !== "number" || !Number.isFinite(sharedWall.sharedLength)) return null;
  if (typeof sharedWall.positionA !== "number" || !Number.isFinite(sharedWall.positionA)) return null;
  if (typeof sharedWall.positionB !== "number" || !Number.isFinite(sharedWall.positionB)) return null;
  return {
    roomA: sharedWall.roomA,
    roomB: sharedWall.roomB,
    wallA: sharedWall.wallA,
    wallB: sharedWall.wallB,
    sharedLength: sharedWall.sharedLength,
    positionA: clampUnit(sharedWall.positionA),
    positionB: clampUnit(sharedWall.positionB),
  };
}

function isWallSide(value: unknown): value is WallSide {
  return value === "top" || value === "bottom" || value === "left" || value === "right";
}

function clampUnit(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}

function coerceRoom(value: unknown): Room | null {
  if (!value || typeof value !== "object") return null;
  const room = value as Partial<Room>;
  if (typeof room.id !== "string" || typeof room.type !== "string" || typeof room.label !== "string") return null;
  const { x, y, width, height } = room;
  if (typeof x !== "number" || !Number.isFinite(x)) return null;
  if (typeof y !== "number" || !Number.isFinite(y)) return null;
  if (typeof width !== "number" || !Number.isFinite(width)) return null;
  if (typeof height !== "number" || !Number.isFinite(height)) return null;
  return snapRoom({ id: room.id, type: room.type, label: room.label, x, y, width, height });
}

function isSpatialSolverStatus(value: unknown): value is SpatialSolverStatus {
  return value === "feasible" || value === "timeout" || value === "infeasible";
}

function createFootprintBounds(brief: PlannerBrief): FootprintBounds {
  const totalRoomArea = brief.rooms.reduce((sum, room) => sum + room.area, 0);
  const area = Math.max(brief.targetAreaSqm, Math.round(totalRoomArea * 1.18));
  const aspect = footprintAspectRatio(brief.siteShape, brief.projectType);
  const widthMeters = Math.max(8, Math.round(Math.sqrt(area * aspect)));
  const heightMeters = Math.max(8, Math.ceil(area / widthMeters));

  return {
    width: widthMeters * GRID,
    height: heightMeters * GRID,
    shape: brief.siteShape,
  };
}

function footprintAspectRatio(siteShape: SiteShape, projectType: PlannerBrief["projectType"]): number {
  if (siteShape === "narrow_lot") return 0.58;
  if (siteShape === "l_shape" || siteShape === "u_shape" || siteShape === "courtyard") return 1.45;
  if (projectType === "builder_spec") return 1.55;
  if (projectType === "unit" || projectType === "studio") return 1.35;
  return 1.65;
}

function annotateFootprintCompliance(candidate: PlannerCandidate, footprint: FootprintBounds): PlannerCandidate {
  const bounds = getBounds(candidate.rooms);
  const outsideWidth = Math.max(0, bounds.width - footprint.width);
  const outsideHeight = Math.max(0, bounds.height - footprint.height);
  const overflowMeters = Math.round((outsideWidth + outsideHeight) / GRID);
  const notes = overflowMeters > 0
    ? [...candidate.notes, `Footprint envelope overflow: ${overflowMeters}m adjusted by scoring rather than hard rejection.`]
    : [...candidate.notes, `Fits the ${Math.round(footprint.width / GRID)}m x ${Math.round(footprint.height / GRID)}m footprint envelope.`];

  return { ...candidate, notes, footprintOverflowMeters: overflowMeters };
}

function generateCandidate(brief: PlannerBrief, index: number, strategy: CandidateStrategy): PlannerCandidate {
  const seed = hash(`${brief.projectType}:${brief.siteShape}:${brief.targetAreaSqm}:${index}`);
  const orderedSpecs = orderSpecsForStrategy(brief, strategy, seed);
  const placed = placeRoomsByGraph(brief, orderedSpecs, seed, strategy);
  const optimized = optimizeCandidateGeometry(placed, brief, seed, strategy === "mutated_refinement" ? 18 : 8);
  const normalized = normalizeRooms(optimized);
  const totalArea = Math.round(normalized.reduce((sum, room) => sum + (room.width * room.height) / (GRID * GRID), 0));

  return {
    id: `planner_${brief.siteShape}_${strategy}_${index + 1}`,
    rooms: normalized,
    totalArea,
    notes: [
      `Generated with ${strategy.replaceAll("_", " ")} geometry from a room adjacency graph.`,
      "Used graph placement, footprint-aware partitioning, and local-search refinement instead of fixed template coordinates.",
    ],
  };
}

function orderSpecsForStrategy(brief: PlannerBrief, strategy: CandidateStrategy, seed: number): PlannerRoomSpec[] {
  const publicRooms = brief.rooms.filter((room) => room.zone === "public");
  const privateRooms = brief.rooms.filter((room) => room.zone === "private");
  const serviceRooms = brief.rooms.filter((room) => room.zone === "service");
  const byArea = [...brief.rooms].sort((a, b) => b.area - a.area);
  const anchoredPublic = sortByAnchorPriority(publicRooms, ["entry", "garage", "living", "studio", "kitchen", "dining"]);
  const anchoredService = sortByAnchorPriority(serviceRooms, ["hallway", "bathroom", "ensuite", "laundry"]);
  const anchoredPrivate = sortByAnchorPriority(privateRooms, ["master_bedroom", "bedroom", "study"]);

  if (strategy === "squarified_area") {
    return interleaveByAreaAndZone(byArea, seed);
  }

  if (strategy === "slicing_tree") {
    return seed % 2 === 0
      ? [...anchoredPublic, ...anchoredService, ...anchoredPrivate]
      : [...anchoredPublic, ...anchoredPrivate, ...anchoredService];
  }

  if (strategy === "boundary_seed") {
    return [...anchoredPublic, ...anchoredPrivate, ...anchoredService];
  }

  if (strategy === "mutated_refinement") {
    return seededShuffle([...anchoredPublic, ...anchoredService, ...anchoredPrivate], seed);
  }

  return [...anchoredPublic, ...anchoredService, ...anchoredPrivate];
}

function sortByAnchorPriority(rooms: PlannerRoomSpec[], priority: string[]): PlannerRoomSpec[] {
  return [...rooms].sort((a, b) => {
    const ai = priority.includes(a.type) ? priority.indexOf(a.type) : priority.length;
    const bi = priority.includes(b.type) ? priority.indexOf(b.type) : priority.length;
    return ai - bi || b.area - a.area;
  });
}

function interleaveByAreaAndZone(rooms: PlannerRoomSpec[], seed: number): PlannerRoomSpec[] {
  const buckets: Record<PrivacyZone, PlannerRoomSpec[]> = { public: [], private: [], service: [] };
  rooms.forEach((room) => buckets[room.zone].push(room));
  const order: PrivacyZone[] = seed % 2 === 0 ? ["public", "service", "private"] : ["public", "private", "service"];
  const result: PlannerRoomSpec[] = [];
  while (Object.values(buckets).some((bucket) => bucket.length)) {
    order.forEach((zone) => {
      const next = buckets[zone].shift();
      if (next) result.push(next);
    });
  }
  return result;
}

function seededShuffle<T>(items: T[], seed: number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = hash(`${seed}:${i}`) % (i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function placeRoomsByGraph(
  brief: PlannerBrief,
  specs: PlannerRoomSpec[],
  seed: number,
  strategy: CandidateStrategy,
): Room[] {
  const rooms: Room[] = [];
  for (const spec of specs) {
    const size = sizeFor(spec);
    const placements = candidatePlacementsForRoom(spec, size, rooms, brief, seed, strategy);
    const best = placements
      .filter((candidate) => !overlapsAny(candidate, rooms))
      .sort((a, b) => scorePlacement(b, spec, rooms, brief, strategy) - scorePlacement(a, spec, rooms, brief, strategy))[0];
    rooms.push(best ?? fallbackPlacement(spec, size, rooms));
  }
  return rooms;
}

function candidatePlacementsForRoom(
  spec: PlannerRoomSpec,
  size: { width: number; height: number },
  placed: Room[],
  brief: PlannerBrief,
  seed: number,
  strategy: CandidateStrategy,
): Room[] {
  const base = { id: uniqueRoomId(placed, spec.id), type: spec.type, label: spec.label, width: size.width, height: size.height };
  if (!placed.length) return [{ ...base, x: 0, y: 0 }];

  const anchors = findPlacementAnchors(spec, placed, brief);
  const bounds = getBounds(placed);
  const boundaryAnchors = [
    { x: bounds.x, y: bounds.y },
    { x: bounds.x + bounds.width, y: bounds.y },
    { x: bounds.x, y: bounds.y + bounds.height },
    { x: bounds.x + Math.round(bounds.width / 2 / GRID) * GRID, y: bounds.y + bounds.height },
  ];
  const candidates: Room[] = [];

  for (const anchor of anchors) {
    candidates.push(
      { ...base, x: anchor.x + anchor.width, y: anchor.y },
      { ...base, x: anchor.x - size.width, y: anchor.y },
      { ...base, x: anchor.x, y: anchor.y + anchor.height },
      { ...base, x: anchor.x, y: anchor.y - size.height },
      { ...base, x: anchor.x + anchor.width, y: anchor.y + anchor.height - size.height },
      { ...base, x: anchor.x + anchor.width - size.width, y: anchor.y + anchor.height },
    );
  }

  for (const point of boundaryAnchors) {
    const offset = footprintOffset(brief.siteShape, placed.length, seed, strategy);
    candidates.push({ ...base, x: point.x + offset.x, y: point.y + offset.y });
  }

  return dedupeRooms(candidates.map(snapRoom));
}

function findPlacementAnchors(spec: PlannerRoomSpec, placed: Room[], brief: PlannerBrief): Room[] {
  const preferred = placed.filter((room) => spec.adjacency.includes(room.type) || spec.adjacency.includes(room.id));
  const reversePreferred = placed.filter((room) => {
    const source = brief.rooms.find((candidate) => candidate.id === room.id || candidate.type === room.type);
    return source?.adjacency.includes(spec.type) || source?.adjacency.includes(spec.id);
  });
  const zoneAnchors = placed.filter((room) => zoneForRoom(room.type) === spec.zone);
  return [...preferred, ...reversePreferred, ...zoneAnchors, ...placed].filter((room, index, all) => all.findIndex((candidate) => candidate.id === room.id) === index);
}

function footprintOffset(siteShape: SiteShape, index: number, seed: number, strategy: CandidateStrategy): { x: number; y: number } {
  const direction = (seed + index) % 4;
  if (siteShape === "narrow_lot") return { x: 0, y: GRID };
  if (siteShape === "l_shape") return index > 4 ? { x: GRID * 2, y: 0 } : { x: 0, y: 0 };
  if (siteShape === "u_shape") return index % 3 === 1 ? { x: GRID * 2, y: GRID } : { x: 0, y: 0 };
  if (siteShape === "courtyard") return index % 4 === 2 ? { x: GRID * 2, y: GRID * 2 } : { x: 0, y: 0 };
  if (siteShape === "stepped" || strategy === "boundary_seed") return { x: direction === 0 ? GRID : 0, y: direction === 1 ? GRID : 0 };
  return { x: 0, y: 0 };
}

function fallbackPlacement(spec: PlannerRoomSpec, size: { width: number; height: number }, placed: Room[]): Room {
  const bounds = getBounds(placed);
  return snapRoom({
    id: uniqueRoomId(placed, spec.id),
    type: spec.type,
    label: spec.label,
    x: bounds.x + bounds.width,
    y: bounds.y,
    width: size.width,
    height: size.height,
  });
}

function scorePlacement(room: Room, spec: PlannerRoomSpec, placed: Room[], brief: PlannerBrief, strategy: CandidateStrategy): number {
  const nextRooms = [...placed, room];
  const bounds = getBounds(nextRooms);
  const adjacentTouches = placed.filter((candidate) => roomsTouch(candidate, room)).length;
  const preferredTouches = placed.filter((candidate) => (spec.adjacency.includes(candidate.type) || spec.adjacency.includes(candidate.id)) && roomsTouch(candidate, room)).length;
  const preferredNear = placed.filter((candidate) => (spec.adjacency.includes(candidate.type) || spec.adjacency.includes(candidate.id)) && roomDistance(candidate, room) <= GRID * 2).length;
  const exteriorBonus = spec.requiresWindow && touchesExterior(room, bounds) ? 18 : 0;
  const compactnessPenalty = ((bounds.width * bounds.height) - nextRooms.reduce((sum, item) => sum + item.width * item.height, 0)) / (GRID * GRID);
  const privacyBonus = spec.zone === "private" ? distanceFromPublic(room, placed) / GRID : 0;
  const shapeBonus = siteShapePlacementBonus(room, bounds, brief.siteShape, strategy);
  return preferredTouches * 34 + preferredNear * 18 + adjacentTouches * 8 + exteriorBonus + privacyBonus + shapeBonus - compactnessPenalty * 1.8;
}

function optimizeCandidateGeometry(rooms: Room[], brief: PlannerBrief, seed: number, iterations: number): Room[] {
  let current = normalizeRooms(rooms);
  let currentScore = scoreCandidate({ id: "optimizing", rooms: current, totalArea: areaOfRooms(current), notes: [] }, brief).total;

  for (let step = 0; step < iterations; step += 1) {
    const roomIndex = hash(`${seed}:room:${step}`) % current.length;
    const moveIndex = hash(`${seed}:move:${step}`) % 8;
    const moved = current.map((room, index) => index === roomIndex ? moveRoom(room, moveIndex) : room);
    const normalized = normalizeRooms(moved);
    if (hasOverlap(normalized)) continue;
    const nextScore = scoreCandidate({ id: "optimizing", rooms: normalized, totalArea: areaOfRooms(normalized), notes: [] }, brief).total;
    if (nextScore >= currentScore) {
      current = normalized;
      currentScore = nextScore;
    }
  }

  return current;
}

function moveRoom(room: Room, moveIndex: number): Room {
  const moves = [
    { x: GRID, y: 0 }, { x: -GRID, y: 0 }, { x: 0, y: GRID }, { x: 0, y: -GRID },
    { x: GRID, y: GRID }, { x: -GRID, y: GRID }, { x: GRID, y: -GRID }, { x: -GRID, y: -GRID },
  ];
  const move = moves[moveIndex];
  return { ...room, x: room.x + move.x, y: room.y + move.y };
}

function sizeFor(room: PlannerRoomSpec): { width: number; height: number } {
  const widthMeters = Math.max(room.minWidth, Math.sqrt(room.area * room.aspectRatio));
  const heightMeters = Math.max(room.minDepth, room.area / widthMeters);
  return {
    width: Math.max(GRID * MIN_ROOM_METERS, Math.round(widthMeters) * GRID),
    height: Math.max(GRID * MIN_ROOM_METERS, Math.round(heightMeters) * GRID),
  };
}

function normalizeRooms(rooms: Room[]): Room[] {
  const minX = Math.min(...rooms.map((room) => room.x));
  const minY = Math.min(...rooms.map((room) => room.y));
  return rooms.map((room) => ({ ...room, x: room.x - minX, y: room.y - minY }));
}

function uniqueRoomId(existing: Room[], baseId: string): string {
  if (!existing.some((room) => room.id === baseId)) return baseId;
  let index = 2;
  while (existing.some((room) => room.id === `${baseId}_${index}`)) index += 1;
  return `${baseId}_${index}`;
}

function validateCandidate(candidate: PlannerCandidate, brief: PlannerBrief): boolean {
  if (candidate.rooms.length !== brief.rooms.length) return false;
  if (hasOverlap(candidate.rooms)) return false;
  if (candidate.rooms.some((room) => room.width < GRID * MIN_ROOM_METERS || room.height < GRID * MIN_ROOM_METERS)) return false;
  if ((candidate.footprintOverflowMeters ?? 0) > Math.max(8, Math.round(brief.targetAreaSqm * 0.06))) return false;
  if (!hasBasicCirculation(candidate.rooms)) return false;
  return brief.rooms.every((spec) => candidate.rooms.some((room) => room.type === spec.type));
}

function snapRoom(room: Room): Room {
  return {
    ...room,
    x: Math.round(room.x / GRID) * GRID,
    y: Math.round(room.y / GRID) * GRID,
    width: Math.round(room.width / GRID) * GRID,
    height: Math.round(room.height / GRID) * GRID,
  };
}

function dedupeRooms(rooms: Room[]): Room[] {
  const seen = new Set<string>();
  return rooms.filter((room) => {
    const key = `${room.x}:${room.y}:${room.width}:${room.height}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function overlapsAny(room: Room, rooms: Room[]): boolean {
  return rooms.some((candidate) => room.x < candidate.x + candidate.width
    && room.x + room.width > candidate.x
    && room.y < candidate.y + candidate.height
    && room.y + room.height > candidate.y);
}

function areaOfRooms(rooms: Room[]): number {
  return Math.round(rooms.reduce((sum, room) => sum + (room.width * room.height) / (GRID * GRID), 0));
}

function hasOverlap(rooms: Room[]): boolean {
  for (let i = 0; i < rooms.length; i += 1) {
    for (let j = i + 1; j < rooms.length; j += 1) {
      const a = rooms[i];
      const b = rooms[j];
      if (a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y) return true;
    }
  }
  return false;
}

function hasBasicCirculation(rooms: Room[]): boolean {
  const entry = rooms.find((room) => room.type === "entry");
  if (!entry) return false;
  const publicTarget = rooms.find((room) => ["living", "studio"].includes(room.type));
  const privateTargets = rooms.filter((room) => zoneForRoom(room.type) === "private");
  if (publicTarget && !isReachable(rooms, entry.id, publicTarget.id)) return false;
  if (privateTargets.length && !privateTargets.some((room) => isReachable(rooms, entry.id, room.id))) return false;
  return countReachableRooms(rooms, entry.id) >= Math.ceil(rooms.length * 0.65);
}

function countReachableRooms(rooms: Room[], startId: string): number {
  const seen = new Set<string>();
  const queue = [startId];

  while (queue.length) {
    const currentId = queue.shift();
    if (!currentId || seen.has(currentId)) continue;
    seen.add(currentId);
    const current = rooms.find((room) => room.id === currentId);
    if (!current) continue;
    for (const next of rooms) {
      if (!seen.has(next.id) && roomsCirculate(current, next)) queue.push(next.id);
    }
  }

  return seen.size;
}

function isReachable(rooms: Room[], startId: string, targetId: string): boolean {
  const seen = new Set<string>();
  const queue = [startId];

  while (queue.length) {
    const currentId = queue.shift();
    if (!currentId || seen.has(currentId)) continue;
    if (currentId === targetId) return true;
    seen.add(currentId);
    const current = rooms.find((room) => room.id === currentId);
    if (!current) continue;
    for (const next of rooms) {
      if (!seen.has(next.id) && roomsCirculate(current, next)) queue.push(next.id);
    }
  }

  return false;
}

function roomsCirculate(a: Room, b: Room): boolean {
  if (sharedWallLength(a, b) >= GRID) return true;
  const includesTransition = [a.type, b.type].some((type) => type === "hallway" || type === "entry");
  return includesTransition && roomDistance(a, b) <= GRID * 2;
}

function scoreCandidate(candidate: PlannerCandidate, brief: PlannerBrief): PlannerScore {
  const areaFit = clampScore(100 - (Math.abs(candidate.totalArea - brief.targetAreaSqm) / Math.max(brief.areaTolerance, 1)) * 22);
  const adjacency = scoreAdjacency(candidate, brief);
  const privacy = scorePrivacy(candidate);
  const circulation = scoreCirculation(candidate);
  const daylight = scoreDaylight(candidate, brief);
  const wetRoomClustering = scoreWetRoomClustering(candidate);
  const buildability = scoreBuildability(candidate, brief);
  const wallSharing = scoreWallSharing(candidate, brief);
  const roleFit = scoreRoleFit({ areaFit, adjacency, privacy, circulation, daylight, wetRoomClustering, buildability, wallSharing }, brief.userType);
  const total = Math.round(areaFit * 0.14 + adjacency * 0.16 + privacy * 0.12 + circulation * 0.13 + daylight * 0.11 + wetRoomClustering * 0.09 + buildability * 0.08 + wallSharing * 0.09 + roleFit * 0.08);

  return { total, areaFit, adjacency, privacy, circulation, daylight, wetRoomClustering, buildability, wallSharing, roleFit };
}

function scoreAdjacency(candidate: PlannerCandidate, brief: PlannerBrief): number {
  let hits = 0;
  let checks = 0;
  for (const spec of brief.rooms) {
    const room = candidate.rooms.find((candidateRoom) => candidateRoom.id === spec.id || candidateRoom.type === spec.type);
    if (!room) continue;
    for (const adjacentType of spec.adjacency) {
      const target = candidate.rooms.find((candidateRoom) => candidateRoom.type === adjacentType || candidateRoom.id === adjacentType);
      if (!target) continue;
      checks += 1;
      if (roomsTouch(room, target) || roomDistance(room, target) <= GRID * 1.5) hits += 1;
    }
  }
  return checks ? Math.round((hits / checks) * 100) : 75;
}

function scorePrivacy(candidate: PlannerCandidate): number {
  const publicRooms = candidate.rooms.filter((room) => ["living", "dining", "kitchen", "entry", "garage", "studio"].includes(room.type));
  const privateRooms = candidate.rooms.filter((room) => ["master_bedroom", "bedroom", "study"].includes(room.type));
  if (!publicRooms.length || !privateRooms.length) return 80;
  const avgDistance = privateRooms.reduce((sum, room) => sum + Math.min(...publicRooms.map((publicRoom) => roomDistance(room, publicRoom))), 0) / privateRooms.length;
  return clampScore(45 + avgDistance / GRID * 8);
}

function scoreCirculation(candidate: PlannerCandidate): number {
  const entry = candidate.rooms.find((room) => room.type === "entry");
  const hallway = candidate.rooms.find((room) => room.type === "hallway");
  if (!entry) return 50;
  const connectedLiving = candidate.rooms.some((room) => ["living", "studio"].includes(room.type) && (roomsTouch(entry, room) || roomDistance(entry, room) <= GRID));
  const hallwayReach = hallway ? candidate.rooms.filter((room) => roomsTouch(hallway, room) || roomDistance(hallway, room) <= GRID).length : 0;
  const reachable = countReachableRooms(candidate.rooms, entry.id);
  const privateReach = candidate.rooms
    .filter((room) => zoneForRoom(room.type) === "private")
    .filter((room) => isReachable(candidate.rooms, entry.id, room.id)).length;
  return clampScore((connectedLiving ? 30 : 10) + hallwayReach * 5 + (reachable / candidate.rooms.length) * 35 + privateReach * 5);
}

function scoreDaylight(candidate: PlannerCandidate, brief: PlannerBrief): number {
  const bounds = getBounds(candidate.rooms);
  const required = brief.rooms.filter((room) => room.requiresWindow);
  if (!required.length) return 80;
  const hits = required.filter((spec) => {
    const room = candidate.rooms.find((candidateRoom) => candidateRoom.id === spec.id || candidateRoom.type === spec.type);
    return room && touchesExterior(room, bounds);
  }).length;
  return Math.round((hits / required.length) * 100);
}

function scoreWetRoomClustering(candidate: PlannerCandidate): number {
  const wetRooms = candidate.rooms.filter((room) => ["bathroom", "ensuite", "laundry", "kitchen"].includes(room.type));
  if (wetRooms.length < 2) return 80;
  let total = 0;
  let pairs = 0;
  for (let i = 0; i < wetRooms.length; i += 1) {
    for (let j = i + 1; j < wetRooms.length; j += 1) {
      total += roomDistance(wetRooms[i], wetRooms[j]);
      pairs += 1;
    }
  }
  return clampScore(100 - (total / pairs / GRID) * 7);
}

function scoreWallSharing(candidate: PlannerCandidate, brief: PlannerBrief): number {
  let hits = 0;
  let checks = 0;
  for (const spec of brief.rooms) {
    const room = candidate.rooms.find((candidateRoom) => candidateRoom.id === spec.id || candidateRoom.type === spec.type);
    if (!room) continue;
    for (const adjacentType of spec.adjacency) {
      const target = candidate.rooms.find((candidateRoom) => candidateRoom.id === adjacentType || candidateRoom.type === adjacentType);
      if (!target) continue;
      checks += 1;
      if (sharedWallLength(room, target) >= GRID) hits += 1;
    }
  }
  return checks ? Math.round((hits / checks) * 100) : 70;
}

function scoreBuildability(candidate: PlannerCandidate, brief: PlannerBrief): number {
  const bounds = getBounds(candidate.rooms);
  const footprintRatio = (bounds.width * bounds.height) / Math.max(candidate.rooms.reduce((sum, room) => sum + room.width * room.height, 0), 1);
  const shapePenalty = brief.siteShape === "rectangle" || brief.siteShape === "narrow_lot" ? 0 : 8;
  const overflowPenalty = (candidate.footprintOverflowMeters ?? 0) * 3;
  return clampScore(110 - footprintRatio * 18 - shapePenalty - overflowPenalty);
}

function scoreRoleFit(scores: Omit<PlannerScore, "total" | "roleFit">, userType: UserType | null): number {
  if (userType === "architect_designer") return Math.round(scores.adjacency * 0.26 + scores.wallSharing * 0.22 + scores.privacy * 0.18 + scores.circulation * 0.18 + scores.buildability * 0.16);
  if (userType === "real_estate_builder") return Math.round(scores.areaFit * 0.24 + scores.buildability * 0.28 + scores.circulation * 0.18 + scores.wetRoomClustering * 0.16 + scores.wallSharing * 0.14);
  return Math.round(scores.privacy * 0.24 + scores.daylight * 0.24 + scores.adjacency * 0.2 + scores.wallSharing * 0.16 + scores.circulation * 0.16);
}

async function selectCandidateWithAI(
  genAI: GoogleGenerativeAI,
  modelName: string,
  prompt: string,
  brief: PlannerBrief,
  candidates: PlannerCandidate[],
): Promise<string | null> {
  try {
    const model = genAI.getGenerativeModel({ model: modelName, generationConfig: { responseMimeType: "application/json" } });
    const summary = candidates.map((candidate) => ({ id: candidate.id, totalArea: candidate.totalArea, score: candidate.score, roomCount: candidate.rooms.length, notes: candidate.notes }));
    const result = await model.generateContent(`You are an architectural critic. Select one candidate ID only from the provided list. Do not invent geometry.\nPrompt: ${prompt}\nBrief: ${JSON.stringify({ userType: brief.userType, projectType: brief.projectType, siteShape: brief.siteShape, targetAreaSqm: brief.targetAreaSqm })}\nCandidates: ${JSON.stringify(summary)}\nReturn JSON: {"selectedCandidateId":"candidate id","reason":"short reason"}`);
    const parsed = JSON.parse(result.response.text()) as { selectedCandidateId?: string };
    return candidates.some((candidate) => candidate.id === parsed.selectedCandidateId) ? parsed.selectedCandidateId ?? null : null;
  } catch (error) {
    console.warn("[AI Planner] Critic selection failed, using top scored candidate:", error instanceof Error ? error.message : String(error));
    return null;
  }
}

function assembleFloorPlan(candidate: PlannerCandidate, brief: PlannerBrief, solverResult: SpatialSolverResult): FloorPlan {
  const unsupportedNotes = brief.unsupportedRequests.map((item) => `Unsupported request not applied: ${item}.`);
  const score = candidate.score;
  const solverDoors = buildSolverInformedDoors(candidate, brief);
  const plan = regenerateMaterials(regenerateFurniture(regenerateOpenings({
    rooms: candidate.rooms,
    doors: solverDoors,
    windows: [],
    totalArea: candidate.totalArea,
    template: "ai_planner",
    generationNotes: [
      "Generated by the role-aware AI planner from spatial constraints, not fixed template coordinates.",
      `Spatial solver backend: ${solverResult.backend}; status: ${solverResult.status}; explored ${solverResult.exploredCandidates} candidates in ${solverResult.elapsedMs}ms.`,
      ...solverResult.notes,
      `Planner selected ${candidate.id}${score ? ` with score ${score.total}/100` : ""} for a ${brief.projectType.replaceAll("_", " ")} brief.`,
      ...candidate.notes,
      ...unsupportedNotes,
    ],
  })));
  return plan;
}

function enforceCriticalAdjacencies(candidate: PlannerCandidate, brief: PlannerBrief): PlannerCandidate {
  let rooms = candidate.rooms.map((room) => ({ ...room }));
  for (const spec of brief.rooms) {
    const room = findRoomForSpec(rooms, spec.id, spec.type);
    if (!room) continue;

    for (const adjacentType of spec.adjacency) {
      const target = findRoomForSpec(rooms, adjacentType, adjacentType);
      if (!target || !isCriticalAdjacencyPair(room.type, target.type) || sharedWallLength(room, target) >= GRID) continue;
      rooms = moveRoomNextToTarget(rooms, room.id, target.id);
    }
  }

  return {
    ...candidate,
    rooms,
    sharedWalls: deriveSharedWalls(rooms),
    notes: [
      ...candidate.notes,
      "Planner repaired critical adjacencies into door-ready shared walls where feasible.",
    ],
  };
}

function findRoomForSpec(rooms: Room[], id: string, type: string): Room | undefined {
  return rooms.find((room) => room.id === id) ?? rooms.find((room) => room.type === type);
}

function moveRoomNextToTarget(rooms: Room[], roomId: string, targetId: string): Room[] {
  const room = rooms.find((candidate) => candidate.id === roomId);
  const target = rooms.find((candidate) => candidate.id === targetId);
  if (!room || !target) return rooms;

  const movedRoom = placeRoomBeside(rooms, room, target);
  if (movedRoom) return movedRoom;

  return placeRoomBeside(rooms, target, room) ?? rooms;
}

function placeRoomBeside(rooms: Room[], room: Room, target: Room): Room[] | null {
  const placements = adjacentPlacements(room, target);

  const others = rooms.filter((candidate) => candidate.id !== room.id);
  const placement = placements.find((candidate) => !overlapsAny(candidate, others));
  return placement ? rooms.map((candidate) => candidate.id === room.id ? placement : candidate) : null;
}

function adjacentPlacements(room: Room, target: Room): Room[] {
  const placements: Room[] = [];
  const verticalStart = target.y - room.height + GRID;
  const verticalEnd = target.y + target.height - GRID;
  for (let y = verticalStart; y <= verticalEnd; y += GRID) {
    placements.push({ ...room, x: target.x + target.width, y });
    placements.push({ ...room, x: target.x - room.width, y });
  }

  const horizontalStart = target.x - room.width + GRID;
  const horizontalEnd = target.x + target.width - GRID;
  for (let x = horizontalStart; x <= horizontalEnd; x += GRID) {
    placements.push({ ...room, x, y: target.y + target.height });
    placements.push({ ...room, x, y: target.y - room.height });
  }

  return placements.toSorted((a, b) => Math.abs(a.x) + Math.abs(a.y) - Math.abs(b.x) - Math.abs(b.y));
}

function isCriticalAdjacencyPair(a: string, b: string): boolean {
  const pair = new Set([a, b]);
  if (pair.has("master_bedroom") && pair.has("ensuite")) return true;
  if (pair.has("hallway") && [...pair].some((type) => ["master_bedroom", "bedroom", "bathroom", "study"].includes(type))) return true;
  if (pair.has("entry") && (pair.has("living") || pair.has("studio"))) return true;
  if (pair.has("kitchen") && pair.has("dining")) return true;
  return false;
}

function buildSolverInformedDoors(candidate: PlannerCandidate, brief: PlannerBrief): Door[] {
  const roomsById = new Map(candidate.rooms.map((room) => [room.id, room]));
  const roomsByType = new Map<string, Room[]>();
  for (const room of candidate.rooms) {
    const existing = roomsByType.get(room.type) ?? [];
    existing.push(room);
    roomsByType.set(room.type, existing);
  }

  const adjacencyPairs = new Set<string>();
  for (const spec of brief.rooms) {
    const sourceRooms = candidate.rooms.filter((room) => room.id === spec.id || room.type === spec.type);
    for (const adjacent of spec.adjacency) {
      const targetRooms = roomsById.has(adjacent) ? [roomsById.get(adjacent)!] : roomsByType.get(adjacent) ?? [];
      for (const source of sourceRooms) {
        for (const target of targetRooms) {
          if (source.id !== target.id) adjacencyPairs.add(pairKey(source.id, target.id));
        }
      }
    }
  }

  const usedRooms = new Set<string>();
  const doors: Door[] = [];
  const sharedWalls = (candidate.sharedWalls?.length ? candidate.sharedWalls : deriveSharedWalls(candidate.rooms))
    .filter((sharedWall) => adjacencyPairs.has(pairKey(sharedWall.roomA, sharedWall.roomB)))
    .sort((a, b) => doorPriority(candidate.rooms, b) - doorPriority(candidate.rooms, a));

  for (const sharedWall of sharedWalls) {
    const roomA = roomsById.get(sharedWall.roomA);
    const roomB = roomsById.get(sharedWall.roomB);
    if (!roomA || !roomB) continue;

    const doorRoom = pickDoorRoom(roomA, roomB);
    const door: Door = doorRoom.id === roomA.id
      ? { roomId: roomA.id, wall: sharedWall.wallA, position: sharedWall.positionA, widthMeters: 0.9, hinge: "left", swing: "inward" }
      : { roomId: roomB.id, wall: sharedWall.wallB, position: sharedWall.positionB, widthMeters: 0.9, hinge: "left", swing: "inward" };
    if (usedRooms.has(door.roomId)) continue;
    usedRooms.add(door.roomId);
    doors.push(door);
  }

  return doors;
}

function deriveSharedWalls(rooms: Room[]): SharedWallEvidence[] {
  const sharedWalls: SharedWallEvidence[] = [];
  for (let i = 0; i < rooms.length; i++) {
    for (let j = i + 1; j < rooms.length; j++) {
      const sharedWall = deriveSharedWall(rooms[i], rooms[j]);
      if (sharedWall) sharedWalls.push(sharedWall);
    }
  }
  return sharedWalls;
}

function deriveSharedWall(a: Room, b: Room): SharedWallEvidence | null {
  if (a.x + a.width === b.x) return verticalSharedWallEvidence(a, b, "right", "left");
  if (b.x + b.width === a.x) return verticalSharedWallEvidence(a, b, "left", "right");
  if (a.y + a.height === b.y) return horizontalSharedWallEvidence(a, b, "bottom", "top");
  if (b.y + b.height === a.y) return horizontalSharedWallEvidence(a, b, "top", "bottom");
  return null;
}

function verticalSharedWallEvidence(a: Room, b: Room, wallA: WallSide, wallB: WallSide): SharedWallEvidence | null {
  const start = Math.max(a.y, b.y);
  const end = Math.min(a.y + a.height, b.y + b.height);
  if (end <= start) return null;
  const center = start + (end - start) / 2;
  return {
    roomA: a.id,
    roomB: b.id,
    wallA,
    wallB,
    sharedLength: end - start,
    positionA: clampUnit((center - a.y) / a.height),
    positionB: clampUnit((center - b.y) / b.height),
  };
}

function horizontalSharedWallEvidence(a: Room, b: Room, wallA: WallSide, wallB: WallSide): SharedWallEvidence | null {
  const start = Math.max(a.x, b.x);
  const end = Math.min(a.x + a.width, b.x + b.width);
  if (end <= start) return null;
  const center = start + (end - start) / 2;
  return {
    roomA: a.id,
    roomB: b.id,
    wallA,
    wallB,
    sharedLength: end - start,
    positionA: clampUnit((center - a.x) / a.width),
    positionB: clampUnit((center - b.x) / b.width),
  };
}

function pickDoorRoom(a: Room, b: Room): Room {
  const privateOrService = [a, b].find((room) => ["bedroom", "master_bedroom", "bathroom", "ensuite", "study", "laundry", "garage", "kitchen"].includes(room.type));
  return privateOrService ?? b;
}

function doorPriority(rooms: Room[], sharedWall: SharedWallEvidence): number {
  const roomA = rooms.find((room) => room.id === sharedWall.roomA);
  const roomB = rooms.find((room) => room.id === sharedWall.roomB);
  if (!roomA || !roomB) return 0;
  const pair = new Set([roomA.type, roomB.type]);
  if (pair.has("hallway") && [...pair].some((type) => ["bedroom", "master_bedroom", "bathroom", "study"].includes(type))) return 80;
  if (pair.has("master_bedroom") && pair.has("ensuite")) return 75;
  if (pair.has("entry") && (pair.has("living") || pair.has("studio"))) return 70;
  if (pair.has("kitchen") && pair.has("dining")) return 65;
  return Math.min(sharedWall.sharedLength / GRID, 40);
}

function pairKey(a: string, b: string): string {
  return [a, b].sort().join("::");
}

function buildRationale(candidate: PlannerCandidate, brief: PlannerBrief, solverResult: SpatialSolverResult): string {
  const score = candidate.score;
  if (!score) return `Selected ${candidate.id} for the requested ${brief.projectType.replaceAll("_", " ")} layout.`;
  return `Selected ${candidate.id} from ${solverResult.exploredCandidates} ${solverResult.backend} candidates because it balanced ${brief.userType ?? "general"} priorities with ${score.adjacency}/100 adjacency, ${score.wallSharing}/100 wall sharing, ${score.privacy}/100 privacy, ${score.circulation}/100 circulation, and ${score.areaFit}/100 area fit.`;
}

function roomsTouch(a: Room, b: Room): boolean {
  const horizontalTouch = (a.x + a.width === b.x || b.x + b.width === a.x) && rangesOverlap(a.y, a.y + a.height, b.y, b.y + b.height);
  const verticalTouch = (a.y + a.height === b.y || b.y + b.height === a.y) && rangesOverlap(a.x, a.x + a.width, b.x, b.x + b.width);
  return horizontalTouch || verticalTouch;
}

function sharedWallLength(a: Room, b: Room): number {
  if (a.x + a.width === b.x || b.x + b.width === a.x) {
    return Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  }
  if (a.y + a.height === b.y || b.y + b.height === a.y) {
    return Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
  }
  return 0;
}

function zoneForRoom(type: string): PrivacyZone {
  if (["master_bedroom", "bedroom", "study"].includes(type)) return "private";
  if (["bathroom", "ensuite", "laundry", "hallway"].includes(type)) return "service";
  return "public";
}

function distanceFromPublic(room: Room, placed: Room[]): number {
  const publicRooms = placed.filter((candidate) => zoneForRoom(candidate.type) === "public");
  if (!publicRooms.length) return GRID * 2;
  return Math.min(...publicRooms.map((candidate) => roomDistance(room, candidate)));
}

function siteShapePlacementBonus(room: Room, bounds: { x: number; y: number; width: number; height: number }, siteShape: SiteShape, strategy: CandidateStrategy): number {
  const rightEdge = room.x + room.width === bounds.x + bounds.width;
  const bottomEdge = room.y + room.height === bounds.y + bounds.height;
  if (siteShape === "narrow_lot") return room.width <= GRID * 5 ? 14 : -10;
  if (siteShape === "l_shape") return rightEdge || bottomEdge ? 10 : 0;
  if (siteShape === "u_shape" || siteShape === "courtyard") return touchesExterior(room, bounds) ? 8 : -4;
  if (siteShape === "stepped") return rightEdge !== bottomEdge ? 8 : 0;
  return strategy === "squarified_area" ? clampScore(20 - Math.abs(room.width / Math.max(room.height, 1) - 1.2) * 6) : 0;
}

function rangesOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

function roomDistance(a: Room, b: Room): number {
  const ax = a.x + a.width / 2;
  const ay = a.y + a.height / 2;
  const bx = b.x + b.width / 2;
  const by = b.y + b.height / 2;
  return Math.abs(ax - bx) + Math.abs(ay - by);
}

function getBounds(rooms: Room[]): { x: number; y: number; width: number; height: number } {
  const minX = Math.min(...rooms.map((room) => room.x));
  const minY = Math.min(...rooms.map((room) => room.y));
  const maxX = Math.max(...rooms.map((room) => room.x + room.width));
  const maxY = Math.max(...rooms.map((room) => room.y + room.height));
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function touchesExterior(room: Room, bounds: { x: number; y: number; width: number; height: number }): boolean {
  return room.x === bounds.x || room.y === bounds.y || room.x + room.width === bounds.x + bounds.width || room.y + room.height === bounds.y + bounds.height;
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function hash(value: string): number {
  let result = 0;
  for (let index = 0; index < value.length; index += 1) {
    result = ((result << 5) - result + value.charCodeAt(index)) | 0;
  }
  return Math.abs(result);
}

function validNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function stringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function isSiteShape(value: unknown): value is SiteShape {
  return ["rectangle", "l_shape", "u_shape", "courtyard", "narrow_lot", "stepped"].includes(String(value));
}

function isProjectType(value: unknown): value is PlannerBrief["projectType"] {
  return ["studio", "unit", "family_home", "villa", "builder_spec", "unknown_residential"].includes(String(value));
}
