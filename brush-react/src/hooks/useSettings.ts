import { useState, useCallback, useEffect } from 'react';
import type { Settings, MachineProfile } from '../types';

const STORAGE_KEY = 'brush-settings';
const PROFILES_KEY = 'brush-machine-profiles';
const ACTIVE_PROFILE_KEY = 'brush-active-profile';

export const DEFAULT_SETTINGS: Settings = {
  targetWidth: 120,
  offsetX: 10,
  offsetY: 70,
  feedRate: 1600,
  backlashX: 0,
  backlashY: 0,
  safeZ: 5,
  kerning: 0.1,
  lineHeight: 1.5,
  artefactThreshold: 0.05,
  dipInterval: 50,
  dipX: 41,
  dipY: 5,
  continuousPlot: false,
  controllerHost: 'http://192.168.0.248',
  customDipSequence: '',
  // Path optimization (Clipper2)
  optimizePaths: false,
  simplifyTolerance: 0.1,
  mergeOverlapping: true,
  minSegmentLength: 0.5,
};

// Built-in machine presets
const BUILT_IN_PROFILES: Omit<MachineProfile, 'createdAt' | 'updatedAt'>[] = [
  {
    id: 'default',
    name: 'Default',
    settings: DEFAULT_SETTINGS,
  },
  {
    id: 'axidraw',
    name: 'AxiDraw V3',
    settings: {
      ...DEFAULT_SETTINGS,
      targetWidth: 280,
      feedRate: 3000,
      safeZ: 3,
      backlashX: 0,
      backlashY: 0,
      controllerHost: 'http://localhost:8080',
    },
  },
  {
    id: 'eleksdraw',
    name: 'EleksDraw',
    settings: {
      ...DEFAULT_SETTINGS,
      targetWidth: 170,
      feedRate: 2000,
      safeZ: 5,
      backlashX: 0.2,
      backlashY: 0.2,
    },
  },
  {
    id: 'plotter-large',
    name: 'Large Format Plotter',
    settings: {
      ...DEFAULT_SETTINGS,
      targetWidth: 500,
      feedRate: 4000,
      safeZ: 10,
      dipInterval: 100,
      dipX: 50,
      dipY: 10,
    },
  },
];

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

export function useSettings() {
  // Load initial settings from localStorage
  const [settings, setSettings] = useState<Settings>(() => 
    loadFromStorage(STORAGE_KEY, DEFAULT_SETTINGS)
  );
  
  // Load custom profiles from localStorage
  const [customProfiles, setCustomProfiles] = useState<MachineProfile[]>(() =>
    loadFromStorage(PROFILES_KEY, [])
  );
  
  // Track active profile ID (null means custom/modified)
  const [activeProfileId, setActiveProfileId] = useState<string | null>(() =>
    loadFromStorage(ACTIVE_PROFILE_KEY, 'default')
  );

  // Autosave settings to localStorage whenever they change
  useEffect(() => {
    saveToStorage(STORAGE_KEY, settings);
  }, [settings]);

  // Save custom profiles to localStorage
  useEffect(() => {
    saveToStorage(PROFILES_KEY, customProfiles);
  }, [customProfiles]);

  // Save active profile ID to localStorage
  useEffect(() => {
    saveToStorage(ACTIVE_PROFILE_KEY, activeProfileId);
  }, [activeProfileId]);

  const updateSetting = useCallback(<K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    // Mark as custom when settings are modified
    setActiveProfileId(null);
  }, []);

  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
    setActiveProfileId('default');
  }, []);

  // Get all profiles (built-in + custom)
  const allProfiles = [
    ...BUILT_IN_PROFILES.map(p => ({
      ...p,
      createdAt: 0,
      updatedAt: 0,
      isBuiltIn: true,
    })),
    ...customProfiles.map(p => ({ ...p, isBuiltIn: false })),
  ];

  // Load a profile
  const loadProfile = useCallback((profileId: string) => {
    const profile = allProfiles.find(p => p.id === profileId);
    if (profile) {
      setSettings(profile.settings);
      setActiveProfileId(profileId);
    }
  }, [allProfiles]);

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
    };
    setCustomProfiles(prev => [...prev, newProfile]);
    setActiveProfileId(id);
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
  }, [settings]);

  // Delete a custom profile
  const deleteProfile = useCallback((profileId: string) => {
    setCustomProfiles(prev => prev.filter(p => p.id !== profileId));
    if (activeProfileId === profileId) {
      setActiveProfileId('default');
      const defaultProfile = BUILT_IN_PROFILES.find(p => p.id === 'default');
      if (defaultProfile) {
        setSettings(defaultProfile.settings);
      }
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

  return {
    settings,
    updateSetting,
    resetSettings,
    // Profile management
    profiles: allProfiles,
    activeProfileId,
    loadProfile,
    saveAsProfile,
    updateProfile,
    deleteProfile,
    renameProfile,
  };
}
