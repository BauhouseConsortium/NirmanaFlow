/**
 * OBJ File Loader and 3D Geometry Utilities
 * Parses OBJ files and provides geometry data structures
 */

import type { Point } from './drawingApi';

// 3D Vector type
export type Vec3 = [number, number, number];

// 3D Geometry data structure
export interface Geometry3D {
  vertices: Vec3[];
  edges: [number, number][]; // Pairs of vertex indices
  faces: number[][]; // Arrays of vertex indices per face
  bounds: {
    min: Vec3;
    max: Vec3;
    center: Vec3;
    size: Vec3;
  };
}

/**
 * Parse OBJ file content into Geometry3D
 */
export function parseOBJ(content: string): Geometry3D {
  const vertices: Vec3[] = [];
  const faces: number[][] = [];
  const edgeSet = new Set<string>();
  
  const lines = content.split('\n');
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    
    const parts = trimmed.split(/\s+/);
    const type = parts[0];
    
    if (type === 'v') {
      // Vertex: v x y z
      const x = parseFloat(parts[1]) || 0;
      const y = parseFloat(parts[2]) || 0;
      const z = parseFloat(parts[3]) || 0;
      vertices.push([x, y, z]);
    } else if (type === 'f') {
      // Face: f v1 v2 v3 ... or f v1/vt1/vn1 v2/vt2/vn2 ...
      const faceIndices: number[] = [];
      
      for (let i = 1; i < parts.length; i++) {
        // Handle formats: v, v/vt, v/vt/vn, v//vn
        const vertexPart = parts[i].split('/')[0];
        let index = parseInt(vertexPart, 10);
        
        // OBJ indices are 1-based, convert to 0-based
        // Negative indices are relative to current vertex count
        if (index < 0) {
          index = vertices.length + index;
        } else {
          index = index - 1;
        }
        
        faceIndices.push(index);
      }
      
      if (faceIndices.length >= 3) {
        faces.push(faceIndices);
        
        // Extract edges from face
        for (let i = 0; i < faceIndices.length; i++) {
          const a = faceIndices[i];
          const b = faceIndices[(i + 1) % faceIndices.length];
          // Normalize edge order for deduplication
          const edgeKey = a < b ? `${a}-${b}` : `${b}-${a}`;
          edgeSet.add(edgeKey);
        }
      }
    }
  }
  
  // Convert edge set to array
  const edges: [number, number][] = [];
  for (const edgeKey of edgeSet) {
    const [a, b] = edgeKey.split('-').map(Number);
    edges.push([a, b]);
  }
  
  // Calculate bounds
  const bounds = calculateBounds(vertices);
  
  return { vertices, edges, faces, bounds };
}

/**
 * Calculate bounding box of vertices
 */
function calculateBounds(vertices: Vec3[]): Geometry3D['bounds'] {
  if (vertices.length === 0) {
    return {
      min: [0, 0, 0],
      max: [0, 0, 0],
      center: [0, 0, 0],
      size: [0, 0, 0],
    };
  }
  
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  
  for (const [x, y, z] of vertices) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    minZ = Math.min(minZ, z);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
    maxZ = Math.max(maxZ, z);
  }
  
  return {
    min: [minX, minY, minZ],
    max: [maxX, maxY, maxZ],
    center: [(minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2],
    size: [maxX - minX, maxY - minY, maxZ - minZ],
  };
}

/**
 * Camera projection settings
 */
export interface CameraSettings {
  rotationX: number; // degrees
  rotationY: number; // degrees
  rotationZ: number; // degrees
  distance: number;
  projection: 'perspective' | 'orthographic';
  fov: number; // Field of view for perspective (degrees)
  scale: number; // Output scale
  centerX: number; // Output center X
  centerY: number; // Output center Y
  // Edge reduction options
  edgeReduction: number; // 0 = all edges, 1 = every 2nd, 2 = every 3rd, etc.
  edgeAngleThreshold: number; // 0-180, only show edges with face angle > threshold (0 = all)
}

/**
 * Calculate face normal from vertices
 */
function calculateFaceNormal(v0: Vec3, v1: Vec3, v2: Vec3): Vec3 {
  // Edge vectors
  const e1: Vec3 = [v1[0] - v0[0], v1[1] - v0[1], v1[2] - v0[2]];
  const e2: Vec3 = [v2[0] - v0[0], v2[1] - v0[1], v2[2] - v0[2]];
  
  // Cross product
  const nx = e1[1] * e2[2] - e1[2] * e2[1];
  const ny = e1[2] * e2[0] - e1[0] * e2[2];
  const nz = e1[0] * e2[1] - e1[1] * e2[0];
  
  // Normalize
  const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
  return [nx / len, ny / len, nz / len];
}

/**
 * Calculate angle between two normals (in degrees)
 */
function angleBetweenNormals(n1: Vec3, n2: Vec3): number {
  const dot = n1[0] * n2[0] + n1[1] * n2[1] + n1[2] * n2[2];
  // Clamp to avoid NaN from floating point errors
  const clamped = Math.max(-1, Math.min(1, dot));
  return Math.acos(clamped) * (180 / Math.PI);
}

/**
 * Build edge to face mapping and calculate edge angles
 */
function calculateEdgeAngles(
  vertices: Vec3[],
  faces: number[][],
  edges: [number, number][]
): Map<string, number> {
  // Map edge key to list of face indices
  const edgeToFaces = new Map<string, number[]>();
  
  // Calculate face normals
  const faceNormals: Vec3[] = [];
  
  for (let fi = 0; fi < faces.length; fi++) {
    const face = faces[fi];
    if (face.length >= 3) {
      const v0 = vertices[face[0]];
      const v1 = vertices[face[1]];
      const v2 = vertices[face[2]];
      if (v0 && v1 && v2) {
        faceNormals.push(calculateFaceNormal(v0, v1, v2));
      } else {
        faceNormals.push([0, 1, 0]); // Default normal
      }
      
      // Map edges to this face
      for (let i = 0; i < face.length; i++) {
        const a = face[i];
        const b = face[(i + 1) % face.length];
        const edgeKey = a < b ? `${a}-${b}` : `${b}-${a}`;
        
        if (!edgeToFaces.has(edgeKey)) {
          edgeToFaces.set(edgeKey, []);
        }
        edgeToFaces.get(edgeKey)!.push(fi);
      }
    }
  }
  
  // Calculate angle for each edge
  const edgeAngles = new Map<string, number>();
  
  for (const [a, b] of edges) {
    const edgeKey = a < b ? `${a}-${b}` : `${b}-${a}`;
    const faceIndices = edgeToFaces.get(edgeKey) || [];
    
    if (faceIndices.length === 2) {
      // Edge shared by two faces - calculate angle between them
      const n1 = faceNormals[faceIndices[0]];
      const n2 = faceNormals[faceIndices[1]];
      if (n1 && n2) {
        edgeAngles.set(edgeKey, angleBetweenNormals(n1, n2));
      } else {
        edgeAngles.set(edgeKey, 180); // Treat as sharp edge
      }
    } else if (faceIndices.length === 1) {
      // Boundary edge - always show
      edgeAngles.set(edgeKey, 180);
    } else {
      // Orphan edge or shared by more than 2 faces
      edgeAngles.set(edgeKey, 180);
    }
  }
  
  return edgeAngles;
}

/**
 * Rotate a 3D point around axes
 */
function rotatePoint(point: Vec3, rx: number, ry: number, rz: number): Vec3 {
  let [x, y, z] = point;
  
  // Convert to radians
  const radX = (rx * Math.PI) / 180;
  const radY = (ry * Math.PI) / 180;
  const radZ = (rz * Math.PI) / 180;
  
  // Rotate around X axis
  const cosX = Math.cos(radX);
  const sinX = Math.sin(radX);
  let y1 = y * cosX - z * sinX;
  let z1 = y * sinX + z * cosX;
  y = y1;
  z = z1;
  
  // Rotate around Y axis
  const cosY = Math.cos(radY);
  const sinY = Math.sin(radY);
  let x1 = x * cosY + z * sinY;
  z1 = -x * sinY + z * cosY;
  x = x1;
  z = z1;
  
  // Rotate around Z axis
  const cosZ = Math.cos(radZ);
  const sinZ = Math.sin(radZ);
  x1 = x * cosZ - y * sinZ;
  y1 = x * sinZ + y * cosZ;
  x = x1;
  y = y1;
  
  return [x, y, z];
}

/**
 * Project 3D geometry to 2D paths (wireframe)
 */
export function projectToWireframe(
  geometry: Geometry3D,
  camera: CameraSettings
): Point[][] {
  if (geometry.vertices.length === 0 || geometry.edges.length === 0) {
    return [];
  }
  
  const { 
    rotationX, rotationY, rotationZ, distance, projection, fov, scale, centerX, centerY,
    edgeReduction = 0, edgeAngleThreshold = 0
  } = camera;
  const { vertices, edges, faces, bounds } = geometry;
  
  // Calculate edge angles if threshold is set
  let edgeAngles: Map<string, number> | null = null;
  if (edgeAngleThreshold > 0 && faces.length > 0) {
    edgeAngles = calculateEdgeAngles(vertices, faces, edges);
  }
  
  // Normalize geometry to unit cube centered at origin
  const maxDim = Math.max(bounds.size[0], bounds.size[1], bounds.size[2]) || 1;
  
  // Transform and project all vertices
  const projected: Point[] = [];
  
  for (const vertex of vertices) {
    // Center the geometry
    let [x, y, z] = vertex;
    x = (x - bounds.center[0]) / maxDim;
    y = (y - bounds.center[1]) / maxDim;
    z = (z - bounds.center[2]) / maxDim;
    
    // Apply rotation
    const [rx, ry, rz] = rotatePoint([x, y, z], rotationX, rotationY, rotationZ);
    
    // Project to 2D
    let px: number, py: number;
    
    if (projection === 'perspective') {
      // Perspective projection
      const fovRad = (fov * Math.PI) / 180;
      const zOffset = distance + rz;
      const perspectiveScale = 1 / Math.tan(fovRad / 2);
      
      if (zOffset > 0.1) {
        px = (rx * perspectiveScale) / zOffset;
        py = (ry * perspectiveScale) / zOffset;
      } else {
        px = rx * perspectiveScale;
        py = ry * perspectiveScale;
      }
    } else {
      // Orthographic projection - just drop Z
      px = rx;
      py = ry;
    }
    
    // Scale and translate to output coordinates
    projected.push([
      centerX + px * scale,
      centerY - py * scale, // Flip Y for screen coordinates
    ]);
  }
  
  // Build edge paths with filtering
  const paths: Point[][] = [];
  const skipCount = edgeReduction + 1; // 0 = show all, 1 = every 2nd, etc.
  
  for (let i = 0; i < edges.length; i++) {
    // Edge reduction - skip edges based on index
    if (edgeReduction > 0 && i % skipCount !== 0) {
      continue;
    }
    
    const [a, b] = edges[i];
    
    // Edge angle threshold - skip edges with low angle between faces
    if (edgeAngles && edgeAngleThreshold > 0) {
      const edgeKey = a < b ? `${a}-${b}` : `${b}-${a}`;
      const angle = edgeAngles.get(edgeKey) || 0;
      if (angle < edgeAngleThreshold) {
        continue;
      }
    }
    
    if (a < projected.length && b < projected.length) {
      paths.push([projected[a], projected[b]]);
    }
  }
  
  return paths;
}

/**
 * Serialize Geometry3D for storage in node data
 */
export function serializeGeometry(geometry: Geometry3D): string {
  return JSON.stringify(geometry);
}

/**
 * Deserialize Geometry3D from node data
 */
export function deserializeGeometry(data: string): Geometry3D | null {
  try {
    return JSON.parse(data) as Geometry3D;
  } catch {
    return null;
  }
}
