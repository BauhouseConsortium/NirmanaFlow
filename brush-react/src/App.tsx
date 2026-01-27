import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { Allotment } from 'allotment';
import 'allotment/dist/style.css';

import { FlowEditor, type ExecutionResult as FlowExecutionResult } from './components/flow';
import { VectorPreview } from './components/VectorPreview';
import { VectorSettingsPanel } from './components/VectorSettingsPanel';
import { Toolbar } from './components/Toolbar';
import { Console } from './components/Console';
import { ConnectionIndicator } from './components/ConnectionIndicator';
import { StreamingProgress } from './components/StreamingProgress';
import { SplashScreen, useSplashScreen } from './components/SplashScreen';
import { useVectorSettings, getColorWells, type ColorWell } from './hooks/useVectorSettings';
import { useConsole } from './hooks/useConsole';
import { useFluidNC } from './hooks/useFluidNC';
import type { ColoredPath } from './utils/drawingApi';
import { generateVectorGCode, type GeneratedVectorGCode } from './utils/vectorGcodeGenerator';
import { uploadGCode } from './utils/hardware';

export default function App() {
  const [paths, setPaths] = useState<ColoredPath[]>([]);
  const [gcodeResult, setGcodeResult] = useState<GeneratedVectorGCode | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [placementMode, setPlacementMode] = useState<{ colorIndex: 1 | 2 | 3 | 4; color: string } | null>(null);

  const { settings, updateSetting, resetSettings, loadSettings } = useVectorSettings();
  const { showSplash, dismissSplash, resetSplash } = useSplashScreen();
  const colorWells = useMemo(() => getColorWells(settings), [settings]);
  const { logs, log, clear } = useConsole();
  const lastExecutionRef = useRef<FlowExecutionResult | null>(null);

  // FluidNC WebSocket connection
  const fluidNC = useFluidNC(settings.controllerHost, {
    autoConnect: false,
    autoReconnect: true,
    reconnectInterval: 5000,
  });

  // Log connection state changes
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

  // Log streaming completion
  useEffect(() => {
    const { state, errors } = fluidNC.streaming;
    if (state === 'completed') {
      if (errors.length > 0) {
        log(`Streaming completed with ${errors.length} errors`, 'warning');
      } else {
        log('Streaming completed successfully!', 'success');
      }
    } else if (state === 'error') {
      log('Streaming failed', 'error');
    }
  }, [fluidNC.streaming.state]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle flow editor changes
  const handleFlowChange = useCallback(
    (newPaths: ColoredPath[], result: FlowExecutionResult) => {
      lastExecutionRef.current = result;
      setPaths(newPaths);

      if (!result.success) {
        log(`Error: ${result.error}`, 'error');
        setGcodeResult(null);
        return;
      }

      // Generate G-code if we have paths
      if (newPaths.length > 0) {
        const gcode = generateVectorGCode(newPaths, settings);
        setGcodeResult(gcode);
      } else {
        setGcodeResult(null);
      }
    },
    [settings, log]
  );

  // Log execution stats periodically (debounced)
  const logTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (logTimeoutRef.current) {
      clearTimeout(logTimeoutRef.current);
    }

    logTimeoutRef.current = setTimeout(() => {
      if (paths.length > 0 && gcodeResult) {
        log(
          `${paths.length} paths, ${gcodeResult.lines.length} G-code lines`,
          'info'
        );
      }
    }, 1000);

    return () => {
      if (logTimeoutRef.current) {
        clearTimeout(logTimeoutRef.current);
      }
    };
  }, [paths.length, gcodeResult?.lines.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-regenerate G-code when dip-related settings change
  useEffect(() => {
    if (paths.length > 0) {
      const gcode = generateVectorGCode(paths, settings);
      setGcodeResult(gcode);
    }
  }, [
    paths,
    settings.mainColor,
    settings.dipX,
    settings.dipY,
    settings.dipInterval,
    settings.continuousPlot,
    settings.colorPaletteEnabled,
    settings.colorWell1X,
    settings.colorWell1Y,
    settings.colorWell2X,
    settings.colorWell2Y,
    settings.colorWell3X,
    settings.colorWell3Y,
    settings.colorWell4X,
    settings.colorWell4Y,
    settings.targetWidth,
    settings.targetHeight,
    settings.offsetX,
    settings.offsetY,
    settings.feedRate,
    settings.backlashX,
    settings.backlashY,
    settings.safeZ,
    settings.artefactThreshold,
    settings.clipToWorkArea,
  ]);

  const handleRun = useCallback(() => {
    // Re-generate G-code with current settings
    if (paths.length > 0) {
      setIsLoading(true);
      const gcode = generateVectorGCode(paths, settings);
      setGcodeResult(gcode);
      log(
        `G-code: ${gcode.lines.length} lines, ${gcode.stats.totalDistance.toFixed(0)}mm draw, ${gcode.stats.travelDistance.toFixed(0)}mm travel`,
        'success'
      );
      setIsLoading(false);
    }
  }, [paths, settings, log]);

  const handleExportSVG = useCallback(() => {
    if (!gcodeResult?.svg) return;

    const blob = new Blob([gcodeResult.svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'drawing.svg';
    a.click();
    URL.revokeObjectURL(url);
    log('Exported SVG', 'success');
  }, [gcodeResult, log]);

  const handleExportGCode = useCallback(() => {
    if (!gcodeResult?.gcode) return;

    const blob = new Blob([gcodeResult.gcode], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'drawing.gcode';
    a.click();
    URL.revokeObjectURL(url);
    log('Exported G-code', 'success');
  }, [gcodeResult, log]);

  const handleUpload = useCallback(async () => {
    if (!gcodeResult?.gcode) return;

    setIsLoading(true);
    log('Uploading to controller...', 'info');

    const result = await uploadGCode(settings.controllerHost, gcodeResult.gcode, 'drawing');
    log(result.message, result.success ? 'success' : 'error');

    setIsLoading(false);
  }, [gcodeResult, settings.controllerHost, log]);

  // WebSocket streaming
  const handleStream = useCallback(() => {
    if (!gcodeResult?.lines || gcodeResult.lines.length === 0) {
      log('No G-code to stream', 'error');
      return;
    }

    if (!fluidNC.isConnected) {
      log('Not connected to FluidNC. Click the connection button first.', 'error');
      return;
    }

    log(`Starting WebSocket stream (${gcodeResult.lines.length} lines)...`, 'info');
    const success = fluidNC.startStreaming(gcodeResult.lines);

    if (success) {
      log('Streaming started', 'success');
    } else {
      log('Failed to start streaming', 'error');
    }
  }, [gcodeResult, fluidNC, log]);

  // Memoize gcodeLines to prevent unnecessary re-renders of VectorPreview
  const gcodeLines = useMemo(() => gcodeResult?.lines ?? [], [gcodeResult?.lines]);

  // Memoize outputSettings to prevent object recreation on every render
  const outputSettings = useMemo(() => ({
    targetWidth: settings.targetWidth,
    targetHeight: settings.targetHeight,
    offsetX: settings.offsetX,
    offsetY: settings.offsetY,
  }), [settings.targetWidth, settings.targetHeight, settings.offsetX, settings.offsetY]);

  // Memoize colorWells for preview to prevent array recreation
  const previewColorWells = useMemo(
    () => settings.colorPaletteEnabled ? colorWells : [],
    [settings.colorPaletteEnabled, colorWells]
  );

  // Memoize streaming callbacks to prevent re-renders
  const handlePauseStreaming = useCallback(() => {
    fluidNC.pauseStreaming();
    log('Streaming paused', 'warning');
  }, [fluidNC, log]);

  const handleResumeStreaming = useCallback(() => {
    fluidNC.resumeStreaming();
    log('Streaming resumed', 'info');
  }, [fluidNC, log]);

  const handleCancelStreaming = useCallback(() => {
    fluidNC.cancelStreaming();
    log('Streaming cancelled', 'warning');
  }, [fluidNC, log]);

  // Color well placement handlers
  const handleSetColorWellPosition = useCallback((colorIndex: 1 | 2 | 3 | 4) => {
    const well = colorWells.find(w => w.id === colorIndex);
    if (well) {
      setPlacementMode({ colorIndex, color: well.color });
    }
  }, [colorWells]);

  const handlePlacementConfirm = useCallback((x: number, y: number) => {
    if (placementMode) {
      const { colorIndex } = placementMode;
      updateSetting(`colorWell${colorIndex}X` as keyof typeof settings, x);
      updateSetting(`colorWell${colorIndex}Y` as keyof typeof settings, y);
      log(`Color ${colorIndex} well position set to X:${x} Y:${y}`, 'success');
      setPlacementMode(null);
    }
  }, [placementMode, updateSetting, log, settings]);

  const handlePlacementCancel = useCallback(() => {
    setPlacementMode(null);
  }, []);

  return (
    <div className="h-screen flex flex-col bg-slate-900 text-white overflow-hidden">
      {/* Splash Screen */}
      {showSplash && <SplashScreen onDismiss={dismissSplash} />}

      {/* Header */}
      <header className="flex-shrink-0 border-b border-slate-700 bg-slate-900 z-10">
        <div className="px-4 py-2 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold text-slate-100">Nirmana Flow</h1>
            <span className="text-xs text-slate-500 hidden sm:inline">Visual algorithmic drawing</span>
            <button
              onClick={resetSplash}
              className="p-1 text-slate-500 hover:text-slate-300 transition-colors"
              title="About"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
          </div>
          <div className="flex items-center gap-3">
            <Toolbar
              onRun={handleRun}
              onExportSVG={handleExportSVG}
              onExportGCode={handleExportGCode}
              onUpload={handleUpload}
              onStream={handleStream}
              hasOutput={!!gcodeResult}
              isLoading={isLoading}
              isConnected={fluidNC.isConnected}
              isStreaming={fluidNC.isStreaming}
            />
            <div className="h-6 w-px bg-slate-700" />
            <ConnectionIndicator
              connectionState={fluidNC.status.connectionState}
              machineState={fluidNC.status.machineState}
              position={fluidNC.status.position}
              host={settings.controllerHost}
              onConnect={fluidNC.connect}
              onDisconnect={fluidNC.disconnect}
            />
          </div>
        </div>
      </header>

      {/* Main Content - Split Panes */}
      <main className="flex-1 min-h-0">
        <Allotment>
          {/* Left: Visual Flow Editor */}
          <Allotment.Pane minSize={400} preferredSize="50%">
            <div className="h-full">
              <FlowEditor onChange={handleFlowChange} />
            </div>
          </Allotment.Pane>

          {/* Right: Preview + Settings + Console */}
          <Allotment.Pane minSize={350}>
            <Allotment vertical>
              {/* Preview */}
              <Allotment.Pane minSize={200} preferredSize="55%">
                <div className="h-full p-3 overflow-auto">
                  <VectorPreview
                    paths={paths}
                    width={settings.canvasWidth}
                    height={settings.canvasHeight}
                    gcodeLines={gcodeLines}
                    showSimulation={true}
                    machinePosition={fluidNC.status.position}
                    isConnected={fluidNC.isConnected}
                    outputSettings={outputSettings}
                    clipToWorkArea={settings.clipToWorkArea}
                    placementMode={placementMode}
                    onPlacementConfirm={handlePlacementConfirm}
                    onPlacementCancel={handlePlacementCancel}
                    colorWells={previewColorWells}
                  />

                  {/* Stats */}
                  {gcodeResult && (
                    <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                      <div className="bg-slate-800/50 rounded-lg p-2 border border-slate-700">
                        <div className="text-slate-500">Paths</div>
                        <div className="text-slate-200 font-mono">{gcodeResult.stats.pathCount}</div>
                      </div>
                      <div className="bg-slate-800/50 rounded-lg p-2 border border-slate-700">
                        <div className="text-slate-500">Draw Dist</div>
                        <div className="text-slate-200 font-mono">{gcodeResult.stats.totalDistance.toFixed(0)}mm</div>
                      </div>
                      <div className="bg-slate-800/50 rounded-lg p-2 border border-slate-700">
                        <div className="text-slate-500">Travel</div>
                        <div className="text-slate-200 font-mono">{gcodeResult.stats.travelDistance.toFixed(0)}mm</div>
                      </div>
                      <div className="bg-slate-800/50 rounded-lg p-2 border border-slate-700">
                        <div className="text-slate-500">G-code Lines</div>
                        <div className="text-slate-200 font-mono">{gcodeResult.lines.length}</div>
                      </div>
                    </div>
                  )}

                  {/* Streaming Progress */}
                  {fluidNC.streaming.state !== 'idle' && (
                    <div className="mt-3">
                      <StreamingProgress
                        streaming={fluidNC.streaming}
                        onPause={handlePauseStreaming}
                        onResume={handleResumeStreaming}
                        onCancel={handleCancelStreaming}
                      />
                    </div>
                  )}
                </div>
              </Allotment.Pane>

              {/* Settings + Console */}
              <Allotment.Pane minSize={150}>
                <Allotment>
                  <Allotment.Pane minSize={200} preferredSize="50%">
                    <div className="h-full p-3 overflow-auto">
                      <VectorSettingsPanel
                        settings={settings}
                        onUpdate={updateSetting}
                        onReset={resetSettings}
                        onLoad={loadSettings}
                        onSetColorWellPosition={handleSetColorWellPosition}
                        onJogToPosition={fluidNC.goToXY}
                        isConnected={fluidNC.isConnected}
                      />
                    </div>
                  </Allotment.Pane>
                  <Allotment.Pane minSize={200}>
                    <div className="h-full p-3">
                      <div className="h-full bg-slate-800/50 rounded-lg border border-slate-700 overflow-hidden">
                        <Console logs={logs} onClear={clear} />
                      </div>
                    </div>
                  </Allotment.Pane>
                </Allotment>
              </Allotment.Pane>
            </Allotment>
          </Allotment.Pane>
        </Allotment>
      </main>
    </div>
  );
}
