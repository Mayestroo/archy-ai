// app/api/generate/route.ts
import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { generatePlannerFloorPlan } from "@/lib/ai-planner";
import { validateAndFixFloorPlan } from "@/lib/validateFloorPlan";
import {
  countSleepingRooms,
  generateLayout,
  inferTemplateFromText,
  listPixelTemplates,
  regenerateOpenings,
  templateForBedroomCount,
  type AIRoom,
  type AIResponse,
} from "@/lib/layout-engine";
import type { FloorPlan } from "@/lib/floorplan-schema";
import { isUserType, type UserType } from "@/lib/user-types";

// ── Request / Response shapes ─────────────────────────────────────────────────

interface GenerateRequest {
  prompt: string;
  currentFloorPlan?: FloorPlan; // For "Smart Layout" refinement
  userType?: UserType | null;
}

interface GenerateResponse {
  floorPlan: FloorPlan;
  enhancedPrompt: string;
  generationNotes?: string[];
}

interface ErrorResponse {
  error: string;
}

interface GenerateApiError {
  message?: string;
  status?: number;
  errorDetails?: { retryDelay?: string }[];
}

function toGenerateApiError(err: unknown): GenerateApiError {
  if (err instanceof Error) {
    return err as Error & GenerateApiError;
  }
  if (typeof err === "object" && err !== null) {
    return err as GenerateApiError;
  }
  return { message: String(err) };
}

function getErrorMessage(err: unknown): string {
  return toGenerateApiError(err).message ?? "Unknown error";
}

// ── System Prompt (new two-stage approach) ────────────────────────────────────
// The AI ONLY returns room dimensions + zones. The layout engine assigns x/y.

function buildSystemPrompt(availableTemplates: string): string {
  return `
You are an architectural design assistant.
Your ONLY job is to pick the best template and provide detailed room specifications.
All pixel positions are FIXED and HARDCODED — you must NOT change them.
You DO control room area, aspect ratio, zone, and adjacency — these influence door/window placement and room type selection.

AVAILABLE TEMPLATES (pick the best match for the user's request):
${availableTemplates}

Return ONLY valid JSON matching this EXACT schema — nothing else:
{
  "template": "<template_key>",
  "totalArea": <number, sqm — use the template's listed area>,
  "unsupportedFeatures": ["<unsupported feature, if any>"],
  "generationNotes": ["<short note, if useful>"],
  "rooms": [
    {
      "id": "<unique_snake_case_id>",
      "type": "living|dining|kitchen|bedroom|master_bedroom|bathroom|ensuite|hallway|laundry|entry|garage|studio|study",
      "label": "<Human Readable Name, e.g. Master Bedroom, Kitchen>",
      "area": <number, sqm — reasonable room area for this room type>,
      "aspectRatio": <number, width÷height — e.g. 1.5 means 50%% wider than tall>,
      "zone": "public|private|service",
      "adjacentTo": ["<id of rooms this room should be placed near>"],
      "hasWindow": <boolean>,
      "hasDoor": <boolean>
    }
  ]
}

RULES:
1. Pick the template whose bedroom count and area best matches the user's request.
2. Include ONE room object per room that exists in the template (follow the template's room list).
3. The "type" field should match the chosen template slot types; use "study" only when the user explicitly asks for an office/study.
4. For templates with multiple bedrooms, include a "bedroom" entry for each one.
5. Every bedroom / living room / studio MUST have hasWindow: true.
6. Every room MUST have hasDoor: true.
7. Do NOT add extra rooms beyond what the template defines.
8. Do NOT include x, y, width, or height fields — the layout engine handles positioning.
9. Set "area" to a reasonable sqm for each room type (informational — used for door adjacency hints):
   - master_bedroom: 15-22 sqm, bedroom: 10-16 sqm, living: 16-28 sqm, kitchen: 7-16 sqm
   - dining: 8-14 sqm, bathroom: 4-7 sqm, ensuite: 3-5 sqm, hallway: 4-8 sqm
   - laundry: 3-5 sqm, entry: 3-6 sqm, garage: 18-24 sqm, study: 8-12 sqm
   - Adjust within these ranges based on the user's request (e.g. "large kitchen" → 12-16 sqm).
   - For compact/efficient templates, use the lower end of each range.
   - Service rooms (hallway, laundry, bathroom, ensuite) should NEVER exceed 8 sqm.
10. Set "aspectRatio" based on the room's shape in the template:
    - Long/narrow rooms (hallway, laundry): 2.0-3.0
    - Square-ish rooms (bathroom, ensuite, entry): 0.8-1.2
    - Typical rooms (bedroom, living, kitchen): 1.0-1.8
11. Set "zone" for each room:
    - "public": living, dining, kitchen, entry, garage
    - "private": master_bedroom, bedroom, ensuite, study
    - "service": bathroom, hallway, laundry
12. Set "adjacentTo" to list room IDs this room should be placed near (used for door placement). Use sensible architectural adjacencies:
    - master_bedroom → [ensuite, hallway]
    - bedroom → [hallway, bathroom]
    - kitchen → [dining, living]
    - bathroom → [hallway, bedroom]
    - living → [entry, dining, kitchen]
    - Only list adjacent rooms that exist in the template.
13. If the user asks for a balcony, deck, pool, stairs, or a second floor, list it in unsupportedFeatures instead of inventing it.
14. If the user asks for a larger kitchen in a 3-bedroom home, prefer the large-kitchen template variant.
15. If the user asks for a narrow lot/townhouse/terrace, prefer the narrow-lot 3-bedroom template when the bedroom count is compatible.
16. If the user asks for an L-shaped/courtyard/corner layout, prefer the L-shaped 3-bedroom template when the bedroom count is compatible.
17. If the user asks for a compact unit or minimized corridor area, prefer the compact 2-bedroom unit when compatible.
18. If the user asks for an open-plan 1-bedroom home, prefer the open-plan 1-bedroom template.
19. If the user asks for a builder-friendly/spec 4-bedroom home with garage, prefer the 4-bedroom garage template over the villa template.
`.trim();
}

// ── Refinement Prompt ────────────────────────────────────────────────────────
// Used when the user is modifying an EXISTING plan. The AI must respect the
// current layout as a baseline and only change what the user asked for.

function buildRefinementPrompt(
  currentFloorPlan: FloorPlan,
  newRequest: string,
  availableTemplates: string
): string {
  const currentRooms = currentFloorPlan.rooms
    .map(r => {
      const hasWindow = currentFloorPlan.windows.some(w => w.roomId === r.id);
      const hasDoor = currentFloorPlan.doors.some(d => d.roomId === r.id);
      const w = r.width / 50;
      const h = r.height / 50;
      return `  - id: "${r.id}" | type: "${r.type}" | label: "${r.label}" | area: ${(w * h).toFixed(1)} sqm | hasWindow: ${hasWindow} | hasDoor: ${hasDoor}`;
    })
    .join("\n");

  const templateKey =
    "template" in currentFloorPlan && typeof currentFloorPlan.template === "string"
      ? currentFloorPlan.template
      : "unknown";

  return `
You are an architectural design assistant refining an EXISTING floor plan.
Your job is to apply the user's requested change while keeping everything else identical.

CURRENT FLOOR PLAN (template: "${templateKey}", area: ${currentFloorPlan.totalArea} sqm):
ROOMS:
${currentRooms}

AVAILABLE TEMPLATES (only switch template if the change REQUIRES a different room count or area):
${availableTemplates}

USER CHANGE REQUEST: "${newRequest}"

Return ONLY valid JSON matching this EXACT schema — nothing else:
{
  "template": "<keep existing template key, or change ONLY if room count/area must change>",
  "totalArea": <number, sqm>,
  "unsupportedFeatures": ["<unsupported feature, if any>"],
  "generationNotes": ["<short note, if useful>"],
  "rooms": [
    {
      "id": "<reuse existing id for unchanged rooms, new snake_case id for new rooms>",
      "type": "living|dining|kitchen|bedroom|master_bedroom|bathroom|ensuite|hallway|laundry|entry|garage|studio|study",
      "label": "<Human Readable Name>",
      "area": <number, sqm>,
      "aspectRatio": <number, width÷height>,
      "zone": "public|private|service",
      "adjacentTo": ["<id of rooms this room should be placed near>"],
      "hasWindow": <boolean>,
      "hasDoor": <boolean>
    }
  ]
}

RULES:
1. PRESERVE all rooms that are NOT mentioned in the change request — reuse their exact id, type, label, hasWindow, hasDoor.
2. Only modify the specific room(s) the user asked to change.
3. If the user asks to ADD a room and the template has a slot for it, add it. If not, switch to the nearest larger template.
4. If the user asks to REMOVE a room, omit it and switch to the nearest smaller template if needed.
5. Relabelling (e.g. "rename bedroom to office") should change label and type to "study" only — keep the same id.
6. Every bedroom / living room / studio MUST have hasWindow: true.
7. Every room MUST have hasDoor: true.
8. Do NOT include x, y, width, or height fields — the layout engine handles positioning.
9. Include area, aspectRatio, zone, and adjacentTo for every room (informational — used for door/window placement hints).
10. If the user asks for a balcony, deck, pool, stairs, or a second floor, list it in unsupportedFeatures instead of inventing it.
11. If the user asks for a larger kitchen in a 3-bedroom home, prefer the large-kitchen template variant.
12. If a requested layout style requires a compatible template variant (narrow lot, L-shaped, compact unit, open-plan 1-bed, or builder garage), switch templates only when the room count matches that variant.
`.trim();
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(
  req: NextRequest
): Promise<NextResponse<GenerateResponse | ErrorResponse>> {
  // 1. Parse and validate request body
  let body: GenerateRequest;
  try {
    body = (await req.json()) as GenerateRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { prompt, currentFloorPlan } = body;
  const userType = isUserType(body.userType) ? body.userType : null;
  if (!prompt) {
    return NextResponse.json({ error: "No prompt provided." }, { status: 400 });
  }

  const deterministicRefinement = currentFloorPlan
    ? applyDeterministicRefinement(currentFloorPlan, prompt)
    : null;

  if (deterministicRefinement) {
    const cleanedFloorPlan = validateAndFixFloorPlan(deterministicRefinement);
    const notedFloorPlan = withGenerationNotes(cleanedFloorPlan, areaApproximationNotes(prompt, cleanedFloorPlan.totalArea));
    return NextResponse.json({
      floorPlan: notedFloorPlan,
      enhancedPrompt: enhancePromptWithNotes(prompt, notedFloorPlan.generationNotes),
      generationNotes: notedFloorPlan.generationNotes,
    });
  }

  // 2. Validate API key and build client
  const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("Generate API Error: GEMINI_API_KEY is missing from environment variables.");
    return NextResponse.json({ error: "API key not found." }, { status: 500 });
  }

  // Log masked key for debugging (first 4 and last 4 chars)
  const maskedKey = `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}`;
  console.log(`[Generate API] Using API Key: ${maskedKey}`);

  const genAI = new GoogleGenerativeAI(apiKey);
  const plannerModelsToTry = ["gemini-2.0-flash", "gemini-flash-latest"];
  for (const modelName of plannerModelsToTry) {
    try {
      const plannerResult = await generatePlannerFloorPlan(prompt, {
        genAI,
        modelName,
        userType,
        mode: "quality",
      });

      const cleanedFloorPlan = validateAndFixFloorPlan(plannerResult.floorPlan);
      const notedFloorPlan = withGenerationNotes(
        cleanedFloorPlan,
        areaApproximationNotes(prompt, cleanedFloorPlan.totalArea),
      );

      console.log(`[Generate API] Successfully generated floor plan using AI planner with ${modelName}`);
      return NextResponse.json({
        floorPlan: notedFloorPlan,
        enhancedPrompt: enhancePromptWithNotes(`${prompt}\n\nPlanner rationale: ${plannerResult.rationale}`, notedFloorPlan.generationNotes),
        generationNotes: notedFloorPlan.generationNotes,
      });
    } catch (plannerError) {
      console.warn(`[Generate API] AI planner failed with ${modelName}; falling back if needed:`, getErrorMessage(plannerError));
    }
  }

  console.warn("[Generate API] AI planner did not return a valid plan. Using deterministic template fallback.");
  const templates = listPixelTemplates()
    .map(t => `  - "${t.key}": ${t.description} (~${t.totalArea} sqm)`)
    .join("\n");
  const systemPrompt = buildSystemPrompt(templates);
  const preferredTemplate = inferPreferredTemplate(prompt, currentFloorPlan);
  const localNotes = unsupportedFeatureNotes(detectUnsupportedFeatures(prompt));
  
  // Try models in order of preference. 
  // Verified aliases from REST API: gemini-flash-latest, gemini-pro-latest, gemini-2.0-flash, gemini-2.0-flash-lite
  const modelsToTry = ["gemini-2.0-flash", "gemini-flash-latest", "gemini-pro-latest", "gemini-2.0-flash-lite"];
  let lastError: GenerateApiError | null = null;

  for (const modelName of modelsToTry) {
    try {
      console.log(`[Generate API] Attempting generation with model: ${modelName}`);
      const model = genAI.getGenerativeModel({ 
        model: modelName,
        generationConfig: { responseMimeType: "application/json" }
      });

      // For refinements, use a dedicated prompt that preserves unchanged rooms.
      // For fresh generation, use the standard system prompt.
      const finalPrompt = currentFloorPlan
        ? buildRefinementPrompt(currentFloorPlan, prompt, templates)
        : `${systemPrompt}\n\nUSER REQUEST: ${prompt}`;

      const result = await model.generateContent(finalPrompt);
      const response = await result.response;
      const text = response.text();

      // 4. Parse AI response (rooms are dimension-only, no x/y)
      const aiResponse = coerceAIResponse(JSON.parse(text));

      // 5. Two-stage pipeline: pack rooms into zones → assign x/y positions
      let floorPlan: FloorPlan;
      try {
        floorPlan = generateLayout(aiResponse, { preferredTemplate, generationNotes: localNotes });
      } catch (layoutErr: unknown) {
        console.error(`[Generate API] Layout engine failed: ${getErrorMessage(layoutErr)}. Falling back to preferred template.`);
        floorPlan = generateLayout(
          { template: preferredTemplate, rooms: aiResponse.rooms },
          { generationNotes: [...localNotes, "Recovered with a deterministic fallback template."] }
        );
      }

      // 6. Validate and fix geometry (gaps/overlaps)
      const cleanedFloorPlan = withGenerationNotes(
        validateAndFixFloorPlan(floorPlan),
        areaApproximationNotes(prompt, floorPlan.totalArea),
      );

      console.log(`[Generate API] Successfully generated floor plan using ${modelName}`);
      return NextResponse.json({
        floorPlan: cleanedFloorPlan,
        enhancedPrompt: enhancePromptWithNotes(prompt, cleanedFloorPlan.generationNotes),
        generationNotes: cleanedFloorPlan.generationNotes,
      });

    } catch (err: unknown) {
      const apiError = toGenerateApiError(err);
      lastError = apiError;
      const statusCode = apiError.status || 0;
      const message = apiError.message ?? "";
      const isQuotaError = statusCode === 429 || message.includes("429") || message.includes("quota") || message.includes("limit");
      const isNotFoundError = statusCode === 404 || message.includes("404") || message.includes("not found");
      const isAuthError = statusCode === 403 || message.includes("403") || message.includes("permission");
      
      console.error(`[Generate API] Error with model ${modelName}:`, message || "Unknown error");

      // Fallback if it's a quota, not found (sometimes models are removed or renamed), or auth error
      if ((isQuotaError || isNotFoundError || isAuthError) && modelName !== modelsToTry[modelsToTry.length - 1]) {
        console.warn(`[Generate API] ${modelName} failed with ${statusCode}. Falling back to next model...`);
        continue; 
      }
      
      break; 
    }
  }

  // If we exhausted all models or hit a non-quota error
  const isQuotaError = lastError?.status === 429 || lastError?.message?.includes("429") || lastError?.message?.includes("quota") || lastError?.message?.includes("limit");

  if (isQuotaError) {
    return NextResponse.json(
      { error: `API Limit Reached (429). The provided API key might have a zero quota or has hit its limit. Please check your Google AI Studio billing/plan. (Error: ${lastError?.message ?? "Unknown error"})` }, 
      { status: 429 }
    );
  }

  return NextResponse.json({ error: lastError?.message || "Failed to generate floor plan." }, { status: 500 });
}

function applyDeterministicRefinement(currentFloorPlan: FloorPlan, prompt: string): FloorPlan | null {
  const lower = prompt.toLowerCase();
  const unsupportedFeatures = detectUnsupportedFeatures(prompt);
  if (unsupportedFeatures.length) {
    return withGenerationNotes(
      regenerateOpenings(currentFloorPlan),
      unsupportedFeatureNotes(unsupportedFeatures)
    );
  }

  if (isStudyConversion(lower)) {
    return convertBedroomToStudy(currentFloorPlan, lower.includes("office") ? "Home Office" : "Study");
  }

  if (isKitchenExpansion(lower)) {
    return applyLargeKitchenTemplate(currentFloorPlan);
  }

  if (isAddBedroom(lower)) {
    return switchBedroomCount(currentFloorPlan, 1);
  }

  if (isRemoveBedroom(lower)) {
    return switchBedroomCount(currentFloorPlan, -1);
  }

  return null;
}

function convertBedroomToStudy(currentFloorPlan: FloorPlan, label: string): FloorPlan {
  const rooms = currentFloorPlan.rooms.map((room) => ({ ...room }));
  let targetIndex = -1;
  for (let i = rooms.length - 1; i >= 0; i--) {
    if (rooms[i].type === "bedroom") {
      targetIndex = i;
      break;
    }
  }

  if (targetIndex === -1) {
    return withGenerationNotes(
      regenerateOpenings(currentFloorPlan),
      ["No regular bedroom was available to convert into a study."]
    );
  }

  const originalLabel = rooms[targetIndex].label;
  rooms[targetIndex] = { ...rooms[targetIndex], type: "study", label };

  return withGenerationNotes(
    regenerateOpenings({ ...currentFloorPlan, rooms }),
    [`Converted ${originalLabel} into ${label}.`]
  );
}

function applyLargeKitchenTemplate(currentFloorPlan: FloorPlan): FloorPlan {
  if (currentFloorPlan.template === "3bed_open_kitchen") {
    return withGenerationNotes(
      regenerateOpenings(currentFloorPlan),
      ["The kitchen is already using the larger 3-bedroom kitchen layout."]
    );
  }

  if (countSleepingRooms(currentFloorPlan.rooms) !== 3) {
    return withGenerationNotes(
      regenerateOpenings(currentFloorPlan),
      ["Kitchen resizing is currently available for 3-bedroom layouts only."]
    );
  }

  return generateLayout(
    { template: "3bed_open_kitchen", rooms: aiRoomsFromPlan(currentFloorPlan) },
    { generationNotes: ["Applied the larger-kitchen 3-bedroom layout variant."] }
  );
}

function switchBedroomCount(currentFloorPlan: FloorPlan, delta: 1 | -1): FloorPlan {
  const currentCount = countSleepingRooms(currentFloorPlan.rooms);
  const targetCount = currentCount + delta;

  if (targetCount > 4) {
    return withGenerationNotes(
      regenerateOpenings(currentFloorPlan),
      ["Four bedrooms is the largest supported template right now."]
    );
  }

  if (targetCount < 0) {
    return withGenerationNotes(
      regenerateOpenings(currentFloorPlan),
      ["There are no more bedrooms to remove."]
    );
  }

  let rooms = aiRoomsFromPlan(currentFloorPlan);
  if (delta === 1) {
    rooms = [
      ...rooms,
      {
        id: `bedroom_${targetCount}`,
        type: "bedroom",
        label: `Bedroom ${targetCount}`,
        area: 12,
        aspectRatio: 1.2,
        zone: "private" as const,
        adjacentTo: ["hallway", "bathroom"],
        hasDoor: true,
        hasWindow: true,
      },
    ];
  } else {
    rooms = limitSleepingRooms(rooms, targetCount);
  }

  return generateLayout(
    { template: templateForBedroomCount(targetCount), rooms },
    { generationNotes: [`Switched to the ${targetCount || "studio"}-bedroom template.`] }
  );
}

function aiRoomsFromPlan(floorPlan: FloorPlan): AIRoom[] {
  const doorRoomIds = new Set(floorPlan.doors?.map((door) => door.roomId) ?? []);
  const windowRoomIds = new Set(floorPlan.windows?.map((window) => window.roomId) ?? []);
  const ROOM_ZONE_MAP: Record<string, "public" | "private" | "service"> = {
    entry: "public", garage: "public", living: "public", dining: "public", kitchen: "public",
    master_bedroom: "private", bedroom: "private", ensuite: "private", study: "private",
    bathroom: "service", hallway: "service", laundry: "service", studio: "public",
  };

  return floorPlan.rooms.map((room) => {
    const w = room.width / 50;
    const h = room.height / 50;
    return {
      id: room.id,
      type: room.type,
      label: room.label,
      area: Math.round(w * h * 10) / 10,
      aspectRatio: Math.round((w / h) * 100) / 100,
      zone: ROOM_ZONE_MAP[room.type] ?? "service",
      hasDoor: doorRoomIds.has(room.id),
      hasWindow: windowRoomIds.has(room.id),
    };
  });
}

function limitSleepingRooms(rooms: AIRoom[], targetCount: number): AIRoom[] {
  let sleepingRooms = 0;
  return rooms.filter((room) => {
    if (room.type !== "bedroom" && room.type !== "master_bedroom") return true;
    sleepingRooms += 1;
    return sleepingRooms <= targetCount;
  });
}

function inferPreferredTemplate(prompt: string, currentFloorPlan?: FloorPlan): string {
  if (!currentFloorPlan) return inferTemplateFromText(prompt);

  const lower = prompt.toLowerCase();
  const currentBedroomCount = countSleepingRooms(currentFloorPlan.rooms);
  if (isAddBedroom(lower)) return templateForBedroomCount(currentBedroomCount + 1);
  if (isRemoveBedroom(lower)) return templateForBedroomCount(Math.max(currentBedroomCount - 1, 0));
  if (isKitchenExpansion(lower) && currentBedroomCount === 3) return "3bed_open_kitchen";
  return currentFloorPlan.template ?? inferTemplateFromText(prompt);
}

function coerceAIResponse(value: unknown): AIResponse {
  if (!value || typeof value !== "object") return { rooms: [] };
  const candidate = value as Partial<AIResponse>;

  return {
    template: typeof candidate.template === "string" ? candidate.template : undefined,
    totalArea: typeof candidate.totalArea === "number" ? candidate.totalArea : undefined,
    rooms: Array.isArray(candidate.rooms)
      ? candidate.rooms.map(coerceAIRoom).filter((room): room is AIRoom => room !== null)
      : [],
    generationNotes: stringArray(candidate.generationNotes),
    unsupportedFeatures: stringArray(candidate.unsupportedFeatures),
  };
}

function coerceAIRoom(value: unknown): AIRoom | null {
  if (!value || typeof value !== "object") return null;
  const room = value as Partial<AIRoom>;
  const type = typeof room.type === "string" ? room.type : "room";
  const label = typeof room.label === "string" ? room.label : type.replaceAll("_", " ");

  const validZones: Array<"public" | "private" | "service"> = ["public", "private", "service"];

  return {
    id: typeof room.id === "string" ? room.id : label.toLowerCase().replace(/[^a-z0-9]+/g, "_"),
    type,
    label,
    area: typeof room.area === "number" && room.area > 0 ? room.area : undefined,
    aspectRatio: typeof room.aspectRatio === "number" && room.aspectRatio > 0 ? room.aspectRatio : undefined,
    zone: validZones.includes(room.zone as "public" | "private" | "service") ? room.zone as "public" | "private" | "service" : undefined,
    adjacentTo: Array.isArray(room.adjacentTo)
      ? room.adjacentTo.filter((a): a is string => typeof a === "string" && a.length > 0)
      : undefined,
    hasDoor: typeof room.hasDoor === "boolean" ? room.hasDoor : undefined,
    hasWindow: typeof room.hasWindow === "boolean" ? room.hasWindow : undefined,
  };
}

function stringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const strings = value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  return strings.length ? strings : undefined;
}

function withGenerationNotes(floorPlan: FloorPlan, notes: string[]): FloorPlan {
  const generationNotes = Array.from(new Set([...(floorPlan.generationNotes ?? []), ...notes].filter(Boolean)));
  return { ...floorPlan, generationNotes };
}

function enhancePromptWithNotes(prompt: string, notes: string[] | undefined): string {
  return notes?.length ? `${prompt}\n\nNotes: ${notes.join(" ")}` : prompt;
}

function areaApproximationNotes(prompt: string, selectedArea: number): string[] {
  const requestedArea = parseRequestedArea(prompt);
  if (!requestedArea) return [];

  const tolerance = Math.max(10, requestedArea * 0.08);
  if (Math.abs(requestedArea - selectedArea) <= tolerance) return [];

  return [`Requested ${requestedArea}m² was approximated with the nearest fixed ${selectedArea}m² deterministic template.`];
}

function parseRequestedArea(prompt: string): number | null {
  const match = prompt.match(/\b(\d{2,4})\s*(?:sqm|sq\.?\s*m|m2|m²|square\s+met(?:er|re)s?)\b/i);
  return match ? Number(match[1]) : null;
}

function unsupportedFeatureNotes(features: string[]): string[] {
  return features.map((feature) => `Unsupported request not applied: ${feature}.`);
}

function detectUnsupportedFeatures(prompt: string): string[] {
  const lower = prompt.toLowerCase();
  const features: string[] = [];
  if (/\bbalcon(?:y|ies)\b/.test(lower)) features.push("balcony");
  if (/\bdeck\b/.test(lower)) features.push("deck");
  if (/\bpool\b/.test(lower)) features.push("pool");
  if (/\b(?:stairs|staircase|upstairs|second floor|two-storey|two story|multi-storey|multi story)\b/.test(lower)) {
    features.push("multi-storey layout");
  }
  return features;
}

function isStudyConversion(prompt: string): boolean {
  return /\b(?:convert|turn|make|change)\b/.test(prompt)
    && /\bbed(?:room)?\b/.test(prompt)
    && /\b(?:office|study)\b/.test(prompt);
}

function isKitchenExpansion(prompt: string): boolean {
  return /\bkitchen\b/.test(prompt) && /\b(?:larger|bigger|expand|expanded|increase|open)\b/.test(prompt);
}

function isAddBedroom(prompt: string): boolean {
  return /\b(?:add|another|extra|more)\b/.test(prompt) && /\bbed(?:room)?\b/.test(prompt);
}

function isRemoveBedroom(prompt: string): boolean {
  return /\b(?:remove|delete|less|fewer)\b/.test(prompt) && /\bbed(?:room)?\b/.test(prompt);
}
