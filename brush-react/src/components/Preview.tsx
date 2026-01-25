import { useRef, useEffect, useState, useCallback } from 'react';

interface MachinePosition {
  x: number;
  y: number;
  z: number;
}

interface PreviewProps {
  gcodeLines: string[];
  isPrinting?: boolean;
  onStopPrinting?: () => void;
  showTravelMoves?: boolean;
  machinePosition?: MachinePosition | null;
  isConnected?: boolean;
}

interface TrailPoint {
  x: number;
  y: number;
  z: number;
  timestamp: number;
}

const TRAIL_MAX_POINTS = 50;
const TRAIL_MAX_AGE_MS = 5000; // Trail fades over 5 seconds

interface GCodeMove {
  type: 'G0' | 'G1' | 'G4';
  fromX: number;
  fromY: number;
  fromZ: number;
  toX: number;
  toY: number;
  toZ: number;
  feedRate: number; // mm/min
  duration: number; // seconds
  startTime: number; // cumulative time in seconds
}

interface MachineState {
  x: number;
  y: number;
  z: number;
}

const RAPID_SPEED = 5000; // mm/min for G0
const DEFAULT_FEED = 1600; // mm/min for G1

function parseGCodeToMoves(lines: string[]): { moves: GCodeMove[]; totalTime: number } {
  const moves: GCodeMove[] = [];
  let x = 0, y = 0, z = 5;
  let feedRate = DEFAULT_FEED;
  let cumulativeTime = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith(';') || trimmed === '%') continue;

    const isG0 = trimmed.startsWith('G0');
    const isG1 = trimmed.startsWith('G1');
    const isG4 = trimmed.startsWith('G4');

    if (isG4) {
      // Dwell command - G4 P0.5 means pause for 0.5 seconds
      const pMatch = trimmed.match(/P([\d.]+)/);
      const dwellTime = pMatch ? parseFloat(pMatch[1]) : 0.5;

      moves.push({
        type: 'G4',
        fromX: x, fromY: y, fromZ: z,
        toX: x, toY: y, toZ: z,
        feedRate: 0,
        duration: dwellTime,
        startTime: cumulativeTime,
      });
      cumulativeTime += dwellTime;
      continue;
    }

    if (!isG0 && !isG1) continue;

    const prevX = x, prevY = y, prevZ = z;

    const xMatch = trimmed.match(/X(-?[\d.]+)/);
    const yMatch = trimmed.match(/Y(-?[\d.]+)/);
    const zMatch = trimmed.match(/Z(-?[\d.]+)/);
    const fMatch = trimmed.match(/F([\d.]+)/);

    if (xMatch) x = parseFloat(xMatch[1]);
    if (yMatch) y = parseFloat(yMatch[1]);
    if (zMatch) z = parseFloat(zMatch[1]);
    if (fMatch) feedRate = parseFloat(fMatch[1]);

    // Calculate distance
    const dx = x - prevX;
    const dy = y - prevY;
    const dz = z - prevZ;
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

    // Calculate duration based on speed
    const speed = isG0 ? RAPID_SPEED : feedRate;
    const duration = distance > 0 ? (distance / speed) * 60 : 0; // Convert to seconds

    moves.push({
      type: isG0 ? 'G0' : 'G1',
      fromX: prevX, fromY: prevY, fromZ: prevZ,
      toX: x, toY: y, toZ: z,
      feedRate: speed,
      duration,
      startTime: cumulativeTime,
    });

    cumulativeTime += duration;
  }

  return { moves, totalTime: cumulativeTime };
}

function getMachineStateAtTime(moves: GCodeMove[], time: number): MachineState & { moveIndex: number } {
  if (moves.length === 0) return { x: 0, y: 0, z: 5, moveIndex: 0 };

  for (let i = 0; i < moves.length; i++) {
    const move = moves[i];
    const moveEndTime = move.startTime + move.duration;

    if (time < moveEndTime) {
      // We're in this move - interpolate position
      const elapsed = time - move.startTime;
      const progress = move.duration > 0 ? elapsed / move.duration : 1;

      return {
        x: move.fromX + (move.toX - move.fromX) * progress,
        y: move.fromY + (move.toY - move.fromY) * progress,
        z: move.fromZ + (move.toZ - move.fromZ) * progress,
        moveIndex: i,
      };
    }
  }

  // Past all moves - return final position
  const lastMove = moves[moves.length - 1];
  return { x: lastMove.toX, y: lastMove.toY, z: lastMove.toZ, moveIndex: moves.length };
}

export function Preview({
  gcodeLines,
  isPrinting = false,
  onStopPrinting,
  showTravelMoves: initialShowTravel = false,
  machinePosition = null,
  isConnected = false,
}: PreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number | null>(null);
  const trailRef = useRef<TrailPoint[]>([]);
  const drawCanvasRef = useRef<((state?: MachineState & { moveIndex: number }, moves?: GCodeMove[]) => void) | null>(null);
  const [dimensions, setDimensions] = useState({ width: 600, height: 300 });
  const [showTravelMoves, setShowTravelMoves] = useState(initialShowTravel);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationProgress, setSimulationProgress] = useState(0);
  const [simulationSpeed, setSimulationSpeed] = useState(5);
  const [currentMoveInfo, setCurrentMoveInfo] = useState<string>('');

  // Responsive canvas sizing
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const width = rect.width;
        const height = Math.min(width * 0.6, 350);
        setDimensions({ width, height });
      }
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Update trail when machine position changes
  useEffect(() => {
    if (!isConnected || !machinePosition) {
      // Clear trail when disconnected
      trailRef.current = [];
      return;
    }

    const now = Date.now();
    const trail = trailRef.current;

    // Add new point if position changed significantly
    const lastPoint = trail[trail.length - 1];
    const minDistance = 0.5; // mm - minimum distance to add new point

    if (!lastPoint ||
        Math.abs(machinePosition.x - lastPoint.x) > minDistance ||
        Math.abs(machinePosition.y - lastPoint.y) > minDistance ||
        Math.abs(machinePosition.z - lastPoint.z) > minDistance) {
      trail.push({
        x: machinePosition.x,
        y: machinePosition.y,
        z: machinePosition.z,
        timestamp: now,
      });
    }

    // Remove old points
    const cutoff = now - TRAIL_MAX_AGE_MS;
    while (trail.length > 0 && trail[0].timestamp < cutoff) {
      trail.shift();
    }

    // Limit trail length
    while (trail.length > TRAIL_MAX_POINTS) {
      trail.shift();
    }
  }, [machinePosition, isConnected]);

  const drawCanvas = useCallback((state?: MachineState & { moveIndex: number }, moves?: GCodeMove[]) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = dimensions;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    // Fill entire canvas with machine bed background
    ctx.fillStyle = '#334155'; // slate-700 - represents the machine bed
    ctx.fillRect(0, 0, width, height);

    const padding = 10;
    const workWidth = 150;
    const workHeight = 140;
    const scaleX = (width - padding * 2) / workWidth;
    const scaleY = (height - padding * 2) / workHeight;
    const scale = Math.min(scaleX, scaleY);

    const offsetX = padding;
    const offsetY = padding;

    // Calculate paper dimensions
    const paperWidth = workWidth * scale;
    const paperHeight = workHeight * scale;

    // Draw paper area (white background)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(offsetX, offsetY, paperWidth, paperHeight);

    // Draw paper shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.fillRect(offsetX + 3, offsetY + paperHeight, paperWidth, 3);
    ctx.fillRect(offsetX + paperWidth, offsetY + 3, 3, paperHeight);

    // Draw grid on paper
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 0.5;

    const gridSize = 10;
    for (let gx = 0; gx <= workWidth; gx += gridSize) {
      ctx.beginPath();
      ctx.moveTo(offsetX + gx * scale, offsetY);
      ctx.lineTo(offsetX + gx * scale, offsetY + paperHeight);
      ctx.stroke();
    }

    for (let gy = 0; gy <= workHeight; gy += gridSize) {
      ctx.beginPath();
      ctx.moveTo(offsetX, offsetY + gy * scale);
      ctx.lineTo(offsetX + paperWidth, offsetY + gy * scale);
      ctx.stroke();
    }

    // Paper border
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1;
    ctx.strokeRect(offsetX, offsetY, paperWidth, paperHeight);

    // Parse moves if not provided
    const { moves: parsedMoves } = moves ? { moves } : parseGCodeToMoves(gcodeLines);
    const isAnimating = state !== undefined;
    const maxMoveIndex = state?.moveIndex ?? parsedMoves.length;

    if (parsedMoves.length === 0) {
      ctx.fillStyle = '#94a3b8';
      ctx.font = '14px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('Enter text to generate preview', width / 2, height / 2);
      return;
    }

    const penDown = (z: number) => z <= 0.1;

    // Draw completed moves
    for (let i = 0; i < maxMoveIndex && i < parsedMoves.length; i++) {
      const move = parsedMoves[i];
      if (move.type === 'G4') continue; // Skip dwell commands for drawing

      const fromX = offsetX + move.fromX * scale;
      const fromY = offsetY + (workHeight - move.fromY) * scale;
      const toX = offsetX + move.toX * scale;
      const toY = offsetY + (workHeight - move.toY) * scale;

      const isDrawing = penDown(move.toZ) && penDown(move.fromZ);

      if (isDrawing) {
        ctx.beginPath();
        ctx.moveTo(fromX, fromY);
        ctx.lineTo(toX, toY);
        ctx.strokeStyle = '#1e40af';
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.stroke();
      } else if (showTravelMoves || isAnimating) {
        ctx.beginPath();
        ctx.moveTo(fromX, fromY);
        ctx.lineTo(toX, toY);
        ctx.strokeStyle = isAnimating ? '#f87171' : '#fecaca';
        ctx.lineWidth = isAnimating ? 1 : 0.5;
        ctx.setLineDash([3, 3]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // Draw current partial move if animating
    if (state && maxMoveIndex < parsedMoves.length) {
      const move = parsedMoves[maxMoveIndex];
      if (move.type !== 'G4') {
        const fromX = offsetX + move.fromX * scale;
        const fromY = offsetY + (workHeight - move.fromY) * scale;
        const toX = offsetX + state.x * scale;
        const toY = offsetY + (workHeight - state.y) * scale;

        const isDrawing = penDown(state.z) && penDown(move.fromZ);

        ctx.beginPath();
        ctx.moveTo(fromX, fromY);
        ctx.lineTo(toX, toY);
        if (isDrawing) {
          ctx.strokeStyle = '#1e40af';
          ctx.lineWidth = 2.5;
        } else {
          ctx.strokeStyle = '#f87171';
          ctx.lineWidth = 1;
          ctx.setLineDash([3, 3]);
        }
        ctx.lineCap = 'round';
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // Draw current position marker during simulation
    if (state) {
      const curX = offsetX + state.x * scale;
      const curY = offsetY + (workHeight - state.y) * scale;

      // Draw crosshair
      ctx.strokeStyle = '#00000040';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(curX, offsetY);
      ctx.lineTo(curX, offsetY + workHeight * scale);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(offsetX, curY);
      ctx.lineTo(offsetX + workWidth * scale, curY);
      ctx.stroke();
      ctx.setLineDash([]);

      const isPenDown = penDown(state.z);

      // Outer glow
      ctx.fillStyle = isPenDown ? '#ef444440' : '#22c55e40';
      ctx.beginPath();
      ctx.arc(curX, curY, 12, 0, Math.PI * 2);
      ctx.fill();

      // Main circle
      ctx.fillStyle = isPenDown ? '#ef4444' : '#22c55e';
      ctx.beginPath();
      ctx.arc(curX, curY, 8, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(curX, curY, 2, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = isPenDown ? '#dc2626' : '#16a34a';
      ctx.font = 'bold 9px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(isPenDown ? 'PEN DOWN' : 'PEN UP', curX, curY - 16);
    }

    // Draw start marker
    if (parsedMoves.length > 0) {
      const startX = offsetX + parsedMoves[0].fromX * scale;
      const startY = offsetY + (workHeight - parsedMoves[0].fromY) * scale;
      ctx.fillStyle = '#22c55e';
      ctx.beginPath();
      ctx.arc(startX, startY, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#166534';
      ctx.font = 'bold 8px system-ui';
      ctx.textAlign = 'left';
      ctx.fillText('START', startX + 8, startY + 3);
    }

    // Draw end marker (only if not simulating or simulation complete)
    if (parsedMoves.length > 0 && (!state || maxMoveIndex >= parsedMoves.length)) {
      const lastMove = parsedMoves[parsedMoves.length - 1];
      const endX = offsetX + lastMove.toX * scale;
      const endY = offsetY + (workHeight - lastMove.toY) * scale;
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(endX, endY, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#991b1b';
      ctx.font = 'bold 8px system-ui';
      ctx.textAlign = 'left';
      ctx.fillText('END', endX + 8, endY + 3);
    }

    // Draw dip location
    ctx.fillStyle = '#8b5cf6';
    ctx.beginPath();
    const dipX = offsetX + 41 * scale;
    const dipY = offsetY + (workHeight - 5) * scale;
    ctx.arc(dipX, dipY, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#5b21b6';
    ctx.font = '7px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('INK', dipX, dipY - 6);

    // Draw trail for live position - only when connected and not simulating
    if (isConnected && !state && trailRef.current.length > 1) {
      const trail = trailRef.current;
      const now = Date.now();

      // Draw trail segments with fading opacity
      for (let i = 1; i < trail.length; i++) {
        const prev = trail[i - 1];
        const curr = trail[i];

        const age = now - curr.timestamp;
        const opacity = Math.max(0, 1 - age / TRAIL_MAX_AGE_MS);

        if (opacity <= 0) continue;

        const fromX = offsetX + prev.x * scale;
        const fromY = offsetY + (workHeight - prev.y) * scale;
        const toX = offsetX + curr.x * scale;
        const toY = offsetY + (workHeight - curr.y) * scale;

        const isPenDown = curr.z <= 0.5;

        ctx.beginPath();
        ctx.moveTo(fromX, fromY);
        ctx.lineTo(toX, toY);

        if (isPenDown) {
          // Solid line for pen down (drawing)
          ctx.strokeStyle = `rgba(6, 182, 212, ${opacity})`; // cyan, full opacity
          ctx.lineWidth = 4;
          ctx.setLineDash([]);
        } else {
          // Dashed line for pen up (travel)
          ctx.strokeStyle = `rgba(6, 182, 212, ${opacity * 0.7})`; // cyan
          ctx.lineWidth = 2;
          ctx.setLineDash([4, 4]);
        }

        ctx.lineCap = 'round';
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // Draw real machine position (from WebSocket) - only when connected and not simulating
    if (isConnected && machinePosition && !state) {
      const realX = offsetX + machinePosition.x * scale;
      const realY = offsetY + (workHeight - machinePosition.y) * scale;
      const isPenDown = machinePosition.z <= 0.5;

      // Draw crosshair for real position
      ctx.strokeStyle = '#06b6d480';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.moveTo(realX, offsetY);
      ctx.lineTo(realX, offsetY + paperHeight);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(offsetX, realY);
      ctx.lineTo(offsetX + paperWidth, realY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Outer glow
      ctx.fillStyle = isPenDown ? '#06b6d440' : '#06b6d420';
      ctx.beginPath();
      ctx.arc(realX, realY, 14, 0, Math.PI * 2);
      ctx.fill();

      // Main circle - cyan color for real position
      ctx.fillStyle = '#06b6d4';
      ctx.beginPath();
      ctx.arc(realX, realY, 8, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Inner dot
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(realX, realY, 2, 0, Math.PI * 2);
      ctx.fill();

      // Label
      ctx.fillStyle = '#06b6d4';
      ctx.font = 'bold 9px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('LIVE', realX, realY - 16);

      // Z indicator
      ctx.fillStyle = isPenDown ? '#ef4444' : '#22c55e';
      ctx.font = '8px system-ui';
      ctx.fillText(`Z${machinePosition.z.toFixed(1)}`, realX, realY + 22);
    }

  }, [gcodeLines, dimensions, showTravelMoves, machinePosition, isConnected]);

  // Keep ref updated with latest drawCanvas function
  useEffect(() => {
    drawCanvasRef.current = drawCanvas;
  }, [drawCanvas]);

  // Regular drawing (not simulating)
  useEffect(() => {
    if (!isSimulating) {
      drawCanvas();
      setCurrentMoveInfo('');
    }
  }, [gcodeLines, dimensions, showTravelMoves, isSimulating, drawCanvas, machinePosition, isConnected]);

  // Simulation animation - G-code based timing
  useEffect(() => {
    if (!isSimulating) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      return;
    }

    const { moves, totalTime } = parseGCodeToMoves(gcodeLines);
    if (moves.length === 0 || totalTime === 0) {
      setIsSimulating(false);
      return;
    }

    let startTimestamp: number | null = null;
    const realTimeMultiplier = simulationSpeed * 10; // Speed up simulation

    const animate = (timestamp: number) => {
      if (startTimestamp === null) startTimestamp = timestamp;

      const elapsedMs = timestamp - startTimestamp;
      const simulatedTime = (elapsedMs / 1000) * realTimeMultiplier;

      setSimulationProgress(Math.min(simulatedTime / totalTime * 100, 100));

      if (simulatedTime >= totalTime) {
        drawCanvasRef.current?.();
        setIsSimulating(false);
        setSimulationProgress(100);
        setCurrentMoveInfo('Complete');
        return;
      }

      const state = getMachineStateAtTime(moves, simulatedTime);
      const currentMove = moves[state.moveIndex];

      // Update move info display
      if (currentMove) {
        if (currentMove.type === 'G4') {
          setCurrentMoveInfo(`DWELL (pause ${currentMove.duration.toFixed(1)}s)`);
        } else if (currentMove.type === 'G0') {
          setCurrentMoveInfo(`G0 RAPID → X${state.x.toFixed(1)} Y${state.y.toFixed(1)}`);
        } else {
          setCurrentMoveInfo(`G1 FEED ${currentMove.feedRate}mm/min → X${state.x.toFixed(1)} Y${state.y.toFixed(1)}`);
        }
      }

      drawCanvasRef.current?.(state, moves);
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isSimulating, gcodeLines, simulationSpeed]); // Removed drawCanvas dependency

  const startSimulation = () => {
    setSimulationProgress(0);
    setIsSimulating(true);
  };

  const stopSimulation = () => {
    setIsSimulating(false);
    drawCanvasRef.current?.();
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-medium text-slate-300">Preview</h3>
          {isPrinting && (
            <span className="flex items-center gap-1.5 text-xs text-green-400">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
              Printing...
              {onStopPrinting && (
                <button
                  onClick={onStopPrinting}
                  className="ml-1 text-slate-400 hover:text-white"
                >
                  (clear)
                </button>
              )}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-500">
          {!isSimulating ? (
            <button
              onClick={startSimulation}
              disabled={gcodeLines.length === 0}
              className="px-2 py-1 bg-slate-700 hover:bg-slate-600 disabled:opacity-50
                         text-slate-300 rounded transition-colors flex items-center gap-1"
            >
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
              </svg>
              Simulate
            </button>
          ) : (
            <button
              onClick={stopSimulation}
              className="px-2 py-1 bg-red-600 hover:bg-red-500 text-white rounded transition-colors flex items-center gap-1"
            >
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path d="M5.75 3A1.75 1.75 0 004 4.75v10.5c0 .966.784 1.75 1.75 1.75h8.5A1.75 1.75 0 0016 15.25V4.75A1.75 1.75 0 0014.25 3h-8.5z" />
              </svg>
              Stop
            </button>
          )}
          <select
            value={simulationSpeed}
            onChange={e => setSimulationSpeed(Number(e.target.value))}
            className="px-1 py-0.5 bg-slate-800 border border-slate-600 rounded text-slate-300"
          >
            <option value={0.25}>0.25x</option>
            <option value={1}>1x</option>
            <option value={3}>3x</option>
            <option value={5}>5x</option>
            <option value={10}>10x</option>
            <option value={20}>20x</option>
          </select>
          <label className="flex items-center gap-1.5 cursor-pointer hover:text-slate-300">
            <input
              type="checkbox"
              checked={showTravelMoves}
              onChange={e => setShowTravelMoves(e.target.checked)}
              className="w-3 h-3 rounded border-slate-600 bg-slate-800 text-blue-500"
            />
            Travel
          </label>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-500"></span> Start
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-500"></span> End
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-purple-500"></span> Ink
          </span>
          {isConnected && (
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse"></span> Live
            </span>
          )}
        </div>
      </div>

      {isSimulating && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400 font-mono">{currentMoveInfo}</span>
            <span className="text-slate-500">{simulationProgress.toFixed(0)}%</span>
          </div>
          <div className="h-1 bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 transition-all duration-75"
              style={{ width: `${simulationProgress}%` }}
            />
          </div>
        </div>
      )}

      <div ref={containerRef} className="bg-slate-700 rounded-lg overflow-hidden border border-slate-600">
        <canvas
          ref={canvasRef}
          style={{ width: dimensions.width, height: dimensions.height }}
          className="block"
        />
      </div>
    </div>
  );
}
