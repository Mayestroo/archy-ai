# OR-Tools Spatial Solver Service

Minimal HTTP contract for the future CP-SAT spatial solver.

## Run Locally

```bash
python -m venv .venv
.venv/Scripts/pip install -r services/ortools-solver/requirements.txt
.venv/Scripts/python -m uvicorn main:app --app-dir services/ortools-solver --host 127.0.0.1 --port 8787
```

Set the Next.js backend to use it:

```bash
SPATIAL_SOLVER_BACKEND=ortools
SPATIAL_SOLVER_URL=http://127.0.0.1:8787/solve
```

If the service fails, the app falls back to the in-process TypeScript hybrid solver.

## Contract

`POST /solve` receives the planner brief, footprint bounds, generation mode, and time budget. It returns solver status, explored candidate count, elapsed time, and editable room-box candidates compatible with the current `FloorPlan` schema.

The service now attempts an OR-Tools CP-SAT rectangle-placement model first. The model uses fixed room sizes, `NoOverlap2D`, footprint overflow slack, adjacency distance minimization, and simple zoning penalties. If CP-SAT is unavailable or infeasible, it falls back to deterministic graph-aware placement without changing the TypeScript adapter contract.
