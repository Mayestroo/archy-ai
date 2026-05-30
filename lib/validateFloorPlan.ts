import type { FloorPlan, Room } from "./floorplan-schema";

const SNAP_THRESHOLD = 25; // More aggressive threshold for global alignment

export function validateAndFixFloorPlan(floorPlan: FloorPlan): FloorPlan {
  if (!floorPlan.rooms || floorPlan.rooms.length === 0) return floorPlan;
  
  const rooms = JSON.parse(JSON.stringify(floorPlan.rooms)) as Room[];
  
  // 1. Global Boundary Unification
  // We want to find common X and Y coordinates (axes) and snap everyone to them.
  unifyBoundaries(rooms);
  
  // 2. Resolve Overlaps (Post-unification)
  resolveOverlaps(rooms);
  
  // 3. Final Snap for micro-gaps
  snapToNearestNeighbors(rooms);

  // Recalculate total area based on fixed coordinates
  let totalArea = 0;
  rooms.forEach(r => {
    totalArea += (r.width / 50) * (r.height / 50);
  });

  return {
    ...floorPlan,
    rooms,
    totalArea
  };
}

function unifyBoundaries(rooms: Room[]) {
    // Identify all x-coordinates (starts and ends)
    const xCoords: number[] = [];
    const yCoords: number[] = [];
    
    rooms.forEach(r => {
        xCoords.push(r.x, r.x + r.width);
        yCoords.push(r.y, r.y + r.height);
    });

    const unifiedX = findUnifiedAxes(xCoords);
    const unifiedY = findUnifiedAxes(yCoords);

    // Apply unification
    rooms.forEach(r => {
        const left = findNearest(r.x, unifiedX);
        const right = findNearest(r.x + r.width, unifiedX);
        const top = findNearest(r.y, unifiedY);
        const bottom = findNearest(r.y + r.height, unifiedY);

        r.x = left;
        r.width = Math.max(50, right - left); // Ensure min size
        r.y = top;
        r.height = Math.max(50, bottom - top);
    });
}

function findUnifiedAxes(coords: number[]): number[] {
    const sorted = [...coords].sort((a, b) => a - b);
    if (sorted.length === 0) return [];

    const axes: number[] = [];
    let currentCluster = [sorted[0]];

    for (let i = 1; i < sorted.length; i++) {
        if (sorted[i] - sorted[i - 1] < SNAP_THRESHOLD) {
            currentCluster.push(sorted[i]);
        } else {
            // End of cluster, average it
            const avg = Math.round(currentCluster.reduce((a, b) => a + b, 0) / currentCluster.length);
            axes.push(avg);
            currentCluster = [sorted[i]];
        }
    }
    // Last cluster
    const avg = Math.round(currentCluster.reduce((a, b) => a + b, 0) / currentCluster.length);
    axes.push(avg);

    return axes;
}

function findNearest(val: number, axes: number[]): number {
    return axes.reduce((prev, curr) => 
        Math.abs(curr - val) < Math.abs(prev - val) ? curr : prev
    );
}

function resolveOverlaps(rooms: Room[]) {
  for (let pass = 0; pass < 5; pass++) {
    for (let i = 0; i < rooms.length; i++) {
        for (let j = i + 1; j < rooms.length; j++) {
            const r1 = rooms[i];
            const r2 = rooms[j];

            if (isOverlapping(r1, r2)) {
                const dx = Math.min(r1.x + r1.width, r2.x + r2.width) - Math.max(r1.x, r2.x);
                const dy = Math.min(r1.y + r1.height, r2.y + r2.height) - Math.max(r1.y, r2.y);

                if (dx < dy) {
                    if (r1.x < r2.x) r2.x += dx;
                    else r2.x -= dx;
                } else {
                    if (r1.y < r2.y) r2.y += dy;
                    else r2.y -= dy;
                }
            }
        }
    }
  }
}

function snapToNearestNeighbors(rooms: Room[]) {
    // Final pass to close gaps between rooms that should be adjacent
    for (const r1 of rooms) {
        for (const r2 of rooms) {
            if (r1.id === r2.id) continue;
            
            // Snap X
            if (Math.abs((r1.x + r1.width) - r2.x) < 10) {
                 if (isVerticallyAligned(r1, r2)) r2.x = r1.x + r1.width;
            }
            if (Math.abs(r1.x - (r2.x + r2.width)) < 10) {
                 if (isVerticallyAligned(r1, r2)) r2.x = r1.x - r2.width;
            }

            // Snap Y
            if (Math.abs((r1.y + r1.height) - r2.y) < 10) {
                 if (isHorizontalAligned(r1, r2)) r2.y = r1.y + r1.height;
            }
            if (Math.abs(r1.y - (r2.y + r2.height)) < 10) {
                 if (isHorizontalAligned(r1, r2)) r2.y = r1.y - r2.height;
            }
        }
    }
}

function isOverlapping(r1: Room, r2: Room): boolean {
    // Use a tiny epsilon to allow perfect wall sharedness without overlap flagging
    return !(r2.x >= r1.x + r1.width - 0.1 || 
             r2.x + r2.width <= r1.x + 0.1 || 
             r2.y >= r1.y + r1.height - 0.1 || 
             r2.y + r2.height <= r1.y + 0.1);
}

function isVerticallyAligned(r1: Room, r2: Room): boolean {
    const overlap = Math.min(r1.y + r1.height, r2.y + r2.height) - Math.max(r1.y, r2.y);
    return overlap > 5;
}

function isHorizontalAligned(r1: Room, r2: Room): boolean {
    const overlap = Math.min(r1.x + r1.width, r2.x + r2.width) - Math.max(r1.x, r2.x);
    return overlap > 5;
}
