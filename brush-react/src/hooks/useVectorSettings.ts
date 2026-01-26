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

  // Filter
  artefactThreshold: z.number().min(0).max(10).default(0.1),

  // Hardware
  controllerHost: z.string().url().default('http://192.168.0.248'),
});

// Infer TypeScript type from schema
export type VectorSettings = z.infer<typeof VectorSettingsSchema>;

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
    artefactThreshold: { min: 0, max: 10, step: 0.1 },
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
    validationErrors,
    isValid,
    scale,
    DEFAULT_SETTINGS,
  };
}
