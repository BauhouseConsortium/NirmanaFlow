import { useState, useCallback, useMemo } from 'react';
import { z } from 'zod';

// Zod schema with validation constraints
export const VectorSettingsSchema = z.object({
  // Canvas (input coordinate space)
  canvasWidth: z.number().min(1).max(1000).default(150),
  canvasHeight: z.number().min(1).max(1000).default(120),

  // Output dimensions (mm)
  targetWidth: z.number().min(1).max(500).default(120),
  targetHeight: z.number().min(1).max(500).default(100),
  offsetX: z.number().min(0).max(200).default(15),
  offsetY: z.number().min(0).max(200).default(20),

  // Machine settings
  feedRate: z.number().min(100).max(10000).default(1600),
  backlashX: z.number().min(0).max(5).default(0),
  backlashY: z.number().min(0).max(5).default(0),
  safeZ: z.number().min(1).max(50).default(5),

  // Ink dipping
  dipInterval: z.number().min(10).max(500).default(80),
  dipX: z.number().min(0).max(200).default(41),
  dipY: z.number().min(0).max(200).default(5),
  continuousPlot: z.boolean().default(true),

  // Main color selection (uses color well position when color palette is enabled)
  mainColor: z.number().min(1).max(4).default(1),

  // Color palette (multi-color mode) - always enabled
  colorPaletteEnabled: z.boolean().default(true),
  colorWell1X: z.number().min(0).max(200).default(41),
  colorWell1Y: z.number().min(0).max(200).default(5),
  colorWell1Color: z.string().default('#1e40af'), // Blue
  colorWell2X: z.number().min(0).max(200).default(51),
  colorWell2Y: z.number().min(0).max(200).default(5),
  colorWell2Color: z.string().default('#dc2626'), // Red
  colorWell3X: z.number().min(0).max(200).default(61),
  colorWell3Y: z.number().min(0).max(200).default(5),
  colorWell3Color: z.string().default('#16a34a'), // Green
  colorWell4X: z.number().min(0).max(200).default(71),
  colorWell4Y: z.number().min(0).max(200).default(5),
  colorWell4Color: z.string().default('#171717'), // Black

  // Filter
  artefactThreshold: z.number().min(0).max(10).default(0.1),

  // Clipping
  clipToWorkArea: z.boolean().default(false),

  // Hardware
  controllerHost: z.string().url().default('http://192.168.0.248'),
});

// Infer TypeScript type from schema
export type VectorSettings = z.infer<typeof VectorSettingsSchema>;

// Helper type for color well
export interface ColorWell {
  id: 1 | 2 | 3 | 4;
  x: number;
  y: number;
  color: string;
}

// Helper to get color wells as array
export function getColorWells(settings: VectorSettings): ColorWell[] {
  return [
    { id: 1, x: settings.colorWell1X, y: settings.colorWell1Y, color: settings.colorWell1Color },
    { id: 2, x: settings.colorWell2X, y: settings.colorWell2Y, color: settings.colorWell2Color },
    { id: 3, x: settings.colorWell3X, y: settings.colorWell3Y, color: settings.colorWell3Color },
    { id: 4, x: settings.colorWell4X, y: settings.colorWell4Y, color: settings.colorWell4Color },
  ];
}

// Schema for individual setting validation (partial)
export const PartialVectorSettingsSchema = VectorSettingsSchema.partial();

// Default settings derived from schema
const DEFAULT_SETTINGS: VectorSettings = VectorSettingsSchema.parse({});

// Validation result type
export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: z.ZodError;
}

// Validate a single setting
export function validateSetting<K extends keyof VectorSettings>(
  key: K,
  value: unknown
): ValidationResult<VectorSettings[K]> {
  const fieldSchema = VectorSettingsSchema.shape[key];
  const result = fieldSchema.safeParse(value);

  if (result.success) {
    return { success: true, data: result.data as VectorSettings[K] };
  }
  return { success: false, errors: result.error };
}

// Validate entire settings object
export function validateSettings(settings: unknown): ValidationResult<VectorSettings> {
  const result = VectorSettingsSchema.safeParse(settings);

  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: result.error };
}

// Get validation constraints for a field (for UI)
export function getFieldConstraints(key: keyof VectorSettings): { min?: number; max?: number; step?: number } {
  const constraints: Record<keyof VectorSettings, { min?: number; max?: number; step?: number }> = {
    canvasWidth: { min: 1, max: 1000, step: 1 },
    canvasHeight: { min: 1, max: 1000, step: 1 },
    targetWidth: { min: 1, max: 500, step: 1 },
    targetHeight: { min: 1, max: 500, step: 1 },
    offsetX: { min: 0, max: 200, step: 1 },
    offsetY: { min: 0, max: 200, step: 1 },
    feedRate: { min: 100, max: 10000, step: 100 },
    backlashX: { min: 0, max: 5, step: 0.1 },
    backlashY: { min: 0, max: 5, step: 0.1 },
    safeZ: { min: 1, max: 50, step: 1 },
    dipInterval: { min: 10, max: 500, step: 10 },
    dipX: { min: 0, max: 200, step: 1 },
    dipY: { min: 0, max: 200, step: 1 },
    continuousPlot: {},
    mainColor: { min: 1, max: 4, step: 1 },
    colorPaletteEnabled: {},
    colorWell1X: { min: 0, max: 200, step: 1 },
    colorWell1Y: { min: 0, max: 200, step: 1 },
    colorWell1Color: {},
    colorWell2X: { min: 0, max: 200, step: 1 },
    colorWell2Y: { min: 0, max: 200, step: 1 },
    colorWell2Color: {},
    colorWell3X: { min: 0, max: 200, step: 1 },
    colorWell3Y: { min: 0, max: 200, step: 1 },
    colorWell3Color: {},
    colorWell4X: { min: 0, max: 200, step: 1 },
    colorWell4Y: { min: 0, max: 200, step: 1 },
    colorWell4Color: {},
    artefactThreshold: { min: 0, max: 10, step: 0.1 },
    clipToWorkArea: {},
    controllerHost: {},
  };
  return constraints[key];
}

export function useVectorSettings() {
  const [settings, setSettings] = useState<VectorSettings>(DEFAULT_SETTINGS);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Memoized update function with validation
  const updateSetting = useCallback(<K extends keyof VectorSettings>(key: K, value: VectorSettings[K]) => {
    const result = validateSetting(key, value);

    if (result.success && result.data !== undefined) {
      setSettings(prev => ({ ...prev, [key]: result.data }));
      setValidationErrors(prev => {
        const { [key]: _, ...rest } = prev;
        return rest;
      });
    } else if (result.errors) {
      const errorMessage = result.errors.errors[0]?.message || 'Invalid value';
      setValidationErrors(prev => ({ ...prev, [key]: errorMessage }));
    }
  }, []);

  // Update without validation (for trusted sources)
  const updateSettingUnsafe = useCallback(<K extends keyof VectorSettings>(key: K, value: VectorSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  }, []);

  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
    setValidationErrors({});
  }, []);

  // Load settings from a partial object (merges with defaults and validates)
  const loadSettings = useCallback((partial: Partial<VectorSettings>) => {
    const merged = { ...DEFAULT_SETTINGS, ...partial };
    const result = validateSettings(merged);

    if (result.success && result.data) {
      setSettings(result.data);
      setValidationErrors({});
    } else if (result.errors) {
      // Still load what we can, but report errors
      const validatedPartial: Partial<VectorSettings> = {};
      for (const key of Object.keys(partial) as (keyof VectorSettings)[]) {
        const fieldResult = validateSetting(key, partial[key]);
        if (fieldResult.success && fieldResult.data !== undefined) {
          (validatedPartial as Record<string, unknown>)[key] = fieldResult.data;
        }
      }
      setSettings(prev => ({ ...prev, ...validatedPartial }));
    }
  }, []);

  // Memoized derived values for performance
  const scale = useMemo(() => ({
    x: settings.targetWidth / settings.canvasWidth,
    y: settings.targetHeight / settings.canvasHeight,
  }), [settings.targetWidth, settings.targetHeight, settings.canvasWidth, settings.canvasHeight]);

  const isValid = useMemo(() => Object.keys(validationErrors).length === 0, [validationErrors]);

  return {
    settings,
    updateSetting,
    updateSettingUnsafe,
    resetSettings,
    loadSettings,
    validationErrors,
    isValid,
    scale,
    DEFAULT_SETTINGS,
  };
}
