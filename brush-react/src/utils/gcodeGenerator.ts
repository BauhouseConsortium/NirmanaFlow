import type { Point, Settings, GeneratedGCode } from '../types';
import { glyphs } from '../data/glyphs';
import { transliterateToba, isBatakScript } from './transliteration';
import { getPathLength, optimizePaths } from './pathOptimizer';
import { BacklashFixer } from './backlashFixer';
import { WIGGLE_DIP_SEQUENCE, processDipSequence } from './gcodeDipLogic';

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

  // Reference baseline advance for mark positioning (from original implementation)
  const REF_BASE_ADV = 478.2 / 600.0;

  // Convert to Batak if Latin input
  const text = isBatakScript(inputText) ? inputText : transliterateToba(inputText);

  // Collect all paths with their positions
  const allPaths: ProcessedPath[] = [];
  let cursorX = 0;
  let lastBaseOriginX = 0;  // Track where last base character started
  let lastBaseAdvance = 0;  // Advance width of last base character
  let artefactsRemoved = 0;
  let markShiftX = 0;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (char === ' ') {
      cursorX += 0.5;
      lastBaseOriginX = cursorX;
      lastBaseAdvance = 0.5;
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

    // Calculate drawing X position
    let drawX = cursorX;

    // Handle pangolat (U+1BF2) special positioning
    if (char === '\u1BF2') {
      drawX -= 0.85;
    }

    // Handle mark positioning (except pangolat which has its own logic)
    if (glyph.is_mark && char !== '\u1BF2') {
      const mode = glyph.anchor?.mode || 'center';

      if (mode === 'right') {
        const shift = lastBaseAdvance - REF_BASE_ADV;
        drawX = lastBaseOriginX + shift;
      } else {
        // center mode (default)
        const shift = (lastBaseAdvance / 2) - (REF_BASE_ADV / 2);
        drawX = lastBaseOriginX + shift;
      }
    }

    // Add paths to collection (reference uses just drawX, not drawX + markShiftX)
    for (const path of optimized) {
      const translatedPoints: Point[] = path.map(([x, y]) => [
        x + drawX,
        y,
      ]);
      allPaths.push({
        points: translatedPoints,
        absoluteX: drawX,
      });
    }

    // Update cursor and tracking variables
    if (!glyph.is_mark || char === '\u1BF2') {
      // Base character or pangolat
      markShiftX = 0;
      lastBaseOriginX = cursorX;
      lastBaseAdvance = glyph.advance;
      cursorX += glyph.advance + kerning;
    } else {
      // Mark character (not pangolat) - handle stacking
      // Apply current shift to drawX for path generation (already done above)
      drawX += markShiftX;

      // Calculate this mark's width for NEXT mark
      let mMin = Infinity, mMax = -Infinity;
      for (const p of glyph.paths) {
        for (const pt of p) {
          mMin = Math.min(mMin, pt[0]);
          mMax = Math.max(mMax, pt[0]);
        }
      }
      const mWidth = (mMax > mMin) ? (mMax - mMin) : 0;

      // Increment shift for NEXT mark
      markShiftX += (mWidth > 0 ? mWidth : 0.4) + 0.5;

      // If mark has advance (spacing), add it
      if (glyph.advance > 0) {
        cursorX += glyph.advance;
      }

      // AUTO-SPACING: If this mark extends BEYOND the current cursorX,
      // push cursorX to accommodate it (ensures next base starts after mark)
      const markRightEdge = drawX + mMax;
      if (markRightEdge > cursorX) {
        cursorX = markRightEdge - 0.1;
      }
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

  // Header (matching reference)
  lines.push('%');
  lines.push('(Batak Skeleton Assembler Output)');
  lines.push('G21 G90');
  lines.push(`G0 Z${safeZ}`);

  const backlash = new BacklashFixer(backlashX, backlashY);
  let distanceAccumulator = 0;
  let dipCount = 0;
  let lastPoint: Point | null = null;

  // Generate dip sequence G-code using new shift logic
  const generateDipSequence = (): string[] => {
    const template = customDipSequence || WIGGLE_DIP_SEQUENCE;
    return processDipSequence(template, dipX, dipY);
  };

  // Initial dip (if not continuous plot)
  if (!continuousPlot) { // Note: Reference logic has simple (!isPlotter) check, implicitly always dips at start if not plotter
    dipCount++;
    lines.push(`(Initial Dip #${dipCount})`);

    // Check if we have a sequence to use
    const template = customDipSequence || WIGGLE_DIP_SEQUENCE;
    if (template && template.trim().length > 0) {
      lines.push(...generateDipSequence());
    } else {
      // Fallback default from reference if somehow WIGGLE is cleared but custom is empty (unlikely with this code structure but for safety)
      // This is the only place G4 would appear, matching reference "else" block.
      // However, processDipSequence handles empty logic too.
      // If we really wanted to match the "G4 fallback" of the reference when textarea is empty:
      lines.push(`G0 Z${safeZ}`);
      lines.push(`G0 X${dipX} Y${dipY}`);
      lines.push(`G1 Z-2 F500`);
      lines.push("G4 P500");
      lines.push(`G0 Z${safeZ}`);
    }

    // Return to safe Z
    lines.push(`G0 Z${safeZ}`);
  }

  // Process each path
  for (const { points } of allPaths) {
    if (points.length === 0) continue;

    const transformedPoints = points.map(transform);

    let first = true;
    for (const [tx, ty] of transformedPoints) {
      // Calc distance for dipping
      if (!first && lastPoint) {
        distanceAccumulator += distance(lastPoint, [tx, ty]);
      }

      if (first) {
        lines.push(...backlash.process(tx, ty, true, feedRate));
        lines.push('G1 Z0 F500');
        first = false;
      } else {
        lines.push(...backlash.process(tx, ty, false, feedRate));
      }
      lastPoint = [tx, ty];
    }
    lines.push(`G0 Z${safeZ}`);

    // Check dip AFTER stroke is complete
    if (!continuousPlot && distanceAccumulator > dipInterval) {
      dipCount++;
      lines.push(`(Dip #${dipCount} at dist ${distanceAccumulator.toFixed(1)} after stroke)`);

      const template = customDipSequence || WIGGLE_DIP_SEQUENCE;
      if (template && template.trim().length > 0) {
        lines.push(...generateDipSequence());
      } else {
        // Fallback G4 logic
        lines.push(`G0 Z${safeZ}`);
        lines.push(`G0 X${dipX} Y${dipY}`);
        lines.push(`G1 Z-2 F500`);
        lines.push("G4 P500");
        lines.push(`G0 Z${safeZ}`);
      }

      distanceAccumulator = 0;
    }
  }

  // End sequence - park position and program end (matching reference)
  lines.push('G0 X10 Y130');
  lines.push('M30');
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
