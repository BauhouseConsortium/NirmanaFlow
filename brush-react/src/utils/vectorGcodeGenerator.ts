/**
 * G-code generator for vector paths from the drawing API
 */

import type { Path, Point } from './drawingApi';
import { getPathLength, optimizePaths } from './pathOptimizer';
import { BacklashFixer } from './backlashFixer';

export interface VectorSettings {
  // Canvas dimensions (input coordinate space)
  canvasWidth: number;
  canvasHeight: number;

  // Output dimensions
  targetWidth: number;
  targetHeight: number;
  offsetX: number;
  offsetY: number;

  // Machine settings
  feedRate: number;
  backlashX: number;
  backlashY: number;
  safeZ: number;

  // Ink/Dip settings
  dipInterval: number;
  dipX: number;
  dipY: number;
  continuousPlot: boolean;

  // Filter settings
  artefactThreshold: number;
}

export interface GeneratedVectorGCode {
  gcode: string;
  lines: string[];
  svg: string;
  stats: {
    bounds: { minX: number; maxX: number; minY: number; maxY: number };
    scale: number;
    pathCount: number;
    totalDistance: number;
    travelDistance: number;
    artefactsRemoved: number;
    dipCount: number;
  };
}

function distance(p1: Point, p2: Point): number {
  const dx = p2[0] - p1[0];
  const dy = p2[1] - p1[1];
  return Math.sqrt(dx * dx + dy * dy);
}

export function generateVectorGCode(
  paths: Path[],
  settings: VectorSettings
): GeneratedVectorGCode {
  const {
    canvasWidth,
    canvasHeight,
    targetWidth,
    targetHeight,
    offsetX,
    offsetY,
    feedRate,
    backlashX,
    backlashY,
    safeZ,
    dipInterval,
    dipX,
    dipY,
    continuousPlot,
    artefactThreshold,
  } = settings;

  // Filter tiny paths
  let filteredPaths = paths.filter((path) => getPathLength(path) >= artefactThreshold);
  const artefactsRemoved = paths.length - filteredPaths.length;

  // Optimize paths (sort and merge)
  filteredPaths = optimizePaths(filteredPaths);

  if (filteredPaths.length === 0) {
    return {
      gcode: '',
      lines: [],
      svg: generateSVG([], canvasWidth, canvasHeight),
      stats: {
        bounds: { minX: 0, maxX: 0, minY: 0, maxY: 0 },
        scale: 1,
        pathCount: 0,
        totalDistance: 0,
        travelDistance: 0,
        artefactsRemoved,
        dipCount: 0,
      },
    };
  }

  // Calculate bounds
  const allPoints = filteredPaths.flatMap((p) => p);
  const minX = Math.min(...allPoints.map((p) => p[0]));
  const maxX = Math.max(...allPoints.map((p) => p[0]));
  const minY = Math.min(...allPoints.map((p) => p[1]));
  const maxY = Math.max(...allPoints.map((p) => p[1]));

  // Calculate scale to fit target dimensions while maintaining aspect ratio
  const inputWidth = maxX - minX || 1;
  const inputHeight = maxY - minY || 1;
  const scaleX = targetWidth / inputWidth;
  const scaleY = targetHeight / inputHeight;
  const scale = Math.min(scaleX, scaleY);

  // Center the output
  const outputWidth = inputWidth * scale;
  const outputHeight = inputHeight * scale;
  const centerOffsetX = (targetWidth - outputWidth) / 2;
  const centerOffsetY = (targetHeight - outputHeight) / 2;

  // Transform function
  const transform = (p: Point): Point => {
    const x = (p[0] - minX) * scale + offsetX + centerOffsetX;
    const y = (p[1] - minY) * scale + offsetY + centerOffsetY;
    return [x, y];
  };

  // Generate G-code
  const lines: string[] = [];
  lines.push('%');
  lines.push('(Algorithmic Drawing G-code)');
  lines.push('G21 G90'); // mm, absolute
  lines.push(`G0 Z${safeZ}`); // Safe height

  const backlash = new BacklashFixer(backlashX, backlashY);
  let distanceAccumulator = 0;
  let totalDistance = 0;
  let travelDistance = 0;
  let dipCount = 0;
  let lastPoint: Point | null = null;

  // Initial dip
  if (!continuousPlot) {
    dipCount++;
    lines.push(`(Initial Dip #${dipCount})`);
    lines.push(`G0 X${dipX} Y${dipY}`);
    lines.push('G1 Z-2 F500');
    lines.push('G4 P0.5');
    lines.push(`G0 Z${safeZ}`);
  }

  // Process each path
  for (const path of filteredPaths) {
    if (path.length === 0) continue;

    const transformedPath = path.map(transform);
    const firstPoint = transformedPath[0];

    // Travel to start
    if (lastPoint) {
      travelDistance += distance(lastPoint, firstPoint);
    }

    let first = true;
    for (const [tx, ty] of transformedPath) {
      if (first) {
        lines.push(...backlash.process(tx, ty, true, feedRate));
        lines.push('G1 Z0 F500'); // Pen down
        first = false;
      } else {
        lines.push(...backlash.process(tx, ty, false, feedRate));

        // Accumulate distance
        if (lastPoint) {
          const d = distance(lastPoint, [tx, ty]);
          distanceAccumulator += d;
          totalDistance += d;
        }
      }
      lastPoint = [tx, ty];
    }

    lines.push(`G0 Z${safeZ}`); // Pen up

    // Check for dip
    if (!continuousPlot && distanceAccumulator > dipInterval) {
      dipCount++;
      lines.push(`(Dip #${dipCount} at dist ${distanceAccumulator.toFixed(1)})`);
      lines.push(`G0 X${dipX} Y${dipY}`);
      lines.push('G1 Z-2 F500');
      lines.push('G4 P0.5');
      lines.push(`G0 Z${safeZ}`);
      distanceAccumulator = 0;
    }
  }

  // End sequence
  lines.push('G0 X10 Y130'); // Park position
  lines.push('M30');
  lines.push('%');

  return {
    gcode: lines.join('\n'),
    lines,
    svg: generateSVG(filteredPaths, canvasWidth, canvasHeight),
    stats: {
      bounds: { minX, maxX, minY, maxY },
      scale,
      pathCount: filteredPaths.length,
      totalDistance,
      travelDistance,
      artefactsRemoved,
      dipCount,
    },
  };
}

function generateSVG(paths: Path[], width: number, height: number): string {
  const pathStrings = paths.map((path) => {
    if (path.length === 0) return '';

    const d = path
      .map((point, i) => {
        const [x, y] = point;
        return i === 0 ? `M ${x.toFixed(2)} ${y.toFixed(2)}` : `L ${x.toFixed(2)} ${y.toFixed(2)}`;
      })
      .join(' ');

    return `<path d="${d}" fill="none" stroke="black" stroke-width="0.5"/>`;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="100%" height="100%" fill="white"/>
  ${pathStrings.join('\n  ')}
</svg>`;
}
