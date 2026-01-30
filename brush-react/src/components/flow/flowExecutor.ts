/**
 * Flow Executor - Converts node graph to drawing paths
 * Uses Zod schemas for safe data extraction
 * Implements persistent caching for performance optimization
 */

import type { Node, Edge } from '@xyflow/react';
import type { Path, Point, ColoredPath } from '../../utils/drawingApi';

// ============ Persistent Cache System ============

interface CacheEntry {
  paths: ColoredPath[];
  dataHash: string;
  upstreamHash: string; // Combined hash of all upstream node hashes
}

/**
 * Persistent cache for node execution results.
 * Survives across multiple executeFlow calls.
 */
export class FlowExecutionCache {
  private cache = new Map<string, CacheEntry>();
  private nodeHashes = new Map<string, string>(); // nodeId -> combined hash
  private hitCount = 0;
  private missCount = 0;

  /**
   * Fast string hash using djb2 algorithm
   */
  private hashString(str: string): string {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
    }
    return (hash >>> 0).toString(36);
  }

  /**
   * Extract only data-relevant fields from node (exclude position, selection, etc.)
   */
  private getRelevantNodeData(node: Node): Record<string, unknown> {
    const data = node.data as Record<string, unknown>;
    // Filter out UI-only fields
    const { selected, dragging, ...relevantData } = data;
    return {
      type: node.type,
      ...relevantData,
    };
  }

  /**
   * Generate a hash for a node's data (excluding position/UI state)
   */
  private hashNodeData(node: Node): string {
    const relevantData = this.getRelevantNodeData(node);
    return this.hashString(JSON.stringify(relevantData));
  }

  /**
   * Compute the combined hash for a node (its data + all upstream hashes)
   */
  computeNodeHash(
    nodeId: string,
    nodes: Node[],
    edges: Edge[],
    computed: Map<string, string> = new Map()
  ): string {
    // Return if already computed in this pass
    if (computed.has(nodeId)) {
      return computed.get(nodeId)!;
    }

    const node = nodes.find((n) => n.id === nodeId);
    if (!node) {
      computed.set(nodeId, '');
      return '';
    }

    // Get upstream nodes
    const incomingEdges = edges.filter((e) => e.target === nodeId);
    const upstreamIds = incomingEdges.map((e) => e.source);

    // Compute upstream hashes first (recursive)
    const upstreamHashes: string[] = [];
    for (const upId of upstreamIds) {
      upstreamHashes.push(this.computeNodeHash(upId, nodes, edges, computed));
    }

    // For group nodes, include child hashes
    if (node.type === 'group') {
      const childNodes = nodes.filter((n) => n.parentId === nodeId);
      for (const child of childNodes) {
        upstreamHashes.push(this.computeNodeHash(child.id, nodes, edges, computed));
      }
    }

    // Combine: node data hash + sorted upstream hashes
    const dataHash = this.hashNodeData(node);
    const upstreamHash = this.hashString(upstreamHashes.sort().join('|'));
    const combinedHash = this.hashString(`${dataHash}:${upstreamHash}`);

    computed.set(nodeId, combinedHash);
    this.nodeHashes.set(nodeId, combinedHash);

    return combinedHash;
  }

  /**
   * Get cached paths for a node if valid
   * Returns cached paths only if the current hash matches the stored hash
   */
  get(nodeId: string, currentHash: string): ColoredPath[] | null {
    const entry = this.cache.get(nodeId);
    if (entry && entry.dataHash === currentHash) {
      this.hitCount++;
      return entry.paths;
    }
    this.missCount++;
    return null;
  }

  /**
   * Store paths for a node
   */
  set(nodeId: string, paths: ColoredPath[], dataHash: string, upstreamHash: string): void {
    this.cache.set(nodeId, { paths, dataHash, upstreamHash });
  }

  /**
   * Clear cache for specific nodes (when they're deleted)
   */
  invalidateNodes(nodeIds: string[]): void {
    for (const id of nodeIds) {
      this.cache.delete(id);
      this.nodeHashes.delete(id);
    }
  }

  /**
   * Clear entire cache
   */
  clear(): void {
    this.cache.clear();
    this.nodeHashes.clear();
    this.hitCount = 0;
    this.missCount = 0;
  }

  /**
   * Get cache statistics
   */
  getStats(): { hits: number; misses: number; hitRate: number; size: number } {
    const total = this.hitCount + this.missCount;
    return {
      hits: this.hitCount,
      misses: this.missCount,
      hitRate: total > 0 ? this.hitCount / total : 0,
      size: this.cache.size,
    };
  }

  /**
   * Reset statistics (keep cache)
   */
  resetStats(): void {
    this.hitCount = 0;
    this.missCount = 0;
  }
}

// Global cache instance (can be replaced with dependency injection if needed)
let globalCache: FlowExecutionCache | null = null;

export function getGlobalCache(): FlowExecutionCache {
  if (!globalCache) {
    globalCache = new FlowExecutionCache();
  }
  return globalCache;
}

export function createCache(): FlowExecutionCache {
  return new FlowExecutionCache();
}
import { renderText } from './strokeFont';
import { transliterateToba } from '../../utils/transliteration';
import { glyphs } from '../../data/glyphs';
import {
  nodeSchemaMap,
  type NodeType,
  type LineNodeData,
  type RectNodeData,
  type CircleNodeData,
  type EllipseNodeData,
  type ArcNodeData,
  type PolygonNodeData,
  type RepeatNodeData,
  type GridNodeData,
  type RadialNodeData,
  type TranslateNodeData,
  type RotateNodeData,
  type ScaleNodeData,
  type AlgorithmicNodeData,
  type AttractorNodeData,
  type LSystemNodeData,
  type PathNodeData,
  type CodeNodeData,
  type TextNodeData,
  type BatakTextNodeData,
  // type SlicerNodeData, // Slicer disabled for now
} from '../../schemas/flowNodeSchemas';
// Slicer disabled for now - may re-enable later
// import { slicePathsSync, type SlicerSettings } from '../../utils/slicerService';

/**
 * Safely parse node data using Zod schema
 * Returns validated data or null if invalid
 */
function parseNodeData<T extends NodeType>(
  nodeType: T,
  data: unknown
): ReturnType<typeof nodeSchemaMap[T]['safeParse']>['data'] | null {
  const schema = nodeSchemaMap[nodeType];
  if (!schema) return null;

  const result = schema.safeParse(data);
  return result.success ? result.data : null;
}

// Get all source nodes that connect to a target node
function getSourceNodes(targetId: string, nodes: Node[], edges: Edge[]): Node[] {
  const incomingEdges = edges.filter((e) => e.target === targetId);
  return incomingEdges
    .map((e) => nodes.find((n) => n.id === e.source))
    .filter((n): n is Node => n !== undefined);
}

// Generate paths from a shape node using Zod-validated data
function generateShapePaths(node: Node): ColoredPath[] {
  const data = node.data as Record<string, unknown>;
  const label = ((data.label as string) || '').toLowerCase();
  const nodeColor = data.color as (1 | 2 | 3 | 4 | undefined);
  const paths: Path[] = [];

  switch (label) {
    case 'line': {
      const validated = parseNodeData('line', data) as LineNodeData | null;
      const { x1, y1, x2, y2 } = validated ?? { x1: 0, y1: 0, x2: 0, y2: 0 };
      paths.push([[x1, y1], [x2, y2]]);
      break;
    }

    case 'rectangle': {
      const validated = parseNodeData('rect', data) as RectNodeData | null;
      const { x, y, width: w, height: h } = validated ?? { x: 0, y: 0, width: 20, height: 20 };
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
      const validated = parseNodeData('circle', data) as CircleNodeData | null;
      const { cx, cy, radius: r, segments } = validated ?? { cx: 50, cy: 50, radius: 20, segments: 36 };
      const points: Point[] = [];
      for (let i = 0; i <= segments; i++) {
        const angle = (i / segments) * Math.PI * 2;
        points.push([cx + Math.cos(angle) * r, cy + Math.sin(angle) * r]);
      }
      paths.push(points);
      break;
    }

    case 'ellipse': {
      const validated = parseNodeData('ellipse', data) as EllipseNodeData | null;
      const { cx, cy, rx, ry, segments } = validated ?? { cx: 50, cy: 50, rx: 30, ry: 20, segments: 36 };
      const points: Point[] = [];
      for (let i = 0; i <= segments; i++) {
        const angle = (i / segments) * Math.PI * 2;
        points.push([cx + Math.cos(angle) * rx, cy + Math.sin(angle) * ry]);
      }
      paths.push(points);
      break;
    }

    case 'arc': {
      const validated = parseNodeData('arc', data) as ArcNodeData | null;
      const { cx, cy, radius: r, startAngle, endAngle, segments } = validated ?? {
        cx: 50, cy: 50, radius: 20, startAngle: 0, endAngle: 90, segments: 24
      };
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
      const validated = parseNodeData('polygon', data) as PolygonNodeData | null;
      const { sides, cx, cy, radius: r } = validated ?? { sides: 6, cx: 50, cy: 50, radius: 20 };
      const points: Point[] = [];
      for (let i = 0; i <= sides; i++) {
        const angle = (i / sides) * Math.PI * 2 - Math.PI / 2; // Start from top
        points.push([cx + Math.cos(angle) * r, cy + Math.sin(angle) * r]);
      }
      paths.push(points);
      break;
    }
  }

  // Convert to ColoredPath with node's color
  return paths.map(points => ({ points, color: nodeColor }));
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

// Transform paths (preserves color)
function transformPaths(
  paths: ColoredPath[],
  tx: number,
  ty: number,
  rotation = 0,
  scale = 1,
  cx = 0,
  cy = 0
): ColoredPath[] {
  return paths.map((coloredPath) => ({
    points: coloredPath.points.map((point) => transformPoint(point, tx, ty, rotation, scale, cx, cy)),
    color: coloredPath.color,
  }));
}

// Helper: Convert ColoredPath[] to Path[] (extracts points only)
function toPlainPaths(coloredPaths: ColoredPath[]): Path[] {
  return coloredPaths.map(cp => cp.points);
}

// Helper: Convert Path[] to ColoredPath[] with optional color
function toColoredPaths(paths: Path[], color?: 1 | 2 | 3 | 4): ColoredPath[] {
  return paths.map(points => ({ points, color }));
}

// Transform plain paths (for code API)
function transformPlainPaths(
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

// Calculate centroid of plain paths (for code API)
function getPlainPathsCentroid(paths: Path[]): Point {
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

// Calculate centroid of colored paths
function getPathsCentroid(paths: ColoredPath[]): Point {
  let sumX = 0;
  let sumY = 0;
  let count = 0;

  for (const coloredPath of paths) {
    for (const point of coloredPath.points) {
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
      // Flip Y to compensate for preview's Y-flip (same as strokeFont)
      for (const glyphPath of glyph.paths) {
        const scaledPath: Point[] = glyphPath.map(([px, py]) => [
          renderX + px * scale,
          startY - py * scale,
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

// Apply L-System transformation to input paths using Zod-validated data (preserves colors)
function applyLSystem(node: Node, inputPaths: ColoredPath[]): ColoredPath[] {
  const data = node.data as Record<string, unknown>;
  const validated = parseNodeData('lsystem', data) as LSystemNodeData | null;
  const {
    axiom, rules: rulesStr, iterations, angle, stepSize,
    startX, startY, startAngle, scalePerIter
  } = validated ?? {
    axiom: 'F', rules: 'F=F+F-F-F+F', iterations: 3, angle: 90, stepSize: 10,
    startX: 75, startY: 100, startAngle: -90, scalePerIter: 1
  };

  if (inputPaths.length === 0) return [];

  const rules = parseLSystemRules(rulesStr);
  const expanded = expandLSystem(axiom, rules, iterations);

  const resultPaths: ColoredPath[] = [];
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

// Path layout types
type PathType = 'circle' | 'arc' | 'line' | 'wave' | 'spiral';

// Get point and tangent angle on a parametric path at parameter t (0 to 1)
function getPointOnPath(
  pathType: PathType,
  t: number,
  params: {
    cx?: number;
    cy?: number;
    radius?: number;
    startAngle?: number;
    endAngle?: number;
    x1?: number;
    y1?: number;
    x2?: number;
    y2?: number;
    amplitude?: number;
    frequency?: number;
    turns?: number;
    growth?: number;
  }
): { x: number; y: number; angle: number } {
  const cx = params.cx ?? 75;
  const cy = params.cy ?? 60;
  const radius = params.radius ?? 40;

  switch (pathType) {
    case 'circle': {
      // Full circle, starting from top going clockwise
      const angle = -Math.PI / 2 + t * Math.PI * 2;
      return {
        x: cx + Math.cos(angle) * radius,
        y: cy + Math.sin(angle) * radius,
        angle: (angle + Math.PI / 2) * (180 / Math.PI), // tangent angle in degrees
      };
    }

    case 'arc': {
      const start = ((params.startAngle ?? 0) * Math.PI) / 180;
      const end = ((params.endAngle ?? 180) * Math.PI) / 180;
      const angle = start + t * (end - start);
      return {
        x: cx + Math.cos(angle) * radius,
        y: cy + Math.sin(angle) * radius,
        angle: (angle + Math.PI / 2) * (180 / Math.PI),
      };
    }

    case 'line': {
      const x1 = params.x1 ?? 10;
      const y1 = params.y1 ?? 60;
      const x2 = params.x2 ?? 140;
      const y2 = params.y2 ?? 60;
      const dx = x2 - x1;
      const dy = y2 - y1;
      const angle = Math.atan2(dy, dx) * (180 / Math.PI);
      return {
        x: x1 + t * dx,
        y: y1 + t * dy,
        angle: angle,
      };
    }

    case 'wave': {
      const amp = params.amplitude ?? 20;
      const freq = params.frequency ?? 2;
      const width = radius * 3; // Use radius as width reference
      const x = cx - width / 2 + t * width;
      const waveAngle = t * Math.PI * 2 * freq;
      const y = cy + Math.sin(waveAngle) * amp;
      // Derivative for tangent: dy/dx = (amp * freq * 2 * PI / width) * cos(waveAngle)
      const derivative = (amp * freq * 2 * Math.PI / width) * Math.cos(waveAngle);
      const angle = Math.atan(derivative) * (180 / Math.PI);
      return { x, y, angle };
    }

    case 'spiral': {
      const turns = params.turns ?? 3;
      const growth = params.growth ?? 5;
      const angle = t * Math.PI * 2 * turns;
      const r = growth + t * radius;
      return {
        x: cx + Math.cos(angle) * r,
        y: cy + Math.sin(angle) * r,
        angle: (angle + Math.PI / 2) * (180 / Math.PI),
      };
    }

    default:
      return { x: cx, y: cy, angle: 0 };
  }
}

// Calculate total path length for proper character distribution
function getPathLength(
  pathType: PathType,
  params: Record<string, number | undefined>
): number {
  // Sample the path and sum distances
  const samples = 100;
  let length = 0;
  let prevPoint = getPointOnPath(pathType, 0, params);

  for (let i = 1; i <= samples; i++) {
    const t = i / samples;
    const point = getPointOnPath(pathType, t, params);
    const dx = point.x - prevPoint.x;
    const dy = point.y - prevPoint.y;
    length += Math.sqrt(dx * dx + dy * dy);
    prevPoint = point;
  }

  return length;
}

// Apply path layout to input paths (text along path) using Zod-validated data (preserves colors)
function applyPathLayout(node: Node, inputPaths: ColoredPath[]): ColoredPath[] {
  if (inputPaths.length === 0) return [];

  const data = node.data as Record<string, unknown>;
  const validated = parseNodeData('path', data) as PathNodeData | null;
  const {
    pathType, align, spacing, reverse,
    cx, cy, radius, startAngle, endAngle,
    x1, y1, x2, y2,
    amplitude, frequency, turns, growth
  } = validated ?? {
    pathType: 'circle' as const, align: 'start' as const, spacing: 1, reverse: false,
    cx: 75, cy: 60, radius: 40, startAngle: 0, endAngle: 180,
    x1: 10, y1: 60, x2: 140, y2: 60,
    amplitude: 20, frequency: 2, turns: 3, growth: 5
  };

  const params = {
    cx, cy, radius, startAngle, endAngle,
    x1, y1, x2, y2,
    amplitude, frequency, turns, growth,
  };

  // Calculate input paths bounding box to determine character width
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;

  for (const coloredPath of inputPaths) {
    for (const [px, py] of coloredPath.points) {
      minX = Math.min(minX, px);
      maxX = Math.max(maxX, px);
      minY = Math.min(minY, py);
      maxY = Math.max(maxY, py);
    }
  }

  const textWidth = (maxX - minX) * spacing;
  const textCenterY = (minY + maxY) / 2;

  // Get path length and calculate where text starts
  const pathLength = getPathLength(pathType, params);

  let startT = 0;
  if (align === 'center') {
    startT = 0.5 - (textWidth / pathLength) / 2;
  } else if (align === 'end') {
    startT = 1 - (textWidth / pathLength);
  }

  // Transform each point in input paths (preserving colors)
  const resultPaths: ColoredPath[] = [];

  for (const coloredPath of inputPaths) {
    const transformedPath: Point[] = [];

    for (const [px, py] of coloredPath.points) {
      // Calculate position along text (0 to 1 within text width)
      const textT = textWidth > 0 ? (px - minX) / textWidth : 0;

      // Calculate position along path
      let pathT = startT + textT * (textWidth / pathLength);

      if (reverse) {
        pathT = 1 - pathT;
      }

      // Clamp to valid range
      pathT = Math.max(0, Math.min(1, pathT));

      // Get point and angle on path
      const { x: pathX, y: pathY, angle } = getPointOnPath(pathType, pathT, params);

      // Offset from text baseline (perpendicular to path)
      // Use + PI/2 instead of - PI/2 to compensate for preview Y-flip
      const offsetY = py - textCenterY;
      const angleRad = ((reverse ? angle + 180 : angle) * Math.PI) / 180;
      const perpAngle = angleRad + Math.PI / 2;

      // Transform point
      const newX = pathX + Math.cos(perpAngle) * offsetY;
      const newY = pathY + Math.sin(perpAngle) * offsetY;

      transformedPath.push([newX, newY]);
    }

    if (transformedPath.length > 1) {
      resultPaths.push({ points: transformedPath, color: coloredPath.color });
    }
  }

  return resultPaths;
}

// Generate attractor paths using Zod-validated data
function generateAttractor(node: Node): Path[] {
  const data = node.data as Record<string, unknown>;
  const validated = parseNodeData('attractor', data) as AttractorNodeData | null;
  const { type, iterations, a, b, c, d, scale, centerX, centerY } = validated ?? {
    type: 'clifford' as const, iterations: 5000, a: -1.4, b: 1.6, c: 1.0, d: 0.7,
    scale: 20, centerX: 75, centerY: 60
  };

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

// Apply algorithmic (bytebeat) node transformations using Zod-validated data (preserves colors)
function applyAlgorithmic(node: Node, inputPaths: ColoredPath[]): ColoredPath[] {
  const data = node.data as Record<string, unknown>;
  const validated = parseNodeData('algorithmic', data) as AlgorithmicNodeData | null;
  const { formula, count, mode, xScale, yScale, rotScale, sclScale, baseX, baseY } = validated ?? {
    formula: 't*(t>>5|t>>8)', count: 16, mode: 'position' as const,
    xScale: 0.5, yScale: 0.5, rotScale: 1, sclScale: 0.01, baseX: 75, baseY: 60
  };

  if (inputPaths.length === 0) return [];

  const resultPaths: ColoredPath[] = [];
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

// Seeded random number generator (simple LCG)
function createSeededRandom(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return state / 0x7fffffff;
  };
}

// Simple 2D/3D noise implementation
function createNoise() {
  const permutation: number[] = [];
  for (let i = 0; i < 256; i++) permutation[i] = i;
  // Shuffle
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [permutation[i], permutation[j]] = [permutation[j], permutation[i]];
  }
  const p = [...permutation, ...permutation];

  const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
  const lerp = (a: number, b: number, t: number) => a + t * (b - a);
  const grad = (hash: number, x: number, y: number, z: number) => {
    const h = hash & 15;
    const u = h < 8 ? x : y;
    const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
  };

  return (x: number, y = 0, z = 0) => {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const Z = Math.floor(z) & 255;
    x -= Math.floor(x);
    y -= Math.floor(y);
    z -= Math.floor(z);
    const u = fade(x);
    const v = fade(y);
    const w = fade(z);
    const A = p[X] + Y;
    const AA = p[A] + Z;
    const AB = p[A + 1] + Z;
    const B = p[X + 1] + Y;
    const BA = p[B] + Z;
    const BB = p[B + 1] + Z;
    return (
      lerp(
        lerp(
          lerp(grad(p[AA], x, y, z), grad(p[BA], x - 1, y, z), u),
          lerp(grad(p[AB], x, y - 1, z), grad(p[BB], x - 1, y - 1, z), u),
          v
        ),
        lerp(
          lerp(grad(p[AA + 1], x, y, z - 1), grad(p[BA + 1], x - 1, y, z - 1), u),
          lerp(grad(p[AB + 1], x, y - 1, z - 1), grad(p[BB + 1], x - 1, y - 1, z - 1), u),
          v
        ),
        w
      ) *
        0.5 +
      0.5
    );
  };
}

// Create the Drawing API for code nodes
function createCodeApi() {
  const noise = createNoise();
  let random = createSeededRandom(12345);

  return {
    // Shape generators
    line: (x1: number, y1: number, x2: number, y2: number): Path => {
      return [[x1, y1], [x2, y2]];
    },

    rect: (x: number, y: number, w: number, h: number): Path => {
      return [[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y]];
    },

    circle: (cx: number, cy: number, r: number, segments = 36): Path => {
      const points: Point[] = [];
      for (let i = 0; i <= segments; i++) {
        const angle = (i / segments) * Math.PI * 2;
        points.push([cx + Math.cos(angle) * r, cy + Math.sin(angle) * r]);
      }
      return points;
    },

    ellipse: (cx: number, cy: number, rx: number, ry: number, segments = 36): Path => {
      const points: Point[] = [];
      for (let i = 0; i <= segments; i++) {
        const angle = (i / segments) * Math.PI * 2;
        points.push([cx + Math.cos(angle) * rx, cy + Math.sin(angle) * ry]);
      }
      return points;
    },

    arc: (cx: number, cy: number, r: number, startAngle: number, endAngle: number, segments = 24): Path => {
      const points: Point[] = [];
      const startRad = (startAngle * Math.PI) / 180;
      const endRad = (endAngle * Math.PI) / 180;
      const range = endRad - startRad;
      for (let i = 0; i <= segments; i++) {
        const angle = startRad + (i / segments) * range;
        points.push([cx + Math.cos(angle) * r, cy + Math.sin(angle) * r]);
      }
      return points;
    },

    polygon: (sides: number, cx: number, cy: number, r: number): Path => {
      const points: Point[] = [];
      for (let i = 0; i <= sides; i++) {
        const angle = (i / sides) * Math.PI * 2 - Math.PI / 2;
        points.push([cx + Math.cos(angle) * r, cy + Math.sin(angle) * r]);
      }
      return points;
    },

    polyline: (pts: number[][]): Path => {
      return pts.map((p) => [p[0], p[1]] as Point);
    },

    // Transform helpers
    transform: (
      paths: Path[],
      tx: number,
      ty: number,
      rotation = 0,
      scale = 1,
      cx = 0,
      cy = 0
    ): Path[] => {
      return transformPlainPaths(paths, tx, ty, rotation, scale, cx, cy);
    },

    translate: (paths: Path[], dx: number, dy: number): Path[] => {
      return transformPlainPaths(paths, dx, dy, 0, 1, 0, 0);
    },

    rotate: (paths: Path[], angle: number, cx = 0, cy = 0): Path[] => {
      return transformPlainPaths(paths, 0, 0, angle, 1, cx, cy);
    },

    scale: (paths: Path[], sx: number, sy?: number, cx = 0, cy = 0): Path[] => {
      const scaleY = sy ?? sx;
      return paths.map((path) =>
        path.map((point) => {
          const x = (point[0] - cx) * sx + cx;
          const y = (point[1] - cy) * scaleY + cy;
          return [x, y] as Point;
        })
      );
    },

    centroid: (paths: Path[]): Point => {
      return getPlainPathsCentroid(paths);
    },

    bounds: (paths: Path[]): { minX: number; minY: number; maxX: number; maxY: number } => {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const path of paths) {
        for (const [x, y] of path) {
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }
      return { minX, minY, maxX, maxY };
    },

    // Noise and random
    noise: (x: number, y?: number, z?: number): number => noise(x, y, z),

    random: (min?: number, max?: number): number => {
      const r = random();
      if (min === undefined) return r;
      if (max === undefined) return r * min;
      return min + r * (max - min);
    },

    randomSeed: (seed: number): void => {
      random = createSeededRandom(seed);
    },

    // Math helpers
    map: (value: number, inMin: number, inMax: number, outMin: number, outMax: number): number => {
      return ((value - inMin) / (inMax - inMin)) * (outMax - outMin) + outMin;
    },

    lerp: (a: number, b: number, t: number): number => a + (b - a) * t,

    constrain: (value: number, min: number, max: number): number => {
      return Math.max(min, Math.min(max, value));
    },

    dist: (x1: number, y1: number, x2: number, y2: number): number => {
      const dx = x2 - x1;
      const dy = y2 - y1;
      return Math.sqrt(dx * dx + dy * dy);
    },

    // Trig helpers (degrees)
    sin: (degrees: number): number => Math.sin((degrees * Math.PI) / 180),
    cos: (degrees: number): number => Math.cos((degrees * Math.PI) / 180),
    tan: (degrees: number): number => Math.tan((degrees * Math.PI) / 180),
    atan2: (y: number, x: number): number => (Math.atan2(y, x) * 180) / Math.PI,
    radians: (degrees: number): number => (degrees * Math.PI) / 180,
    degrees: (radians: number): number => (radians * 180) / Math.PI,

    // Constants
    PI: Math.PI,
    TWO_PI: Math.PI * 2,
    HALF_PI: Math.PI / 2,
  };
}

// Execute code node with sandboxed environment using Zod-validated data
function executeCodeNode(node: Node, inputPaths: Path[]): { paths: Path[]; error?: string } {
  const data = node.data as Record<string, unknown>;
  const validated = parseNodeData('code', data) as CodeNodeData | null;
  const { code } = validated ?? { code: 'return input;' };

  try {
    // Create the API
    const api = createCodeApi();

    // Create a sandboxed function
    // The function receives 'input' (array of paths) and 'api' (helper functions)
    const fn = new Function(
      'input',
      'api',
      'Math',
      `"use strict";
      ${code}
      `
    );

    // Execute with limited Math (no dangerous functions)
    const safeMath = {
      abs: Math.abs,
      ceil: Math.ceil,
      floor: Math.floor,
      round: Math.round,
      min: Math.min,
      max: Math.max,
      pow: Math.pow,
      sqrt: Math.sqrt,
      sin: Math.sin,
      cos: Math.cos,
      tan: Math.tan,
      atan: Math.atan,
      atan2: Math.atan2,
      asin: Math.asin,
      acos: Math.acos,
      log: Math.log,
      exp: Math.exp,
      PI: Math.PI,
      E: Math.E,
      random: () => api.random(), // Use seeded random
    };

    const result = fn(inputPaths, api, safeMath);

    // Validate output
    if (!Array.isArray(result)) {
      return { paths: [], error: 'Code must return an array of paths' };
    }

    // Validate each path
    const validPaths: Path[] = [];
    for (const path of result) {
      if (Array.isArray(path)) {
        const validPath: Point[] = [];
        for (const point of path) {
          if (Array.isArray(point) && point.length >= 2 && typeof point[0] === 'number' && typeof point[1] === 'number') {
            validPath.push([point[0], point[1]]);
          }
        }
        if (validPath.length > 1) {
          validPaths.push(validPath);
        }
      }
    }

    return { paths: validPaths };
  } catch (err) {
    return {
      paths: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// Apply transform node transformations (single transform) using Zod-validated data (preserves colors)
function applyTransform(node: Node, inputPaths: ColoredPath[]): ColoredPath[] {
  const data = node.data as Record<string, unknown>;
  const label = ((data.label as string) || '').toLowerCase();

  if (inputPaths.length === 0) return [];

  switch (label) {
    case 'translate': {
      const validated = parseNodeData('translate', data) as TranslateNodeData | null;
      const { dx, dy } = validated ?? { dx: 0, dy: 0 };
      return transformPaths(inputPaths, dx, dy, 0, 1, 0, 0);
    }

    case 'rotate': {
      const validated = parseNodeData('rotate', data) as RotateNodeData | null;
      const { angle, cx, cy } = validated ?? { angle: 0, cx: 0, cy: 0 };
      return transformPaths(inputPaths, 0, 0, angle, 1, cx, cy);
    }

    case 'scale': {
      const validated = parseNodeData('scale', data) as ScaleNodeData | null;
      const { sx, sy, cx, cy } = validated ?? { sx: 1, sy: 1, cx: 0, cy: 0 };
      // For non-uniform scaling, we need to handle it differently (preserves colors)
      return inputPaths.map((coloredPath) => ({
        points: coloredPath.points.map((point) => {
          const x = (point[0] - cx) * sx + cx;
          const y = (point[1] - cy) * sy + cy;
          return [x, y] as Point;
        }),
        color: coloredPath.color,
      }));
    }

    default:
      return inputPaths;
  }
}

// Apply iteration node transformations using Zod-validated data (preserves colors)
function applyIteration(node: Node, inputPaths: ColoredPath[]): ColoredPath[] {
  const data = node.data as Record<string, unknown>;
  const label = ((data.label as string) || '').toLowerCase();
  const resultPaths: ColoredPath[] = [];

  if (inputPaths.length === 0) return [];

  switch (label) {
    case 'repeat': {
      const validated = parseNodeData('repeat', data) as RepeatNodeData | null;
      const { count, offsetX, offsetY, rotation, scale } = validated ?? {
        count: 5, offsetX: 0, offsetY: 0, rotation: 0, scale: 1
      };
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
      const validated = parseNodeData('grid', data) as GridNodeData | null;
      const { cols, rows, spacingX, spacingY, startX, startY } = validated ?? {
        cols: 3, rows: 3, spacingX: 30, spacingY: 30, startX: 0, startY: 0
      };

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
      const validated = parseNodeData('radial', data) as RadialNodeData | null;
      const { count, cx, cy, radius, startAngle } = validated ?? {
        count: 8, cx: 75, cy: 60, radius: 40, startAngle: 0
      };

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
export function executeFlowGraph(
  nodes: Node[],
  edges: Edge[],
  persistentCache?: FlowExecutionCache
): ColoredPath[] {
  // Find output node
  const outputNode = nodes.find((n) => n.type === 'output');
  if (!outputNode) return [];

  // Use persistent cache if provided, otherwise create session cache
  const cache = persistentCache ?? new FlowExecutionCache();

  // Pre-compute all node hashes for this execution pass
  const nodeHashes = new Map<string, string>();
  for (const node of nodes) {
    cache.computeNodeHash(node.id, nodes, edges, nodeHashes);
  }

  // Session cache for this execution (prevents duplicate work within single run)
  const sessionCache = new Map<string, ColoredPath[]>();

  // Recursive function to get paths from a node
  function getNodePaths(nodeId: string): ColoredPath[] {
    // Check session cache first (within-execution deduplication)
    if (sessionCache.has(nodeId)) {
      return sessionCache.get(nodeId)!;
    }

    // Check persistent cache (cross-execution)
    const currentHash = nodeHashes.get(nodeId) ?? '';
    const cachedPaths = cache.get(nodeId, currentHash);
    if (cachedPaths) {
      sessionCache.set(nodeId, cachedPaths);
      return cachedPaths;
    }

    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return [];

    let paths: ColoredPath[] = [];
    const nodeData = node.data as Record<string, unknown>;
    const nodeColor = nodeData.color as (1 | 2 | 3 | 4 | undefined);

    // Get paths from source nodes first
    const sourceNodes = getSourceNodes(nodeId, nodes, edges);

    if (node.type === 'shape') {
      // Shape nodes generate their own paths (color already included)
      paths = generateShapePaths(node);
    } else if (node.type === 'attractor') {
      // Attractor nodes generate strange attractor paths
      const plainPaths = generateAttractor(node);
      paths = toColoredPaths(plainPaths, nodeColor);
    } else if (node.type === 'text') {
      // Text nodes render text as stroke paths using Zod-validated data
      const validated = parseNodeData('text', nodeData) as TextNodeData | null;
      const { text, x, y, size, spacing } = validated ?? {
        text: '', x: 0, y: 0, size: 10, spacing: 1.2
      };
      const plainPaths = renderText(text, { x, y, size, spacing });
      paths = toColoredPaths(plainPaths, nodeColor);
    } else if (node.type === 'batak') {
      // Batak text nodes render Batak script using Zod-validated data
      const validated = parseNodeData('batak', nodeData) as BatakTextNodeData | null;
      const { text, x, y, size } = validated ?? {
        text: '', x: 10, y: 50, size: 30
      };
      const plainPaths = renderBatakText(text, { x, y, size });
      paths = toColoredPaths(plainPaths, nodeColor);
    } else if (node.type === 'iteration') {
      // Iteration nodes transform input paths (preserves colors)
      const inputPaths: ColoredPath[] = [];
      for (const source of sourceNodes) {
        inputPaths.push(...getNodePaths(source.id));
      }
      paths = applyIteration(node, inputPaths);
    } else if (node.type === 'transform') {
      // Transform nodes apply transformations to input paths (preserves colors)
      const inputPaths: ColoredPath[] = [];
      for (const source of sourceNodes) {
        inputPaths.push(...getNodePaths(source.id));
      }
      paths = applyTransform(node, inputPaths);
    } else if (node.type === 'algorithmic') {
      // Algorithmic nodes apply bytebeat formula-driven transformations
      const inputPaths: ColoredPath[] = [];
      for (const source of sourceNodes) {
        inputPaths.push(...getNodePaths(source.id));
      }
      paths = applyAlgorithmic(node, inputPaths);
    } else if (node.type === 'lsystem') {
      // L-System nodes apply fractal pattern transformations
      const inputPaths: ColoredPath[] = [];
      for (const source of sourceNodes) {
        inputPaths.push(...getNodePaths(source.id));
      }
      paths = applyLSystem(node, inputPaths);
    } else if (node.type === 'path') {
      // Path nodes layout input along a path (text on path, etc.)
      const inputPaths: ColoredPath[] = [];
      for (const source of sourceNodes) {
        inputPaths.push(...getNodePaths(source.id));
      }
      paths = applyPathLayout(node, inputPaths);
    } else if (node.type === 'code') {
      // Code nodes execute custom JavaScript to transform/generate paths
      const inputPaths: ColoredPath[] = [];
      for (const source of sourceNodes) {
        inputPaths.push(...getNodePaths(source.id));
      }
      const result = executeCodeNode(node, toPlainPaths(inputPaths));
      paths = toColoredPaths(result.paths, nodeColor);
      // Store error in node data for display (via event)
      if (result.error) {
        const event = new CustomEvent('nodeDataChange', {
          detail: { nodeId: node.id, field: 'error', value: result.error },
        });
        window.dispatchEvent(event);
      } else if (nodeData.error) {
        // Clear previous error
        const event = new CustomEvent('nodeDataChange', {
          detail: { nodeId: node.id, field: 'error', value: undefined },
        });
        window.dispatchEvent(event);
      }
    // Slicer disabled for now - may re-enable later
    // } else if (node.type === 'slicer') {
    //   // Slicer nodes generate infill patterns from input paths
    //   const inputPaths: ColoredPath[] = [];
    //   for (const source of sourceNodes) {
    //     inputPaths.push(...getNodePaths(source.id));
    //   }
    //   
    //   // Get slicer settings from node data
    //   const validated = parseNodeData('slicer', nodeData) as SlicerNodeData | null;
    //   const settings: SlicerSettings = {
    //     extrudeHeight: validated?.extrudeHeight ?? 10,
    //     wallThickness: validated?.wallThickness ?? 0.8,
    //     layerHeight: validated?.layerHeight ?? 0.2,
    //     extractLayer: validated?.extractLayer ?? -1,
    //     infillPattern: validated?.infillPattern ?? 'grid',
    //     infillDensity: validated?.infillDensity ?? 20,
    //     infillAngle: validated?.infillAngle ?? 45,
    //     includeWalls: validated?.includeWalls ?? true,
    //     includeInfill: validated?.includeInfill ?? true,
    //     includeTravel: validated?.includeTravel ?? false,
    //   };
    //   
    //   // Execute slicer synchronously (fallback mode - fast pattern generation)
    //   try {
    //     const plainPaths = toPlainPaths(inputPaths);
    //     const sliceResult = slicePathsSync(plainPaths, settings);
    //     paths = toColoredPaths(sliceResult, nodeColor);
    //     
    //     if (nodeData.error) {
    //       const event = new CustomEvent('nodeDataChange', {
    //         detail: { nodeId: node.id, field: 'error', value: undefined },
    //       });
    //       window.dispatchEvent(event);
    //     }
    //   } catch (err) {
    //     const error = err instanceof Error ? err.message : String(err);
    //     const event = new CustomEvent('nodeDataChange', {
    //       detail: { nodeId: node.id, field: 'error', value: error },
    //     });
    //     window.dispatchEvent(event);
    //   }
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

    // Store in both session and persistent cache
    sessionCache.set(nodeId, paths);
    cache.set(nodeId, paths, currentHash, '');

    return paths;
  }

  return getNodePaths(outputNode.id);
}

export interface ExecutionResult {
  success: boolean;
  paths: ColoredPath[];
  error?: string;
  executionTime: number;
  cacheStats?: { hits: number; misses: number; hitRate: number; size: number };
}

/**
 * Execute flow with optional persistent cache
 * @param nodes - Flow nodes
 * @param edges - Flow edges
 * @param cache - Optional persistent cache instance for cross-execution caching
 */
export function executeFlow(
  nodes: Node[],
  edges: Edge[],
  cache?: FlowExecutionCache
): ExecutionResult {
  const startTime = performance.now();

  try {
    const paths = executeFlowGraph(nodes, edges, cache);
    const result: ExecutionResult = {
      success: true,
      paths,
      executionTime: performance.now() - startTime,
    };

    // Include cache stats if using persistent cache
    if (cache) {
      result.cacheStats = cache.getStats();
    }

    return result;
  } catch (err) {
    return {
      success: false,
      paths: [],
      error: err instanceof Error ? err.message : String(err),
      executionTime: performance.now() - startTime,
    };
  }
}
