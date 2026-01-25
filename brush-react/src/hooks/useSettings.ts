import { useState, useCallback } from 'react';
import type { Settings } from '../types';

const DEFAULT_SETTINGS: Settings = {
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
};

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);

  const updateSetting = useCallback(<K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  }, []);

  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
  }, []);

  return { settings, updateSetting, resetSettings };
}
