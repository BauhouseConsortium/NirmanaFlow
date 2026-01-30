/**
 * Convert 2D paths to extruded 3D STL binary
 * 
 * This module takes 2D vector paths and extrudes them into 3D geometry,
 * then serializes as binary STL format for slicing.
 */

import type { Path, Point } from './drawingApi';

// STL binary format constants
const STL_HEADER_SIZE = 80;
const STL_TRIANGLE_SIZE = 50; // 12 floats (normal + 3 vertices) + 2 bytes attribute

/**
 * Triangulate a polygon using ear clipping algorithm (simple implementation)
 * Returns array of triangle indices
 */
function triangulatePolygon(points: Point[]): number[][] {
  if (points.length < 3) return [];
  
  // Simple fan triangulation from first vertex
  // Works correctly for convex polygons
  const triangles: number[][] = [];
  for (let i = 1; i < points.length - 1; i++) {
    triangles.push([0, i, i + 1]);
  }
  return triangles;
}

/**
 * Check if a polygon is clockwise oriented
 */
function isClockwise(points: Point[]): boolean {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const p1 = points[i];
    const p2 = points[(i + 1) % points.length];
    sum += (p2[0] - p1[0]) * (p2[1] + p1[1]);
  }
  return sum > 0;
}

/**
 * Ensure polygon is counter-clockwise (standard for STL outward normals)
 */
function ensureCCW(points: Point[]): Point[] {
  if (isClockwise(points)) {
    return [...points].reverse();
  }
  return points;
}

/**
 * Calculate normal vector for a triangle
 */
function calculateNormal(
  v1: [number, number, number],
  v2: [number, number, number],
  v3: [number, number, number]
): [number, number, number] {
  // Edge vectors
  const e1: [number, number, number] = [v2[0] - v1[0], v2[1] - v1[1], v2[2] - v1[2]];
  const e2: [number, number, number] = [v3[0] - v1[0], v3[1] - v1[1], v3[2] - v1[2]];
  
  // Cross product
  const nx = e1[1] * e2[2] - e1[2] * e2[1];
  const ny = e1[2] * e2[0] - e1[0] * e2[2];
  const nz = e1[0] * e2[1] - e1[1] * e2[0];
  
  // Normalize
  const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
  if (len === 0) return [0, 0, 1];
  
  return [nx / len, ny / len, nz / len];
}

/**
 * Close a path if not already closed
 */
function closePath(path: Path): Point[] {
  if (path.length < 2) return path;
  
  const first = path[0];
  const last = path[path.length - 1];
  
  // Check if already closed (within tolerance)
  const dx = Math.abs(first[0] - last[0]);
  const dy = Math.abs(first[1] - last[1]);
  
  if (dx < 0.001 && dy < 0.001) {
    return path.slice(0, -1); // Remove duplicate closing point
  }
  
  return path;
}

/**
 * Generate triangles for extruded path
 * Returns array of triangles, each triangle is 3 vertices with [x, y, z]
 */
function generateExtrudedTriangles(
  path: Path,
  height: number,
  wallThickness: number
): Array<[[number, number, number], [number, number, number], [number, number, number]]> {
  const triangles: Array<[[number, number, number], [number, number, number], [number, number, number]]> = [];
  
  // Close the path
  const closedPath = closePath(path);
  if (closedPath.length < 3) return triangles;
  
  // Ensure counter-clockwise winding
  const ccwPath = ensureCCW(closedPath);
  
  const n = ccwPath.length;
  
  // Create offset path for wall thickness (simple offset)
  const innerPath: Point[] = [];
  const outerPath = ccwPath;
  
  if (wallThickness > 0) {
    // Calculate centroid for offset direction
    let cx = 0, cy = 0;
    for (const p of outerPath) {
      cx += p[0];
      cy += p[1];
    }
    cx /= n;
    cy /= n;
    
    // Create inner path by offsetting toward centroid
    for (const p of outerPath) {
      const dx = cx - p[0];
      const dy = cy - p[1];
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 0.001) {
        const scale = Math.min(wallThickness / dist, 0.9);
        innerPath.push([p[0] + dx * scale, p[1] + dy * scale]);
      } else {
        innerPath.push(p);
      }
    }
  }
  
  // Generate side walls (between z=0 and z=height)
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    
    // Outer wall vertices
    const p1: [number, number, number] = [outerPath[i][0], outerPath[i][1], 0];
    const p2: [number, number, number] = [outerPath[j][0], outerPath[j][1], 0];
    const p3: [number, number, number] = [outerPath[j][0], outerPath[j][1], height];
    const p4: [number, number, number] = [outerPath[i][0], outerPath[i][1], height];
    
    // Two triangles for outer wall quad
    triangles.push([p1, p3, p2]); // CCW when viewed from outside
    triangles.push([p1, p4, p3]);
    
    // Inner wall (if wall thickness specified)
    if (innerPath.length > 0) {
      const ip1: [number, number, number] = [innerPath[i][0], innerPath[i][1], 0];
      const ip2: [number, number, number] = [innerPath[j][0], innerPath[j][1], 0];
      const ip3: [number, number, number] = [innerPath[j][0], innerPath[j][1], height];
      const ip4: [number, number, number] = [innerPath[i][0], innerPath[i][1], height];
      
      // Inner wall faces inward (reversed winding)
      triangles.push([ip1, ip2, ip3]);
      triangles.push([ip1, ip3, ip4]);
    }
  }
  
  // Generate top and bottom caps
  const topCapTriangles = triangulatePolygon(outerPath);
  
  for (const tri of topCapTriangles) {
    // Bottom cap (z=0, facing down)
    triangles.push([
      [outerPath[tri[0]][0], outerPath[tri[0]][1], 0],
      [outerPath[tri[2]][0], outerPath[tri[2]][1], 0],
      [outerPath[tri[1]][0], outerPath[tri[1]][1], 0],
    ]);
    
    // Top cap (z=height, facing up)
    triangles.push([
      [outerPath[tri[0]][0], outerPath[tri[0]][1], height],
      [outerPath[tri[1]][0], outerPath[tri[1]][1], height],
      [outerPath[tri[2]][0], outerPath[tri[2]][1], height],
    ]);
  }
  
  // If we have inner path, add top/bottom rings
  if (innerPath.length > 0) {
    // Top ring (between outer and inner at z=height)
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      
      const o1: [number, number, number] = [outerPath[i][0], outerPath[i][1], height];
      const o2: [number, number, number] = [outerPath[j][0], outerPath[j][1], height];
      const i1: [number, number, number] = [innerPath[i][0], innerPath[i][1], height];
      const i2: [number, number, number] = [innerPath[j][0], innerPath[j][1], height];
      
      triangles.push([o1, o2, i2]);
      triangles.push([o1, i2, i1]);
    }
    
    // Bottom ring
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      
      const o1: [number, number, number] = [outerPath[i][0], outerPath[i][1], 0];
      const o2: [number, number, number] = [outerPath[j][0], outerPath[j][1], 0];
      const i1: [number, number, number] = [innerPath[i][0], innerPath[i][1], 0];
      const i2: [number, number, number] = [innerPath[j][0], innerPath[j][1], 0];
      
      triangles.push([o1, i2, o2]);
      triangles.push([o1, i1, i2]);
    }
  }
  
  return triangles;
}

/**
 * Write a single triangle to the STL data view
 */
function writeTriangle(
  view: DataView,
  offset: number,
  v1: [number, number, number],
  v2: [number, number, number],
  v3: [number, number, number]
): void {
  const normal = calculateNormal(v1, v2, v3);
  
  // Normal vector (3 floats)
  view.setFloat32(offset, normal[0], true);
  view.setFloat32(offset + 4, normal[1], true);
  view.setFloat32(offset + 8, normal[2], true);
  
  // Vertex 1 (3 floats)
  view.setFloat32(offset + 12, v1[0], true);
  view.setFloat32(offset + 16, v1[1], true);
  view.setFloat32(offset + 20, v1[2], true);
  
  // Vertex 2 (3 floats)
  view.setFloat32(offset + 24, v2[0], true);
  view.setFloat32(offset + 28, v2[1], true);
  view.setFloat32(offset + 32, v2[2], true);
  
  // Vertex 3 (3 floats)
  view.setFloat32(offset + 36, v3[0], true);
  view.setFloat32(offset + 40, v3[1], true);
  view.setFloat32(offset + 44, v3[2], true);
  
  // Attribute byte count (must be 0)
  view.setUint16(offset + 48, 0, true);
}

/**
 * Convert 2D paths to binary STL format
 * 
 * @param paths - Array of 2D paths to extrude
 * @param height - Extrusion height in mm
 * @param wallThickness - Wall thickness for hollow extrusion (0 = solid)
 * @returns Binary STL data as ArrayBuffer
 */
export function pathsToStl(
  paths: Path[],
  height: number,
  wallThickness: number = 0
): ArrayBuffer {
  // Collect all triangles from all paths
  const allTriangles: Array<[[number, number, number], [number, number, number], [number, number, number]]> = [];
  
  for (const path of paths) {
    const triangles = generateExtrudedTriangles(path, height, wallThickness);
    allTriangles.push(...triangles);
  }
  
  // Calculate buffer size
  const numTriangles = allTriangles.length;
  const bufferSize = STL_HEADER_SIZE + 4 + numTriangles * STL_TRIANGLE_SIZE;
  
  // Create buffer and view
  const buffer = new ArrayBuffer(bufferSize);
  const view = new DataView(buffer);
  
  // Write header (80 bytes, can be anything)
  const header = 'Binary STL generated by Brush - CuraWASM Slicer Node';
  for (let i = 0; i < Math.min(header.length, 80); i++) {
    view.setUint8(i, header.charCodeAt(i));
  }
  
  // Write triangle count
  view.setUint32(STL_HEADER_SIZE, numTriangles, true);
  
  // Write triangles
  let offset = STL_HEADER_SIZE + 4;
  for (const [v1, v2, v3] of allTriangles) {
    writeTriangle(view, offset, v1, v2, v3);
    offset += STL_TRIANGLE_SIZE;
  }
  
  return buffer;
}

/**
 * Get bounding box of paths for centering
 */
export function getPathsBounds(paths: Path[]): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
} {
  let minX = Infinity, minY = Infinity;
  let maxX = -Infinity, maxY = -Infinity;
  
  for (const path of paths) {
    for (const [x, y] of path) {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  
  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2,
  };
}

/**
 * Center and scale paths for slicing (optional preprocessing)
 */
export function centerPaths(paths: Path[], targetSize: number = 100): Path[] {
  const bounds = getPathsBounds(paths);
  const scale = targetSize / Math.max(bounds.width, bounds.height, 1);
  
  return paths.map(path =>
    path.map(([x, y]) => [
      (x - bounds.centerX) * scale,
      (y - bounds.centerY) * scale,
    ] as Point)
  );
}
