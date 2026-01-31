/**
 * Node type definitions for the visual flow editor
 */

export interface NodeData {
  label: string;
  color?: 1 | 2 | 3 | 4; // Color well index (1-4) for multi-color mode
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

export interface BatakTextNodeData extends NodeData {
  text: string;
  x: number;
  y: number;
  size: number;
  showPreview: boolean;
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

export interface AlgorithmicNodeData extends NodeData {
  formula: string;
  count: number;
  mode: 'position' | 'rotation' | 'scale' | 'all';
  xScale: number;
  yScale: number;
  rotScale: number;
  sclScale: number;
  baseX: number;
  baseY: number;
}

export interface AttractorNodeData extends NodeData {
  type: 'clifford' | 'dejong' | 'bedhead' | 'tinkerbell' | 'gumowski';
  iterations: number;
  a: number;
  b: number;
  c: number;
  d: number;
  scale: number;
  centerX: number;
  centerY: number;
}

export interface LSystemNodeData extends NodeData {
  axiom: string;
  rules: string;
  iterations: number;
  angle: number;
  stepSize: number;
  startX: number;
  startY: number;
  startAngle: number;
  scalePerIter: number;
}

export interface PathNodeData extends NodeData {
  pathType: 'circle' | 'arc' | 'line' | 'wave' | 'spiral';
  cx: number;
  cy: number;
  radius: number;
  startAngle: number;
  endAngle: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  amplitude: number;
  frequency: number;
  turns: number;
  growth: number;
  align: 'start' | 'center' | 'end';
  spacing: number;
  reverse: boolean;
}

export interface CodeNodeData extends NodeData {
  code: string;
  error?: string;
}

// SVG node data type
export interface SvgNodeData extends NodeData {
  svgContent?: string;
  filename?: string;
  scale: number;
  offsetX: number;
  offsetY: number;
}

// Image node data type
export interface ImageNodeData extends NodeData {
  imageData?: string; // base64 data URL
  width?: number;
  height?: number;
  filename?: string;
}

// Halftone node data type
export interface HalftoneNodeData extends NodeData {
  mode: 'sine' | 'zigzag' | 'square' | 'triangle';
  lineSpacing: number;
  waveLength: number;
  minAmplitude: number;
  maxAmplitude: number;
  angle: number;
  sampleResolution: number;
  invert: boolean;
  flipX: boolean;
  flipY: boolean;
  skipWhite: boolean;
  whiteThreshold: number;
  outputWidth: number;
  outputHeight: number;
}

// Mask node data type
export interface MaskNodeData extends NodeData {
  threshold: number;
  invert: boolean;
  feather: number;
}

// ASCII node data type
export interface AsciiNodeData extends NodeData {
  charset: string;
  cellWidth: number;
  cellHeight: number;
  fontSize: number;
  outputWidth: number;
  outputHeight: number;
  invert: boolean;
  flipX: boolean;
  flipY: boolean;
}

// Slicer node data type
export interface SlicerNodeData extends NodeData {
  extrudeHeight: number;
  wallThickness: number;
  layerHeight: number;
  extractLayer: number;
  infillPattern: 'lines' | 'grid' | 'triangles' | 'honeycomb' | 'gyroid' | 'concentric';
  infillDensity: number;
  infillAngle: number;
  includeWalls: boolean;
  includeInfill: boolean;
  includeTravel: boolean;
  isSlicing?: boolean;
  sliceProgress?: number;
  error?: string;
  lastSliceHash?: string;
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
  | AlgorithmicNodeData
  | AttractorNodeData
  | LSystemNodeData
  | PathNodeData
  | CodeNodeData
  | SvgNodeData
  | ImageNodeData
  | HalftoneNodeData
  | AsciiNodeData
  | MaskNodeData
  | SlicerNodeData
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
    { type: 'batak', label: 'Batak Text', description: 'Draw Batak script from Latin transliteration' },
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
    { type: 'path', label: 'Path Layout', description: 'Arrange text/shapes along a path' },
  ],
  algorithmic: [
    { type: 'algorithmic', label: 'Bytebeat', description: '8-bit viznut-style formula sequencer' },
    { type: 'attractor', label: 'Attractor', description: 'Strange attractors (Clifford, De Jong, etc.)' },
    { type: 'lsystem', label: 'L-System', description: 'Lindenmayer system fractal patterns' },
    { type: 'code', label: 'Code', description: 'Custom JavaScript code to transform or generate paths' },
  ],
  image: [
    { type: 'svg', label: 'SVG', description: 'Load SVG file as vector paths' },
    { type: 'image', label: 'Image', description: 'Load an image for processing' },
    { type: 'halftone', label: 'Halftone', description: 'Sinusoidal line halftone pattern from image' },
    { type: 'ascii', label: 'ASCII', description: 'Convert image to ASCII art pattern' },
    { type: 'mask', label: 'Mask', description: 'Clip paths using B&W image as mask' },
  ],
  // Slicer disabled for now - may re-enable later
  // slicer: [
  //   { type: 'slicer', label: 'Slicer', description: '3D slicer infill patterns (lines, grid, honeycomb, gyroid)' },
  // ],
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
  batak: { label: 'Batak Text', text: 'horas', x: 10, y: 50, size: 30, showPreview: true },
  repeat: { label: 'Repeat', count: 5, offsetX: 10, offsetY: 0, rotation: 0, scale: 1 },
  grid: { label: 'Grid', cols: 3, rows: 3, spacingX: 30, spacingY: 30, startX: 15, startY: 15 },
  radial: { label: 'Radial', count: 8, cx: 75, cy: 60, radius: 40, startAngle: 0 },
  translate: { label: 'Translate', dx: 10, dy: 10 },
  rotate: { label: 'Rotate', angle: 45, cx: 50, cy: 50 },
  scale: { label: 'Scale', sx: 1.5, sy: 1.5, cx: 50, cy: 50 },
  algorithmic: {
    label: 'Bytebeat',
    formula: 't*(t>>5|t>>8)',
    count: 16,
    mode: 'position',
    xScale: 0.5,
    yScale: 0.5,
    rotScale: 1,
    sclScale: 0.01,
    baseX: 75,
    baseY: 60,
  },
  attractor: {
    label: 'Attractor',
    type: 'clifford',
    iterations: 5000,
    a: -1.4,
    b: 1.6,
    c: 1.0,
    d: 0.7,
    scale: 20,
    centerX: 75,
    centerY: 60,
  },
  lsystem: {
    label: 'L-System',
    axiom: 'F',
    rules: 'F=F+F-F-F+F',
    iterations: 3,
    angle: 90,
    stepSize: 10,
    startX: 20,
    startY: 100,
    startAngle: -90,
    scalePerIter: 0.7,
  },
  path: {
    label: 'Path Layout',
    pathType: 'circle',
    cx: 75,
    cy: 60,
    radius: 40,
    startAngle: 0,
    endAngle: 180,
    x1: 10,
    y1: 60,
    x2: 140,
    y2: 60,
    amplitude: 20,
    frequency: 2,
    turns: 3,
    growth: 5,
    align: 'start',
    spacing: 1,
    reverse: false,
  },
  code: {
    label: 'Code',
    code: `// Transform incoming paths or generate new ones
// Available: input (Path[]), api (Drawing helpers)
//
// Return: Path[] (array of paths)

// Example: Pass through with slight offset
const output = [];
for (const path of input) {
  const newPath = path.map(([x, y]) => [x + 5, y + 5]);
  output.push(newPath);
}
return output;
`,
  },
  svg: {
    label: 'SVG',
    svgContent: undefined,
    filename: undefined,
    scale: 1,
    offsetX: 0,
    offsetY: 0,
  },
  image: {
    label: 'Image',
    imageData: undefined,
    width: undefined,
    height: undefined,
    filename: undefined,
  },
  halftone: {
    label: 'Halftone',
    mode: 'sine',
    lineSpacing: 2,
    waveLength: 4,
    minAmplitude: 0.1,
    maxAmplitude: 1.5,
    angle: 0,
    sampleResolution: 100,
    invert: false,
    flipX: false,
    flipY: true,
    skipWhite: false,
    whiteThreshold: 0.95,
    outputWidth: 100,
    outputHeight: 100,
  },
  ascii: {
    label: 'ASCII',
    charset: ' .:-=+*#%@',
    cellWidth: 3,
    cellHeight: 4,
    fontSize: 3,
    outputWidth: 100,
    outputHeight: 100,
    invert: false,
    flipX: false,
    flipY: true,
  },
  mask: {
    label: 'Mask',
    threshold: 0.5,
    invert: false,
    feather: 0,
  },
  // Slicer disabled for now - may re-enable later
  // slicer: {
  //   label: 'Slicer',
  //   extrudeHeight: 10,
  //   wallThickness: 0.8,
  //   layerHeight: 0.2,
  //   extractLayer: -1,
  //   infillPattern: 'grid',
  //   infillDensity: 20,
  //   infillAngle: 45,
  //   includeWalls: true,
  //   includeInfill: true,
  //   includeTravel: false,
  //   isSlicing: false,
  //   sliceProgress: 0,
  // },
  output: { label: 'Output' },
};
