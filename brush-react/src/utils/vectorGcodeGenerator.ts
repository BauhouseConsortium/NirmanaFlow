/**
 * G-code generator for vector paths from the drawing API
 */

import type { Point, ColoredPath } from './drawingApi';
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

  // Main color (1-4) - which color well to use when color palette is enabled
  mainColor: number;

  // Color palette settings
  colorPaletteEnabled: boolean;
  colorWell1X: number;
  colorWell1Y: number;
  colorWell1Color: string;
  colorWell2X: number;
  colorWell2Y: number;
  colorWell2Color: string;
  colorWell3X: number;
  colorWell3Y: number;
  colorWell3Color: string;
  colorWell4X: number;
  colorWell4Y: number;
  colorWell4Color: string;

  // Filter settings
  artefactThreshold: number;

  // Clipping
  clipToWorkArea: boolean;
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
    outputWidth: number;
    outputHeight: number;
  };
}

function distance(p1: Point, p2: Point): number {
  const dx = p2[0] - p1[0];
  const dy = p2[1] - p1[1];
  return Math.sqrt(dx * dx + dy * dy);
}

// Cohen-Sutherland line clipping algorithm
const INSIDE = 0;
const LEFT = 1;
const RIGHT = 2;
const BOTTOM = 4;
const TOP = 8;

function computeOutCode(x: number, y: number, xMin: number, yMin: number, xMax: number, yMax: number): number {
  let code = INSIDE;
  if (x < xMin) code |= LEFT;
  else if (x > xMax) code |= RIGHT;
  if (y < yMin) code |= BOTTOM;
  else if (y > yMax) code |= TOP;
  return code;
}

function clipLineToRect(
  x0: number, y0: number, x1: number, y1: number,
  xMin: number, yMin: number, xMax: number, yMax: number
): [number, number, number, number] | null {
  let outcode0 = computeOutCode(x0, y0, xMin, yMin, xMax, yMax);
  let outcode1 = computeOutCode(x1, y1, xMin, yMin, xMax, yMax);
  let accept = false;

  while (true) {
    if (!(outcode0 | outcode1)) {
      // Both inside
      accept = true;
      break;
    } else if (outcode0 & outcode1) {
      // Both outside same region
      break;
    } else {
      const outcodeOut = outcode1 > outcode0 ? outcode1 : outcode0;
      let x = 0, y = 0;

      if (outcodeOut & TOP) {
        x = x0 + (x1 - x0) * (yMax - y0) / (y1 - y0);
        y = yMax;
      } else if (outcodeOut & BOTTOM) {
        x = x0 + (x1 - x0) * (yMin - y0) / (y1 - y0);
        y = yMin;
      } else if (outcodeOut & RIGHT) {
        y = y0 + (y1 - y0) * (xMax - x0) / (x1 - x0);
        x = xMax;
      } else if (outcodeOut & LEFT) {
        y = y0 + (y1 - y0) * (xMin - x0) / (x1 - x0);
        x = xMin;
      }

      if (outcodeOut === outcode0) {
        x0 = x;
        y0 = y;
        outcode0 = computeOutCode(x0, y0, xMin, yMin, xMax, yMax);
      } else {
        x1 = x;
        y1 = y;
        outcode1 = computeOutCode(x1, y1, xMin, yMin, xMax, yMax);
      }
    }
  }

  return accept ? [x0, y0, x1, y1] : null;
}

// Clip a path to a rectangle, returning multiple path segments
function clipPathToRect(
  path: Point[],
  xMin: number, yMin: number, xMax: number, yMax: number
): Point[][] {
  if (path.length < 2) return [];

  const result: Point[][] = [];
  let currentSegment: Point[] = [];

  for (let i = 0; i < path.length - 1; i++) {
    const [x0, y0] = path[i];
    const [x1, y1] = path[i + 1];

    const clipped = clipLineToRect(x0, y0, x1, y1, xMin, yMin, xMax, yMax);

    if (clipped) {
      const [cx0, cy0, cx1, cy1] = clipped;

      // Check if we need to start a new segment (discontinuity)
      if (currentSegment.length === 0) {
        currentSegment.push([cx0, cy0]);
      } else {
        const lastPoint = currentSegment[currentSegment.length - 1];
        // If there's a gap, start new segment
        if (Math.abs(lastPoint[0] - cx0) > 0.01 || Math.abs(lastPoint[1] - cy0) > 0.01) {
          if (currentSegment.length >= 2) {
            result.push(currentSegment);
          }
          currentSegment = [[cx0, cy0]];
        }
      }
      currentSegment.push([cx1, cy1]);
    } else {
      // Line completely outside - end current segment
      if (currentSegment.length >= 2) {
        result.push(currentSegment);
      }
      currentSegment = [];
    }
  }

  // Don't forget the last segment
  if (currentSegment.length >= 2) {
    result.push(currentSegment);
  }

  return result;
}

// Helper to get dip position for a color
function getColorWellPosition(
  colorIndex: number,
  settings: VectorSettings
): { x: number; y: number } {
  switch (colorIndex) {
    case 1:
      return { x: settings.colorWell1X, y: settings.colorWell1Y };
    case 2:
      return { x: settings.colorWell2X, y: settings.colorWell2Y };
    case 3:
      return { x: settings.colorWell3X, y: settings.colorWell3Y };
    case 4:
      return { x: settings.colorWell4X, y: settings.colorWell4Y };
    default:
      return { x: settings.dipX, y: settings.dipY };
  }
}

export function generateVectorGCode(
  paths: ColoredPath[],
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
    continuousPlot,
    colorPaletteEnabled,
    mainColor,
    artefactThreshold,
    clipToWorkArea,
  } = settings;

  // Filter tiny paths (using points from ColoredPath)
  let filteredPaths = paths.filter((cp) => getPathLength(cp.points) >= artefactThreshold);
  const artefactsRemoved = paths.length - filteredPaths.length;

  // Extract plain paths for optimization, then re-associate with colors
  const plainPaths = filteredPaths.map(cp => cp.points);
  const colors = filteredPaths.map(cp => cp.color);
  const optimizedPlainPaths = optimizePaths(plainPaths);

  // Note: optimization may reorder paths, so we need to create new ColoredPaths
  // For simplicity, we'll use the paths as-is if colors are being used
  // If no colors are set, we can use the optimized paths
  if (colorPaletteEnabled && colors.some(c => c !== undefined)) {
    // Keep original order to preserve color associations
    // (optimization might break color groupings)
  } else {
    filteredPaths = optimizedPlainPaths.map(points => ({ points, color: undefined }));
  }

  if (filteredPaths.length === 0) {
    return {
      gcode: '',
      lines: [],
      svg: generateSVG([], canvasWidth, canvasHeight, settings),
      stats: {
        bounds: { minX: 0, maxX: 0, minY: 0, maxY: 0 },
        scale: 1,
        pathCount: 0,
        totalDistance: 0,
        travelDistance: 0,
        artefactsRemoved,
        dipCount: 0,
        outputWidth: 0,
        outputHeight: 0,
      },
    };
  }

  // Calculate bounds of drawn content (for stats only)
  const allPoints = filteredPaths.flatMap((cp) => cp.points);
  const minX = Math.min(...allPoints.map((p) => p[0]));
  const maxX = Math.max(...allPoints.map((p) => p[0]));
  const minY = Math.min(...allPoints.map((p) => p[1]));
  const maxY = Math.max(...allPoints.map((p) => p[1]));

  // Calculate scale based on CANVAS dimensions (not drawn content)
  // This ensures predictable 1:1 mapping: canvas coords → output coords
  const scaleX = targetWidth / canvasWidth;
  const scaleY = targetHeight / canvasHeight;
  const scale = Math.min(scaleX, scaleY);

  // Center the canvas content within target area (when aspect ratios differ)
  const scaledCanvasWidth = canvasWidth * scale;
  const scaledCanvasHeight = canvasHeight * scale;
  const centerOffsetX = (targetWidth - scaledCanvasWidth) / 2;
  const centerOffsetY = (targetHeight - scaledCanvasHeight) / 2;

  // Calculate actual output dimensions of drawn content
  const outputWidth = (maxX - minX) * scale;
  const outputHeight = (maxY - minY) * scale;

  // Transform function: canvas coords (0,0)-(canvasW,canvasH) → output coords
  // Direct mapping without mirroring - preview matches print output
  const transform = (p: Point): Point => {
    const x = p[0] * scale + offsetX + centerOffsetX;
    const y = p[1] * scale + offsetY + centerOffsetY;
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

  // Get dip position based on color
  const getDipPosition = (pathColor: number | undefined) => {
    const colorIndex = colorPaletteEnabled ? (pathColor ?? mainColor) : mainColor;
    return getColorWellPosition(colorIndex, settings);
  };

  // Track current color for dipping
  let currentColor: number | undefined = undefined;

  // Initial dip
  if (!continuousPlot) {
    const firstPathColor = filteredPaths[0]?.color;
    currentColor = colorPaletteEnabled ? (firstPathColor ?? mainColor) : undefined;
    const dipPos = getDipPosition(firstPathColor);
    dipCount++;
    lines.push(`(Initial Dip #${dipCount}${colorPaletteEnabled ? ` - Color ${currentColor ?? mainColor}` : ''})`);
    lines.push(`G0 X${dipPos.x} Y${dipPos.y}`);
    lines.push('G1 Z-2 F500');
    lines.push('G4 P0.5');
    lines.push(`G0 Z${safeZ}`);
  }

  // Work area bounds for clipping
  const workAreaMinX = offsetX;
  const workAreaMinY = offsetY;
  const workAreaMaxX = offsetX + targetWidth;
  const workAreaMaxY = offsetY + targetHeight;

  // Process each path (with optional clipping)
  for (const coloredPath of filteredPaths) {
    if (coloredPath.points.length === 0) continue;

    const transformedPath = coloredPath.points.map(transform);
    const pathColor = coloredPath.color;

    // Apply clipping if enabled
    let pathsToProcess: Point[][];
    if (clipToWorkArea) {
      pathsToProcess = clipPathToRect(
        transformedPath,
        workAreaMinX,
        workAreaMinY,
        workAreaMaxX,
        workAreaMaxY
      );
      if (pathsToProcess.length === 0) continue; // Entirely outside
    } else {
      pathsToProcess = [transformedPath];
    }

    // Process each clipped segment
    for (const segmentPath of pathsToProcess) {
      if (segmentPath.length === 0) continue;
      const firstPoint = segmentPath[0];

      // Travel to start
      if (lastPoint) {
        travelDistance += distance(lastPoint, firstPoint);
      }

      let first = true;
      for (const [tx, ty] of segmentPath) {
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

      // Check for dip - use current path's color for dip position
      if (!continuousPlot && distanceAccumulator > dipInterval) {
        dipCount++;
        const dipPos = getDipPosition(pathColor);
        lines.push(`(Dip #${dipCount} at dist ${distanceAccumulator.toFixed(1)}${colorPaletteEnabled ? ` - Color ${pathColor ?? mainColor}` : ''})`);
        lines.push(`G0 X${dipPos.x} Y${dipPos.y}`);
        lines.push('G1 Z-2 F500');
        lines.push('G4 P0.5');
        lines.push(`G0 Z${safeZ}`);
        distanceAccumulator = 0;
      }
    }
  }

  // End sequence
  lines.push('G0 X10 Y130'); // Park position
  lines.push('M30');
  lines.push('%');

  return {
    gcode: lines.join('\n'),
    lines,
    svg: generateSVG(filteredPaths, canvasWidth, canvasHeight, settings),
    stats: {
      bounds: { minX, maxX, minY, maxY },
      scale,
      pathCount: filteredPaths.length,
      totalDistance,
      travelDistance,
      artefactsRemoved,
      dipCount,
      outputWidth,
      outputHeight,
    },
  };
}

// Default colors for the 4 color wells (matches VectorSettings defaults)
const COLOR_WELL_COLORS = ['#1e40af', '#dc2626', '#16a34a', '#171717'];

function generateSVG(
  coloredPaths: ColoredPath[],
  width: number,
  height: number,
  settings?: VectorSettings
): string {
  const pathStrings = coloredPaths.map((coloredPath) => {
    if (coloredPath.points.length === 0) return '';

    const d = coloredPath.points
      .map((point, i) => {
        const [x, y] = point;
        return i === 0 ? `M ${x.toFixed(2)} ${y.toFixed(2)}` : `L ${x.toFixed(2)} ${y.toFixed(2)}`;
      })
      .join(' ');

    // Determine stroke color
    let strokeColor = 'black';
    if (settings?.colorPaletteEnabled && coloredPath.color) {
      // Use the color well's configured color
      const colorIndex = coloredPath.color;
      switch (colorIndex) {
        case 1: strokeColor = settings.colorWell1Color; break;
        case 2: strokeColor = settings.colorWell2Color; break;
        case 3: strokeColor = settings.colorWell3Color; break;
        case 4: strokeColor = settings.colorWell4Color; break;
      }
    } else if (settings?.colorPaletteEnabled) {
      // Use main color
      const mainColorIndex = settings.mainColor;
      strokeColor = COLOR_WELL_COLORS[mainColorIndex - 1] || 'black';
    }

    return `<path d="${d}" fill="none" stroke="${strokeColor}" stroke-width="0.5"/>`;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="100%" height="100%" fill="white"/>
  ${pathStrings.join('\n  ')}
</svg>`;
}
