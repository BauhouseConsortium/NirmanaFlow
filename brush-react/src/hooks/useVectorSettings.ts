import { useState, useCallback, useMemo, useEffect } from 'react';
import { z } from 'zod';

// LocalStorage keys
const PROFILES_KEY = 'brush-vector-profiles';
const ACTIVE_PROFILE_KEY = 'brush-active-vector-profile';

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
  safeZ: z.number().min(1).max(50).default(5), // For brush mode (with dipping)
  safeZPlotter: z.number().min(0.5).max(20).default(2), // For plotter mode (continuous)

  // Ink dipping
  dipInterval: z.number().min(10).max(500).default(80),
  dipX: z.number().min(0).max(200).default(41),
  dipY: z.number().min(0).max(200).default(5),
  continuousPlot: z.boolean().default(false),
  customDipSequence: z.string().default(''),

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

  // Path optimization (Clipper2 WASM)
  optimizePaths: z.boolean().default(false),
  simplifyTolerance: z.number().min(0).max(2).default(0.1),
  mergeOverlapping: z.boolean().default(true),
  minSegmentLength: z.number().min(0).max(5).default(0.5),

  // Plotter optimization
  plotterOptimize: z.boolean().default(true),
  removeDuplicateLines: z.boolean().default(true),
  mergeConnectedPaths: z.boolean().default(true),
  optimizePathOrder: z.boolean().default(true),

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

// Machine profile type
export interface MachineProfile {
  id: string;
  name: string;
  settings: VectorSettings;
  createdAt: number;
  updatedAt: number;
  isBuiltIn?: boolean;
}

// Built-in machine presets
const BUILT_IN_PROFILES: MachineProfile[] = [
  {
    id: 'default',
    name: 'Default',
    settings: DEFAULT_SETTINGS,
    createdAt: 0,
    updatedAt: 0,
    isBuiltIn: true,
  },
];

// LocalStorage helpers
function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const stored = localStorage.getItem(key);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.warn(`Failed to load ${key} from localStorage:`, e);
  }
  return fallback;
}

function saveToStorage<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn(`Failed to save ${key} to localStorage:`, e);
  }
}

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
    safeZPlotter: { min: 0.5, max: 20, step: 0.5 },
    dipInterval: { min: 10, max: 500, step: 10 },
    dipX: { min: 0, max: 200, step: 1 },
    dipY: { min: 0, max: 200, step: 1 },
    continuousPlot: {},
    customDipSequence: {},
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
    optimizePaths: {},
    simplifyTolerance: { min: 0, max: 2, step: 0.01 },
    mergeOverlapping: {},
    minSegmentLength: { min: 0, max: 5, step: 0.1 },
    plotterOptimize: {},
    removeDuplicateLines: {},
    mergeConnectedPaths: {},
    optimizePathOrder: {},
    controllerHost: {},
  };
  return constraints[key];
}

export function useVectorSettings() {
  // Load custom profiles from localStorage first
  const [customProfiles, setCustomProfiles] = useState<MachineProfile[]>(() =>
    loadFromStorage(PROFILES_KEY, [])
  );
  
  // Track active profile ID (which profile is selected)
  const [activeProfileId, setActiveProfileId] = useState<string | null>(() =>
    loadFromStorage(ACTIVE_PROFILE_KEY, 'default')
  );
  
  // Load initial settings from the active profile (not auto-saved)
  const [settings, setSettings] = useState<VectorSettings>(() => {
    const savedProfileId = loadFromStorage(ACTIVE_PROFILE_KEY, 'default');
    const savedCustomProfiles = loadFromStorage<MachineProfile[]>(PROFILES_KEY, []);
    const allProfiles = [...BUILT_IN_PROFILES, ...savedCustomProfiles];
    const activeProfile = allProfiles.find(p => p.id === savedProfileId);
    if (activeProfile) {
      const result = validateSettings(activeProfile.settings);
      return result.success && result.data ? result.data : DEFAULT_SETTINGS;
    }
    return DEFAULT_SETTINGS;
  });
  
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  
  // Track if settings have been modified from the active profile
  const [isDirty, setIsDirty] = useState(false);

  // Save custom profiles to localStorage (profiles persist, but not auto-save settings)
  useEffect(() => {
    saveToStorage(PROFILES_KEY, customProfiles);
  }, [customProfiles]);

  // Save active profile ID to localStorage
  useEffect(() => {
    saveToStorage(ACTIVE_PROFILE_KEY, activeProfileId);
  }, [activeProfileId]);

  // Memoized update function with validation
  const updateSetting = useCallback(<K extends keyof VectorSettings>(key: K, value: VectorSettings[K]) => {
    const result = validateSetting(key, value);

    if (result.success && result.data !== undefined) {
      setSettings(prev => ({ ...prev, [key]: result.data }));
      setValidationErrors(prev => {
        const { [key]: _, ...rest } = prev;
        return rest;
      });
      // Mark as dirty when settings change
      setIsDirty(true);
    } else if (result.errors) {
      const errorMessage = result.errors.issues[0]?.message || 'Invalid value';
      setValidationErrors(prev => ({ ...prev, [key]: errorMessage }));
    }
  }, []);

  // Update without validation (for trusted sources)
  const updateSettingUnsafe = useCallback(<K extends keyof VectorSettings>(key: K, value: VectorSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setIsDirty(true);
  }, []);

  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
    setValidationErrors({});
    setActiveProfileId('default');
    setIsDirty(false);
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

  // Get all profiles (built-in + custom)
  const allProfiles = useMemo(() => [
    ...BUILT_IN_PROFILES,
    ...customProfiles.map(p => ({ ...p, isBuiltIn: false })),
  ], [customProfiles]);

  // Load a profile
  const loadProfile = useCallback((profileId: string) => {
    const profile = [...BUILT_IN_PROFILES, ...customProfiles].find(p => p.id === profileId);
    if (profile) {
      const result = validateSettings(profile.settings);
      if (result.success && result.data) {
        setSettings(result.data);
        setValidationErrors({});
        setActiveProfileId(profileId);
        setIsDirty(false);
      }
    }
  }, [customProfiles]);

  // Save current settings as a new profile
  const saveAsProfile = useCallback((name: string) => {
    const id = `custom-${Date.now()}`;
    const now = Date.now();
    const newProfile: MachineProfile = {
      id,
      name,
      settings: { ...settings },
      createdAt: now,
      updatedAt: now,
      isBuiltIn: false,
    };
    setCustomProfiles(prev => [...prev, newProfile]);
    setActiveProfileId(id);
    setIsDirty(false);
    return id;
  }, [settings]);

  // Update an existing custom profile
  const updateProfile = useCallback((profileId: string) => {
    setCustomProfiles(prev =>
      prev.map(p =>
        p.id === profileId
          ? { ...p, settings: { ...settings }, updatedAt: Date.now() }
          : p
      )
    );
    setActiveProfileId(profileId);
    setIsDirty(false);
  }, [settings]);

  // Delete a custom profile
  const deleteProfile = useCallback((profileId: string) => {
    setCustomProfiles(prev => prev.filter(p => p.id !== profileId));
    if (activeProfileId === profileId) {
      setActiveProfileId('default');
      setSettings(DEFAULT_SETTINGS);
      setIsDirty(false);
    }
  }, [activeProfileId]);

  // Rename a custom profile
  const renameProfile = useCallback((profileId: string, newName: string) => {
    setCustomProfiles(prev =>
      prev.map(p =>
        p.id === profileId
          ? { ...p, name: newName, updatedAt: Date.now() }
          : p
      )
    );
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
    // Profile management
    profiles: allProfiles,
    activeProfileId,
    isDirty,
    loadProfile,
    saveAsProfile,
    updateProfile,
    deleteProfile,
    renameProfile,
  };
}
