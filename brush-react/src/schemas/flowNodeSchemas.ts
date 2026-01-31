/**
 * Zod schemas for FlowNode data validation
 * Provides runtime validation + TypeScript type inference
 */

import { z } from 'zod';

// Base node data schema
const BaseNodeDataSchema = z.object({
  label: z.string().min(1),
});

// ============ Shape Nodes ============

export const LineNodeDataSchema = BaseNodeDataSchema.extend({
  x1: z.number(),
  y1: z.number(),
  x2: z.number(),
  y2: z.number(),
});

export const RectNodeDataSchema = BaseNodeDataSchema.extend({
  x: z.number(),
  y: z.number(),
  width: z.number().min(0),
  height: z.number().min(0),
});

export const CircleNodeDataSchema = BaseNodeDataSchema.extend({
  cx: z.number(),
  cy: z.number(),
  radius: z.number().min(0),
  segments: z.number().int().min(3).max(360),
});

export const EllipseNodeDataSchema = BaseNodeDataSchema.extend({
  cx: z.number(),
  cy: z.number(),
  rx: z.number().min(0),
  ry: z.number().min(0),
  segments: z.number().int().min(3).max(360),
});

export const ArcNodeDataSchema = BaseNodeDataSchema.extend({
  cx: z.number(),
  cy: z.number(),
  radius: z.number().min(0),
  startAngle: z.number().min(-360).max(360),
  endAngle: z.number().min(-360).max(360),
  segments: z.number().int().min(1).max(360),
});

export const PolygonNodeDataSchema = BaseNodeDataSchema.extend({
  sides: z.number().int().min(3).max(100),
  cx: z.number(),
  cy: z.number(),
  radius: z.number().min(0),
});

export const TextNodeDataSchema = BaseNodeDataSchema.extend({
  text: z.string(),
  x: z.number(),
  y: z.number(),
  size: z.number().min(1).max(500),
  spacing: z.number().min(0).max(10),
});

export const BatakTextNodeDataSchema = BaseNodeDataSchema.extend({
  text: z.string(),
  x: z.number(),
  y: z.number(),
  size: z.number().min(1).max(500),
  showPreview: z.boolean(),
});

// ============ Iteration Nodes ============

export const RepeatNodeDataSchema = BaseNodeDataSchema.extend({
  count: z.number().int().min(1).max(1000),
  offsetX: z.number(),
  offsetY: z.number(),
  rotation: z.number(),
  scale: z.number().min(0.01).max(100),
});

export const GridNodeDataSchema = BaseNodeDataSchema.extend({
  cols: z.number().int().min(1).max(100),
  rows: z.number().int().min(1).max(100),
  spacingX: z.number(),
  spacingY: z.number(),
  startX: z.number(),
  startY: z.number(),
});

export const RadialNodeDataSchema = BaseNodeDataSchema.extend({
  count: z.number().int().min(1).max(360),
  cx: z.number(),
  cy: z.number(),
  radius: z.number().min(0),
  startAngle: z.number(),
});

// ============ Transform Nodes ============

export const TranslateNodeDataSchema = BaseNodeDataSchema.extend({
  dx: z.number(),
  dy: z.number(),
});

export const RotateNodeDataSchema = BaseNodeDataSchema.extend({
  angle: z.number(),
  cx: z.number(),
  cy: z.number(),
});

export const ScaleNodeDataSchema = BaseNodeDataSchema.extend({
  sx: z.number().min(0.001),
  sy: z.number().min(0.001),
  cx: z.number(),
  cy: z.number(),
});

export const PathNodeDataSchema = BaseNodeDataSchema.extend({
  pathType: z.enum(['circle', 'arc', 'line', 'wave', 'spiral']),
  cx: z.number(),
  cy: z.number(),
  radius: z.number().min(0),
  startAngle: z.number(),
  endAngle: z.number(),
  x1: z.number(),
  y1: z.number(),
  x2: z.number(),
  y2: z.number(),
  amplitude: z.number(),
  frequency: z.number().min(0),
  turns: z.number().min(0),
  growth: z.number(),
  align: z.enum(['start', 'center', 'end']),
  spacing: z.number().min(0),
  reverse: z.boolean(),
});

// ============ Algorithmic Nodes ============

export const AlgorithmicNodeDataSchema = BaseNodeDataSchema.extend({
  formula: z.string().min(1),
  count: z.number().int().min(1).max(10000),
  mode: z.enum(['position', 'rotation', 'scale', 'all']),
  xScale: z.number(),
  yScale: z.number(),
  rotScale: z.number(),
  sclScale: z.number(),
  baseX: z.number(),
  baseY: z.number(),
});

export const AttractorNodeDataSchema = BaseNodeDataSchema.extend({
  type: z.enum(['clifford', 'dejong', 'bedhead', 'tinkerbell', 'gumowski']),
  iterations: z.number().int().min(100).max(100000),
  a: z.number(),
  b: z.number(),
  c: z.number(),
  d: z.number(),
  scale: z.number().min(0.1),
  centerX: z.number(),
  centerY: z.number(),
});

export const LSystemNodeDataSchema = BaseNodeDataSchema.extend({
  axiom: z.string().min(1).max(100),
  rules: z.string().min(1).max(1000),
  iterations: z.number().int().min(0).max(10),
  angle: z.number(),
  stepSize: z.number().min(0.1),
  startX: z.number(),
  startY: z.number(),
  startAngle: z.number(),
  scalePerIter: z.number().min(0.1).max(2),
});

export const CodeNodeDataSchema = BaseNodeDataSchema.extend({
  code: z.string(),
  error: z.string().optional(),
});

// ============ SVG Node ============

export const SvgNodeDataSchema = BaseNodeDataSchema.extend({
  svgContent: z.string().optional(),
  filename: z.string().optional(),
  scale: z.number().min(0.1).max(10),
  offsetX: z.number(),
  offsetY: z.number(),
});

// ============ Image Node ============

export const ImageNodeDataSchema = BaseNodeDataSchema.extend({
  imageData: z.string().optional(), // base64 data URL
  width: z.number().min(0).optional(),
  height: z.number().min(0).optional(),
  filename: z.string().optional(),
});

// ============ Halftone Node ============

export const HalftoneNodeDataSchema = BaseNodeDataSchema.extend({
  mode: z.enum(['sine', 'zigzag', 'square', 'triangle']),
  lineSpacing: z.number().min(0.5).max(20),
  waveLength: z.number().min(0.5).max(50),
  minAmplitude: z.number().min(0).max(10),
  maxAmplitude: z.number().min(0.1).max(10),
  angle: z.number().min(-180).max(180),
  sampleResolution: z.number().int().min(10).max(500),
  invert: z.boolean(),
  flipX: z.boolean(),
  flipY: z.boolean(),
  skipWhite: z.boolean(),
  whiteThreshold: z.number().min(0).max(1),
  outputWidth: z.number().min(10).max(500),
  outputHeight: z.number().min(10).max(500),
});

// ============ Mask Node ============

export const MaskNodeDataSchema = BaseNodeDataSchema.extend({
  threshold: z.number().min(0).max(1),
  invert: z.boolean(),
  feather: z.number().min(0).max(20),
});

// ============ ASCII Node ============

export const AsciiNodeDataSchema = BaseNodeDataSchema.extend({
  charset: z.string().min(1),
  cellWidth: z.number().min(0.5).max(20),
  cellHeight: z.number().min(0.5).max(30),
  fontSize: z.number().min(0.5).max(20),
  outputWidth: z.number().min(10).max(500),
  outputHeight: z.number().min(10).max(500),
  invert: z.boolean(),
  flipX: z.boolean(),
  flipY: z.boolean(),
});

// ============ Slicer Node ============

export const SlicerNodeDataSchema = BaseNodeDataSchema.extend({
  // Extrusion settings
  extrudeHeight: z.number().min(0.1).max(500),
  wallThickness: z.number().min(0.1).max(10),
  // Slice settings
  layerHeight: z.number().min(0.05).max(1),
  extractLayer: z.number().int().min(-1), // -1 = all layers flattened
  // Infill settings
  infillPattern: z.enum(['lines', 'grid', 'triangles', 'honeycomb', 'gyroid', 'concentric']),
  infillDensity: z.number().min(0).max(100),
  infillAngle: z.number().min(0).max(180),
  // Output options
  includeWalls: z.boolean(),
  includeInfill: z.boolean(),
  includeTravel: z.boolean(),
  // State
  isSlicing: z.boolean().optional(),
  sliceProgress: z.number().min(0).max(100).optional(),
  error: z.string().optional(),
  lastSliceHash: z.string().optional(),
});

// ============ OBJ Loader Node ============

export const ObjLoaderNodeDataSchema = BaseNodeDataSchema.extend({
  filename: z.string().optional(),
  geometryData: z.string().optional(), // Serialized Geometry3D
  vertexCount: z.number().int().min(0).optional(),
  edgeCount: z.number().int().min(0).optional(),
  faceCount: z.number().int().min(0).optional(),
  error: z.string().optional(),
});

// ============ Wireframe Node ============

export const WireframeNodeDataSchema = BaseNodeDataSchema.extend({
  rotationX: z.number().min(-360).max(360),
  rotationY: z.number().min(-360).max(360),
  rotationZ: z.number().min(-360).max(360),
  distance: z.number().min(0.1).max(100),
  projection: z.enum(['perspective', 'orthographic']),
  fov: z.number().min(10).max(120),
  scale: z.number().min(1).max(500),
  centerX: z.number(),
  centerY: z.number(),
  edgeReduction: z.number().int().min(0).max(100),
  edgeAngleThreshold: z.number().min(0).max(180),
});

// ============ Supershape Node ============

export const SupershapeNodeDataSchema = BaseNodeDataSchema.extend({
  // First superformula (latitude)
  m1: z.number(),
  n1_1: z.number(),
  n2_1: z.number(),
  n3_1: z.number(),
  a1: z.number().min(0.01),
  b1: z.number().min(0.01),
  // Second superformula (longitude)
  m2: z.number(),
  n1_2: z.number(),
  n2_2: z.number(),
  n3_2: z.number(),
  a2: z.number().min(0.01),
  b2: z.number().min(0.01),
  // Resolution
  segments: z.number().int().min(5).max(100),
  // Generated data
  geometryData: z.string().optional(),
  vertexCount: z.number().int().min(0).optional(),
  edgeCount: z.number().int().min(0).optional(),
});

// ============ Output Node ============

export const OutputNodeDataSchema = BaseNodeDataSchema;

// ============ Discriminated Union ============

// Map node types to their schemas
export const nodeSchemaMap = {
  line: LineNodeDataSchema,
  rect: RectNodeDataSchema,
  circle: CircleNodeDataSchema,
  ellipse: EllipseNodeDataSchema,
  arc: ArcNodeDataSchema,
  polygon: PolygonNodeDataSchema,
  text: TextNodeDataSchema,
  batak: BatakTextNodeDataSchema,
  repeat: RepeatNodeDataSchema,
  grid: GridNodeDataSchema,
  radial: RadialNodeDataSchema,
  translate: TranslateNodeDataSchema,
  rotate: RotateNodeDataSchema,
  scale: ScaleNodeDataSchema,
  path: PathNodeDataSchema,
  algorithmic: AlgorithmicNodeDataSchema,
  attractor: AttractorNodeDataSchema,
  lsystem: LSystemNodeDataSchema,
  code: CodeNodeDataSchema,
  svg: SvgNodeDataSchema,
  image: ImageNodeDataSchema,
  halftone: HalftoneNodeDataSchema,
  ascii: AsciiNodeDataSchema,
  mask: MaskNodeDataSchema,
  slicer: SlicerNodeDataSchema,
  objloader: ObjLoaderNodeDataSchema,
  wireframe: WireframeNodeDataSchema,
  supershape: SupershapeNodeDataSchema,
  output: OutputNodeDataSchema,
} as const;

export type NodeType = keyof typeof nodeSchemaMap;

// Inferred types from schemas
export type LineNodeData = z.infer<typeof LineNodeDataSchema>;
export type RectNodeData = z.infer<typeof RectNodeDataSchema>;
export type CircleNodeData = z.infer<typeof CircleNodeDataSchema>;
export type EllipseNodeData = z.infer<typeof EllipseNodeDataSchema>;
export type ArcNodeData = z.infer<typeof ArcNodeDataSchema>;
export type PolygonNodeData = z.infer<typeof PolygonNodeDataSchema>;
export type TextNodeData = z.infer<typeof TextNodeDataSchema>;
export type BatakTextNodeData = z.infer<typeof BatakTextNodeDataSchema>;
export type RepeatNodeData = z.infer<typeof RepeatNodeDataSchema>;
export type GridNodeData = z.infer<typeof GridNodeDataSchema>;
export type RadialNodeData = z.infer<typeof RadialNodeDataSchema>;
export type TranslateNodeData = z.infer<typeof TranslateNodeDataSchema>;
export type RotateNodeData = z.infer<typeof RotateNodeDataSchema>;
export type ScaleNodeData = z.infer<typeof ScaleNodeDataSchema>;
export type PathNodeData = z.infer<typeof PathNodeDataSchema>;
export type AlgorithmicNodeData = z.infer<typeof AlgorithmicNodeDataSchema>;
export type AttractorNodeData = z.infer<typeof AttractorNodeDataSchema>;
export type LSystemNodeData = z.infer<typeof LSystemNodeDataSchema>;
export type CodeNodeData = z.infer<typeof CodeNodeDataSchema>;
export type SvgNodeData = z.infer<typeof SvgNodeDataSchema>;
export type ImageNodeData = z.infer<typeof ImageNodeDataSchema>;
export type HalftoneNodeData = z.infer<typeof HalftoneNodeDataSchema>;
export type AsciiNodeData = z.infer<typeof AsciiNodeDataSchema>;
export type MaskNodeData = z.infer<typeof MaskNodeDataSchema>;
export type SlicerNodeData = z.infer<typeof SlicerNodeDataSchema>;
export type ObjLoaderNodeData = z.infer<typeof ObjLoaderNodeDataSchema>;
export type WireframeNodeData = z.infer<typeof WireframeNodeDataSchema>;
export type SupershapeNodeData = z.infer<typeof SupershapeNodeDataSchema>;
export type OutputNodeData = z.infer<typeof OutputNodeDataSchema>;

// Union type
export type FlowNodeData =
  | LineNodeData
  | RectNodeData
  | CircleNodeData
  | EllipseNodeData
  | ArcNodeData
  | PolygonNodeData
  | TextNodeData
  | BatakTextNodeData
  | RepeatNodeData
  | GridNodeData
  | RadialNodeData
  | TranslateNodeData
  | RotateNodeData
  | ScaleNodeData
  | PathNodeData
  | AlgorithmicNodeData
  | AttractorNodeData
  | LSystemNodeData
  | CodeNodeData
  | SvgNodeData
  | ImageNodeData
  | HalftoneNodeData
  | AsciiNodeData
  | MaskNodeData
  | SlicerNodeData
  | ObjLoaderNodeData
  | WireframeNodeData
  | SupershapeNodeData
  | OutputNodeData;

// ============ Validation Helpers ============

export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: z.ZodError;
}

/**
 * Validate node data by type
 */
export function validateNodeData<T extends NodeType>(
  nodeType: T,
  data: unknown
): ValidationResult<z.infer<(typeof nodeSchemaMap)[T]>> {
  const schema = nodeSchemaMap[nodeType];
  if (!schema) {
    return {
      success: false,
      errors: new z.ZodError([
        { code: 'custom', message: `Unknown node type: ${nodeType}`, path: ['nodeType'] },
      ]),
    };
  }

  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data as z.infer<(typeof nodeSchemaMap)[T]> };
  }
  return { success: false, errors: result.error };
}

/**
 * Parse node data with defaults (returns default values for missing fields)
 */
export function parseNodeDataWithDefaults<T extends NodeType>(
  nodeType: T,
  data: Partial<z.infer<(typeof nodeSchemaMap)[T]>>
): z.infer<(typeof nodeSchemaMap)[T]> | null {
  const schema = nodeSchemaMap[nodeType];
  if (!schema) return null;

  try {
    return schema.parse(data) as z.infer<(typeof nodeSchemaMap)[T]>;
  } catch {
    return null;
  }
}

/**
 * Get a safe value for a node field (returns current value if valid, else default)
 */
export function getSafeNodeValue<T extends NodeType, K extends keyof z.infer<(typeof nodeSchemaMap)[T]>>(
  nodeType: T,
  field: K,
  value: unknown,
  defaultValue: z.infer<(typeof nodeSchemaMap)[T]>[K]
): z.infer<(typeof nodeSchemaMap)[T]>[K] {
  const schema = nodeSchemaMap[nodeType];
  if (!schema || !(field in schema.shape)) return defaultValue;

  const fieldSchema = (schema.shape as Record<string, z.ZodTypeAny>)[field as string];
  const result = fieldSchema.safeParse(value);

  return (result.success ? result.data : defaultValue) as z.infer<(typeof nodeSchemaMap)[T]>[K];
}

/**
 * Get validation errors as a map of field -> error message
 */
export function getValidationErrorMap(error: z.ZodError): Record<string, string> {
  const errorMap: Record<string, string> = {};
  for (const issue of error.issues) {
    const path = issue.path.join('.');
    errorMap[path] = issue.message;
  }
  return errorMap;
}
