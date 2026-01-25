import { useState, useCallback, useEffect } from 'react';
import { TextInput } from './components/TextInput';
import { SettingsPanel } from './components/SettingsPanel';
import { Preview } from './components/Preview';
import { GCodeOutput } from './components/GCodeOutput';
import { Console } from './components/Console';
import { Controls } from './components/Controls';
import { useSettings } from './hooks/useSettings';
import { useConsole } from './hooks/useConsole';
import { generateGCode } from './utils/gcodeGenerator';
import { transliterateToba, isBatakScript } from './utils/transliteration';
import { uploadGCode, runGCode, uploadAndRun, testConnection } from './utils/hardware';
import type { GeneratedGCode } from './types';

export default function App() {
  const [inputText, setInputText] = useState('tuak batak');
  const [batakPreview, setBatakPreview] = useState('');
  const [gcodeResult, setGcodeResult] = useState<GeneratedGCode | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const { settings, updateSetting, resetSettings } = useSettings();
  const { logs, log, clear } = useConsole();

  // Update Batak preview when input changes
  useEffect(() => {
    if (inputText.trim()) {
      const preview = isBatakScript(inputText) ? inputText : transliterateToba(inputText);
      setBatakPreview(preview);
    } else {
      setBatakPreview('');
    }
  }, [inputText]);

  const handleGenerate = useCallback(() => {
    clear();
    log('Generating G-code...');

    try {
      const result = generateGCode(inputText, settings);
      setGcodeResult(result);

      if (result.lines.length > 0) {
        log(`Generated ${result.lines.length} lines of G-code`, 'success');
        log(`Paths: ${result.stats.pathCount}, Scale: ${result.stats.scale.toFixed(2)}x`);
        log(`Bounds: X[${result.stats.bounds.minX.toFixed(2)}, ${result.stats.bounds.maxX.toFixed(2)}]`);
        if (result.stats.artefactsRemoved > 0) {
          log(`Removed ${result.stats.artefactsRemoved} artefacts`, 'warning');
        }
        if (result.stats.dipCount > 0) {
          log(`Dip sequences: ${result.stats.dipCount}`);
        }
      } else {
        log('No paths generated. Check input text.', 'warning');
      }
    } catch (error) {
      log(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    }
  }, [inputText, settings, log, clear]);

  // Auto-generate on initial load
  useEffect(() => {
    handleGenerate();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleUpload = useCallback(async () => {
    if (!gcodeResult?.gcode) return;

    setIsLoading(true);
    log('Uploading to controller...');

    const result = await uploadGCode(settings.controllerHost, gcodeResult.gcode, inputText);
    log(result.message, result.success ? 'success' : 'error');
    if (result.blindMode) {
      log('(Blind mode: CORS blocked response)', 'warning');
    }

    setIsLoading(false);
  }, [gcodeResult, settings.controllerHost, inputText, log]);

  const handleRun = useCallback(async () => {
    setIsLoading(true);
    log('Running G-code...');

    const result = await runGCode(settings.controllerHost, inputText);
    log(result.message, result.success ? 'success' : 'error');
    if (result.blindMode) {
      log('(Blind mode: CORS blocked response)', 'warning');
    }

    setIsLoading(false);
  }, [settings.controllerHost, inputText, log]);

  const handleUploadAndRun = useCallback(async () => {
    if (!gcodeResult?.gcode) return;

    setIsLoading(true);
    log('Uploading and running...');

    const result = await uploadAndRun(settings.controllerHost, gcodeResult.gcode, inputText);
    log(result.message, result.success ? 'success' : 'error');
    if (result.blindMode) {
      log('(Blind mode: CORS blocked response)', 'warning');
    }

    setIsLoading(false);
  }, [gcodeResult, settings.controllerHost, inputText, log]);

  const handleTest = useCallback(async () => {
    setIsLoading(true);
    log('Testing connection...');

    const result = await testConnection(settings.controllerHost);
    log(result.message, result.success ? 'success' : 'error');

    setIsLoading(false);
  }, [settings.controllerHost, log]);

  const handleDownload = useCallback(() => {
    if (!gcodeResult?.gcode) return;

    const filename = `${inputText.substring(0, 20).replace(/[^a-zA-Z0-9]/g, '_')}_batak.gcode`;
    const blob = new Blob([gcodeResult.gcode], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();

    URL.revokeObjectURL(url);
    log(`Downloaded: ${filename}`, 'success');
  }, [gcodeResult, inputText, log]);

  const handleCopy = useCallback(async () => {
    if (!gcodeResult?.gcode) return;

    try {
      await navigator.clipboard.writeText(gcodeResult.gcode);
      log('Copied to clipboard', 'success');
    } catch {
      log('Failed to copy to clipboard', 'error');
    }
  }, [gcodeResult, log]);

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">Surat Batak</h1>
            <p className="text-sm text-slate-400">Batak Script G-Code Generator</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="px-2 py-1 bg-slate-800 rounded">v2.0</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column - Input & Settings */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
              <TextInput
                value={inputText}
                onChange={setInputText}
                batakPreview={batakPreview}
              />
            </div>

            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
              <Controls
                onGenerate={handleGenerate}
                onUpload={handleUpload}
                onRun={handleRun}
                onUploadAndRun={handleUploadAndRun}
                onTest={handleTest}
                hasGCode={!!gcodeResult?.gcode}
                isLoading={isLoading}
              />
            </div>

            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
              <SettingsPanel
                settings={settings}
                onUpdate={updateSetting}
                onReset={resetSettings}
              />
            </div>
          </div>

          {/* Right Column - Preview & Output */}
          <div className="lg:col-span-8 space-y-6">
            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
              <Preview gcodeLines={gcodeResult?.lines || []} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 h-80">
                <GCodeOutput
                  result={gcodeResult}
                  onDownload={handleDownload}
                  onCopy={handleCopy}
                />
              </div>

              <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 h-80">
                <Console logs={logs} onClear={clear} />
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 mt-12">
        <div className="max-w-7xl mx-auto px-4 py-4 text-center text-xs text-slate-500">
          Batak Skeleton Assembler - Generate single-stroke G-code for Batak script plotting
        </div>
      </footer>
    </div>
  );
}
