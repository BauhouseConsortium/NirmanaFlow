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
