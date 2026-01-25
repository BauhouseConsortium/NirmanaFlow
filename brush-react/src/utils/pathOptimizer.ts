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
