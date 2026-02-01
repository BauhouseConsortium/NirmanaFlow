/**
 * Delaunay Triangulation using Bowyer-Watson Algorithm
 * Generates triangle mesh from a set of points
 */

import type { Point, Path } from './drawingApi';

interface Triangle {
  p1: Point;
  p2: Point;
  p3: Point;
}

interface Circle {
  center: Point;
  radiusSq: number;
}

/**
 * Calculate circumcircle of a triangle
 */
function circumcircle(t: Triangle): Circle {
  const [ax, ay] = t.p1;
  const [bx, by] = t.p2;
  const [cx, cy] = t.p3;

  const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
  
  if (Math.abs(d) < 1e-10) {
    // Degenerate triangle
    return {
      center: [(ax + bx + cx) / 3, (ay + by + cy) / 3],
      radiusSq: Infinity,
    };
  }

  const ax2 = ax * ax + ay * ay;
  const bx2 = bx * bx + by * by;
  const cx2 = cx * cx + cy * cy;

  const ux = (ax2 * (by - cy) + bx2 * (cy - ay) + cx2 * (ay - by)) / d;
  const uy = (ax2 * (cx - bx) + bx2 * (ax - cx) + cx2 * (bx - ax)) / d;

  const dx = ax - ux;
  const dy = ay - uy;

  return {
    center: [ux, uy],
    radiusSq: dx * dx + dy * dy,
  };
}

/**
 * Check if point is inside circumcircle
 */
function inCircumcircle(p: Point, t: Triangle): boolean {
  const circle = circumcircle(t);
  const dx = p[0] - circle.center[0];
  const dy = p[1] - circle.center[1];
  return dx * dx + dy * dy <= circle.radiusSq;
}

/**
 * Check if two edges are the same (in either direction)
 */
function edgesEqual(e1: [Point, Point], e2: [Point, Point]): boolean {
  const eps = 1e-10;
  const match1 = 
    Math.abs(e1[0][0] - e2[0][0]) < eps && Math.abs(e1[0][1] - e2[0][1]) < eps &&
    Math.abs(e1[1][0] - e2[1][0]) < eps && Math.abs(e1[1][1] - e2[1][1]) < eps;
  const match2 = 
    Math.abs(e1[0][0] - e2[1][0]) < eps && Math.abs(e1[0][1] - e2[1][1]) < eps &&
    Math.abs(e1[1][0] - e2[0][0]) < eps && Math.abs(e1[1][1] - e2[0][1]) < eps;
  return match1 || match2;
}

/**
 * Get edges of a triangle
 */
function triangleEdges(t: Triangle): [Point, Point][] {
  return [
    [t.p1, t.p2],
    [t.p2, t.p3],
    [t.p3, t.p1],
  ];
}

/**
 * Perform Delaunay triangulation using Bowyer-Watson algorithm
 * @param points - Array of points to triangulate
 * @returns Array of paths representing triangle edges
 */
export function delaunayTriangulate(points: Point[]): Path[] {
  if (points.length < 3) {
    return [];
  }

  // Find bounding box
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of points) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }

  // Add margin
  const dx = maxX - minX;
  const dy = maxY - minY;
  const margin = Math.max(dx, dy) * 10;

  // Create super-triangle that contains all points
  const superTriangle: Triangle = {
    p1: [minX - margin, minY - margin],
    p2: [maxX + margin * 2, minY - margin],
    p3: [(minX + maxX) / 2, maxY + margin * 2],
  };

  let triangles: Triangle[] = [superTriangle];

  // Add points one at a time
  for (const point of points) {
    // Find all triangles whose circumcircle contains this point
    const badTriangles: Triangle[] = [];
    for (const t of triangles) {
      if (inCircumcircle(point, t)) {
        badTriangles.push(t);
      }
    }

    // Find the boundary of the polygonal hole
    const polygon: [Point, Point][] = [];
    for (const t of badTriangles) {
      for (const edge of triangleEdges(t)) {
        // Edge is part of boundary if it's not shared by any other bad triangle
        let shared = false;
        for (const other of badTriangles) {
          if (other === t) continue;
          for (const otherEdge of triangleEdges(other)) {
            if (edgesEqual(edge, otherEdge)) {
              shared = true;
              break;
            }
          }
          if (shared) break;
        }
        if (!shared) {
          polygon.push(edge);
        }
      }
    }

    // Remove bad triangles
    triangles = triangles.filter(t => !badTriangles.includes(t));

    // Re-triangulate the polygonal hole with new triangles connecting to the point
    for (const edge of polygon) {
      triangles.push({
        p1: edge[0],
        p2: edge[1],
        p3: point,
      });
    }
  }

  // Remove triangles that share vertices with super-triangle
  const superVerts = [superTriangle.p1, superTriangle.p2, superTriangle.p3];
  const isSuperVertex = (p: Point): boolean => {
    return superVerts.some(sv => 
      Math.abs(sv[0] - p[0]) < 1e-10 && Math.abs(sv[1] - p[1]) < 1e-10
    );
  };

  triangles = triangles.filter(t => 
    !isSuperVertex(t.p1) && !isSuperVertex(t.p2) && !isSuperVertex(t.p3)
  );

  // Convert triangles to paths (closed loops)
  const paths: Path[] = [];
  for (const t of triangles) {
    paths.push([t.p1, t.p2, t.p3, t.p1]); // Closed triangle path
  }

  return paths;
}

/**
 * Extract unique edges from triangulation (no duplicates)
 */
export function delaunayEdges(points: Point[]): Path[] {
  if (points.length < 3) {
    return [];
  }

  const trianglePaths = delaunayTriangulate(points);
  const edgeSet = new Set<string>();
  const edges: Path[] = [];

  for (const path of trianglePaths) {
    for (let i = 0; i < path.length - 1; i++) {
      const p1 = path[i];
      const p2 = path[i + 1];
      
      // Create normalized edge key
      const key = p1[0] < p2[0] || (p1[0] === p2[0] && p1[1] < p2[1])
        ? `${p1[0].toFixed(6)},${p1[1].toFixed(6)}-${p2[0].toFixed(6)},${p2[1].toFixed(6)}`
        : `${p2[0].toFixed(6)},${p2[1].toFixed(6)}-${p1[0].toFixed(6)},${p1[1].toFixed(6)}`;
      
      if (!edgeSet.has(key)) {
        edgeSet.add(key);
        edges.push([p1, p2]);
      }
    }
  }

  return edges;
}

/**
 * Extract points from paths (for triangulation)
 */
export function extractPoints(paths: Path[], sampleDistance?: number): Point[] {
  const points: Point[] = [];
  const pointSet = new Set<string>();

  const addPoint = (p: Point) => {
    const key = `${p[0].toFixed(4)},${p[1].toFixed(4)}`;
    if (!pointSet.has(key)) {
      pointSet.add(key);
      points.push(p);
    }
  };

  for (const path of paths) {
    if (sampleDistance && sampleDistance > 0) {
      // Sample points along the path at regular intervals
      for (let i = 0; i < path.length - 1; i++) {
        const p1 = path[i];
        const p2 = path[i + 1];
        const dx = p2[0] - p1[0];
        const dy = p2[1] - p1[1];
        const len = Math.sqrt(dx * dx + dy * dy);
        const steps = Math.max(1, Math.ceil(len / sampleDistance));
        
        for (let j = 0; j <= steps; j++) {
          const t = j / steps;
          addPoint([p1[0] + dx * t, p1[1] + dy * t]);
        }
      }
    } else {
      // Just use path vertices
      for (const p of path) {
        addPoint(p);
      }
    }
  }

  return points;
}
