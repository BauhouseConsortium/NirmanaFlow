/**
 * Zod schemas for FluidNC status validation
 * Provides safe parsing of WebSocket messages
 */

import { z } from 'zod';

// ============ Enum Schemas ============

export const ConnectionStateSchema = z.enum(['disconnected', 'connecting', 'connected', 'error']);
export type ConnectionState = z.infer<typeof ConnectionStateSchema>;

export const MachineStateSchema = z.enum(['Idle', 'Run', 'Hold', 'Alarm', 'Check', 'Home', 'Sleep', 'Unknown']);
export type MachineState = z.infer<typeof MachineStateSchema>;

export const StreamingStateSchema = z.enum(['idle', 'streaming', 'paused', 'completed', 'error']);
export type StreamingState = z.infer<typeof StreamingStateSchema>;

// ============ Position Schema ============

export const MachinePositionSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
  z: z.number().finite(),
});
export type MachinePosition = z.infer<typeof MachinePositionSchema>;

// ============ Override Schema ============

export const OverrideSchema = z.object({
  feed: z.number().min(0).max(200),
  rapid: z.number().min(0).max(100),
  spindle: z.number().min(0).max(200),
});
export type Override = z.infer<typeof OverrideSchema>;

// ============ Status Schema ============

export const FluidNCStatusSchema = z.object({
  connectionState: ConnectionStateSchema,
  machineState: MachineStateSchema,
  position: MachinePositionSchema,
  feedRate: z.number().min(0),
  spindleSpeed: z.number().min(0),
  override: OverrideSchema.optional(),
  lastMessage: z.string(),
  lastError: z.string().nullable(),
});
export type FluidNCStatus = z.infer<typeof FluidNCStatusSchema>;

// ============ Streaming Progress Schema ============

export const StreamingProgressSchema = z.object({
  state: StreamingStateSchema,
  currentLine: z.number().int().min(0),
  totalLines: z.number().int().min(0),
  percentage: z.number().min(0).max(100),
  currentCommand: z.string(),
  startTime: z.number().nullable(),
  elapsedTime: z.number().min(0),
  errors: z.array(z.string()),
});
export type StreamingProgress = z.infer<typeof StreamingProgressSchema>;

// ============ Initial Values ============

export const INITIAL_STATUS: FluidNCStatus = {
  connectionState: 'disconnected',
  machineState: 'Unknown',
  position: { x: 0, y: 0, z: 0 },
  feedRate: 0,
  spindleSpeed: 0,
  lastMessage: '',
  lastError: null,
};

export const INITIAL_STREAMING: StreamingProgress = {
  state: 'idle',
  currentLine: 0,
  totalLines: 0,
  percentage: 0,
  currentCommand: '',
  startTime: null,
  elapsedTime: 0,
  errors: [],
};

// ============ Parser Helpers ============

/**
 * Safely parse position from comma-separated string
 * Returns null if invalid
 */
export function parsePosition(value: string): MachinePosition | null {
  const parts = value.split(',').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) {
    return null;
  }

  const [x, y, z] = parts;
  const result = MachinePositionSchema.safeParse({ x, y, z });
  return result.success ? result.data : null;
}

/**
 * Safely parse feed/spindle from comma-separated string
 */
export function parseFeedSpindle(value: string): { feedRate: number; spindleSpeed: number } | null {
  const parts = value.split(',').map(Number);
  if (parts.length !== 2 || parts.some(isNaN)) {
    return null;
  }

  const [feedRate, spindleSpeed] = parts;
  if (feedRate < 0 || spindleSpeed < 0) {
    return null;
  }

  return { feedRate, spindleSpeed };
}

/**
 * Safely parse override values from comma-separated string
 */
export function parseOverride(value: string): Override | null {
  const parts = value.split(',').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) {
    return null;
  }

  const [feed, rapid, spindle] = parts;
  const result = OverrideSchema.safeParse({ feed, rapid, spindle });
  return result.success ? result.data : null;
}

/**
 * Safely parse machine state string
 */
export function parseMachineState(state: string): MachineState {
  const result = MachineStateSchema.safeParse(state);
  return result.success ? result.data : 'Unknown';
}

/**
 * Parse full status message from FluidNC
 * Format: <State|MPos:X,Y,Z|FS:Feed,Spindle|Ov:F,R,S|...>
 */
export function parseStatusMessage(data: string): Partial<FluidNCStatus> | null {
  const match = data.match(/<([^|>]+)(.*)>/);
  if (!match) return null;

  const state = parseMachineState(match[1]);
  const fields = match[2].split('|').filter(Boolean);

  const updates: Partial<FluidNCStatus> = {
    machineState: state,
    lastMessage: data,
  };

  for (const field of fields) {
    const colonIndex = field.indexOf(':');
    if (colonIndex === -1) continue;

    const key = field.substring(0, colonIndex);
    const value = field.substring(colonIndex + 1);

    switch (key) {
      case 'MPos':
      case 'WPos': {
        const position = parsePosition(value);
        if (position) {
          updates.position = position;
        }
        break;
      }
      case 'FS': {
        const fs = parseFeedSpindle(value);
        if (fs) {
          updates.feedRate = fs.feedRate;
          updates.spindleSpeed = fs.spindleSpeed;
        }
        break;
      }
      case 'Ov': {
        const override = parseOverride(value);
        if (override) {
          updates.override = override;
        }
        break;
      }
    }
  }

  return updates;
}

/**
 * Validate entire status object
 */
export function validateStatus(status: unknown): FluidNCStatus | null {
  const result = FluidNCStatusSchema.safeParse(status);
  return result.success ? result.data : null;
}

/**
 * Check if position has meaningfully changed (threshold-based)
 */
export function hasPositionChanged(
  prev: MachinePosition,
  next: MachinePosition,
  threshold = 0.01
): boolean {
  return (
    Math.abs(prev.x - next.x) > threshold ||
    Math.abs(prev.y - next.y) > threshold ||
    Math.abs(prev.z - next.z) > threshold
  );
}
