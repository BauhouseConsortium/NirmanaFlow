import { useState, useCallback, useEffect } from 'react';
import { TextInput } from './components/TextInput';
import { SettingsPanel } from './components/SettingsPanel';
import { Preview } from './components/Preview';
import { GCodeOutput } from './components/GCodeOutput';
import { Console } from './components/Console';
import { Controls } from './components/Controls';
import { ConnectionIndicator } from './components/ConnectionIndicator';
import { JogControl } from './components/JogControl';
import { StreamingProgress } from './components/StreamingProgress';
import { MacroPanel } from './components/MacroPanel';
import { useSettings } from './hooks/useSettings';
import { useConsole } from './hooks/useConsole';
import { useFluidNC } from './hooks/useFluidNC';
import { generateGCode } from './utils/gcodeGenerator';
import { transliterateToba, isBatakScript } from './utils/transliteration';
import { uploadGCode, runGCode, uploadAndRun, testConnection } from './utils/hardware';
import type { GeneratedGCode } from './types';

export default function App() {
  const [inputText, setInputText] = useState('tuak batak');
  const [batakPreview, setBatakPreview] = useState('');
  const [gcodeResult, setGcodeResult] = useState<GeneratedGCode | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  const { settings, updateSetting, resetSettings } = useSettings();
  const { logs, log, clear } = useConsole();
  const fluidNC = useFluidNC(settings.controllerHost, {
    autoConnect: false,
    autoReconnect: true,
    reconnectInterval: 5000,
  });

  // Update Batak preview when input changes
  useEffect(() => {
    if (inputText.trim()) {
      const preview = isBatakScript(inputText) ? inputText : transliterateToba(inputText);
      setBatakPreview(preview);
    } else {
      setBatakPreview('');
    }
  }, [inputText]);

  // Log FluidNC connection state changes
  useEffect(() => {
    const { connectionState, lastError } = fluidNC.status;

    if (connectionState === 'connected') {
      log(`WebSocket connected to ${settings.controllerHost}:81`, 'success');
    } else if (connectionState === 'connecting') {
      log(`Connecting to ${settings.controllerHost}:81...`, 'info');
    } else if (connectionState === 'error' && lastError) {
      log(`Connection error: ${lastError}`, 'error');
    }
  }, [fluidNC.status.connectionState]); // eslint-disable-line react-hooks/exhaustive-deps

  // Log machine state changes
  useEffect(() => {
    const { machineState, connectionState } = fluidNC.status;
    if (connectionState === 'connected' && machineState !== 'Unknown') {
      log(`Machine state: ${machineState}`, 'info');
    }
  }, [fluidNC.status.machineState]); // eslint-disable-line react-hooks/exhaustive-deps

  // Log streaming completion
  useEffect(() => {
    const { state, errors } = fluidNC.streaming;
    if (state === 'completed') {
      setIsPrinting(false);
      if (errors.length > 0) {
        log(`Streaming completed with ${errors.length} errors`, 'warning');
      } else {
        log('Streaming completed successfully!', 'success');
      }
    } else if (state === 'error') {
      setIsPrinting(false);
      log('Streaming failed', 'error');
    }
  }, [fluidNC.streaming.state]); // eslint-disable-line react-hooks/exhaustive-deps

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

    if (result.success) {
      setIsPrinting(true);
      log('Printing started - preview shows expected output', 'info');
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

    if (result.success) {
      setIsPrinting(true);
      log('Printing started - preview shows expected output', 'info');
    }

    setIsLoading(false);
  }, [gcodeResult, settings.controllerHost, inputText, log]);

  const handleStopPrinting = useCallback(() => {
    setIsPrinting(false);
    log('Printing status cleared', 'info');
  }, [log]);

  // WebSocket streaming handler
  const handleStream = useCallback(() => {
    if (!gcodeResult?.lines || gcodeResult.lines.length === 0) {
      log('No G-code to stream', 'error');
      return;
    }

    if (!fluidNC.isConnected) {
      log('Not connected to FluidNC', 'error');
      return;
    }

    log(`Starting WebSocket stream (${gcodeResult.lines.length} lines)...`, 'info');
    const success = fluidNC.startStreaming(gcodeResult.lines);

    if (success) {
      setIsPrinting(true);
      log('Streaming started', 'success');
    } else {
      log('Failed to start streaming', 'error');
    }
  }, [gcodeResult, fluidNC, log]);

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
    <div className="h-screen flex flex-col bg-slate-900 text-white overflow-hidden">
      {/* Header */}
      <header className="flex-shrink-0 border-b border-slate-800 bg-slate-900/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold">Surat Batak</h1>
            <span className="text-xs text-slate-500 hidden sm:inline">Batak Script G-Code Generator</span>
          </div>
          <div className="flex items-center gap-3">
            <ConnectionIndicator
              connectionState={fluidNC.status.connectionState}
              machineState={fluidNC.status.machineState}
              position={fluidNC.status.position}
              host={settings.controllerHost}
              onConnect={fluidNC.connect}
              onDisconnect={fluidNC.disconnect}
            />
            <span className="px-2 py-0.5 text-xs bg-slate-800 text-slate-500 rounded">v2.0</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 min-h-0 max-w-7xl w-full mx-auto px-4 py-4">
        <div className="h-full grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Left Column - Input & Settings */}
          <div className="lg:col-span-4 flex flex-col gap-4 overflow-y-auto">
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
                onStream={handleStream}
                onTest={handleTest}
                hasGCode={!!gcodeResult?.gcode}
                isLoading={isLoading}
                isConnected={fluidNC.isConnected}
                isStreaming={fluidNC.isStreaming}
              />
            </div>

            {/* Streaming Progress */}
            {fluidNC.streaming.state !== 'idle' && (
              <StreamingProgress
                streaming={fluidNC.streaming}
                onPause={() => {
                  fluidNC.pauseStreaming();
                  log('Streaming paused', 'warning');
                }}
                onResume={() => {
                  fluidNC.resumeStreaming();
                  log('Streaming resumed', 'info');
                }}
                onCancel={() => {
                  fluidNC.cancelStreaming();
                  setIsPrinting(false);
                  log('Streaming cancelled', 'warning');
                }}
              />
            )}

            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
              <JogControl
                isConnected={fluidNC.isConnected}
                machineState={fluidNC.status.machineState}
                position={fluidNC.status.position}
                onJog={(axis, distance) => {
                  fluidNC.jog(axis, distance);
                  log(`Jog ${axis}${distance > 0 ? '+' : ''}${distance}mm`, 'info');
                }}
                onHome={() => {
                  fluidNC.home();
                  log('Homing all axes...', 'info');
                }}
                onUnlock={() => {
                  fluidNC.unlock();
                  log('Unlocking machine...', 'warning');
                }}
                onSetZero={() => {
                  fluidNC.setZero();
                  log('Work position set to zero', 'success');
                }}
                onGoToZero={() => {
                  fluidNC.goToZero();
                  log('Moving to X0 Y0...', 'info');
                }}
                onStop={() => {
                  fluidNC.stop();
                  log('Emergency stop!', 'error');
                }}
              />
            </div>

            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
              <MacroPanel
                isConnected={fluidNC.isConnected}
                isStreaming={fluidNC.isStreaming}
                onRunMacro={(gcode) => {
                  log(`Running macro (${gcode.length} commands)...`, 'info');
                  // Send each line sequentially
                  gcode.forEach((line, i) => {
                    setTimeout(() => {
                      fluidNC.send(line);
                    }, i * 100); // Small delay between commands
                  });
                }}
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
          <div className="lg:col-span-8 flex flex-col gap-4 min-h-0">
            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 flex-shrink-0">
              <Preview
                gcodeLines={gcodeResult?.lines || []}
                isPrinting={isPrinting}
                onStopPrinting={handleStopPrinting}
                machinePosition={fluidNC.status.position}
                isConnected={fluidNC.isConnected}
              />
            </div>

            <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 flex flex-col min-h-0">
                <GCodeOutput
                  result={gcodeResult}
                  onDownload={handleDownload}
                  onCopy={handleCopy}
                />
              </div>

              <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 flex flex-col min-h-0">
                <Console logs={logs} onClear={clear} />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
