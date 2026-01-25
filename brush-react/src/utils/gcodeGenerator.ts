import type { Point, Settings, GeneratedGCode } from '../types';
import { glyphs } from '../data/glyphs';
import { transliterateToba, isBatakScript } from './transliteration';
import { getPathLength, optimizePaths } from './pathOptimizer';
import { BacklashFixer } from './backlashFixer';

const DEFAULT_DIP_SEQUENCE = `; Dip sequence
G0 X{dipX} Y{dipY}
G1 Z0 F500
G4 P0.5
G0 Z{safeZ}
`;

interface ProcessedPath {
  points: Point[];
  absoluteX: number;
}

function distance(p1: Point, p2: Point): number {
  const dx = p2[0] - p1[0];
  const dy = p2[1] - p1[1];
  return Math.sqrt(dx * dx + dy * dy);
}

export function generateGCode(inputText: string, settings: Settings): GeneratedGCode {
  const {
    targetWidth,
    offsetX,
    offsetY,
    feedRate,
    backlashX,
    backlashY,
    safeZ,
    kerning,
    artefactThreshold,
    dipInterval,
    dipX,
    dipY,
    continuousPlot,
    customDipSequence,
  } = settings;

  // Convert to Batak if Latin input
  const text = isBatakScript(inputText) ? inputText : transliterateToba(inputText);

  // Collect all paths with their positions
  const allPaths: ProcessedPath[] = [];
  let cursorX = 0;
  let artefactsRemoved = 0;
  let lastBaseWidth = 0;
  let markShiftX = 0;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (char === ' ') {
      cursorX += 0.5;
      lastBaseWidth = 0;
      markShiftX = 0;
      continue;
    }

    if (char === '\n') {
      continue;
    }

    const glyph = glyphs[char];
    if (!glyph) {
      console.warn(`Missing glyph for character: ${char} (U+${char.charCodeAt(0).toString(16).toUpperCase()})`);
      continue;
    }

    // Filter artefacts and optimize paths
    const filteredPaths = glyph.paths.filter(path => getPathLength(path) >= artefactThreshold);
    artefactsRemoved += glyph.paths.length - filteredPaths.length;
    const optimized = optimizePaths(filteredPaths);

    // Handle mark positioning
    let offsetForMark = 0;
    if (glyph.is_mark) {
      if (glyph.anchor?.mode === 'center') {
        const markWidth = Math.max(...optimized.flat().map(p => p[0])) - Math.min(...optimized.flat().map(p => p[0]));
        offsetForMark = (lastBaseWidth - markWidth) / 2 + markShiftX;
      } else if (glyph.anchor?.mode === 'right') {
        offsetForMark = lastBaseWidth + markShiftX;
      }
      markShiftX += glyph.anchor?.dx || 0;
    }

    // Handle pangolat (U+1BF2) special positioning
    if (char === '\u1BF2') {
      cursorX -= 0.85;
    }

    // Add paths to collection
    for (const path of optimized) {
      const translatedPoints: Point[] = path.map(([x, y]) => [
        x + cursorX + offsetForMark,
        y,
      ]);
      allPaths.push({
        points: translatedPoints,
        absoluteX: cursorX + offsetForMark,
      });
    }

    // Update cursor position
    if (!glyph.is_mark) {
      lastBaseWidth = glyph.advance;
      markShiftX = 0;
      cursorX += glyph.advance + kerning;
    }
  }

  if (allPaths.length === 0) {
    return {
      gcode: '',
      lines: [],
      stats: {
        bounds: { minX: 0, maxX: 0, minY: 0, maxY: 0 },
        scale: 1,
        pathCount: 0,
        artefactsRemoved,
        dipCount: 0,
      },
    };
  }

  // Calculate bounds
  const allPoints = allPaths.flatMap(p => p.points);
  const minX = Math.min(...allPoints.map(p => p[0]));
  const maxX = Math.max(...allPoints.map(p => p[0]));
  const minY = Math.min(...allPoints.map(p => p[1]));
  const maxY = Math.max(...allPoints.map(p => p[1]));

  // Calculate scale
  const width = maxX - minX;
  const scale = width > 0 ? targetWidth / width : 1;

  // Transform to physical coordinates
  const transform = (p: Point): Point => {
    const physX = (p[0] - minX) * scale + offsetX;
    const physY = (maxY - p[1]) * scale + offsetY; // Y-flip for G-code
    return [physX, physY];
  };

  // Generate G-code
  const lines: string[] = [];
  lines.push('%');
  lines.push(`; Batak Script G-code`);
  lines.push(`; Input: ${inputText.substring(0, 30)}${inputText.length > 30 ? '...' : ''}`);
  lines.push('G21 G90 ; mm, absolute');
  lines.push(`G0 Z${safeZ}`);

  const backlash = new BacklashFixer(backlashX, backlashY);
  let distanceAccumulator = 0;
  let dipCount = 0;
  let lastPoint: Point | null = null;

  // Generate dip sequence G-code
  const generateDipSequence = (): string[] => {
    const template = customDipSequence || DEFAULT_DIP_SEQUENCE;
    const sequence = template
      .replace(/\{dipX\}/g, dipX.toString())
      .replace(/\{dipY\}/g, dipY.toString())
      .replace(/\{safeZ\}/g, safeZ.toString());
    return sequence.split('\n').filter(line => line.trim());
  };

  // Initial dip (if not continuous plot)
  if (!continuousPlot && dipInterval > 0) {
    lines.push('; Initial dip');
    lines.push(...generateDipSequence());
    dipCount++;
  }

  // Process each path
  for (const { points } of allPaths) {
    if (points.length === 0) continue;

    // Transform all points
    const transformedPoints = points.map(transform);

    // First point: rapid move, then pen down
    const [startX, startY] = transformedPoints[0];

    // Check if we need to dip
    if (lastPoint && !continuousPlot && dipInterval > 0) {
      distanceAccumulator += distance(lastPoint, [startX, startY]);
      if (distanceAccumulator > dipInterval) {
        lines.push(`G0 Z${safeZ}`);
        lines.push(...generateDipSequence());
        dipCount++;
        distanceAccumulator = 0;
      }
    }

    lines.push(...backlash.process(startX, startY, true, feedRate));
    lines.push('G1 Z0 F500 ; pen down');

    // Subsequent points: feed moves
    for (let i = 1; i < transformedPoints.length; i++) {
      const [x, y] = transformedPoints[i];
      lines.push(...backlash.process(x, y, false, feedRate));

      if (!continuousPlot && dipInterval > 0) {
        distanceAccumulator += distance(transformedPoints[i - 1], transformedPoints[i]);
      }
    }

    // Pen up
    lines.push(`G0 Z${safeZ} ; pen up`);
    lastPoint = transformedPoints[transformedPoints.length - 1];
  }

  // End sequence
  lines.push('G0 X10 Y130 ; park');
  lines.push('M30 ; end');
  lines.push('%');

  return {
    gcode: lines.join('\n'),
    lines,
    stats: {
      bounds: { minX, maxX, minY, maxY },
      scale,
      pathCount: allPaths.length,
      artefactsRemoved,
      dipCount,
    },
  };
}
