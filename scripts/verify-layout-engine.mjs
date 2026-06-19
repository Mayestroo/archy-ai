import assert from "node:assert/strict";

import {
  generateLayout,
  inferTemplateFromText,
  listPixelTemplates,
  regenerateOpenings,
} from "../lib/layout-engine.ts";
import {
  generatePlannerFloorPlan,
  inferBrief,
} from "../lib/ai-planner.ts";
import {
  furnitureFitsRoom,
  regenerateFurniture,
} from "../lib/furniture.ts";
import {
  applyExteriorConcept,
} from "../lib/exterior-concepts.ts";
import {
  applyInteriorConcept,
  getRoomInteriorConcept,
  pruneInvalidInteriorConcepts,
} from "../lib/interior-concepts.ts";
import {
  applyRoomMaterial,
  getRoomMaterial,
  refreshMaterials,
  regenerateMaterials,
} from "../lib/materials.ts";
import {
  DEFAULT_DOOR_WIDTH_METERS,
  DEFAULT_WINDOW_WIDTH_METERS,
  clampOpeningPosition,
  clampOpeningWidthForWall,
  getDoorHinge,
  getDoorSwing,
  getOpeningWidthMeters,
  isValidDoorWall,
  isValidWindowWall,
  openingFitsWall,
} from "../lib/openings.ts";
import {
  MIN_ROOM_SIZE,
  addRoomToFloorPlan,
  applyRoomGeometry,
  deleteRoomFromFloorPlan,
  pruneInvalidOpenings,
  resizeRoomGeometry,
  snapToGrid,
} from "../lib/room-geometry.ts";

const wallSides = new Set(["top", "bottom", "left", "right"]);
const templates = listPixelTemplates();
const templateKeys = new Set(templates.map((template) => template.key));

for (const requiredTemplate of [
  "1bed_open_plan",
  "2bed_compact_unit",
  "3bed_l_shape",
  "3bed_narrow_lot",
  "4bed_with_garage",
]) {
  assert.ok(templateKeys.has(requiredTemplate), `${requiredTemplate} should be registered`);
}

for (const template of templates) {
  const plan = generateLayout({ template: template.key, rooms: [] });
  assert.equal(plan.template, template.key, `${template.key} should preserve template metadata`);
  assert.ok(plan.rooms.length > 0, `${template.key} should generate rooms`);
  assert.ok(plan.totalArea > 0, `${template.key} should have a positive area`);
  assertNoOverlaps(plan.rooms, template.key);
  assertValidOpenings(plan, template.key);
  assertValidFurniture(plan, template.key);
  assertValidMaterials(plan, template.key);
}

const plannerBrief = inferBrief("builder friendly 4 bedroom spec home with garage on a narrow lot", "real_estate_builder");
assert.equal(plannerBrief.userType, "real_estate_builder", "planner brief should preserve user role");
assert.equal(plannerBrief.siteShape, "narrow_lot", "planner brief should infer narrow-lot constraints");
assert.ok(plannerBrief.rooms.some((room) => room.type === "garage"), "planner brief should include garage when requested");

const plannerResult = await generatePlannerFloorPlan("builder friendly 4 bedroom spec home with garage on a narrow lot", {
  userType: "real_estate_builder",
  mode: "fast",
});
assert.equal(plannerResult.floorPlan.template, "ai_planner", "planner path should not report a fixed deterministic template");
assert.ok(
  ["typescript_hybrid", "ortools_microservice"].includes(plannerResult.solver.backend),
  "planner should expose the active spatial solver backend"
);
assert.equal(plannerResult.solver.status, "feasible", "planner solver should report feasible status");
assert.ok(plannerResult.solver.exploredCandidates > 0, "planner should report explored candidate count");
assert.ok(plannerResult.floorPlan.rooms.length >= 10, "planner should generate a complete editable room program");
assert.ok(plannerResult.floorPlan.generationNotes.some((note) => note.includes("not fixed template coordinates")), "planner output should disclose non-template generation path");
assert.ok(plannerResult.floorPlan.generationNotes.some((note) => note.includes("OR-Tools")), "planner should document the OR-Tools-ready solver boundary");
assertNoOverlaps(plannerResult.floorPlan.rooms, "ai planner");
assertValidOpenings(plannerResult.floorPlan, "ai planner");
assertValidFurniture(plannerResult.floorPlan, "ai planner");
assertValidMaterials(plannerResult.floorPlan, "ai planner");
assertPlannerGeometryQuality(plannerResult.floorPlan, "ai planner");
assertPlannerRequiredAdjacencyOpenings(plannerResult.floorPlan, plannerBrief, "ai planner", plannerResult.solver.backend === "ortools_microservice");

const studyPlan = generateLayout({
  template: "3bed_rectangle",
  rooms: [{ id: "home_office", type: "study", label: "Home Office", hasDoor: true, hasWindow: true }],
});
assert.ok(studyPlan.rooms.some((room) => room.type === "study"), "study rooms should map into bedroom-capable slots");

const fallbackPlan = generateLayout(
  { template: "made_up_template", rooms: [] },
  { preferredTemplate: "2bed_apartment" }
);
assert.equal(fallbackPlan.template, "2bed_apartment", "invalid templates should use the preferred deterministic fallback");

assert.equal(
  inferTemplateFromText("3 bedroom family home with a larger kitchen"),
  "3bed_open_kitchen",
  "large-kitchen prompts should select the large-kitchen variant"
);
assert.equal(
  inferTemplateFromText("narrow lot 3 bedroom townhouse"),
  "3bed_narrow_lot",
  "narrow-lot prompts should select the narrow-lot 3-bedroom variant"
);
assert.equal(
  inferTemplateFromText("L-shaped 3 bedroom family home around a courtyard"),
  "3bed_l_shape",
  "L-shaped prompts should select the L-shaped 3-bedroom variant"
);
assert.equal(
  inferTemplateFromText("compact 2 bedroom unit with minimized corridor"),
  "2bed_compact_unit",
  "compact unit prompts should select the compact 2-bedroom variant"
);
assert.equal(
  inferTemplateFromText("open-plan 1 bedroom apartment for a couple"),
  "1bed_open_plan",
  "open-plan one-bedroom prompts should select the 1-bedroom open-plan variant"
);
assert.equal(
  inferTemplateFromText("builder friendly 4 bedroom spec home with garage"),
  "4bed_with_garage",
  "builder garage prompts should select the 4-bedroom garage variant"
);

assert.equal(clampOpeningPosition(0.526), 0.55, "manual opening positions should snap to 5% increments");
assert.equal(snapToGrid(76), 100, "manual room geometry should snap to 50px increments");

const geometryPlan = generateLayout({ template: "studio", rooms: [] });
const studio = geometryPlan.rooms.find((room) => room.type === "studio");
const entry = geometryPlan.rooms.find((room) => room.type === "entry");
assert.ok(studio, "studio template should have a studio room");
assert.ok(entry, "studio template should have an entry room");

const movedPlan = applyRoomGeometry(geometryPlan, entry.id, {
  x: -49,
  y: 251,
  width: entry.width,
  height: entry.height,
});
assert.ok(movedPlan, "valid room moves should be accepted");
assert.equal(movedPlan.rooms.find((room) => room.id === entry.id)?.x, -50, "room move should snap x to grid");
assert.equal(movedPlan.rooms.find((room) => room.id === entry.id)?.y, 250, "room move should snap y to grid");

const invalidOverlapPlan = applyRoomGeometry(geometryPlan, studio.id, {
  x: 300,
  y: 0,
  width: studio.width,
  height: studio.height,
});
assert.equal(invalidOverlapPlan, null, "room moves that overlap another room should be rejected");

const resizedGeometry = resizeRoomGeometry(studio, "nw", studio.width - MIN_ROOM_SIZE + 25, studio.height - MIN_ROOM_SIZE + 25);
assert.equal(resizedGeometry.width, MIN_ROOM_SIZE, "room resize should enforce minimum width");
assert.equal(resizedGeometry.height, MIN_ROOM_SIZE, "room resize should enforce minimum height");

assert.equal(
  clampOpeningWidthForWall(4, "door", { id: "tiny", type: "entry", label: "Tiny", x: 0, y: 0, width: 100, height: 100 }, "top"),
  2,
  "manual opening widths should clamp to the selected wall length",
);

const addedRoomResult = addRoomToFloorPlan(geometryPlan, "study", entry.id);
assert.ok(addedRoomResult, "new rooms should be placed in the nearest valid snapped slot");
assert.ok(addedRoomResult.floorPlan.rooms.some((room) => room.id === addedRoomResult.roomId), "new rooms should be inserted into the plan");
assertNoOverlaps(addedRoomResult.floorPlan.rooms, "manual add room");
assert.equal(
  addedRoomResult.floorPlan.totalArea,
  Math.round(addedRoomResult.floorPlan.rooms.reduce((sum, room) => sum + (room.width * room.height) / 2500, 0)),
  "adding a room should recalculate total area",
);

const deletedRoomResult = deleteRoomFromFloorPlan({
  rooms: [
    { id: "keep", type: "living", label: "Keep", x: 0, y: 0, width: 100, height: 100 },
    { id: "delete", type: "study", label: "Delete", x: 100, y: 0, width: 100, height: 100 },
  ],
  doors: [{ roomId: "delete", wall: "left", position: 0.5 }],
  windows: [{ roomId: "delete", wall: "right", position: 0.5 }],
  totalArea: 8,
}, "delete");
assert.ok(deletedRoomResult, "deleting a non-final room should be accepted");
assert.equal(deletedRoomResult.floorPlan.rooms.length, 1, "deleting a room should remove it from the plan");
assert.equal(deletedRoomResult.floorPlan.doors.length, 0, "deleting a room should remove tied doors");
assert.equal(deletedRoomResult.floorPlan.windows.length, 0, "deleting a room should remove tied windows");
assert.equal(deleteRoomFromFloorPlan(deletedRoomResult.floorPlan, "keep"), null, "deleting the final room should be rejected");

const prunedPlan = pruneInvalidOpenings({
  rooms: [
    { id: "left", type: "living", label: "Left", x: 0, y: 0, width: 100, height: 100 },
    { id: "right", type: "living", label: "Right", x: 100, y: 0, width: 100, height: 100 },
  ],
  doors: [{ roomId: "left", wall: "right", position: 0.5 }],
  windows: [{ roomId: "left", wall: "right", position: 0.5 }],
  totalArea: 8,
});
assert.equal(prunedPlan.doors.length, 1, "doors may remain on shared walls after geometry edits");
assert.equal(prunedPlan.windows.length, 0, "windows on non-exterior walls should be pruned after geometry edits");

const regeneratedOpeningsPlan = regenerateOpenings({
  rooms: [
    { id: "living", type: "living", label: "Living", x: 0, y: 0, width: 200, height: 200 },
    { id: "hall", type: "hallway", label: "Hall", x: 200, y: 0, width: 100, height: 200 },
    { id: "bed", type: "bedroom", label: "Bedroom", x: 300, y: 0, width: 150, height: 200 },
  ],
  doors: [
    { roomId: "living", wall: "right", position: 0.25, widthMeters: 1.1, hinge: "right", swing: "outward" },
    { roomId: "missing", wall: "left", position: 0.5, widthMeters: 0.9 },
  ],
  windows: [
    { roomId: "bed", wall: "top", position: 0.35, widthMeters: 1.5 },
    { roomId: "living", wall: "right", position: 0.5, widthMeters: 1.2 },
  ],
  totalArea: 18,
});
const preservedDoor = regeneratedOpeningsPlan.doors.find((door) => door.roomId === "living");
assert.ok(preservedDoor, "opening regeneration should preserve valid manual doors");
assert.equal(preservedDoor.wall, "right", "manual door wall should be preserved");
assert.equal(preservedDoor.position, 0.25, "manual door position should be preserved");
assert.equal(getOpeningWidthMeters(preservedDoor, "door"), 1.1, "manual door width should be preserved");
assert.equal(getDoorHinge(preservedDoor), "right", "manual door hinge should be preserved");
assert.equal(getDoorSwing(preservedDoor), "outward", "manual door swing should be preserved");
assert.ok(!regeneratedOpeningsPlan.doors.some((door) => door.roomId === "missing"), "opening regeneration should remove doors for missing rooms");
assert.ok(regeneratedOpeningsPlan.doors.some((door) => door.roomId === "hall"), "opening regeneration should add missing suggested doors");
assert.ok(regeneratedOpeningsPlan.windows.some((window) => window.roomId === "living"), "opening regeneration should add missing suggested windows");
assert.equal(regeneratedOpeningsPlan.windows.filter((window) => window.roomId === "bed").length, 1, "opening regeneration should not duplicate preserved room windows");
assert.equal(getOpeningWidthMeters(regeneratedOpeningsPlan.windows.find((window) => window.roomId === "bed"), "window"), 1.5, "manual window width should be preserved");
assertValidOpeningGeometry(regeneratedOpeningsPlan, "manual opening regeneration");

const regeneratedFurniturePlan = regenerateFurniture({
  rooms: [
    { id: "living", type: "living", label: "Living", x: 0, y: 0, width: 200, height: 200 },
    { id: "bed", type: "bedroom", label: "Bedroom", x: 200, y: 0, width: 150, height: 150 },
    { id: "bath", type: "bathroom", label: "Bathroom", x: 350, y: 0, width: 100, height: 100 },
  ],
  doors: [],
  windows: [],
  totalArea: 22,
});
assertValidFurniture(regeneratedFurniturePlan, "manual furniture regeneration");

const regeneratedMaterialsPlan = regenerateMaterials(regeneratedFurniturePlan);
assertValidMaterials(regeneratedMaterialsPlan, "manual material regeneration");

const manualMaterialPlan = applyRoomMaterial(regeneratedMaterialsPlan, "living", "Spa Tile");
const manualLivingMaterial = getRoomMaterial(manualMaterialPlan, "living");
assert.equal(manualLivingMaterial?.palette, "Spa Tile", "manual material picker should apply the selected palette");
assert.equal(manualLivingMaterial?.manual, true, "manual material picker should mark the room material as manual");
const refreshedManualMaterialPlan = refreshMaterials(manualMaterialPlan);
assert.equal(getRoomMaterial(refreshedManualMaterialPlan, "living")?.palette, "Spa Tile", "material refresh should preserve manual room palettes");
assertValidMaterials(refreshedManualMaterialPlan, "manual material override refresh");

const conceptPlan = applyInteriorConcept(refreshedManualMaterialPlan, "living", "warm_minimal");
const livingConcept = getRoomInteriorConcept(conceptPlan, "living");
assert.ok(livingConcept, "interior concept generation should create a room concept brief");
assert.equal(livingConcept.style, "warm_minimal", "interior concept should preserve the selected style");
assert.ok(livingConcept.renderPrompt.includes("Living"), "interior concept should include room context in the render prompt");
assert.ok(livingConcept.palette.length > 0, "interior concept should include palette cues");
const prunedConceptPlan = pruneInvalidInteriorConcepts({
  ...conceptPlan,
  rooms: conceptPlan.rooms.filter((room) => room.id !== "living"),
});
assert.equal(getRoomInteriorConcept(prunedConceptPlan, "living"), null, "interior concept pruning should remove deleted-room briefs");

const facadeConceptPlan = applyExteriorConcept(conceptPlan, "warm_contemporary");
assert.ok(facadeConceptPlan.exteriorConcept, "exterior concept generation should create a facade concept brief");
assert.equal(facadeConceptPlan.exteriorConcept.style, "warm_contemporary", "exterior concept should preserve the selected style");
assert.ok(facadeConceptPlan.exteriorConcept.renderPrompt.includes("Exterior architectural facade concept"), "exterior concept should include render prompt context");
assert.ok(facadeConceptPlan.exteriorConcept.facadeMoves.length >= 3, "exterior concept should include facade direction moves");
assertValidMaterials(facadeConceptPlan, "exterior concept material hydration");

console.log(`Verified ${templates.length} floor plan templates.`);

function assertNoOverlaps(rooms, templateKey) {
  for (let i = 0; i < rooms.length; i++) {
    for (let j = i + 1; j < rooms.length; j++) {
      assert.ok(!roomsOverlap(rooms[i], rooms[j]), `${templateKey} has overlapping rooms: ${rooms[i].id}, ${rooms[j].id}`);
    }
  }
}

function assertValidOpenings(plan, templateKey) {
  const roomIds = new Set(plan.rooms.map((room) => room.id));
  for (const door of plan.doors) {
    const room = plan.rooms.find((candidate) => candidate.id === door.roomId);
    assert.ok(roomIds.has(door.roomId), `${templateKey} has a door for an unknown room: ${door.roomId}`);
    assert.ok(room, `${templateKey} has a door without a matching room: ${door.roomId}`);
    assert.ok(wallSides.has(door.wall), `${templateKey} has an invalid door wall: ${door.wall}`);
    assert.ok(door.position >= 0 && door.position <= 1, `${templateKey} has an invalid door position`);
    assert.ok(isValidDoorWall(room, plan.rooms, door.wall), `${templateKey} has a door on an invalid wall: ${door.roomId}.${door.wall}`);
    assert.equal(getOpeningWidthMeters(door, "door"), DEFAULT_DOOR_WIDTH_METERS, `${templateKey} should apply the default door width`);
    assert.equal(getDoorHinge(door), "left", `${templateKey} should apply the default door hinge`);
    assert.equal(getDoorSwing(door), "inward", `${templateKey} should apply the default door swing`);
    assert.ok(openingFitsWall(room, door.wall, getOpeningWidthMeters(door, "door")), `${templateKey} has a door that does not fit on its wall`);
  }

  for (const win of plan.windows) {
    const room = plan.rooms.find((candidate) => candidate.id === win.roomId);
    assert.ok(roomIds.has(win.roomId), `${templateKey} has a window for an unknown room: ${win.roomId}`);
    assert.ok(room, `${templateKey} has a window without a matching room: ${win.roomId}`);
    assert.ok(wallSides.has(win.wall), `${templateKey} has an invalid window wall: ${win.wall}`);
    assert.ok(win.position >= 0 && win.position <= 1, `${templateKey} has an invalid window position`);
    assert.ok(isValidWindowWall(room, plan.rooms, win.wall), `${templateKey} has a window on a non-exterior wall: ${win.roomId}.${win.wall}`);
    assert.equal(getOpeningWidthMeters(win, "window"), DEFAULT_WINDOW_WIDTH_METERS, `${templateKey} should apply the default window width`);
    assert.ok(openingFitsWall(room, win.wall, getOpeningWidthMeters(win, "window")), `${templateKey} has a window that does not fit on its wall`);
  }
}

function assertValidOpeningGeometry(plan, label) {
  for (const door of plan.doors) {
    const room = plan.rooms.find((candidate) => candidate.id === door.roomId);
    assert.ok(room, `${label} has a door without a matching room: ${door.roomId}`);
    assert.ok(isValidDoorWall(room, plan.rooms, door.wall), `${label} has a door on an invalid wall: ${door.roomId}.${door.wall}`);
    assert.ok(openingFitsWall(room, door.wall, getOpeningWidthMeters(door, "door")), `${label} has a door that does not fit on its wall`);
  }

  for (const win of plan.windows) {
    const room = plan.rooms.find((candidate) => candidate.id === win.roomId);
    assert.ok(room, `${label} has a window without a matching room: ${win.roomId}`);
    assert.ok(isValidWindowWall(room, plan.rooms, win.wall), `${label} has a window on an invalid wall: ${win.roomId}.${win.wall}`);
    assert.ok(openingFitsWall(room, win.wall, getOpeningWidthMeters(win, "window")), `${label} has a window that does not fit on its wall`);
  }
}

function assertValidFurniture(plan, label) {
  assert.ok(Array.isArray(plan.furniture), `${label} should include furniture suggestions`);
  assert.ok(plan.furniture.length > 0, `${label} should include at least one furniture item`);

  const ids = new Set();
  for (const item of plan.furniture) {
    const room = plan.rooms.find((candidate) => candidate.id === item.roomId);
    assert.ok(item.id && !ids.has(item.id), `${label} has a duplicate or missing furniture id`);
    ids.add(item.id);
    assert.ok(room, `${label} has furniture for an unknown room: ${item.roomId}`);
    assert.ok(item.type, `${label} has furniture without a type`);
    assert.ok(item.label, `${label} has furniture without a label`);
    assert.ok(furnitureFitsRoom(item, room), `${label} has furniture outside its room: ${item.id}`);
  }
}

function assertValidMaterials(plan, label) {
  assert.ok(Array.isArray(plan.materials), `${label} should include material presets`);
  assert.equal(plan.materials.length, plan.rooms.length, `${label} should have one material preset per room`);

  const roomIds = new Set(plan.rooms.map((room) => room.id));
  const materialRoomIds = new Set();
  for (const material of plan.materials) {
    assert.ok(roomIds.has(material.roomId), `${label} has material preset for an unknown room: ${material.roomId}`);
    assert.ok(!materialRoomIds.has(material.roomId), `${label} has duplicate material preset for room: ${material.roomId}`);
    materialRoomIds.add(material.roomId);
    assert.ok(material.palette, `${label} has material without a palette name`);
    assert.ok(isHexColor(material.floorColor), `${label} has invalid floor color for room: ${material.roomId}`);
    assert.ok(isHexColor(material.wallColor), `${label} has invalid wall color for room: ${material.roomId}`);
    assert.ok(isHexColor(material.accentColor), `${label} has invalid accent color for room: ${material.roomId}`);
    assert.ok(material.floorFinish, `${label} has material without a floor finish`);
    assert.ok(material.wallFinish, `${label} has material without a wall finish`);
    assert.ok(getRoomMaterial(plan, material.roomId), `${label} should resolve material by room id`);
  }
}

function assertPlannerGeometryQuality(plan, label) {
  const sharedWallPairs = countSharedWallPairs(plan.rooms);
  const exteriorRoomCount = plan.rooms.filter((room) => touchesExterior(room, plan.rooms)).length;
  const yBands = new Set(plan.rooms.map((room) => room.y));

  assert.ok(sharedWallPairs >= Math.floor(plan.rooms.length * 0.55), `${label} should have substantial wall-level room adjacency`);
  assert.ok(exteriorRoomCount >= Math.floor(plan.rooms.length * 0.35), `${label} should expose enough rooms to exterior walls for daylight`);
  assert.ok(yBands.size >= 3, `${label} should produce multi-zone geometry, not a single-row packing`);
  assert.ok(
    plan.generationNotes.some((note) => note.includes("graph placement") || note.includes("OR-Tools CP-SAT rectangle placement")),
    `${label} should report solver-based geometry generation`
  );
}

function assertPlannerRequiredAdjacencyOpenings(plan, brief, label, strict) {
  for (const spec of brief.rooms) {
    const room = plan.rooms.find((candidate) => candidate.id === spec.id || candidate.type === spec.type);
    if (!room) continue;

    for (const adjacentType of spec.adjacency) {
      const target = plan.rooms.find((candidate) => candidate.id === adjacentType || candidate.type === adjacentType);
      if (!target || !isCriticalDoorPair(room.type, target.type)) continue;

      const sharedWall = getSharedWall(room, target);
      if (!strict && !sharedWall) continue;
      assert.ok(sharedWall, `${label} should place ${room.type} and ${target.type} on a shared wall`);
      assert.ok(
        plan.doors.some((door) => doorOpensBetween(door, room, target, sharedWall)),
        `${label} should place a door/opening between ${room.type} and ${target.type}`
      );
    }
  }
}

function isCriticalDoorPair(a, b) {
  const pair = new Set([a, b]);
  if (pair.has("master_bedroom") && pair.has("ensuite")) return true;
  if (pair.has("hallway") && [...pair].some((type) => ["master_bedroom", "bedroom", "bathroom", "study"].includes(type))) return true;
  if (pair.has("entry") && (pair.has("living") || pair.has("studio"))) return true;
  if (pair.has("kitchen") && pair.has("dining")) return true;
  return false;
}

function doorOpensBetween(door, room, target, sharedWall) {
  if (door.roomId === room.id && door.wall === sharedWall.wallA) return true;
  if (door.roomId === target.id && door.wall === sharedWall.wallB) return true;
  return false;
}

function getSharedWall(a, b) {
  if (a.x + a.width === b.x) return verticalWall(a, b, "right", "left");
  if (b.x + b.width === a.x) return verticalWall(a, b, "left", "right");
  if (a.y + a.height === b.y) return horizontalWall(a, b, "bottom", "top");
  if (b.y + b.height === a.y) return horizontalWall(a, b, "top", "bottom");
  return null;
}

function verticalWall(a, b, wallA, wallB) {
  const overlap = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  return overlap > 0 ? { wallA, wallB } : null;
}

function horizontalWall(a, b, wallA, wallB) {
  const overlap = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  return overlap > 0 ? { wallA, wallB } : null;
}

function countSharedWallPairs(rooms) {
  let count = 0;
  for (let i = 0; i < rooms.length; i++) {
    for (let j = i + 1; j < rooms.length; j++) {
      if (sharedWallLength(rooms[i], rooms[j]) > 0) count += 1;
    }
  }
  return count;
}

function sharedWallLength(a, b) {
  if (a.x + a.width === b.x || b.x + b.width === a.x) {
    return Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  }
  if (a.y + a.height === b.y || b.y + b.height === a.y) {
    return Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
  }
  return 0;
}

function touchesExterior(room, rooms) {
  const minX = Math.min(...rooms.map((candidate) => candidate.x));
  const minY = Math.min(...rooms.map((candidate) => candidate.y));
  const maxX = Math.max(...rooms.map((candidate) => candidate.x + candidate.width));
  const maxY = Math.max(...rooms.map((candidate) => candidate.y + candidate.height));
  return room.x === minX || room.y === minY || room.x + room.width === maxX || room.y + room.height === maxY;
}

function isHexColor(value) {
  return /^#[0-9a-f]{6}$/i.test(value);
}

function roomsOverlap(a, b) {
  return !(
    b.x >= a.x + a.width
    || b.x + b.width <= a.x
    || b.y >= a.y + a.height
    || b.y + b.height <= a.y
  );
}
