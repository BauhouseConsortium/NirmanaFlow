import type { Path, Point } from '../types';

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

export function optimizePaths(paths: Path[]): Path[] {
  if (paths.length === 0) return [];

  const MERGE_THRESHOLD = 0.1;

  // Sort paths by starting X coordinate (left to right)
  const sorted = [...paths].sort((a, b) => {
    const aMinX = Math.min(...a.map(p => p[0]));
    const bMinX = Math.min(...b.map(p => p[0]));
    return aMinX - bMinX;
  });

  // Merge connected paths
  let result: Path[] = [];
  let current: Path | null = null;

  for (const path of sorted) {
    if (!current) {
      current = [...path];
      continue;
    }

    const lastPoint = current[current.length - 1];
    const firstPoint = path[0];
    const lastToFirst = distance(lastPoint, firstPoint);

    // Also check reverse connection
    const lastPointPath = path[path.length - 1];
    const lastToLast = distance(lastPoint, lastPointPath);

    if (lastToFirst < MERGE_THRESHOLD) {
      // Merge: append path to current
      current = [...current, ...path.slice(1)];
    } else if (lastToLast < MERGE_THRESHOLD) {
      // Merge reversed path
      current = [...current, ...[...path].reverse().slice(1)];
    } else {
      // No merge, save current and start new
      result.push(current);
      current = [...path];
    }
  }

  if (current) {
    result.push(current);
  }

  return result;
}
