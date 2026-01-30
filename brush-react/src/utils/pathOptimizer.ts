import type { Path, Point } from '../types';
import {
  optimizePaths as clipperOptimize,
  simplifyPaths as clipperSimplify,
  unionPaths as clipperUnion,
  isClipper2Available,
  loadClipper2,
} from './clipperService';

function distance(p1: Point, p2: Point): number {
  const dx = p2[0] - p1[0];
  const dy = p2[1] - p1[1];
  return Math.sqrt(dx * dx + dy * dy);
}

export function getPathLength(path: Path): number {
  let length = 0;
  for (let i = 1; i < path.length; i++) {
    length += distance(path[i - 1], path[i]);
  }
  return length;
}

/**
 * Basic synchronous path optimization (merging consecutive paths)
 */
export function optimizePaths(paths: Path[]): Path[] {
  if (paths.length === 0) return [];

  // 1. Sort by X of start point for general Left-to-Right flow
  // (Reference uses first point's X, not minimum X)
  let pool = paths.slice().sort((a, b) => a[0][0] - b[0][0]);

  const mergeThreshold = 0.1; // 0.1 units
  let merged = true;

  // Iteratively merge until no more merges occur
  while (merged) {
    merged = false;
    const newPool: Path[] = [];
    let current = pool[0];

    for (let i = 1; i < pool.length; i++) {
      const next = pool[i];
      const lastPt = current[current.length - 1];
      const firstPt = next[0];

      const dx = firstPt[0] - lastPt[0];
      const dy = firstPt[1] - lastPt[1];
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < mergeThreshold) {
        // Merge!
        if (dist === 0) {
          current = [...current, ...next.slice(1)];
        } else {
          current = [...current, ...next];
        }
        merged = true;
      } else {
        newPool.push(current);
        current = next;
      }
    }
    newPool.push(current);
    pool = newPool;
  }

  return pool;
}

// ============ Clipper2 Enhanced Optimization ============

export interface PathOptimizationOptions {
  simplifyTolerance?: number;
  mergeOverlapping?: boolean;
  minSegmentLength?: number;
}

/**
 * Check if Clipper2 is ready
 */
export function isClipper2Ready(): boolean {
  return isClipper2Available();
}

/**
 * Initialize Clipper2 (call early to preload WASM)
 */
export async function initClipper2(): Promise<boolean> {
  return loadClipper2();
}

/**
 * Advanced async path optimization using Clipper2 WASM
 * Falls back to basic optimization if Clipper2 is not available
 */
export async function optimizePathsAdvanced(
  paths: Path[],
  options: PathOptimizationOptions = {}
): Promise<Path[]> {
  if (paths.length === 0) return [];

  const {
    simplifyTolerance = 0.1,
    mergeOverlapping = true,
    minSegmentLength = 0.5,
  } = options;

  // Try to use Clipper2
  const clipperAvailable = await loadClipper2();
  
  if (clipperAvailable) {
    try {
      return await clipperOptimize(paths, {
        simplifyTolerance,
        mergeOverlapping,
        minSegmentLength,
      });
    } catch (err) {
      console.warn('Clipper2 optimization failed, using fallback:', err);
    }
  }

  // Fallback to basic optimization
  let result = optimizePaths(paths);

  // Apply basic simplification
  if (simplifyTolerance > 0) {
    result = result.map(path => simplifyPathBasic(path, simplifyTolerance));
  }

  // Remove short segments
  if (minSegmentLength > 0) {
    result = result.filter(path => getPathLength(path) >= minSegmentLength);
  }

  return result;
}

/**
 * Simplify paths using Clipper2 or fallback
 */
export async function simplifyPathsAdvanced(
  paths: Path[],
  tolerance: number = 0.1
): Promise<Path[]> {
  const clipperAvailable = await loadClipper2();
  
  if (clipperAvailable) {
    try {
      return await clipperSimplify(paths, tolerance);
    } catch (err) {
      console.warn('Clipper2 simplification failed, using fallback:', err);
    }
  }

  // Fallback
  return paths.map(path => simplifyPathBasic(path, tolerance));
}

/**
 * Union overlapping closed paths using Clipper2
 */
export async function unionPathsAdvanced(paths: Path[]): Promise<Path[]> {
  const clipperAvailable = await loadClipper2();
  
  if (clipperAvailable) {
    try {
      return await clipperUnion(paths);
    } catch (err) {
      console.warn('Clipper2 union failed:', err);
    }
  }

  // No fallback for union - return original
  return paths;
}

/**
 * Basic Douglas-Peucker simplification (fallback)
 */
function simplifyPathBasic(path: Path, tolerance: number): Path {
  if (path.length <= 2) return path;

  // Find the point with the maximum distance from the line
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
    const left = simplifyPathBasic(path.slice(0, maxIndex + 1), tolerance);
    const right = simplifyPathBasic(path.slice(maxIndex), tolerance);
    return [...left.slice(0, -1), ...right];
  }

  // All points are within tolerance
  return [path[0], path[end]];
}

/**
 * Calculate perpendicular distance from point to line
 */
function perpendicularDistance(point: Point, lineStart: Point, lineEnd: Point): number {
  const dx = lineEnd[0] - lineStart[0];
  const dy = lineEnd[1] - lineStart[1];

  if (dx === 0 && dy === 0) {
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
