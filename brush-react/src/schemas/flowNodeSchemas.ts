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
    return { success: true, data: result.data };
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
    return schema.parse(data);
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

  return result.success ? result.data : defaultValue;
}

/**
 * Get validation errors as a map of field -> error message
 */
export function getValidationErrorMap(error: z.ZodError): Record<string, string> {
  const errorMap: Record<string, string> = {};
  for (const issue of error.errors) {
    const path = issue.path.join('.');
    errorMap[path] = issue.message;
  }
  return errorMap;
}
