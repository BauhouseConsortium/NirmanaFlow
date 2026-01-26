/**
 * Node type definitions for the visual flow editor
 */

export interface NodeData {
  label: string;
  [key: string]: unknown;
}

// Shape node data types
export interface LineNodeData extends NodeData {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface RectNodeData extends NodeData {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CircleNodeData extends NodeData {
  cx: number;
  cy: number;
  radius: number;
  segments: number;
}

export interface EllipseNodeData extends NodeData {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  segments: number;
}

export interface ArcNodeData extends NodeData {
  cx: number;
  cy: number;
  radius: number;
  startAngle: number;
  endAngle: number;
  segments: number;
}

export interface PolygonNodeData extends NodeData {
  sides: number;
  cx: number;
  cy: number;
  radius: number;
}

export interface TextNodeData extends NodeData {
  text: string;
  x: number;
  y: number;
  size: number;
  spacing: number;
}

// Control flow node data types
export interface RepeatNodeData extends NodeData {
  count: number;
  offsetX: number;
  offsetY: number;
  rotation: number;
  scale: number;
}

export interface GridNodeData extends NodeData {
  cols: number;
  rows: number;
  spacingX: number;
  spacingY: number;
  startX: number;
  startY: number;
}

export interface RadialNodeData extends NodeData {
  count: number;
  cx: number;
  cy: number;
  radius: number;
  startAngle: number;
}

// Transform node data types
export interface TranslateNodeData extends NodeData {
  dx: number;
  dy: number;
}

export interface RotateNodeData extends NodeData {
  angle: number;
  cx: number;
  cy: number;
}

export interface ScaleNodeData extends NodeData {
  sx: number;
  sy: number;
  cx: number;
  cy: number;
}

// Output node
export interface OutputNodeData extends NodeData {
  // No additional data needed
}

// Union type for all node data
export type FlowNodeData =
  | LineNodeData
  | RectNodeData
  | CircleNodeData
  | EllipseNodeData
  | ArcNodeData
  | PolygonNodeData
  | RepeatNodeData
  | GridNodeData
  | RadialNodeData
  | TranslateNodeData
  | RotateNodeData
  | ScaleNodeData
  | OutputNodeData;

// Node categories for the palette
export const nodeCategories = {
  shapes: [
    { type: 'line', label: 'Line', description: 'Draw a line between two points' },
    { type: 'rect', label: 'Rectangle', description: 'Draw a rectangle' },
    { type: 'circle', label: 'Circle', description: 'Draw a circle' },
    { type: 'ellipse', label: 'Ellipse', description: 'Draw an ellipse' },
    { type: 'arc', label: 'Arc', description: 'Draw an arc segment' },
    { type: 'polygon', label: 'Polygon', description: 'Draw a regular polygon' },
    { type: 'text', label: 'Text', description: 'Draw text as vector strokes' },
  ],
  iteration: [
    { type: 'repeat', label: 'Repeat', description: 'Repeat with offset transform' },
    { type: 'grid', label: 'Grid', description: 'Arrange in a grid pattern' },
    { type: 'radial', label: 'Radial', description: 'Arrange in a radial pattern' },
  ],
  transform: [
    { type: 'translate', label: 'Translate', description: 'Move shapes' },
    { type: 'rotate', label: 'Rotate', description: 'Rotate shapes' },
    { type: 'scale', label: 'Scale', description: 'Scale shapes' },
  ],
} as const;

// Default values for each node type
export const nodeDefaults: Record<string, Partial<FlowNodeData>> = {
  line: { label: 'Line', x1: 10, y1: 10, x2: 50, y2: 50 },
  rect: { label: 'Rectangle', x: 20, y: 20, width: 30, height: 20 },
  circle: { label: 'Circle', cx: 50, cy: 50, radius: 20, segments: 36 },
  ellipse: { label: 'Ellipse', cx: 50, cy: 50, rx: 30, ry: 20, segments: 36 },
  arc: { label: 'Arc', cx: 50, cy: 50, radius: 20, startAngle: 0, endAngle: 90, segments: 24 },
  polygon: { label: 'Polygon', sides: 6, cx: 50, cy: 50, radius: 20 },
  text: { label: 'Text', text: 'HELLO', x: 10, y: 10, size: 10, spacing: 1.2 },
  repeat: { label: 'Repeat', count: 5, offsetX: 10, offsetY: 0, rotation: 0, scale: 1 },
  grid: { label: 'Grid', cols: 3, rows: 3, spacingX: 30, spacingY: 30, startX: 15, startY: 15 },
  radial: { label: 'Radial', count: 8, cx: 75, cy: 60, radius: 40, startAngle: 0 },
  translate: { label: 'Translate', dx: 10, dy: 10 },
  rotate: { label: 'Rotate', angle: 45, cx: 50, cy: 50 },
  scale: { label: 'Scale', sx: 1.5, sy: 1.5, cx: 50, cy: 50 },
  output: { label: 'Output' },
};
