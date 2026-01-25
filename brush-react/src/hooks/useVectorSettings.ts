import { useState, useCallback } from 'react';

export interface VectorSettings {
  // Canvas (input)
  canvasWidth: number;
  canvasHeight: number;

  // Output dimensions
  targetWidth: number;
  targetHeight: number;
  offsetX: number;
  offsetY: number;

  // Machine
  feedRate: number;
  backlashX: number;
  backlashY: number;
  safeZ: number;

  // Ink
  dipInterval: number;
  dipX: number;
  dipY: number;
  continuousPlot: boolean;

  // Filter
  artefactThreshold: number;

  // Hardware
  controllerHost: string;
}

const DEFAULT_SETTINGS: VectorSettings = {
  canvasWidth: 150,
  canvasHeight: 120,

  targetWidth: 120,
  targetHeight: 100,
  offsetX: 15,
  offsetY: 20,

  feedRate: 1600,
  backlashX: 0,
  backlashY: 0,
  safeZ: 5,

  dipInterval: 80,
  dipX: 41,
  dipY: 5,
  continuousPlot: true,

  artefactThreshold: 0.1,

  controllerHost: 'http://192.168.0.248',
};

export function useVectorSettings() {
  const [settings, setSettings] = useState<VectorSettings>(DEFAULT_SETTINGS);

  const updateSetting = useCallback(<K extends keyof VectorSettings>(key: K, value: VectorSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  }, []);

  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
  }, []);

  return { settings, updateSetting, resetSettings };
}
