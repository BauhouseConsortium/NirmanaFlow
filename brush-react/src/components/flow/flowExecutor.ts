/**
 * Flow Executor - Converts node graph to drawing paths
 */

import type { Node, Edge } from '@xyflow/react';
import type { Path, Point } from '../../utils/drawingApi';
import { renderText } from './strokeFont';
import { transliterateToba } from '../../utils/transliteration';
import { glyphs } from '../../data/glyphs';

// Get all source nodes that connect to a target node
function getSourceNodes(targetId: string, nodes: Node[], edges: Edge[]): Node[] {
  const incomingEdges = edges.filter((e) => e.target === targetId);
  return incomingEdges
    .map((e) => nodes.find((n) => n.id === e.source))
    .filter((n): n is Node => n !== undefined);
}

// Generate paths from a shape node
function generateShapePaths(node: Node): Path[] {
  const data = node.data as Record<string, unknown>;
  const label = ((data.label as string) || '').toLowerCase();
  const paths: Path[] = [];

  switch (label) {
    case 'line': {
      const x1 = (data.x1 as number) || 0;
      const y1 = (data.y1 as number) || 0;
      const x2 = (data.x2 as number) || 0;
      const y2 = (data.y2 as number) || 0;
      paths.push([[x1, y1], [x2, y2]]);
      break;
    }

    case 'rectangle': {
      const x = (data.x as number) || 0;
      const y = (data.y as number) || 0;
      const w = (data.width as number) || 20;
      const h = (data.height as number) || 20;
      paths.push([
        [x, y],
        [x + w, y],
        [x + w, y + h],
        [x, y + h],
        [x, y],
      ]);
      break;
    }

    case 'circle': {
      const cx = (data.cx as number) || 50;
      const cy = (data.cy as number) || 50;
      const r = (data.radius as number) || 20;
      const segments = (data.segments as number) || 36;
      const points: Point[] = [];
      for (let i = 0; i <= segments; i++) {
        const angle = (i / segments) * Math.PI * 2;
        points.push([cx + Math.cos(angle) * r, cy + Math.sin(angle) * r]);
      }
      paths.push(points);
      break;
    }

    case 'ellipse': {
      const cx = (data.cx as number) || 50;
      const cy = (data.cy as number) || 50;
      const rx = (data.rx as number) || 30;
      const ry = (data.ry as number) || 20;
      const segments = (data.segments as number) || 36;
      const points: Point[] = [];
      for (let i = 0; i <= segments; i++) {
        const angle = (i / segments) * Math.PI * 2;
        points.push([cx + Math.cos(angle) * rx, cy + Math.sin(angle) * ry]);
      }
      paths.push(points);
      break;
    }

    case 'arc': {
      const cx = (data.cx as number) || 50;
      const cy = (data.cy as number) || 50;
      const r = (data.radius as number) || 20;
      const startAngle = (data.startAngle as number) || 0;
      const endAngle = (data.endAngle as number) || 90;
      const segments = (data.segments as number) || 24;
      const startRad = (startAngle * Math.PI) / 180;
      const endRad = (endAngle * Math.PI) / 180;
      const range = endRad - startRad;
      const points: Point[] = [];
      for (let i = 0; i <= segments; i++) {
        const angle = startRad + (i / segments) * range;
        points.push([cx + Math.cos(angle) * r, cy + Math.sin(angle) * r]);
      }
      paths.push(points);
      break;
    }

    case 'polygon': {
      const sides = (data.sides as number) || 6;
      const cx = (data.cx as number) || 50;
      const cy = (data.cy as number) || 50;
      const r = (data.radius as number) || 20;
      const points: Point[] = [];
      for (let i = 0; i <= sides; i++) {
        const angle = (i / sides) * Math.PI * 2 - Math.PI / 2; // Start from top
        points.push([cx + Math.cos(angle) * r, cy + Math.sin(angle) * r]);
      }
      paths.push(points);
      break;
    }
  }

  return paths;
}

// Transform a point around a center
function transformPoint(
  point: Point,
  tx: number,
  ty: number,
  rotation: number,
  scale: number,
  cx: number,
  cy: number
): Point {
  // Translate to origin
  let x = point[0] - cx;
  let y = point[1] - cy;

  // Scale
  x *= scale;
  y *= scale;

  // Rotate
  if (rotation !== 0) {
    const rad = (rotation * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const rx = x * cos - y * sin;
    const ry = x * sin + y * cos;
    x = rx;
    y = ry;
  }

  // Translate back and add offset
  return [x + cx + tx, y + cy + ty];
}

// Transform paths
function transformPaths(
  paths: Path[],
  tx: number,
  ty: number,
  rotation = 0,
  scale = 1,
  cx = 0,
  cy = 0
): Path[] {
  return paths.map((path) =>
    path.map((point) => transformPoint(point, tx, ty, rotation, scale, cx, cy))
  );
}

// Calculate centroid of paths
function getPathsCentroid(paths: Path[]): Point {
  let sumX = 0;
  let sumY = 0;
  let count = 0;

  for (const path of paths) {
    for (const point of path) {
      sumX += point[0];
      sumY += point[1];
      count++;
    }
  }

  return count > 0 ? [sumX / count, sumY / count] : [0, 0];
}

// Render Batak text using glyphs data
// Simplify path by removing consecutive points that are too close together
function simplifyPath(path: Point[], minDistance: number = 0.5): Point[] {
  if (path.length < 2) return path;

  const result: Point[] = [path[0]];

  for (let i = 1; i < path.length; i++) {
    const prev = result[result.length - 1];
    const curr = path[i];
    const dx = curr[0] - prev[0];
    const dy = curr[1] - prev[1];
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Keep point if it's far enough from the previous kept point
    // or if it's the last point in the path
    if (dist >= minDistance || i === path.length - 1) {
      result.push(curr);
    }
  }

  return result;
}

function renderBatakText(
  latinText: string,
  options: { x: number; y: number; size: number }
): Path[] {
  const { x: startX, y: startY, size } = options;
  const paths: Path[] = [];

  // Transliterate Latin to Batak script
  const batakText = transliterateToba(latinText);
  if (!batakText) return paths;

  let cursorX = startX;
  let lastBaseX = startX; // Track position of last base character for marks
  const scale = size; // Size is the scaling factor

  // Minimum distance for path simplification (scaled)
  const minDist = 0.01 * scale;

  for (const char of batakText) {
    const glyph = glyphs[char];

    if (glyph) {
      // Determine render position
      let renderX = cursorX;

      if (glyph.is_mark && glyph.anchor) {
        // Marks are positioned relative to the previous base character
        // Use the anchor dx value to offset from the base position
        renderX = lastBaseX;
        if (glyph.anchor.mode === 'center') {
          // For center mode, subtract the glyph's built-in X offset
          // The mark paths already have X coordinates baked in
          renderX = lastBaseX - (glyph.anchor.dx || 0) * scale;
        } else if (glyph.anchor.mode === 'right') {
          renderX = lastBaseX;
        }
      }

      // Render glyph paths
      for (const glyphPath of glyph.paths) {
        const scaledPath: Point[] = glyphPath.map(([px, py]) => [
          renderX + px * scale,
          startY + py * scale,
        ]);

        // Simplify path to remove clustered points that cause artifacts
        const simplifiedPath = simplifyPath(scaledPath, minDist);

        if (simplifiedPath.length > 1) {
          paths.push(simplifiedPath);
        }
      }

      // Handle cursor advancement
      if (!glyph.is_mark) {
        // Save base character position for subsequent marks
        lastBaseX = cursorX;
        // Advance cursor by glyph width
        cursorX += glyph.advance * scale;
      }
    } else if (char === ' ') {
      // Space character - advance by a fixed amount
      cursorX += 0.5 * scale;
    }
  }

  return paths;
}

// Parse L-System rules from string format "F=FF,X=FX"
function parseLSystemRules(rulesStr: string): Map<string, string> {
  const rules = new Map<string, string>();
  const parts = rulesStr.split(',');
  for (const part of parts) {
    const [key, value] = part.split('=');
    if (key && value !== undefined) {
      rules.set(key.trim(), value.trim());
    }
  }
  return rules;
}

// Expand L-System string
function expandLSystem(axiom: string, rules: Map<string, string>, iterations: number): string {
  let current = axiom;
  for (let i = 0; i < iterations; i++) {
    let next = '';
    for (const char of current) {
      next += rules.get(char) ?? char;
    }
    current = next;
    // Limit length to prevent explosion
    if (current.length > 50000) break;
  }
  return current;
}

// Apply L-System transformation to input paths
function applyLSystem(node: Node, inputPaths: Path[]): Path[] {
  const data = node.data as Record<string, unknown>;
  const axiom = (data.axiom as string) || 'F';
  const rulesStr = (data.rules as string) || 'F=F+F-F-F+F';
  const iterations = Math.max(1, Math.min(8, (data.iterations as number) || 3));
  const angle = (data.angle as number) ?? 90;
  const stepSize = (data.stepSize as number) ?? 10;
  const startX = (data.startX as number) ?? 75;
  const startY = (data.startY as number) ?? 100;
  const startAngle = (data.startAngle as number) ?? -90;
  const scalePerIter = (data.scalePerIter as number) ?? 1;

  if (inputPaths.length === 0) return [];

  const rules = parseLSystemRules(rulesStr);
  const expanded = expandLSystem(axiom, rules, iterations);

  const resultPaths: Path[] = [];
  const centroid = getPathsCentroid(inputPaths);

  // Turtle state
  let x = startX;
  let y = startY;
  let dir = startAngle;
  let currentScale = 1;
  const stack: { x: number; y: number; dir: number; scale: number }[] = [];

  // Characters that trigger shape placement
  const drawChars = new Set(['F', 'G', 'A', 'B', '0', '1', '6', '7', '8', '9']);

  for (const char of expanded) {
    switch (char) {
      case 'F':
      case 'G':
      case 'A':
      case 'B':
      case '0':
      case '1':
      case '6':
      case '7':
      case '8':
      case '9':
        if (drawChars.has(char)) {
          // Place input paths at current position with current rotation
          const tx = x - centroid[0];
          const ty = y - centroid[1];
          const transformed = transformPaths(inputPaths, tx, ty, dir + 90, currentScale, 0, 0);
          resultPaths.push(...transformed);
        }
        // Move forward
        const rad = (dir * Math.PI) / 180;
        x += Math.cos(rad) * stepSize * currentScale;
        y += Math.sin(rad) * stepSize * currentScale;
        break;

      case 'f':
        // Move forward without drawing
        const radF = (dir * Math.PI) / 180;
        x += Math.cos(radF) * stepSize * currentScale;
        y += Math.sin(radF) * stepSize * currentScale;
        break;

      case '+':
        // Turn right
        dir += angle;
        break;

      case '-':
        // Turn left
        dir -= angle;
        break;

      case '[':
        // Push state
        stack.push({ x, y, dir, scale: currentScale });
        currentScale *= scalePerIter;
        break;

      case ']':
        // Pop state
        const state = stack.pop();
        if (state) {
          x = state.x;
          y = state.y;
          dir = state.dir;
          currentScale = state.scale;
        }
        break;

      case '|':
        // Turn around (180 degrees)
        dir += 180;
        break;
    }

    // Safety limit
    if (resultPaths.length > 5000) break;
  }

  return resultPaths;
}

// Generate attractor paths
function generateAttractor(node: Node): Path[] {
  const data = node.data as Record<string, unknown>;
  const type = (data.type as string) || 'clifford';
  const iterations = Math.max(100, Math.min(50000, (data.iterations as number) || 5000));
  const a = (data.a as number) ?? -1.4;
  const b = (data.b as number) ?? 1.6;
  const c = (data.c as number) ?? 1.0;
  const d = (data.d as number) ?? 0.7;
  const scale = (data.scale as number) ?? 20;
  const centerX = (data.centerX as number) ?? 75;
  const centerY = (data.centerY as number) ?? 60;

  const points: Point[] = [];
  let x = 0.1;
  let y = 0.1;

  // Skip first few iterations to settle into attractor
  for (let i = 0; i < 100; i++) {
    const result = iterateAttractor(type, x, y, a, b, c, d);
    x = result.x;
    y = result.y;
  }

  // Generate points
  for (let i = 0; i < iterations; i++) {
    const result = iterateAttractor(type, x, y, a, b, c, d);
    x = result.x;
    y = result.y;

    // Check for divergence
    if (!isFinite(x) || !isFinite(y) || Math.abs(x) > 1e6 || Math.abs(y) > 1e6) {
      break;
    }

    points.push([centerX + x * scale, centerY + y * scale]);
  }

  // Split into multiple paths to avoid single massive stroke
  // This creates a more plottable result
  const paths: Path[] = [];
  const chunkSize = 500;
  for (let i = 0; i < points.length; i += chunkSize) {
    const chunk = points.slice(i, Math.min(i + chunkSize + 1, points.length));
    if (chunk.length > 1) {
      paths.push(chunk);
    }
  }

  return paths;
}

function iterateAttractor(
  type: string,
  x: number,
  y: number,
  a: number,
  b: number,
  c: number,
  d: number
): { x: number; y: number } {
  switch (type) {
    case 'clifford':
      // Clifford Attractor: x' = sin(a*y) + c*cos(a*x), y' = sin(b*x) + d*cos(b*y)
      return {
        x: Math.sin(a * y) + c * Math.cos(a * x),
        y: Math.sin(b * x) + d * Math.cos(b * y),
      };

    case 'dejong':
      // De Jong Attractor: x' = sin(a*y) - cos(b*x), y' = sin(c*x) - cos(d*y)
      return {
        x: Math.sin(a * y) - Math.cos(b * x),
        y: Math.sin(c * x) - Math.cos(d * y),
      };

    case 'bedhead':
      // Bedhead Attractor: x' = sin(x*y/b)*y + cos(a*x-y), y' = x + sin(y)/b
      return {
        x: Math.sin(x * y / b) * y + Math.cos(a * x - y),
        y: x + Math.sin(y) / b,
      };

    case 'tinkerbell':
      // Tinkerbell Attractor: x' = x² - y² + a*x + b*y, y' = 2*x*y + c*x + d*y
      return {
        x: x * x - y * y + a * x + b * y,
        y: 2 * x * y + c * x + d * y,
      };

    case 'gumowski':
      // Gumowski-Mira Attractor
      const gFunc = (v: number) => a * v + 2 * (1 - a) * v * v / (1 + v * v);
      const newX = b * y + gFunc(x);
      return {
        x: newX,
        y: -x + gFunc(newX),
      };

    default:
      return { x, y };
  }
}

// Safely evaluate a bytebeat formula
function evaluateFormula(formula: string, t: number): number {
  try {
    // Create a safe evaluation context with only t and bitwise operators
    const safeFormula = formula
      .replace(/[^0-9t+\-*/%&|^~()<>]/g, '') // Remove unsafe chars
      .replace(/>>>/g, '>>'); // Normalize unsigned shift

    // Use Function constructor for sandboxed evaluation
    const fn = new Function('t', `return (${safeFormula}) & 0xFF;`);
    const result = fn(t);
    return typeof result === 'number' && isFinite(result) ? result : 0;
  } catch {
    return 0;
  }
}

// Apply algorithmic (bytebeat) node transformations
function applyAlgorithmic(node: Node, inputPaths: Path[]): Path[] {
  const data = node.data as Record<string, unknown>;
  const formula = (data.formula as string) || 't*(t>>5|t>>8)';
  const count = Math.max(1, Math.min(256, Math.floor((data.count as number) || 16)));
  const mode = (data.mode as string) || 'position';
  const xScale = (data.xScale as number) ?? 0.5;
  const yScale = (data.yScale as number) ?? 0.5;
  const rotScale = (data.rotScale as number) ?? 1;
  const sclScale = (data.sclScale as number) ?? 0.01;
  const baseX = (data.baseX as number) ?? 75;
  const baseY = (data.baseY as number) ?? 60;

  if (inputPaths.length === 0) return [];

  const resultPaths: Path[] = [];
  const centroid = getPathsCentroid(inputPaths);

  for (let t = 0; t < count; t++) {
    const val = evaluateFormula(formula, t);

    let tx = 0, ty = 0, rot = 0, scl = 1;

    switch (mode) {
      case 'position':
        tx = baseX + (val * xScale) - centroid[0];
        ty = baseY + ((val >> 4) * yScale) - centroid[1];
        break;
      case 'rotation':
        rot = val * rotScale;
        tx = baseX - centroid[0];
        ty = baseY - centroid[1];
        break;
      case 'scale':
        scl = 0.5 + (val * sclScale);
        tx = baseX - centroid[0];
        ty = baseY - centroid[1];
        break;
      case 'all':
        tx = baseX + ((val & 0x0F) * xScale) - centroid[0];
        ty = baseY + (((val >> 4) & 0x0F) * yScale) - centroid[1];
        rot = (val & 0x1F) * rotScale;
        scl = 0.5 + ((val >> 5) * sclScale);
        break;
    }

    const transformed = transformPaths(inputPaths, tx, ty, rot, scl, 0, 0);
    resultPaths.push(...transformed);
  }

  return resultPaths;
}

// Apply transform node transformations (single transform)
function applyTransform(node: Node, inputPaths: Path[]): Path[] {
  const data = node.data as Record<string, unknown>;
  const label = ((data.label as string) || '').toLowerCase();

  if (inputPaths.length === 0) return [];

  switch (label) {
    case 'translate': {
      const dx = (data.dx as number) || 0;
      const dy = (data.dy as number) || 0;
      return transformPaths(inputPaths, dx, dy, 0, 1, 0, 0);
    }

    case 'rotate': {
      const angle = (data.angle as number) || 0;
      const cx = (data.cx as number) || 0;
      const cy = (data.cy as number) || 0;
      return transformPaths(inputPaths, 0, 0, angle, 1, cx, cy);
    }

    case 'scale': {
      const sx = (data.sx as number) || 1;
      const sy = (data.sy as number) || 1;
      const cx = (data.cx as number) || 0;
      const cy = (data.cy as number) || 0;
      // For non-uniform scaling, we need to handle it differently
      return inputPaths.map((path) =>
        path.map((point) => {
          const x = (point[0] - cx) * sx + cx;
          const y = (point[1] - cy) * sy + cy;
          return [x, y] as Point;
        })
      );
    }

    default:
      return inputPaths;
  }
}

// Apply iteration node transformations
function applyIteration(node: Node, inputPaths: Path[]): Path[] {
  const data = node.data as Record<string, unknown>;
  const label = ((data.label as string) || '').toLowerCase();
  const resultPaths: Path[] = [];

  if (inputPaths.length === 0) return [];

  switch (label) {
    case 'repeat': {
      const count = Math.max(1, Math.floor((data.count as number) || 5));
      const offsetX = (data.offsetX as number) || 0;
      const offsetY = (data.offsetY as number) || 0;
      const rotation = (data.rotation as number) || 0;
      const scale = (data.scale as number) || 1;
      const centroid = getPathsCentroid(inputPaths);

      for (let i = 0; i < count; i++) {
        const tx = offsetX * i;
        const ty = offsetY * i;
        const rot = rotation * i;
        const scl = Math.pow(scale, i);
        const transformed = transformPaths(inputPaths, tx, ty, rot, scl, centroid[0], centroid[1]);
        resultPaths.push(...transformed);
      }
      break;
    }

    case 'grid': {
      const cols = Math.max(1, Math.floor((data.cols as number) || 3));
      const rows = Math.max(1, Math.floor((data.rows as number) || 3));
      const spacingX = (data.spacingX as number) || 30;
      const spacingY = (data.spacingY as number) || 30;
      const startX = (data.startX as number) || 0;
      const startY = (data.startY as number) || 0;

      // Get the original centroid to offset properly
      const centroid = getPathsCentroid(inputPaths);

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const tx = startX + col * spacingX - centroid[0];
          const ty = startY + row * spacingY - centroid[1];
          const transformed = transformPaths(inputPaths, tx, ty, 0, 1, 0, 0);
          resultPaths.push(...transformed);
        }
      }
      break;
    }

    case 'radial': {
      const count = Math.max(1, Math.floor((data.count as number) || 8));
      const cx = (data.cx as number) || 75;
      const cy = (data.cy as number) || 60;
      const radius = (data.radius as number) || 40;
      const startAngle = (data.startAngle as number) || 0;

      const centroid = getPathsCentroid(inputPaths);

      for (let i = 0; i < count; i++) {
        const angle = startAngle + (i / count) * 360;
        const rad = (angle * Math.PI) / 180;
        const tx = cx + Math.cos(rad) * radius - centroid[0];
        const ty = cy + Math.sin(rad) * radius - centroid[1];
        const transformed = transformPaths(inputPaths, tx, ty, angle, 1, 0, 0);
        resultPaths.push(...transformed);
      }
      break;
    }
  }

  return resultPaths;
}

// Main execution function - traverses the graph from output node backwards
export function executeFlowGraph(nodes: Node[], edges: Edge[]): Path[] {
  // Find output node
  const outputNode = nodes.find((n) => n.type === 'output');
  if (!outputNode) return [];

  // Build execution cache to avoid re-executing nodes
  const cache = new Map<string, Path[]>();

  // Recursive function to get paths from a node
  function getNodePaths(nodeId: string): Path[] {
    if (cache.has(nodeId)) {
      return cache.get(nodeId)!;
    }

    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return [];

    let paths: Path[] = [];

    // Get paths from source nodes first
    const sourceNodes = getSourceNodes(nodeId, nodes, edges);

    if (node.type === 'shape') {
      // Shape nodes generate their own paths
      paths = generateShapePaths(node);
    } else if (node.type === 'attractor') {
      // Attractor nodes generate strange attractor paths
      paths = generateAttractor(node);
    } else if (node.type === 'text') {
      // Text nodes render text as stroke paths
      const data = node.data as Record<string, unknown>;
      const text = (data.text as string) || '';
      const x = (data.x as number) || 0;
      const y = (data.y as number) || 0;
      const size = (data.size as number) || 10;
      const spacing = (data.spacing as number) || 1.2;
      paths = renderText(text, { x, y, size, spacing });
    } else if (node.type === 'batak') {
      // Batak text nodes render Batak script from Latin transliteration
      const data = node.data as Record<string, unknown>;
      const text = (data.text as string) || '';
      const x = (data.x as number) || 10;
      const y = (data.y as number) || 50;
      const size = (data.size as number) || 30;
      paths = renderBatakText(text, { x, y, size });
    } else if (node.type === 'iteration') {
      // Iteration nodes transform input paths
      const inputPaths: Path[] = [];
      for (const source of sourceNodes) {
        inputPaths.push(...getNodePaths(source.id));
      }
      paths = applyIteration(node, inputPaths);
    } else if (node.type === 'transform') {
      // Transform nodes apply transformations to input paths
      const inputPaths: Path[] = [];
      for (const source of sourceNodes) {
        inputPaths.push(...getNodePaths(source.id));
      }
      paths = applyTransform(node, inputPaths);
    } else if (node.type === 'algorithmic') {
      // Algorithmic nodes apply bytebeat formula-driven transformations
      const inputPaths: Path[] = [];
      for (const source of sourceNodes) {
        inputPaths.push(...getNodePaths(source.id));
      }
      paths = applyAlgorithmic(node, inputPaths);
    } else if (node.type === 'lsystem') {
      // L-System nodes apply fractal pattern transformations
      const inputPaths: Path[] = [];
      for (const source of sourceNodes) {
        inputPaths.push(...getNodePaths(source.id));
      }
      paths = applyLSystem(node, inputPaths);
    } else if (node.type === 'group') {
      // Group node - collect paths from child nodes that are terminal (output not connected to siblings)
      const childNodes = nodes.filter((n) => n.parentId === nodeId);

      if (childNodes.length > 0) {
        // Find terminal nodes: children whose source handles aren't connected to other children
        const childIds = new Set(childNodes.map((n) => n.id));
        const terminalChildren = childNodes.filter((child) => {
          // A child is terminal if no edge goes FROM this child TO another child in the group
          const outgoingToSibling = edges.some(
            (e) => e.source === child.id && childIds.has(e.target)
          );
          return !outgoingToSibling;
        });

        // Collect paths from terminal children
        for (const terminal of terminalChildren) {
          paths.push(...getNodePaths(terminal.id));
        }
      }

      // Also collect paths from any external sources connected to the group
      for (const source of sourceNodes) {
        paths.push(...getNodePaths(source.id));
      }
    } else if (node.type === 'output') {
      // Output node just collects paths from sources
      for (const source of sourceNodes) {
        paths.push(...getNodePaths(source.id));
      }
    }

    cache.set(nodeId, paths);
    return paths;
  }

  return getNodePaths(outputNode.id);
}

export interface ExecutionResult {
  success: boolean;
  paths: Path[];
  error?: string;
  executionTime: number;
}

export function executeFlow(nodes: Node[], edges: Edge[]): ExecutionResult {
  const startTime = performance.now();

  try {
    const paths = executeFlowGraph(nodes, edges);
    return {
      success: true,
      paths,
      executionTime: performance.now() - startTime,
    };
  } catch (err) {
    return {
      success: false,
      paths: [],
      error: err instanceof Error ? err.message : String(err),
      executionTime: performance.now() - startTime,
    };
  }
}
