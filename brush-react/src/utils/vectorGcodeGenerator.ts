/**
 * G-code generator for vector paths from the drawing API
 */

import type { Path, Point, ColoredPath } from './drawingApi';
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
    dipX,
    dipY,
    continuousPlot,
    colorPaletteEnabled,
    mainColor,
    artefactThreshold,
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
      },
    };
  }

  // Calculate bounds (using points from ColoredPath)
  const allPoints = filteredPaths.flatMap((cp) => cp.points);
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

  // Get dip position based on color
  const getDipPosition = (pathColor: number | undefined) => {
    if (colorPaletteEnabled) {
      // Use path-specific color if set, otherwise use mainColor
      const colorIndex = pathColor ?? mainColor;
      return getColorWellPosition(colorIndex, settings);
    }
    // When color palette is disabled, use default dip position
    return { x: dipX, y: dipY };
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

  // Process each path
  for (const coloredPath of filteredPaths) {
    if (coloredPath.points.length === 0) continue;

    const transformedPath = coloredPath.points.map(transform);
    const firstPoint = transformedPath[0];
    const pathColor = coloredPath.color;

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
