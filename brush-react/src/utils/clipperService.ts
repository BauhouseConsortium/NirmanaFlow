/**
 * Clipper2 WASM Service
 * 
 * Provides polygon boolean operations and path optimization using Clipper2 library.
 * Features:
 * - Union: Merge overlapping paths
 * - Intersection: Find common areas
 * - Difference: Subtract paths
 * - Offset: Inset/outset polygons
 * - Simplification: Remove redundant points
 */

import type { Path, Point } from './drawingApi';

// Clipper2 module types (simplified)
interface Clipper2Module {
  Clipper: {
    Paths64: new () => Paths64;
    Path64: new () => Path64;
    Clipper64: new () => Clipper64;
    ClipperOffset: new () => ClipperOffset;
    FillRule: {
      EvenOdd: number;
      NonZero: number;
      Positive: number;
      Negative: number;
    };
    ClipType: {
      None: number;
      Intersection: number;
      Union: number;
      Difference: number;
      Xor: number;
    };
    PathType: {
      Subject: number;
      Clip: number;
    };
    JoinType: {
      Square: number;
      Round: number;
      Miter: number;
    };
    EndType: {
      Polygon: number;
      Joined: number;
      Butt: number;
      Square: number;
      Round: number;
    };
    SimplifyPaths: (paths: Paths64, epsilon: number, isOpen: boolean) => Paths64;
  };
}

interface Path64 {
  push_back(point: { x: bigint; y: bigint }): void;
  size(): number;
  get(index: number): { x: bigint; y: bigint };
  delete(): void;
}

interface Paths64 {
  push_back(path: Path64): void;
  size(): number;
  get(index: number): Path64;
  delete(): void;
}

interface Clipper64 {
  AddSubject(paths: Paths64): void;
  AddClip(paths: Paths64): void;
  AddOpenSubject(paths: Paths64): void;
  Execute(clipType: number, fillRule: number, closedPaths: Paths64, openPaths?: Paths64): boolean;
  Clear(): void;
  delete(): void;
}

interface ClipperOffset {
  AddPaths(paths: Paths64, joinType: number, endType: number): void;
  Execute(delta: number, result: Paths64): void;
  Clear(): void;
  delete(): void;
}

// Module state
let clipper2Module: Clipper2Module | null = null;
let clipper2Loading = false;
let clipper2Error: string | null = null;

// Scale factor for converting float coords to int64 (Clipper uses integers)
const SCALE = 1000000; // 6 decimal places precision

/**
 * Check if Clipper2 is available
 */
export function isClipper2Available(): boolean {
  return clipper2Module !== null;
}

/**
 * Get Clipper2 loading error if any
 */
export function getClipper2Error(): string | null {
  return clipper2Error;
}

/**
 * Load Clipper2 WASM module
 */
export async function loadClipper2(): Promise<boolean> {
  if (clipper2Module) return true;
  if (clipper2Loading) {
    // Wait for existing load
    return new Promise((resolve) => {
      const check = setInterval(() => {
        if (!clipper2Loading) {
          clearInterval(check);
          resolve(clipper2Module !== null);
        }
      }, 100);
    });
  }

  clipper2Loading = true;

  try {
    // Dynamic import of clipper2-wasm
    const moduleName = 'clipper2-wasm';
    const clipper2 = await import(/* @vite-ignore */ moduleName);
    
    // Initialize the WASM module
    if (clipper2.default) {
      clipper2Module = await clipper2.default();
    } else {
      clipper2Module = clipper2;
    }
    
    clipper2Error = null;
    console.log('Clipper2 WASM loaded successfully');
    return true;
  } catch (err) {
    clipper2Error = err instanceof Error ? err.message : String(err);
    console.warn('Clipper2 WASM not available:', clipper2Error);
    return false;
  } finally {
    clipper2Loading = false;
  }
}

/**
 * Convert our Path format to Clipper2 Path64
 */
function pathToPath64(path: Path, module: Clipper2Module): Path64 {
  const path64 = new module.Clipper.Path64();
  for (const [x, y] of path) {
    path64.push_back({
      x: BigInt(Math.round(x * SCALE)),
      y: BigInt(Math.round(y * SCALE)),
    });
  }
  return path64;
}

/**
 * Convert our Path[] to Clipper2 Paths64
 */
function pathsToPaths64(paths: Path[], module: Clipper2Module): Paths64 {
  const paths64 = new module.Clipper.Paths64();
  for (const path of paths) {
    const path64 = pathToPath64(path, module);
    paths64.push_back(path64);
    path64.delete();
  }
  return paths64;
}

/**
 * Convert Clipper2 Path64 to our Path format
 */
function path64ToPath(path64: Path64): Path {
  const path: Path = [];
  const size = path64.size();
  for (let i = 0; i < size; i++) {
    const pt = path64.get(i);
    path.push([Number(pt.x) / SCALE, Number(pt.y) / SCALE]);
  }
  return path;
}

/**
 * Convert Clipper2 Paths64 to our Path[] format
 */
function paths64ToPaths(paths64: Paths64): Path[] {
  const paths: Path[] = [];
  const size = paths64.size();
  for (let i = 0; i < size; i++) {
    const path64 = paths64.get(i);
    const path = path64ToPath(path64);
    if (path.length >= 2) {
      paths.push(path);
    }
  }
  return paths;
}

// ============ Public API ============

export type ClipOperation = 'union' | 'intersection' | 'difference' | 'xor';
export type JoinType = 'square' | 'round' | 'miter';
export type EndType = 'polygon' | 'joined' | 'butt' | 'square' | 'round';

/**
 * Perform boolean operation on paths
 */
export async function clipPaths(
  subjectPaths: Path[],
  clipPaths: Path[],
  operation: ClipOperation
): Promise<Path[]> {
  const available = await loadClipper2();
  if (!available || !clipper2Module) {
    console.warn('Clipper2 not available, returning original paths');
    return subjectPaths;
  }

  const module = clipper2Module;
  const clipper = new module.Clipper.Clipper64();
  const subject64 = pathsToPaths64(subjectPaths, module);
  const clip64 = pathsToPaths64(clipPaths, module);
  const result64 = new module.Clipper.Paths64();

  try {
    clipper.AddSubject(subject64);
    clipper.AddClip(clip64);

    let clipType: number;
    switch (operation) {
      case 'union':
        clipType = module.Clipper.ClipType.Union;
        break;
      case 'intersection':
        clipType = module.Clipper.ClipType.Intersection;
        break;
      case 'difference':
        clipType = module.Clipper.ClipType.Difference;
        break;
      case 'xor':
        clipType = module.Clipper.ClipType.Xor;
        break;
    }

    clipper.Execute(clipType, module.Clipper.FillRule.EvenOdd, result64);
    return paths64ToPaths(result64);
  } finally {
    clipper.delete();
    subject64.delete();
    clip64.delete();
    result64.delete();
  }
}

/**
 * Union all paths together (merge overlapping)
 */
export async function unionPaths(paths: Path[]): Promise<Path[]> {
  if (paths.length === 0) return [];
  if (paths.length === 1) return paths;
  
  const available = await loadClipper2();
  if (!available || !clipper2Module) {
    return paths;
  }

  const module = clipper2Module;
  const clipper = new module.Clipper.Clipper64();
  const subject64 = pathsToPaths64(paths, module);
  const result64 = new module.Clipper.Paths64();

  try {
    clipper.AddSubject(subject64);
    clipper.Execute(
      module.Clipper.ClipType.Union,
      module.Clipper.FillRule.EvenOdd,
      result64
    );
    return paths64ToPaths(result64);
  } finally {
    clipper.delete();
    subject64.delete();
    result64.delete();
  }
}

/**
 * Offset paths (positive = outset, negative = inset)
 */
export async function offsetPaths(
  paths: Path[],
  delta: number,
  joinType: JoinType = 'round',
  endType: EndType = 'polygon'
): Promise<Path[]> {
  if (paths.length === 0 || delta === 0) return paths;
  
  const available = await loadClipper2();
  if (!available || !clipper2Module) {
    return paths;
  }

  const module = clipper2Module;
  const offset = new module.Clipper.ClipperOffset();
  const paths64 = pathsToPaths64(paths, module);
  const result64 = new module.Clipper.Paths64();

  try {
    let jt: number;
    switch (joinType) {
      case 'square':
        jt = module.Clipper.JoinType.Square;
        break;
      case 'round':
        jt = module.Clipper.JoinType.Round;
        break;
      case 'miter':
        jt = module.Clipper.JoinType.Miter;
        break;
    }

    let et: number;
    switch (endType) {
      case 'polygon':
        et = module.Clipper.EndType.Polygon;
        break;
      case 'joined':
        et = module.Clipper.EndType.Joined;
        break;
      case 'butt':
        et = module.Clipper.EndType.Butt;
        break;
      case 'square':
        et = module.Clipper.EndType.Square;
        break;
      case 'round':
        et = module.Clipper.EndType.Round;
        break;
    }

    offset.AddPaths(paths64, jt, et);
    offset.Execute(delta * SCALE, result64);
    return paths64ToPaths(result64);
  } finally {
    offset.delete();
    paths64.delete();
    result64.delete();
  }
}

/**
 * Simplify paths by removing redundant points
 */
export async function simplifyPaths(
  paths: Path[],
  tolerance: number = 0.1
): Promise<Path[]> {
  if (paths.length === 0) return [];
  
  const available = await loadClipper2();
  if (!available || !clipper2Module) {
    // Fallback to simple simplification
    return simplifyPathsFallback(paths, tolerance);
  }

  const module = clipper2Module;
  const paths64 = pathsToPaths64(paths, module);

  try {
    const simplified = module.Clipper.SimplifyPaths(
      paths64,
      tolerance * SCALE,
      false // isOpen
    );
    const result = paths64ToPaths(simplified);
    simplified.delete();
    return result;
  } finally {
    paths64.delete();
  }
}

/**
 * Fallback simplification using Douglas-Peucker algorithm
 */
function simplifyPathsFallback(paths: Path[], tolerance: number): Path[] {
  return paths.map(path => douglasPeucker(path, tolerance));
}

/**
 * Douglas-Peucker line simplification
 */
function douglasPeucker(path: Path, tolerance: number): Path {
  if (path.length <= 2) return path;

  // Find the point with the maximum distance
  let maxDist = 0;
  let maxIndex = 0;
  const end = path.length - 1;

  for (let i = 1; i < end; i++) {
    const dist = perpendicularDistance(path[i], path[0], path[end]);
    if (dist > maxDist) {
      maxDist = dist;
      maxIndex = i;
    }
  }

  // If max distance is greater than tolerance, recursively simplify
  if (maxDist > tolerance) {
    const left = douglasPeucker(path.slice(0, maxIndex + 1), tolerance);
    const right = douglasPeucker(path.slice(maxIndex), tolerance);
    return [...left.slice(0, -1), ...right];
  }

  // All points are within tolerance, return just endpoints
  return [path[0], path[end]];
}

/**
 * Calculate perpendicular distance from point to line
 */
function perpendicularDistance(point: Point, lineStart: Point, lineEnd: Point): number {
  const dx = lineEnd[0] - lineStart[0];
  const dy = lineEnd[1] - lineStart[1];

  if (dx === 0 && dy === 0) {
    // Line is a point
    const pdx = point[0] - lineStart[0];
    const pdy = point[1] - lineStart[1];
    return Math.sqrt(pdx * pdx + pdy * pdy);
  }

  const t = ((point[0] - lineStart[0]) * dx + (point[1] - lineStart[1]) * dy) / (dx * dx + dy * dy);
  
  let nearestX: number, nearestY: number;
  if (t < 0) {
    nearestX = lineStart[0];
    nearestY = lineStart[1];
  } else if (t > 1) {
    nearestX = lineEnd[0];
    nearestY = lineEnd[1];
  } else {
    nearestX = lineStart[0] + t * dx;
    nearestY = lineStart[1] + t * dy;
  }

  const pdx = point[0] - nearestX;
  const pdy = point[1] - nearestY;
  return Math.sqrt(pdx * pdx + pdy * pdy);
}

/**
 * Clip paths to a polygon boundary (using Clipper2)
 */
export async function clipToPolygon(
  paths: Path[],
  polygon: Path
): Promise<Path[]> {
  if (paths.length === 0 || polygon.length < 3) return paths;
  
  return clipPaths(paths, [polygon], 'intersection');
}

/**
 * Optimize paths for plotting:
 * 1. Simplify paths (remove redundant points)
 * 2. Union overlapping closed paths
 * 3. Remove very short segments
 */
export async function optimizePaths(
  paths: Path[],
  options: {
    simplifyTolerance?: number;
    mergeOverlapping?: boolean;
    minSegmentLength?: number;
  } = {}
): Promise<Path[]> {
  const {
    simplifyTolerance = 0.1,
    mergeOverlapping = true,
    minSegmentLength = 0.5,
  } = options;

  let result = paths;

  // Step 1: Simplify
  if (simplifyTolerance > 0) {
    result = await simplifyPaths(result, simplifyTolerance);
  }

  // Step 2: Union overlapping closed paths
  if (mergeOverlapping) {
    // Separate closed and open paths
    const closedPaths: Path[] = [];
    const openPaths: Path[] = [];

    for (const path of result) {
      if (path.length >= 3) {
        const first = path[0];
        const last = path[path.length - 1];
        const dx = Math.abs(first[0] - last[0]);
        const dy = Math.abs(first[1] - last[1]);
        if (dx < 0.01 && dy < 0.01) {
          closedPaths.push(path);
        } else {
          openPaths.push(path);
        }
      } else {
        openPaths.push(path);
      }
    }

    // Union closed paths
    if (closedPaths.length > 1) {
      const merged = await unionPaths(closedPaths);
      result = [...merged, ...openPaths];
    }
  }

  // Step 3: Remove very short segments
  if (minSegmentLength > 0) {
    result = result.filter(path => {
      if (path.length < 2) return false;
      let totalLength = 0;
      for (let i = 1; i < path.length; i++) {
        const dx = path[i][0] - path[i - 1][0];
        const dy = path[i][1] - path[i - 1][1];
        totalLength += Math.sqrt(dx * dx + dy * dy);
      }
      return totalLength >= minSegmentLength;
    });
  }

  return result;
}
