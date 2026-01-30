/**
 * Plotter Path Optimizer
 * 
 * Optimizations specific to pen plotters:
 * 1. Remove duplicate/overlapping line segments
 * 2. Merge connected paths (reduce pen lifts)
 * 3. Optimize path order (minimize travel distance)
 * 4. Simplify paths (remove collinear points)
 */

import type { Path, Point } from './drawingApi';

// Tolerance for considering points equal
const POINT_TOLERANCE = 0.01;
const LINE_TOLERANCE = 0.1;

/**
 * Check if two points are approximately equal
 */
function pointsEqual(a: Point, b: Point, tolerance = POINT_TOLERANCE): boolean {
  return Math.abs(a[0] - b[0]) < tolerance && Math.abs(a[1] - b[1]) < tolerance;
}

/**
 * Calculate distance between two points
 */
function distance(a: Point, b: Point): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Create a canonical key for a line segment (order-independent)
 */
function lineKey(p1: Point, p2: Point): string {
  // Round to tolerance and sort to make order-independent
  const x1 = Math.round(p1[0] / LINE_TOLERANCE) * LINE_TOLERANCE;
  const y1 = Math.round(p1[1] / LINE_TOLERANCE) * LINE_TOLERANCE;
  const x2 = Math.round(p2[0] / LINE_TOLERANCE) * LINE_TOLERANCE;
  const y2 = Math.round(p2[1] / LINE_TOLERANCE) * LINE_TOLERANCE;
  
  // Sort points to make key direction-independent
  if (x1 < x2 || (x1 === x2 && y1 < y2)) {
    return `${x1},${y1}-${x2},${y2}`;
  }
  return `${x2},${y2}-${x1},${y1}`;
}

/**
 * Remove duplicate line segments from paths
 * This prevents drawing the same line twice
 */
export function removeDuplicateSegments(paths: Path[]): Path[] {
  const seenSegments = new Set<string>();
  const result: Path[] = [];
  
  for (const path of paths) {
    if (path.length < 2) continue;
    
    const newPath: Point[] = [path[0]];
    
    for (let i = 1; i < path.length; i++) {
      const key = lineKey(path[i - 1], path[i]);
      
      if (!seenSegments.has(key)) {
        seenSegments.add(key);
        newPath.push(path[i]);
      } else {
        // Segment is duplicate - start new path if we have points
        if (newPath.length >= 2) {
          result.push([...newPath]);
        }
        newPath.length = 0;
        newPath.push(path[i]);
      }
    }
    
    if (newPath.length >= 2) {
      result.push(newPath);
    }
  }
  
  return result;
}

/**
 * Merge paths that share endpoints
 * Reduces the number of pen lifts
 */
export function mergeConnectedPaths(paths: Path[], tolerance = POINT_TOLERANCE): Path[] {
  if (paths.length === 0) return [];
  
  // Create a working copy
  let remaining = paths.map(p => [...p] as Path);
  const result: Path[] = [];
  
  while (remaining.length > 0) {
    // Start with the first remaining path
    let current = remaining.shift()!;
    let merged = true;
    
    while (merged) {
      merged = false;
      
      for (let i = 0; i < remaining.length; i++) {
        const candidate = remaining[i];
        const currentStart = current[0];
        const currentEnd = current[current.length - 1];
        const candidateStart = candidate[0];
        const candidateEnd = candidate[candidate.length - 1];
        
        // Check all 4 connection possibilities
        if (pointsEqual(currentEnd, candidateStart, tolerance)) {
          // current → candidate
          current = [...current, ...candidate.slice(1)];
          remaining.splice(i, 1);
          merged = true;
          break;
        }
        if (pointsEqual(currentEnd, candidateEnd, tolerance)) {
          // current → reversed candidate
          current = [...current, ...candidate.slice(0, -1).reverse()];
          remaining.splice(i, 1);
          merged = true;
          break;
        }
        if (pointsEqual(currentStart, candidateEnd, tolerance)) {
          // candidate → current
          current = [...candidate, ...current.slice(1)];
          remaining.splice(i, 1);
          merged = true;
          break;
        }
        if (pointsEqual(currentStart, candidateStart, tolerance)) {
          // reversed candidate → current
          current = [...candidate.reverse(), ...current.slice(1)];
          remaining.splice(i, 1);
          merged = true;
          break;
        }
      }
    }
    
    result.push(current);
  }
  
  return result;
}

/**
 * Optimize path order using nearest-neighbor algorithm
 * Minimizes total travel distance between paths
 */
export function optimizePathOrder(
  paths: Path[],
  startPoint: Point = [0, 0]
): Path[] {
  if (paths.length <= 1) return paths;
  
  const result: Path[] = [];
  const remaining = paths.map((path, index) => ({ path, index }));
  let currentPos = startPoint;
  
  while (remaining.length > 0) {
    let bestIndex = 0;
    let bestDist = Infinity;
    let shouldReverse = false;
    
    // Find nearest path (checking both endpoints)
    for (let i = 0; i < remaining.length; i++) {
      const path = remaining[i].path;
      const startDist = distance(currentPos, path[0]);
      const endDist = distance(currentPos, path[path.length - 1]);
      
      if (startDist < bestDist) {
        bestDist = startDist;
        bestIndex = i;
        shouldReverse = false;
      }
      if (endDist < bestDist) {
        bestDist = endDist;
        bestIndex = i;
        shouldReverse = true;
      }
    }
    
    // Add the best path (possibly reversed)
    const { path } = remaining.splice(bestIndex, 1)[0];
    const orderedPath = shouldReverse ? [...path].reverse() : path;
    result.push(orderedPath);
    currentPos = orderedPath[orderedPath.length - 1];
  }
  
  return result;
}

/**
 * Simplify path by removing collinear points
 */
export function simplifyPath(path: Path, tolerance = 0.01): Path {
  if (path.length <= 2) return path;
  
  const result: Point[] = [path[0]];
  
  for (let i = 1; i < path.length - 1; i++) {
    const prev = result[result.length - 1];
    const curr = path[i];
    const next = path[i + 1];
    
    // Check if curr is collinear with prev and next
    const cross = (curr[0] - prev[0]) * (next[1] - prev[1]) - 
                  (curr[1] - prev[1]) * (next[0] - prev[0]);
    
    if (Math.abs(cross) > tolerance) {
      result.push(curr);
    }
  }
  
  result.push(path[path.length - 1]);
  return result;
}

/**
 * Simplify all paths
 */
export function simplifyPaths(paths: Path[], tolerance = 0.01): Path[] {
  return paths
    .map(p => simplifyPath(p, tolerance))
    .filter(p => p.length >= 2);
}

/**
 * Calculate total path length (drawing distance)
 */
export function getTotalPathLength(paths: Path[]): number {
  let total = 0;
  for (const path of paths) {
    for (let i = 1; i < path.length; i++) {
      total += distance(path[i - 1], path[i]);
    }
  }
  return total;
}

/**
 * Calculate total travel distance (pen-up movements)
 */
export function getTotalTravelDistance(paths: Path[], startPoint: Point = [0, 0]): number {
  let total = 0;
  let currentPos = startPoint;
  
  for (const path of paths) {
    if (path.length > 0) {
      total += distance(currentPos, path[0]);
      currentPos = path[path.length - 1];
    }
  }
  
  return total;
}

/**
 * Full plotter optimization pipeline
 */
export interface PlotterOptimizeOptions {
  removeDuplicates?: boolean;
  mergePaths?: boolean;
  optimizeOrder?: boolean;
  simplify?: boolean;
  simplifyTolerance?: number;
  mergeTolerance?: number;
  startPoint?: Point;
}

export interface PlotterOptimizeResult {
  paths: Path[];
  stats: {
    originalPaths: number;
    optimizedPaths: number;
    originalSegments: number;
    optimizedSegments: number;
    duplicatesRemoved: number;
    pathsMerged: number;
    drawingDistance: number;
    travelDistance: number;
    travelReduction: number;
  };
}

export function optimizeForPlotter(
  paths: Path[],
  options: PlotterOptimizeOptions = {}
): PlotterOptimizeResult {
  const {
    removeDuplicates = true,
    mergePaths = true,
    optimizeOrder = true,
    simplify = true,
    simplifyTolerance = 0.01,
    mergeTolerance = POINT_TOLERANCE,
    startPoint = [0, 0],
  } = options;
  
  const originalPaths = paths.length;
  const originalSegments = paths.reduce((sum, p) => sum + Math.max(0, p.length - 1), 0);
  const originalTravel = getTotalTravelDistance(paths, startPoint);
  
  let result = paths;
  let duplicatesRemoved = 0;
  let pathsMerged = 0;
  
  // Step 1: Remove duplicate segments
  if (removeDuplicates) {
    const before = result.reduce((sum, p) => sum + Math.max(0, p.length - 1), 0);
    result = removeDuplicateSegments(result);
    const after = result.reduce((sum, p) => sum + Math.max(0, p.length - 1), 0);
    duplicatesRemoved = before - after;
  }
  
  // Step 2: Simplify paths
  if (simplify) {
    result = simplifyPaths(result, simplifyTolerance);
  }
  
  // Step 3: Merge connected paths
  if (mergePaths) {
    const beforeMerge = result.length;
    result = mergeConnectedPaths(result, mergeTolerance);
    pathsMerged = beforeMerge - result.length;
  }
  
  // Step 4: Optimize order
  if (optimizeOrder) {
    result = optimizePathOrder(result, startPoint);
  }
  
  const optimizedPaths = result.length;
  const optimizedSegments = result.reduce((sum, p) => sum + Math.max(0, p.length - 1), 0);
  const drawingDistance = getTotalPathLength(result);
  const travelDistance = getTotalTravelDistance(result, startPoint);
  const travelReduction = originalTravel > 0 
    ? Math.round((1 - travelDistance / originalTravel) * 100)
    : 0;
  
  return {
    paths: result,
    stats: {
      originalPaths,
      optimizedPaths,
      originalSegments,
      optimizedSegments,
      duplicatesRemoved,
      pathsMerged,
      drawingDistance,
      travelDistance,
      travelReduction,
    },
  };
}
