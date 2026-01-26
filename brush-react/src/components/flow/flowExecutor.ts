/**
 * Flow Executor - Converts node graph to drawing paths
 */

import type { Node, Edge } from '@xyflow/react';
import type { Path, Point } from '../../utils/drawingApi';
import { renderText } from './strokeFont';

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
    } else if (node.type === 'text') {
      // Text nodes render text as stroke paths
      const data = node.data as Record<string, unknown>;
      const text = (data.text as string) || '';
      const x = (data.x as number) || 0;
      const y = (data.y as number) || 0;
      const size = (data.size as number) || 10;
      const spacing = (data.spacing as number) || 1.2;
      paths = renderText(text, { x, y, size, spacing });
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
