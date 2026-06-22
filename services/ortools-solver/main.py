from __future__ import annotations

import time
from typing import Any, Literal

from fastapi import FastAPI
from pydantic import BaseModel, Field

try:
    from ortools.sat.python import cp_model
except Exception:  # pragma: no cover - keeps the service contract usable without local OR-Tools installed.
    cp_model = None


GRID = 50
MIN_ROOM_METERS = 2


class RoomSpec(BaseModel):
    id: str
    type: str
    label: str
    zone: Literal["public", "private", "service"]
    area: float
    minWidth: float = MIN_ROOM_METERS
    minDepth: float = MIN_ROOM_METERS
    aspectRatio: float = 1.2
    requiresWindow: bool = False
    adjacency: list[str] = Field(default_factory=list)


class PlannerBrief(BaseModel):
    userType: str | None = None
    projectType: str
    targetAreaSqm: float
    areaTolerance: float
    siteShape: str
    frontDoorSide: str
    rooms: list[RoomSpec]
    mustHave: list[str] = Field(default_factory=list)
    niceToHave: list[str] = Field(default_factory=list)
    unsupportedRequests: list[str] = Field(default_factory=list)


class FootprintBounds(BaseModel):
    width: int
    height: int
    shape: str


class SolverRequest(BaseModel):
    brief: PlannerBrief
    mode: Literal["fast", "quality"] = "fast"
    timeBudgetMs: int = 900
    footprint: FootprintBounds
    grid: int = GRID


class Room(BaseModel):
    id: str
    type: str
    label: str
    x: int
    y: int
    width: int
    height: int


class SharedWall(BaseModel):
    roomA: str
    roomB: str
    wallA: Literal["top", "bottom", "left", "right"]
    wallB: Literal["top", "bottom", "left", "right"]
    sharedLength: int
    positionA: float
    positionB: float


class Candidate(BaseModel):
    id: str
    rooms: list[Room]
    totalArea: int
    notes: list[str]
    footprintOverflowMeters: int = 0
    sharedWalls: list[SharedWall] = Field(default_factory=list)


class SolverResponse(BaseModel):
    backend: Literal["ortools_microservice"] = "ortools_microservice"
    status: Literal["feasible", "timeout", "infeasible"]
    candidates: list[Candidate]
    elapsedMs: int
    exploredCandidates: int
    notes: list[str]


app = FastAPI(title="Archy AI OR-Tools Spatial Solver", version="0.1.0")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/solve", response_model=SolverResponse)
def solve(request: SolverRequest) -> SolverResponse:
    started = time.perf_counter()
    limit = time.time() + max(0.1, request.timeBudgetMs / 1000)
    candidates: list[Candidate] = []
    variants = 80 if request.mode == "quality" else 32

    for index in range(variants):
        if time.time() > limit:
            break
        candidate = build_candidate(request, index)
        if candidate and not has_overlap(candidate.rooms):
            candidates.append(candidate)

    elapsed_ms = int((time.perf_counter() - started) * 1000)
    return SolverResponse(
        status="feasible" if candidates else "timeout",
        candidates=candidates,
        elapsedMs=elapsed_ms,
        exploredCandidates=variants,
        notes=[
            "OR-Tools service contract is active.",
            "Service attempts CP-SAT rectangle placement first and falls back to deterministic graph packing when infeasible.",
        ],
    )


def build_candidate(request: SolverRequest, index: int) -> Candidate | None:
    cp_candidate = build_cp_sat_candidate(request, index)
    if cp_candidate:
        return cp_candidate
    return build_deterministic_candidate(request, index)


def build_cp_sat_candidate(request: SolverRequest, index: int) -> Candidate | None:
    if cp_model is None:
        return None

    ordered = order_specs(request.brief.rooms, index)
    if not ordered:
        return None

    grid = max(1, request.grid)
    footprint_w = max(8, round(request.footprint.width / grid))
    footprint_h = max(8, round(request.footprint.height / grid))
    footprint_slack = 0 if request.mode == "quality" else 4
    max_x = footprint_w + footprint_slack
    max_y = footprint_h + footprint_slack
    model = cp_model.CpModel()

    x_vars = {}
    y_vars = {}
    widths = {}
    heights = {}
    x_intervals = []
    y_intervals = []

    for spec in ordered:
        width_px, height_px = room_size(spec)
        width = max(MIN_ROOM_METERS, round(width_px / grid))
        height = max(MIN_ROOM_METERS, round(height_px / grid))
        widths[spec.id] = width
        heights[spec.id] = height
        x = model.new_int_var(0, max_x, f"x_{spec.id}")
        y = model.new_int_var(0, max_y, f"y_{spec.id}")
        x_vars[spec.id] = x
        y_vars[spec.id] = y
        x_intervals.append(model.new_fixed_size_interval_var(x, width, f"x_interval_{spec.id}"))
        y_intervals.append(model.new_fixed_size_interval_var(y, height, f"y_interval_{spec.id}"))

    model.add_no_overlap_2d(x_intervals, y_intervals)

    overflow_terms = footprint_constraint_terms(model, ordered, x_vars, y_vars, widths, heights, footprint_w, footprint_h, request.mode)

    objective_terms = [term * 12 for term in overflow_terms]
    objective_terms.extend(adjacency_objective_terms(model, ordered, x_vars, y_vars, widths, heights, index))
    objective_terms.extend(circulation_objective_terms(model, ordered, x_vars, y_vars, widths, heights, index))
    objective_terms.extend(zone_objective_terms(model, ordered, x_vars, y_vars, footprint_w, footprint_h))
    objective_terms.extend(exterior_objective_terms(model, ordered, x_vars, y_vars, widths, heights, footprint_w, footprint_h))
    model.minimize(sum(objective_terms))

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = max(0.1, request.timeBudgetMs / 1000 / 2)
    solver.parameters.num_search_workers = 8
    status = solver.solve(model)
    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        return None

    rooms = [
        Room(
            id=spec.id,
            type=spec.type,
            label=spec.label,
            x=solver.value(x_vars[spec.id]) * grid,
            y=solver.value(y_vars[spec.id]) * grid,
            width=widths[spec.id] * grid,
            height=heights[spec.id] * grid,
        )
        for spec in ordered
    ]
    rooms = normalize_rooms(rooms)
    total_area = round(sum((room.width * room.height) / (GRID * GRID) for room in rooms))
    overflow = footprint_overflow(rooms, request.footprint)
    return Candidate(
        id=f"ortools_cpsat_{request.brief.siteShape}_{index + 1}",
        rooms=rooms,
        totalArea=total_area,
        footprintOverflowMeters=overflow,
        sharedWalls=shared_walls_for(rooms),
        notes=[
            "Generated by OR-Tools CP-SAT rectangle placement.",
            "Model used fixed room sizes, NoOverlap2D, mode-aware footprint containment, shared-wall adjacency constraints, circulation reachability constraints, adjacency distances, and role-independent zoning penalties.",
        ],
    )


def footprint_constraint_terms(model: Any, specs: list[RoomSpec], x_vars: dict[str, Any], y_vars: dict[str, Any], widths: dict[str, int], heights: dict[str, int], footprint_w: int, footprint_h: int, mode: Literal["fast", "quality"]) -> list[Any]:
    terms: list[Any] = []
    for spec in specs:
        if mode == "quality":
            model.add(x_vars[spec.id] + widths[spec.id] <= footprint_w)
            model.add(y_vars[spec.id] + heights[spec.id] <= footprint_h)
            continue

        overflow_x = model.new_int_var(0, 4, f"overflow_x_{spec.id}")
        overflow_y = model.new_int_var(0, 4, f"overflow_y_{spec.id}")
        model.add(x_vars[spec.id] + widths[spec.id] - footprint_w <= overflow_x)
        model.add(y_vars[spec.id] + heights[spec.id] - footprint_h <= overflow_y)
        terms.extend([overflow_x, overflow_y])
    return terms


def adjacency_objective_terms(model: Any, specs: list[RoomSpec], x_vars: dict[str, Any], y_vars: dict[str, Any], widths: dict[str, int], heights: dict[str, int], index: int) -> list[Any]:
    terms: list[Any] = []
    by_id = {spec.id: spec for spec in specs}
    by_type: dict[str, list[RoomSpec]] = {}
    for spec in specs:
        by_type.setdefault(spec.type, []).append(spec)

    for spec in specs:
        for target_key in spec.adjacency:
            targets = [by_id[target_key]] if target_key in by_id else by_type.get(target_key, [])
            for target in targets:
                touch_bools = wall_touch_bools(model, spec, target, x_vars, y_vars, widths, heights, index)
                if is_must_touch_pair(spec, target):
                    model.add(sum(touch_bools) >= 1)
                else:
                    missing_touch = model.new_bool_var(f"missing_touch_{spec.id}_{target.id}_{index}")
                    model.add(sum(touch_bools) + missing_touch >= 1)
                    terms.append(missing_touch * 28)

                dx = model.new_int_var(0, 200, f"dx_{spec.id}_{target.id}_{index}")
                dy = model.new_int_var(0, 200, f"dy_{spec.id}_{target.id}_{index}")
                spec_cx = x_vars[spec.id] * 2 + widths[spec.id]
                target_cx = x_vars[target.id] * 2 + widths[target.id]
                spec_cy = y_vars[spec.id] * 2 + heights[spec.id]
                target_cy = y_vars[target.id] * 2 + heights[target.id]
                model.add_abs_equality(dx, spec_cx - target_cx)
                model.add_abs_equality(dy, spec_cy - target_cy)
                terms.extend([dx * 2, dy * 2])
    return terms


def circulation_objective_terms(model: Any, specs: list[RoomSpec], x_vars: dict[str, Any], y_vars: dict[str, Any], widths: dict[str, int], heights: dict[str, int], index: int) -> list[Any]:
    terms: list[Any] = []
    entry = next((spec for spec in specs if spec.type == "entry"), None)
    public_target = next((spec for spec in specs if spec.type in {"living", "studio"}), None)
    hallways = [spec for spec in specs if spec.type == "hallway"]

    if entry and public_target:
        model.add(sum(wall_touch_bools(model, entry, public_target, x_vars, y_vars, widths, heights, index, "circulation_")) >= 1)

    if hallways:
        hallway = hallways[0]
        for spec in specs:
            if spec.id == hallway.id or spec.type not in {"master_bedroom", "bedroom", "bathroom", "study"}:
                continue
            model.add(sum(wall_touch_bools(model, spec, hallway, x_vars, y_vars, widths, heights, index, "circulation_")) >= 1)

            dx = model.new_int_var(0, 200, f"circulation_dx_{spec.id}_{hallway.id}_{index}")
            dy = model.new_int_var(0, 200, f"circulation_dy_{spec.id}_{hallway.id}_{index}")
            spec_cx = x_vars[spec.id] * 2 + widths[spec.id]
            hallway_cx = x_vars[hallway.id] * 2 + widths[hallway.id]
            spec_cy = y_vars[spec.id] * 2 + heights[spec.id]
            hallway_cy = y_vars[hallway.id] * 2 + heights[hallway.id]
            model.add_abs_equality(dx, spec_cx - hallway_cx)
            model.add_abs_equality(dy, spec_cy - hallway_cy)
            terms.extend([dx, dy])

    return terms


def wall_touch_bools(model: Any, a: RoomSpec, b: RoomSpec, x_vars: dict[str, Any], y_vars: dict[str, Any], widths: dict[str, int], heights: dict[str, int], index: int, prefix: str = "") -> list[Any]:
    min_overlap = max(1, min(widths[a.id], widths[b.id], heights[a.id], heights[b.id]) // 3)
    directions = [
        ("a_right_b_left", x_vars[a.id] + widths[a.id] == x_vars[b.id], y_vars[a.id] <= y_vars[b.id] + heights[b.id] - min_overlap, y_vars[b.id] <= y_vars[a.id] + heights[a.id] - min_overlap),
        ("b_right_a_left", x_vars[b.id] + widths[b.id] == x_vars[a.id], y_vars[a.id] <= y_vars[b.id] + heights[b.id] - min_overlap, y_vars[b.id] <= y_vars[a.id] + heights[a.id] - min_overlap),
        ("a_bottom_b_top", y_vars[a.id] + heights[a.id] == y_vars[b.id], x_vars[a.id] <= x_vars[b.id] + widths[b.id] - min_overlap, x_vars[b.id] <= x_vars[a.id] + widths[a.id] - min_overlap),
        ("b_bottom_a_top", y_vars[b.id] + heights[b.id] == y_vars[a.id], x_vars[a.id] <= x_vars[b.id] + widths[b.id] - min_overlap, x_vars[b.id] <= x_vars[a.id] + widths[a.id] - min_overlap),
    ]
    bools = []
    for label, edge_constraint, overlap_a, overlap_b in directions:
        touch = model.new_bool_var(f"touch_{prefix}{label}_{a.id}_{b.id}_{index}")
        model.add(edge_constraint).only_enforce_if(touch)
        model.add(overlap_a).only_enforce_if(touch)
        model.add(overlap_b).only_enforce_if(touch)
        bools.append(touch)
    return bools


def is_must_touch_pair(a: RoomSpec, b: RoomSpec) -> bool:
    pair = {a.type, b.type}
    if pair == {"master_bedroom", "ensuite"}:
        return True
    if "hallway" in pair and pair.intersection({"master_bedroom", "bedroom", "bathroom", "study"}):
        return True
    if pair == {"entry", "living"} or pair == {"entry", "studio"}:
        return True
    if pair == {"kitchen", "dining"}:
        return True
    return False


def zone_objective_terms(model: Any, specs: list[RoomSpec], x_vars: dict[str, Any], y_vars: dict[str, Any], footprint_w: int, footprint_h: int) -> list[Any]:
    terms: list[Any] = []
    for spec in specs:
        if spec.zone == "public":
            terms.append(y_vars[spec.id])
        elif spec.zone == "private":
            target_y = max(0, footprint_h - 4)
            dy = model.new_int_var(0, 200, f"private_dy_{spec.id}")
            model.add_abs_equality(dy, y_vars[spec.id] - target_y)
            terms.append(dy)
        elif spec.zone == "service":
            target_x = max(0, footprint_w // 2)
            dx = model.new_int_var(0, 200, f"service_dx_{spec.id}")
            model.add_abs_equality(dx, x_vars[spec.id] - target_x)
            terms.append(dx)
    return terms


def exterior_objective_terms(model: Any, specs: list[RoomSpec], x_vars: dict[str, Any], y_vars: dict[str, Any], widths: dict[str, int], heights: dict[str, int], footprint_w: int, footprint_h: int) -> list[Any]:
    terms: list[Any] = []
    for spec in specs:
        if not spec.requiresWindow:
            continue
        right_distance = model.new_int_var(0, 200, f"exterior_right_{spec.id}")
        bottom_distance = model.new_int_var(0, 200, f"exterior_bottom_{spec.id}")
        nearest_exterior = model.new_int_var(0, 200, f"nearest_exterior_{spec.id}")
        model.add_abs_equality(right_distance, x_vars[spec.id] + widths[spec.id] - footprint_w)
        model.add_abs_equality(bottom_distance, y_vars[spec.id] + heights[spec.id] - footprint_h)
        model.add_min_equality(nearest_exterior, [x_vars[spec.id], y_vars[spec.id], right_distance, bottom_distance])
        terms.append(nearest_exterior * 3)
    return terms


def build_deterministic_candidate(request: SolverRequest, index: int) -> Candidate | None:
    rooms: list[Room] = []
    ordered = order_specs(request.brief.rooms, index)

    for spec in ordered:
        width, height = room_size(spec)
        room = place_room(spec, width, height, rooms, index)
        if room is None:
            return None
        rooms.append(room)

    rooms = normalize_rooms(rooms)
    total_area = round(sum((room.width * room.height) / (GRID * GRID) for room in rooms))
    overflow = footprint_overflow(rooms, request.footprint)
    return Candidate(
        id=f"ortools_contract_{request.brief.siteShape}_{index + 1}",
        rooms=rooms,
        totalArea=total_area,
        footprintOverflowMeters=overflow,
        sharedWalls=shared_walls_for(rooms),
        notes=[
            "Generated by OR-Tools service deterministic fallback.",
            "Fallback uses graph-aware placement when CP-SAT is unavailable or infeasible.",
        ],
    )


def order_specs(specs: list[RoomSpec], index: int) -> list[RoomSpec]:
    zone_order = ["public", "service", "private"] if index % 2 == 0 else ["public", "private", "service"]
    priority = ["entry", "garage", "living", "studio", "kitchen", "dining", "hallway", "bathroom", "ensuite", "laundry", "master_bedroom", "bedroom", "study"]
    return sorted(
        specs,
        key=lambda spec: (
            zone_order.index(spec.zone) if spec.zone in zone_order else len(zone_order),
            priority.index(spec.type) if spec.type in priority else len(priority),
            -spec.area,
        ),
    )


def room_size(spec: RoomSpec) -> tuple[int, int]:
    width_m = max(spec.minWidth, (spec.area * max(spec.aspectRatio, 0.6)) ** 0.5)
    height_m = max(spec.minDepth, spec.area / width_m)
    return max(GRID * MIN_ROOM_METERS, round(width_m) * GRID), max(GRID * MIN_ROOM_METERS, round(height_m) * GRID)


def place_room(spec: RoomSpec, width: int, height: int, rooms: list[Room], index: int) -> Room | None:
    base: dict[str, Any] = {"id": unique_id(spec.id, rooms), "type": spec.type, "label": spec.label, "width": width, "height": height}
    if not rooms:
        return Room(**base, x=0, y=0)

    anchors = preferred_anchors(spec, rooms)
    candidates: list[Room] = []
    for anchor in anchors:
        candidates.extend([
            Room(**base, x=anchor.x + anchor.width, y=anchor.y),
            Room(**base, x=anchor.x - width, y=anchor.y),
            Room(**base, x=anchor.x, y=anchor.y + anchor.height),
            Room(**base, x=anchor.x, y=anchor.y - height),
        ])

    valid = [candidate for candidate in candidates if not any(overlap(candidate, room) for room in rooms)]
    if valid:
        return max(valid, key=lambda candidate: placement_score(candidate, spec, rooms))

    bounds = bounds_for(rooms)
    fallback = Room(**base, x=bounds[2], y=bounds[1] + (index % 3) * GRID)
    return fallback if not any(overlap(fallback, room) for room in rooms) else None


def preferred_anchors(spec: RoomSpec, rooms: list[Room]) -> list[Room]:
    preferred = [room for room in rooms if room.type in spec.adjacency or room.id in spec.adjacency]
    return preferred + [room for room in rooms if room not in preferred]


def placement_score(candidate: Room, spec: RoomSpec, rooms: list[Room]) -> float:
    score = 0.0
    for room in rooms:
        if room.type in spec.adjacency or room.id in spec.adjacency:
            score += 40 if shared_wall(candidate, room) > 0 else max(0, 20 - distance(candidate, room) / GRID)
        elif shared_wall(candidate, room) > 0:
            score += 4
    return score


def normalize_rooms(rooms: list[Room]) -> list[Room]:
    min_x = min(room.x for room in rooms)
    min_y = min(room.y for room in rooms)
    return [room.model_copy(update={"x": room.x - min_x, "y": room.y - min_y}) for room in rooms]


def footprint_overflow(rooms: list[Room], footprint: FootprintBounds) -> int:
    min_x, min_y, max_x, max_y = bounds_for(rooms)
    return round((max(0, max_x - min_x - footprint.width) + max(0, max_y - min_y - footprint.height)) / GRID)


def bounds_for(rooms: list[Room]) -> tuple[int, int, int, int]:
    return min(room.x for room in rooms), min(room.y for room in rooms), max(room.x + room.width for room in rooms), max(room.y + room.height for room in rooms)


def unique_id(base_id: str, rooms: list[Room]) -> str:
    used = {room.id for room in rooms}
    if base_id not in used:
        return base_id
    index = 2
    while f"{base_id}_{index}" in used:
        index += 1
    return f"{base_id}_{index}"


def has_overlap(rooms: list[Room]) -> bool:
    return any(overlap(a, b) for index, a in enumerate(rooms) for b in rooms[index + 1 :])


def overlap(a: Room, b: Room) -> bool:
    return a.x < b.x + b.width and a.x + a.width > b.x and a.y < b.y + b.height and a.y + a.height > b.y


def shared_wall(a: Room, b: Room) -> int:
    if a.x + a.width == b.x or b.x + b.width == a.x:
        return max(0, min(a.y + a.height, b.y + b.height) - max(a.y, b.y))
    if a.y + a.height == b.y or b.y + b.height == a.y:
        return max(0, min(a.x + a.width, b.x + b.width) - max(a.x, b.x))
    return 0


def shared_walls_for(rooms: list[Room]) -> list[SharedWall]:
    shared_walls: list[SharedWall] = []
    for index, room in enumerate(rooms):
        for other in rooms[index + 1:]:
            shared_wall = shared_wall_for(room, other)
            if shared_wall:
                shared_walls.append(shared_wall)
    return shared_walls


def shared_wall_for(a: Room, b: Room) -> SharedWall | None:
    if a.x + a.width == b.x:
        return vertical_shared_wall(a, b, "right", "left")
    if b.x + b.width == a.x:
        return vertical_shared_wall(a, b, "left", "right")
    if a.y + a.height == b.y:
        return horizontal_shared_wall(a, b, "bottom", "top")
    if b.y + b.height == a.y:
        return horizontal_shared_wall(a, b, "top", "bottom")
    return None


def vertical_shared_wall(a: Room, b: Room, wall_a: Literal["left", "right"], wall_b: Literal["left", "right"]) -> SharedWall | None:
    start = max(a.y, b.y)
    end = min(a.y + a.height, b.y + b.height)
    if end <= start:
        return None
    center = start + (end - start) / 2
    return SharedWall(
        roomA=a.id,
        roomB=b.id,
        wallA=wall_a,
        wallB=wall_b,
        sharedLength=end - start,
        positionA=round((center - a.y) / a.height, 2),
        positionB=round((center - b.y) / b.height, 2),
    )


def horizontal_shared_wall(a: Room, b: Room, wall_a: Literal["top", "bottom"], wall_b: Literal["top", "bottom"]) -> SharedWall | None:
    start = max(a.x, b.x)
    end = min(a.x + a.width, b.x + b.width)
    if end <= start:
        return None
    center = start + (end - start) / 2
    return SharedWall(
        roomA=a.id,
        roomB=b.id,
        wallA=wall_a,
        wallB=wall_b,
        sharedLength=end - start,
        positionA=round((center - a.x) / a.width, 2),
        positionB=round((center - b.x) / b.width, 2),
    )


def distance(a: Room, b: Room) -> int:
    return abs((a.x + a.width // 2) - (b.x + b.width // 2)) + abs((a.y + a.height // 2) - (b.y + b.height // 2))
