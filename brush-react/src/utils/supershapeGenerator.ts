/**
 * 3D Supershape Generator
 * Based on the Gielis superformula for generating complex organic and geometric shapes
 * 
 * The superformula: r(θ) = (|cos(m*θ/4)/a|^n2 + |sin(m*θ/4)/b|^n3)^(-1/n1)
 */

import type { Geometry3D, Vec3 } from './objLoader';

export interface SupershapeParams {
  // First superformula (latitude)
  m1: number;  // Symmetry
  n1_1: number; // Shape parameter
  n2_1: number; // Shape parameter
  n3_1: number; // Shape parameter
  a1: number;   // Scale X
  b1: number;   // Scale Y
  
  // Second superformula (longitude)
  m2: number;
  n1_2: number;
  n2_2: number;
  n3_2: number;
  a2: number;
  b2: number;
  
  // Resolution
  segments: number; // Number of segments in each direction
}

/**
 * Calculate superformula radius for a given angle
 */
function superformula(theta: number, m: number, n1: number, n2: number, n3: number, a: number, b: number): number {
  const t1 = Math.abs(Math.cos(m * theta / 4) / a);
  const t2 = Math.abs(Math.sin(m * theta / 4) / b);
  
  const r = Math.pow(Math.pow(t1, n2) + Math.pow(t2, n3), -1 / n1);
  
  // Handle infinities and NaN
  if (!isFinite(r) || isNaN(r)) {
    return 0;
  }
  
  return r;
}

/**
 * Generate a 3D supershape geometry
 */
export function generateSupershape(params: SupershapeParams): Geometry3D {
  const {
    m1, n1_1, n2_1, n3_1, a1, b1,
    m2, n1_2, n2_2, n3_2, a2, b2,
    segments
  } = params;
  
  const vertices: Vec3[] = [];
  const faces: number[][] = [];
  const edgeSet = new Set<string>();
  
  const latSegments = segments;
  const lonSegments = segments * 2;
  
  // Generate vertices using spherical coordinates with superformula radii
  for (let i = 0; i <= latSegments; i++) {
    const phi = (i / latSegments) * Math.PI - Math.PI / 2; // -PI/2 to PI/2 (latitude)
    const r1 = superformula(phi, m1, n1_1, n2_1, n3_1, a1, b1);
    
    for (let j = 0; j <= lonSegments; j++) {
      const theta = (j / lonSegments) * 2 * Math.PI - Math.PI; // -PI to PI (longitude)
      const r2 = superformula(theta, m2, n1_2, n2_2, n3_2, a2, b2);
      
      // Convert to Cartesian coordinates
      const x = r1 * Math.cos(phi) * r2 * Math.cos(theta);
      const y = r1 * Math.cos(phi) * r2 * Math.sin(theta);
      const z = r1 * Math.sin(phi);
      
      vertices.push([x, y, z]);
    }
  }
  
  // Generate faces and edges
  for (let i = 0; i < latSegments; i++) {
    for (let j = 0; j < lonSegments; j++) {
      const a = i * (lonSegments + 1) + j;
      const b = a + 1;
      const c = a + (lonSegments + 1);
      const d = c + 1;
      
      // Two triangles per quad
      if (vertices[a] && vertices[b] && vertices[c] && vertices[d]) {
        // Check for degenerate vertices (at poles or where superformula is 0)
        const va = vertices[a];
        const vb = vertices[b];
        const vc = vertices[c];
        const vd = vertices[d];
        
        const isValidA = isFinite(va[0]) && isFinite(va[1]) && isFinite(va[2]);
        const isValidB = isFinite(vb[0]) && isFinite(vb[1]) && isFinite(vb[2]);
        const isValidC = isFinite(vc[0]) && isFinite(vc[1]) && isFinite(vc[2]);
        const isValidD = isFinite(vd[0]) && isFinite(vd[1]) && isFinite(vd[2]);
        
        if (isValidA && isValidB && isValidC) {
          faces.push([a, b, c]);
          addEdge(edgeSet, a, b);
          addEdge(edgeSet, b, c);
          addEdge(edgeSet, c, a);
        }
        
        if (isValidB && isValidD && isValidC) {
          faces.push([b, d, c]);
          addEdge(edgeSet, b, d);
          addEdge(edgeSet, d, c);
          addEdge(edgeSet, c, b);
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

function addEdge(edgeSet: Set<string>, a: number, b: number): void {
  const edgeKey = a < b ? `${a}-${b}` : `${b}-${a}`;
  edgeSet.add(edgeKey);
}

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
    if (isFinite(x) && isFinite(y) && isFinite(z)) {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      minZ = Math.min(minZ, z);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      maxZ = Math.max(maxZ, z);
    }
  }
  
  // Handle case where all vertices are invalid
  if (!isFinite(minX)) {
    return {
      min: [0, 0, 0],
      max: [1, 1, 1],
      center: [0.5, 0.5, 0.5],
      size: [1, 1, 1],
    };
  }
  
  return {
    min: [minX, minY, minZ],
    max: [maxX, maxY, maxZ],
    center: [(minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2],
    size: [maxX - minX, maxY - minY, maxZ - minZ],
  };
}

// Preset supershapes
export const SUPERSHAPE_PRESETS: Record<string, Partial<SupershapeParams>> = {
  sphere: {
    m1: 0, n1_1: 1, n2_1: 1, n3_1: 1, a1: 1, b1: 1,
    m2: 0, n1_2: 1, n2_2: 1, n3_2: 1, a2: 1, b2: 1,
  },
  star: {
    m1: 5, n1_1: 0.3, n2_1: 0.3, n3_1: 0.3, a1: 1, b1: 1,
    m2: 5, n1_2: 0.3, n2_2: 0.3, n3_2: 0.3, a2: 1, b2: 1,
  },
  flower: {
    m1: 6, n1_1: 1, n2_1: 1, n3_1: 1, a1: 1, b1: 1,
    m2: 3, n1_2: 1, n2_2: 1, n3_2: 1, a2: 1, b2: 1,
  },
  shell: {
    m1: 4, n1_1: 2, n2_1: 2, n3_1: 2, a1: 1, b1: 1,
    m2: 8, n1_2: 1, n2_2: 1, n3_2: 1, a2: 1, b2: 1,
  },
  crystal: {
    m1: 4, n1_1: 0.5, n2_1: 0.5, n3_1: 0.5, a1: 1, b1: 1,
    m2: 4, n1_2: 0.5, n2_2: 0.5, n3_2: 0.5, a2: 1, b2: 1,
  },
  organic: {
    m1: 7, n1_1: 0.2, n2_1: 1.7, n3_1: 1.7, a1: 1, b1: 1,
    m2: 7, n1_2: 0.2, n2_2: 1.7, n3_2: 1.7, a2: 1, b2: 1,
  },
  pillow: {
    m1: 4, n1_1: 4, n2_1: 4, n3_1: 4, a1: 1, b1: 1,
    m2: 4, n1_2: 4, n2_2: 4, n3_2: 4, a2: 1, b2: 1,
  },
  gear: {
    m1: 8, n1_1: 60, n2_1: 100, n3_1: 30, a1: 1, b1: 1,
    m2: 8, n1_2: 60, n2_2: 100, n3_2: 30, a2: 1, b2: 1,
  },
  blob: {
    m1: 3, n1_1: 0.5, n2_1: 1, n3_1: 1, a1: 1, b1: 1,
    m2: 4, n1_2: 0.5, n2_2: 1, n3_2: 1, a2: 1, b2: 1,
  },
};
