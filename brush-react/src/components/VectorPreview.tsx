import { useRef, useEffect, useState, useCallback, useMemo, memo } from 'react';
import type { Path } from '../utils/drawingApi';

interface MachinePosition {
  x: number;
  y: number;
  z: number;
}

interface OutputSettings {
  targetWidth: number;
  targetHeight: number;
  offsetX: number;
  offsetY: number;
}

interface VectorPreviewProps {
  paths: Path[];
  width: number;
  height: number;
  gcodeLines?: string[];
  showSimulation?: boolean;
  machinePosition?: MachinePosition | null;
  isConnected?: boolean;
  outputSettings?: OutputSettings;
}

// Stable empty array for default prop
const EMPTY_GCODE_LINES: string[] = [];

interface GCodeMove {
  type: 'G0' | 'G1' | 'G4';
  fromX: number;
  fromY: number;
  fromZ: number;
  toX: number;
  toY: number;
  toZ: number;
  feedRate: number;
  duration: number;
  startTime: number;
}

const RAPID_SPEED = 5000;
const DEFAULT_FEED = 1600;

interface GCodePath {
  points: [number, number][];
}

interface ParsedGCode {
  moves: GCodeMove[];
  totalTime: number;
  paths: GCodePath[];
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
}

function parseGCodeToMoves(lines: string[]): ParsedGCode {
  const moves: GCodeMove[] = [];
  const paths: GCodePath[] = [];
  let currentPath: [number, number][] = [];

  let x = 0, y = 0, z = 5;
  let feedRate = DEFAULT_FEED;
  let cumulativeTime = 0;
  let penDown = false;

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith(';') || trimmed.startsWith('(') || trimmed === '%') continue;

    const isG0 = trimmed.startsWith('G0');
    const isG1 = trimmed.startsWith('G1');
    const isG4 = trimmed.startsWith('G4');

    if (isG4) {
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

    const dx = x - prevX;
    const dy = y - prevY;
    const dz = z - prevZ;
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const speed = isG0 ? RAPID_SPEED : feedRate;
    const duration = distance > 0 ? (distance / speed) * 60 : 0;

    moves.push({
      type: isG0 ? 'G0' : 'G1',
      fromX: prevX, fromY: prevY, fromZ: prevZ,
      toX: x, toY: y, toZ: z,
      feedRate: speed,
      duration,
      startTime: cumulativeTime,
    });

    cumulativeTime += duration;

    // Track pen state and build paths from drawing moves
    const wasPenDown = penDown;
    penDown = z <= 0.1;

    if (penDown) {
      // Update bounds only for drawing positions
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);

      if (!wasPenDown) {
        // Pen just went down - start new path
        if (currentPath.length > 1) {
          paths.push({ points: currentPath });
        }
        currentPath = [[x, y]];
      } else if (isG1) {
        // Continue drawing
        currentPath.push([x, y]);
      }
    } else if (wasPenDown) {
      // Pen just lifted - end current path
      if (currentPath.length > 1) {
        paths.push({ points: currentPath });
      }
      currentPath = [];
    }
  }

  // Don't forget last path
  if (currentPath.length > 1) {
    paths.push({ points: currentPath });
  }

  // Default bounds if nothing was drawn
  if (minX === Infinity) {
    minX = 0; minY = 0; maxX = 150; maxY = 120;
  }

  return {
    moves,
    totalTime: cumulativeTime,
    paths,
    bounds: { minX, minY, maxX, maxY }
  };
}

function VectorPreviewComponent({
  paths,
  width,
  height,
  gcodeLines = EMPTY_GCODE_LINES,
  showSimulation = false,
  machinePosition = null,
  isConnected = false,
  outputSettings,
}: VectorPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number | null>(null);
  const [dimensions, setDimensions] = useState({ width: 400, height: 300 });
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationProgress, setSimulationProgress] = useState(0);
  const [simulationSpeed, setSimulationSpeed] = useState(5);
  const [currentInfo, setCurrentInfo] = useState('');

  // Memoize parsed G-code moves to avoid re-parsing on every render
  const parsedGCode = useMemo((): ParsedGCode => {
    if (gcodeLines.length === 0) {
      return {
        moves: [],
        totalTime: 0,
        paths: [],
        bounds: { minX: 0, minY: 0, maxX: width, maxY: height }
      };
    }
    return parseGCodeToMoves(gcodeLines);
  }, [gcodeLines, width, height]);

  // Responsive sizing
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const w = rect.width || 400;
        const h = Math.max(Math.min(w * (height / width), 400), 200);
        setDimensions({ width: w, height: h });
      }
    };

    // Delay initial measurement to ensure container has rendered
    const timer = setTimeout(updateSize, 50);

    window.addEventListener('resize', updateSize);

    // Also observe container size changes
    const observer = new ResizeObserver(updateSize);
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', updateSize);
      observer.disconnect();
    };
  }, [width, height]);

  const drawCanvas = useCallback((simState?: { x: number; y: number; z: number; moveIndex: number }) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Use actual canvas client dimensions if dimensions state is not yet set
    const cw = dimensions.width > 10 ? dimensions.width : canvas.clientWidth || 400;
    const ch = dimensions.height > 10 ? dimensions.height : canvas.clientHeight || 300;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = cw * dpr;
    canvas.height = ch * dpr;
    ctx.scale(dpr, dpr);

    // Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, cw, ch);

    // Decide whether to render from G-code or canvas paths
    const useGCode = parsedGCode.paths.length > 0;
    const { bounds } = parsedGCode;

    // Calculate viewport - add padding around content
    const padding = 10;
    let viewMinX: number, viewMinY: number, viewMaxX: number, viewMaxY: number;

    if (useGCode) {
      // Use G-code bounds with some margin
      const margin = 5;
      viewMinX = bounds.minX - margin;
      viewMinY = bounds.minY - margin;
      viewMaxX = bounds.maxX + margin;
      viewMaxY = bounds.maxY + margin;
    } else {
      // Use canvas coordinate space
      viewMinX = 0;
      viewMinY = 0;
      viewMaxX = width;
      viewMaxY = height;
    }

    const viewWidth = viewMaxX - viewMinX;
    const viewHeight = viewMaxY - viewMinY;

    // Calculate scale to fit viewport in canvas (with padding)
    const availableWidth = cw - padding * 2;
    const availableHeight = ch - padding * 2;
    const scaleX = availableWidth / viewWidth;
    const scaleY = availableHeight / viewHeight;
    const scale = Math.min(scaleX, scaleY);

    // Helper to convert coordinates to screen space
    const toScreen = (x: number, y: number): [number, number] => {
      return [
        padding + (x - viewMinX) * scale,
        padding + (y - viewMinY) * scale
      ];
    };

    // Grid (in view coordinates)
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 0.5;
    const gridSize = 20;
    const gridStartX = Math.floor(viewMinX / gridSize) * gridSize;
    const gridStartY = Math.floor(viewMinY / gridSize) * gridSize;

    for (let gx = gridStartX; gx <= viewMaxX; gx += gridSize) {
      const [sx] = toScreen(gx, 0);
      ctx.beginPath();
      ctx.moveTo(sx, 0);
      ctx.lineTo(sx, ch);
      ctx.stroke();
    }
    for (let gy = gridStartY; gy <= viewMaxY; gy += gridSize) {
      const [, sy] = toScreen(0, gy);
      ctx.beginPath();
      ctx.moveTo(0, sy);
      ctx.lineTo(cw, sy);
      ctx.stroke();
    }

    // Draw paths
    ctx.strokeStyle = '#1e40af';
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (useGCode) {
      // Render from G-code paths (already in G-code coordinates)
      for (const gcodePath of parsedGCode.paths) {
        if (gcodePath.points.length < 2) continue;

        ctx.beginPath();
        const [sx, sy] = toScreen(gcodePath.points[0][0], gcodePath.points[0][1]);
        ctx.moveTo(sx, sy);
        for (let i = 1; i < gcodePath.points.length; i++) {
          const [px, py] = toScreen(gcodePath.points[i][0], gcodePath.points[i][1]);
          ctx.lineTo(px, py);
        }
        ctx.stroke();
      }
    } else {
      // Render from canvas paths (original behavior)
      for (const path of paths) {
        if (path.length < 2) continue;

        ctx.beginPath();
        const [sx, sy] = toScreen(path[0][0], path[0][1]);
        ctx.moveTo(sx, sy);
        for (let i = 1; i < path.length; i++) {
          const [px, py] = toScreen(path[i][0], path[i][1]);
          ctx.lineTo(px, py);
        }
        ctx.stroke();
      }
    }

    // Draw simulation state (always in G-code coordinates when useGCode)
    if (simState) {
      const penDown = simState.z <= 0.1;

      // Simulation coordinates are always G-code coordinates
      const [sx, sy] = toScreen(simState.x, simState.y);

      // Crosshair
      ctx.strokeStyle = '#00000040';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(sx, 0);
      ctx.lineTo(sx, ch);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, sy);
      ctx.lineTo(cw, sy);
      ctx.stroke();
      ctx.setLineDash([]);

      // Position marker
      ctx.fillStyle = penDown ? '#ef444440' : '#22c55e40';
      ctx.beginPath();
      ctx.arc(sx, sy, 12, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = penDown ? '#ef4444' : '#22c55e';
      ctx.beginPath();
      ctx.arc(sx, sy, 8, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = penDown ? '#dc2626' : '#16a34a';
      ctx.font = 'bold 9px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(penDown ? 'PEN DOWN' : 'PEN UP', sx, sy - 16);
    }

    // Draw realtime machine position (when connected and not simulating)
    if (!simState && isConnected && machinePosition) {
      const penDown = machinePosition.z <= 0.1;

      // Machine position is in G-code coordinates
      const [mx, my] = toScreen(machinePosition.x, machinePosition.y);

      // Crosshair
      ctx.strokeStyle = '#f59e0b40';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(mx, 0);
      ctx.lineTo(mx, ch);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, my);
      ctx.lineTo(cw, my);
      ctx.stroke();
      ctx.setLineDash([]);

      // Outer glow
      ctx.fillStyle = penDown ? '#ef444450' : '#f59e0b50';
      ctx.beginPath();
      ctx.arc(mx, my, 16, 0, Math.PI * 2);
      ctx.fill();

      // Middle ring
      ctx.fillStyle = penDown ? '#ef444480' : '#f59e0b80';
      ctx.beginPath();
      ctx.arc(mx, my, 10, 0, Math.PI * 2);
      ctx.fill();

      // Inner dot
      ctx.fillStyle = penDown ? '#ef4444' : '#f59e0b';
      ctx.beginPath();
      ctx.arc(mx, my, 6, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Label
      ctx.fillStyle = penDown ? '#dc2626' : '#d97706';
      ctx.font = 'bold 9px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(penDown ? 'PEN DOWN' : 'PEN UP', mx, my - 22);

      // Position coordinates
      ctx.fillStyle = '#ffffff';
      ctx.font = '10px monospace';
      ctx.fillText(
        `X${machinePosition.x.toFixed(1)} Y${machinePosition.y.toFixed(1)} Z${machinePosition.z.toFixed(1)}`,
        mx,
        my + 28
      );
    }

    // Stats overlay
    const pathCount = useGCode ? parsedGCode.paths.length : paths.length;
    if (pathCount > 0 && !simState) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(4, ch - 24, 120, 20);
      ctx.fillStyle = '#ffffff';
      ctx.font = '11px system-ui';
      ctx.textAlign = 'left';
      ctx.fillText(`${pathCount} paths`, 8, ch - 10);
    }
  }, [paths, dimensions, width, height, isConnected, machinePosition, parsedGCode]);

  // Regular drawing
  useEffect(() => {
    if (!isSimulating) {
      // Draw immediately
      drawCanvas();
      // Also redraw after a short delay to catch any layout changes
      const timer = setTimeout(() => drawCanvas(), 100);
      return () => clearTimeout(timer);
    }
  }, [paths, dimensions, isSimulating, drawCanvas]);

  // Redraw when machine position updates (for realtime indicator)
  useEffect(() => {
    if (!isSimulating && isConnected && machinePosition) {
      drawCanvas();
    }
  }, [machinePosition, isConnected, isSimulating, drawCanvas]);

  // Simulation - use memoized parsedGCode
  useEffect(() => {
    if (!isSimulating || parsedGCode.moves.length === 0) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      if (isSimulating && parsedGCode.moves.length === 0) {
        setIsSimulating(false);
      }
      return;
    }

    const { moves, totalTime } = parsedGCode;

    let startTimestamp: number | null = null;
    const speed = simulationSpeed * 10;

    const animate = (timestamp: number) => {
      if (startTimestamp === null) startTimestamp = timestamp;

      const elapsed = (timestamp - startTimestamp) / 1000;
      const simTime = elapsed * speed;

      setSimulationProgress(Math.min(simTime / totalTime * 100, 100));

      if (simTime >= totalTime) {
        drawCanvas();
        setIsSimulating(false);
        setSimulationProgress(100);
        setCurrentInfo('Complete');
        return;
      }

      // Find current move
      let state = { x: 0, y: 0, z: 5, moveIndex: 0 };
      for (let i = 0; i < moves.length; i++) {
        const move = moves[i];
        const endTime = move.startTime + move.duration;
        if (simTime < endTime) {
          const progress = move.duration > 0 ? (simTime - move.startTime) / move.duration : 1;
          state = {
            x: move.fromX + (move.toX - move.fromX) * progress,
            y: move.fromY + (move.toY - move.fromY) * progress,
            z: move.fromZ + (move.toZ - move.fromZ) * progress,
            moveIndex: i,
          };
          break;
        }
        state = { x: move.toX, y: move.toY, z: move.toZ, moveIndex: i + 1 };
      }

      const currentMove = moves[state.moveIndex];
      if (currentMove) {
        if (currentMove.type === 'G4') {
          setCurrentInfo(`DWELL ${currentMove.duration.toFixed(1)}s`);
        } else {
          setCurrentInfo(`${currentMove.type} X${state.x.toFixed(1)} Y${state.y.toFixed(1)}`);
        }
      }

      drawCanvas(state);
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isSimulating, parsedGCode, simulationSpeed, drawCanvas]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-sm font-medium text-slate-300">Preview</h3>
        <div className="flex items-center gap-2 text-xs">
          {showSimulation && gcodeLines.length > 0 && (
            <>
              {!isSimulating ? (
                <button
                  onClick={() => { setSimulationProgress(0); setIsSimulating(true); }}
                  className="px-2 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded flex items-center gap-1"
                >
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                  </svg>
                  Simulate
                </button>
              ) : (
                <button
                  onClick={() => setIsSimulating(false)}
                  className="px-2 py-1 bg-red-600 hover:bg-red-500 text-white rounded flex items-center gap-1"
                >
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M5.75 3A1.75 1.75 0 004 4.75v10.5c0 .966.784 1.75 1.75 1.75h8.5A1.75 1.75 0 0016 15.25V4.75A1.75 1.75 0 0014.25 3h-8.5z" />
                  </svg>
                  Stop
                </button>
              )}
              <select
                value={simulationSpeed}
                onChange={(e) => setSimulationSpeed(Number(e.target.value))}
                className="px-1 py-0.5 bg-slate-800 border border-slate-600 rounded text-slate-300"
              >
                <option value={1}>1x</option>
                <option value={3}>3x</option>
                <option value={5}>5x</option>
                <option value={10}>10x</option>
                <option value={20}>20x</option>
              </select>
            </>
          )}
        </div>
      </div>

      {isSimulating && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400 font-mono">{currentInfo}</span>
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

      <div ref={containerRef} className="bg-white rounded-lg overflow-hidden border border-slate-600 min-h-[200px]">
        <canvas
          ref={canvasRef}
          style={{ width: '100%', height: dimensions.height }}
          className="block"
        />
      </div>
    </div>
  );
}

// Memoized component to prevent unnecessary re-renders
export const VectorPreview = memo(VectorPreviewComponent, (prev, next) => {
  // Custom comparison - only re-render if meaningful props changed
  if (prev.width !== next.width) return false;
  if (prev.height !== next.height) return false;
  if (prev.showSimulation !== next.showSimulation) return false;
  if (prev.isConnected !== next.isConnected) return false;

  // Compare paths by reference first, then by length
  if (prev.paths !== next.paths) {
    if (prev.paths.length !== next.paths.length) return false;
  }

  // Compare gcodeLines by reference
  if (prev.gcodeLines !== next.gcodeLines) {
    if (prev.gcodeLines?.length !== next.gcodeLines?.length) return false;
  }

  // Compare outputSettings
  if (prev.outputSettings !== next.outputSettings) {
    if (!prev.outputSettings || !next.outputSettings) return false;
    if (
      prev.outputSettings.targetWidth !== next.outputSettings.targetWidth ||
      prev.outputSettings.targetHeight !== next.outputSettings.targetHeight ||
      prev.outputSettings.offsetX !== next.outputSettings.offsetX ||
      prev.outputSettings.offsetY !== next.outputSettings.offsetY
    ) {
      return false;
    }
  }

  // Machine position - allow some tolerance for jitter
  if (prev.machinePosition !== next.machinePosition) {
    if (!prev.machinePosition || !next.machinePosition) return false;
    const threshold = 0.1;
    if (
      Math.abs(prev.machinePosition.x - next.machinePosition.x) > threshold ||
      Math.abs(prev.machinePosition.y - next.machinePosition.y) > threshold ||
      Math.abs(prev.machinePosition.z - next.machinePosition.z) > threshold
    ) {
      return false;
    }
  }

  return true;
});
