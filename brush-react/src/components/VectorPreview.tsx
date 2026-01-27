import { useRef, useEffect, useState, useCallback, useMemo, memo } from 'react';
import type { ColoredPath } from '../utils/drawingApi';

// Default colors for the 4 color wells (matches VectorSettings defaults)
const COLOR_WELL_DEFAULTS = ['#1e40af', '#dc2626', '#16a34a', '#171717'];

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

interface ColorWellPlacement {
  colorIndex: 1 | 2 | 3 | 4;
  color: string;
}

interface ColorWell {
  id: 1 | 2 | 3 | 4;
  x: number;
  y: number;
  color: string;
}

interface VectorPreviewProps {
  paths: ColoredPath[];
  width: number;
  height: number;
  gcodeLines?: string[];
  showSimulation?: boolean;
  machinePosition?: MachinePosition | null;
  isConnected?: boolean;
  outputSettings?: OutputSettings;
  clipToWorkArea?: boolean;
  // Color well placement mode
  placementMode?: ColorWellPlacement | null;
  onPlacementConfirm?: (x: number, y: number) => void;
  onPlacementCancel?: () => void;
  colorWells?: ColorWell[];
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

interface DipPoint {
  x: number;
  y: number;
  afterPathIndex: number; // Which path this dip occurs after
}

interface ParsedGCode {
  moves: GCodeMove[];
  totalTime: number;
  paths: GCodePath[];
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
  dipPoints: DipPoint[];
  dipWellPosition: { x: number; y: number } | null;
}

function parseGCodeToMoves(lines: string[]): ParsedGCode {
  const moves: GCodeMove[] = [];
  const paths: GCodePath[] = [];
  const dipPoints: DipPoint[] = [];
  let currentPath: [number, number][] = [];

  let x = 0, y = 0, z = 5;
  let feedRate = DEFAULT_FEED;
  let cumulativeTime = 0;
  let penDown = false;
  let nextIsDip = false;
  let dipWellPosition: { x: number; y: number } | null = null;

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed === '%') continue;

    // Check for dip comments
    if (trimmed.startsWith('(') && trimmed.includes('Dip #')) {
      nextIsDip = true;
      continue;
    }

    if (trimmed.startsWith(';') || trimmed.startsWith('(')) continue;

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

    // Capture dip position (G0 after dip comment)
    if (nextIsDip && isG0 && xMatch && yMatch) {
      dipWellPosition = { x, y };
      dipPoints.push({
        x,
        y,
        afterPathIndex: paths.length - 1, // Dip occurs after current path count
      });
      nextIsDip = false;
    }

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
    bounds: { minX, minY, maxX, maxY },
    dipPoints,
    dipWellPosition,
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
  clipToWorkArea = false,
  placementMode = null,
  onPlacementConfirm,
  onPlacementCancel,
  colorWells = [],
}: VectorPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoverPosition, setHoverPosition] = useState<{ x: number; y: number } | null>(null);
  const [clickedPosition, setClickedPosition] = useState<{ x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number | null>(null);
  const [dimensions, setDimensions] = useState({ width: 400, height: 300 });
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationProgress, setSimulationProgress] = useState(0);
  const [simulationSpeed, setSimulationSpeed] = useState(5);
  const [currentInfo, setCurrentInfo] = useState('');
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [showWorkArea, setShowWorkArea] = useState(true);
  const [showInkDips, setShowInkDips] = useState(true);
  const [panMode, setPanMode] = useState(false);
  const isPanningRef = useRef(false);
  const lastPanPosRef = useRef({ x: 0, y: 0 });

  // Memoize parsed G-code moves to avoid re-parsing on every render
  const parsedGCode = useMemo((): ParsedGCode => {
    if (gcodeLines.length === 0) {
      return {
        moves: [],
        totalTime: 0,
        paths: [],
        bounds: { minX: 0, minY: 0, maxX: width, maxY: height },
        dipPoints: [],
        dipWellPosition: null,
      };
    }
    return parseGCodeToMoves(gcodeLines);
  }, [gcodeLines, width, height]);

  // Track last dimensions to avoid unnecessary updates
  const lastDimensionsRef = useRef({ width: 0, height: 0 });

  // Responsive sizing - with proper debouncing to prevent loops
  useEffect(() => {
    let rafId: number | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const updateSize = () => {
      // Debounce with timeout to prevent rapid updates
      if (timeoutId) clearTimeout(timeoutId);
      if (rafId) cancelAnimationFrame(rafId);

      timeoutId = setTimeout(() => {
        rafId = requestAnimationFrame(() => {
          if (containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            const w = Math.floor(rect.width) || 400;
            // Use container height directly - the flex layout should give us proper height
            const h = Math.floor(rect.height) || Math.max(Math.floor(w * (height / width)), 200);

            // Only update if dimensions changed by more than 2px (prevents resize loops)
            const lastW = lastDimensionsRef.current.width;
            const lastH = lastDimensionsRef.current.height;
            if (Math.abs(w - lastW) > 2 || Math.abs(h - lastH) > 2) {
              lastDimensionsRef.current = { width: w, height: h };
              setDimensions({ width: w, height: h });
            }
          }
        });
      }, 100); // 100ms debounce
    };

    // Delay initial measurement to ensure container has rendered
    const timer = setTimeout(updateSize, 100);

    window.addEventListener('resize', updateSize);

    // Also observe container size changes - but only for significant changes
    const observer = new ResizeObserver(updateSize);
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => {
      clearTimeout(timer);
      if (timeoutId) clearTimeout(timeoutId);
      if (rafId) cancelAnimationFrame(rafId);
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
    const targetWidth = Math.floor(cw * dpr);
    const targetHeight = Math.floor(ch * dpr);

    // Only resize canvas if dimensions actually changed (avoids GPU thrashing)
    if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
      canvas.width = targetWidth;
      canvas.height = targetHeight;
    }

    // Reset transform and scale for drawing
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);

    // Clear any stray state
    ctx.setLineDash([]);
    ctx.beginPath();

    // Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, cw, ch);

    // Decide whether to render from G-code or canvas paths
    const useGCode = parsedGCode.paths.length > 0;
    const { bounds } = parsedGCode;

    // Calculate viewport based on coordinate space being used
    const padding = 10;
    let viewMinX: number, viewMinY: number, viewMaxX: number, viewMaxY: number;

    if (useGCode && outputSettings) {
      // G-code paths exist: show machine coordinate space (origin to work area bounds)
      const margin = 5;
      const workAreaMaxX = outputSettings.offsetX + outputSettings.targetWidth;
      const workAreaMaxY = outputSettings.offsetY + outputSettings.targetHeight;

      viewMinX = -margin;
      viewMinY = -margin;
      viewMaxX = workAreaMaxX + margin;
      viewMaxY = workAreaMaxY + margin;
    } else if (useGCode) {
      // G-code paths but no outputSettings: use G-code bounds
      const margin = 5;
      viewMinX = bounds.minX - margin;
      viewMinY = bounds.minY - margin;
      viewMaxX = bounds.maxX + margin;
      viewMaxY = bounds.maxY + margin;
    } else {
      // No G-code: use canvas coordinate space for canvas paths
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
    const baseScale = Math.min(scaleX, scaleY);
    const scale = baseScale * zoomLevel;

    // Calculate centering offsets (with pan)
    const scaledWidth = viewWidth * scale;
    const scaledHeight = viewHeight * scale;
    const offsetX = padding + (availableWidth - scaledWidth) / 2 + panOffset.x;
    const offsetY = padding + (availableHeight - scaledHeight) / 2 + panOffset.y;

    // Helper to convert coordinates to screen space
    const toScreen = (x: number, y: number): [number, number] => {
      return [
        offsetX + (x - viewMinX) * scale,
        offsetY + (y - viewMinY) * scale
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

    // Draw work area border (only when showing G-code in machine coordinates)
    if (outputSettings && useGCode) {
      const { targetWidth, targetHeight, offsetX, offsetY } = outputSettings;
      const [waX1, waY1] = toScreen(offsetX, offsetY);
      const [waX2, waY2] = toScreen(offsetX + targetWidth, offsetY + targetHeight);

      // Draw border if enabled
      if (showWorkArea) {
        ctx.setLineDash([6, 4]);
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.rect(waX1, waY1, waX2 - waX1, waY2 - waY1);
        ctx.stroke();
        ctx.setLineDash([]);

        // Work area label
        ctx.fillStyle = '#3b82f6';
        ctx.font = '10px system-ui';
        ctx.textAlign = 'left';
        ctx.fillText(`${targetWidth}×${targetHeight}mm`, waX1 + 4, waY1 - 4);
      }

      // Apply canvas clipping if enabled (independent of border visibility)
      if (clipToWorkArea) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(waX1, waY1, waX2 - waX1, waY2 - waY1);
        ctx.clip();
      }
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
      // Render from canvas paths (with colors when available)
      for (const coloredPath of paths) {
        if (coloredPath.points.length < 2) continue;

        // Determine stroke color based on path's color property
        let strokeColor = '#1e40af'; // Default blue
        if (coloredPath.color && colorWells.length > 0) {
          // Use color from colorWells if available
          const well = colorWells.find(w => w.id === coloredPath.color);
          if (well) {
            strokeColor = well.color;
          } else {
            // Fallback to default color array
            strokeColor = COLOR_WELL_DEFAULTS[coloredPath.color - 1] || '#1e40af';
          }
        } else if (coloredPath.color) {
          // Use default colors when no color wells configured
          strokeColor = COLOR_WELL_DEFAULTS[coloredPath.color - 1] || '#1e40af';
        }

        ctx.strokeStyle = strokeColor;
        ctx.beginPath();
        const [sx, sy] = toScreen(coloredPath.points[0][0], coloredPath.points[0][1]);
        ctx.moveTo(sx, sy);
        for (let i = 1; i < coloredPath.points.length; i++) {
          const [px, py] = toScreen(coloredPath.points[i][0], coloredPath.points[i][1]);
          ctx.lineTo(px, py);
        }
        ctx.stroke();
      }
    }

    // Restore canvas state if clipping was applied
    if (outputSettings && useGCode && clipToWorkArea) {
      ctx.restore();
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

    // Draw ink well and dip markers
    if (showInkDips && parsedGCode.dipPoints.length > 0 && parsedGCode.dipWellPosition) {
      const { dipWellPosition, dipPoints } = parsedGCode;
      const gcodePaths = parsedGCode.paths;

      // Draw dip markers at the end of strokes that trigger dips
      for (let i = 0; i < dipPoints.length; i++) {
        const dip = dipPoints[i];
        const pathIndex = dip.afterPathIndex;

        // Get the end point of the path that triggered this dip
        if (pathIndex >= 0 && pathIndex < gcodePaths.length) {
          const path = gcodePaths[pathIndex];
          const lastPoint = path.points[path.points.length - 1];
          const [dx, dy] = toScreen(lastPoint[0], lastPoint[1]);

          // Draw small purple diamond marker
          ctx.fillStyle = '#6366f180';
          ctx.beginPath();
          ctx.moveTo(dx, dy - 6);
          ctx.lineTo(dx + 6, dy);
          ctx.lineTo(dx, dy + 6);
          ctx.lineTo(dx - 6, dy);
          ctx.closePath();
          ctx.fill();

          ctx.strokeStyle = '#6366f1';
          ctx.lineWidth = 1.5;
          ctx.stroke();

          // Draw dip number
          ctx.fillStyle = '#6366f1';
          ctx.font = 'bold 8px system-ui';
          ctx.textAlign = 'center';
          ctx.fillText(`${i + 1}`, dx, dy + 3);
        }
      }

      // Draw ink well icon
      const [wellX, wellY] = toScreen(dipWellPosition.x, dipWellPosition.y);
      ctx.fillStyle = '#6366f1';
      ctx.beginPath();
      ctx.arc(wellX, wellY, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Draw drop icon inside
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(wellX, wellY - 4);
      ctx.quadraticCurveTo(wellX + 4, wellY + 2, wellX, wellY + 5);
      ctx.quadraticCurveTo(wellX - 4, wellY + 2, wellX, wellY - 4);
      ctx.fill();

      // Label
      ctx.fillStyle = '#6366f1';
      ctx.font = 'bold 9px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(`${dipPoints.length} dips`, wellX, wellY + 18);
    }

    // Draw color wells (when multi-color mode is enabled)
    if (showInkDips && colorWells.length > 0) {
      for (const well of colorWells) {
        const [wx, wy] = toScreen(well.x, well.y);

        // Draw well circle
        ctx.fillStyle = well.color + '80';
        ctx.beginPath();
        ctx.arc(wx, wy, 10, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = well.color;
        ctx.beginPath();
        ctx.arc(wx, wy, 6, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Label
        ctx.fillStyle = well.color;
        ctx.font = 'bold 9px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText(`${well.id}`, wx, wy + 20);
      }
    }

    // Draw placement marker (when in placement mode)
    if (placementMode && (clickedPosition || hoverPosition)) {
      const pos = clickedPosition || hoverPosition!;
      const [px, py] = toScreen(pos.x, pos.y);

      // Crosshair
      ctx.strokeStyle = placementMode.color;
      ctx.lineWidth = 2;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(px - 15, py);
      ctx.lineTo(px + 15, py);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(px, py - 15);
      ctx.lineTo(px, py + 15);
      ctx.stroke();

      // Circle
      ctx.fillStyle = placementMode.color + '60';
      ctx.beginPath();
      ctx.arc(px, py, 12, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = placementMode.color;
      ctx.lineWidth = 2;
      ctx.stroke();

      if (clickedPosition) {
        // Confirmed marker - inner dot
        ctx.fillStyle = placementMode.color;
        ctx.beginPath();
        ctx.arc(px, py, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Stats overlay
    const pathCount = useGCode ? parsedGCode.paths.length : paths.length;
    const dipCount = parsedGCode.dipPoints.length;
    if (pathCount > 0 && !simState) {
      const statsText = dipCount > 0 ? `${pathCount} paths · ${dipCount} dips` : `${pathCount} paths`;
      const statsWidth = dipCount > 0 ? 150 : 80;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(4, ch - 24, statsWidth, 20);
      ctx.fillStyle = '#ffffff';
      ctx.font = '11px system-ui';
      ctx.textAlign = 'left';
      ctx.fillText(statsText, 8, ch - 10);
    }
  }, [paths, dimensions, width, height, isConnected, machinePosition, parsedGCode, colorWells, placementMode, clickedPosition, hoverPosition, outputSettings, clipToWorkArea, zoomLevel, panOffset, showWorkArea, showInkDips]);

  // Store drawCanvas in a ref to avoid dependency loops
  const drawCanvasRef = useRef(drawCanvas);
  drawCanvasRef.current = drawCanvas;

  // Track if a redraw is already scheduled to prevent multiple frames
  const redrawScheduledRef = useRef(false);
  const scheduleRedraw = useCallback((simState?: { x: number; y: number; z: number; moveIndex: number }) => {
    if (redrawScheduledRef.current) return;
    redrawScheduledRef.current = true;
    requestAnimationFrame(() => {
      redrawScheduledRef.current = false;
      drawCanvasRef.current(simState);
    });
  }, []);

  // Regular drawing - only redraw when actual data changes
  useEffect(() => {
    if (!isSimulating) {
      scheduleRedraw();
    }
  }, [paths, dimensions, isSimulating, parsedGCode, scheduleRedraw]);

  // Redraw when placement state changes
  useEffect(() => {
    if (!isSimulating && (placementMode || colorWells.length > 0)) {
      scheduleRedraw();
    }
  }, [placementMode, colorWells, clickedPosition, hoverPosition, isSimulating, scheduleRedraw]);

  // Redraw when zoom, pan, or display settings change
  useEffect(() => {
    if (!isSimulating) {
      scheduleRedraw();
    }
  }, [zoomLevel, panOffset, showWorkArea, showInkDips, isSimulating, scheduleRedraw]);

  // Redraw when machine position updates (for realtime indicator)
  useEffect(() => {
    if (!isSimulating && isConnected && machinePosition) {
      scheduleRedraw();
    }
  }, [machinePosition, isConnected, isSimulating, scheduleRedraw]);

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
        scheduleRedraw();
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

      // During simulation, draw directly without throttling for smooth animation
      drawCanvasRef.current(state);
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isSimulating, parsedGCode, simulationSpeed, scheduleRedraw]);

  return (
    <div className="h-full flex flex-col gap-2">
      <div className="flex-shrink-0 flex items-center justify-between flex-wrap gap-2">
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
                <option value={0.25}>0.25x</option>
                <option value={0.5}>0.5x</option>
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
        <div className="flex-shrink-0 space-y-1">
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

      <div
        ref={containerRef}
        className={`flex-1 min-h-0 bg-white rounded-lg overflow-hidden border relative ${
          placementMode ? 'border-purple-500 border-2 cursor-crosshair' :
          panMode ? 'border-slate-600 cursor-grab active:cursor-grabbing' : 'border-slate-600'
        }`}
        onWheel={(e) => {
          if (placementMode) return;
          e.preventDefault();
          const delta = e.deltaY > 0 ? 0.9 : 1.1;
          setZoomLevel(z => Math.max(0.25, Math.min(10, z * delta)));
        }}
        onMouseDown={(e) => {
          // Middle mouse button, alt+left click, or pan mode left click for panning
          if (placementMode) return;
          if (e.button === 1 || (e.button === 0 && e.altKey) || (e.button === 0 && panMode)) {
            e.preventDefault();
            isPanningRef.current = true;
            lastPanPosRef.current = { x: e.clientX, y: e.clientY };
          }
        }}
        onMouseUp={() => {
          isPanningRef.current = false;
        }}
        onMouseLeave={() => {
          isPanningRef.current = false;
        }}
        onMouseMove={(e) => {
          // Handle panning
          if (isPanningRef.current) {
            const dx = e.clientX - lastPanPosRef.current.x;
            const dy = e.clientY - lastPanPosRef.current.y;
            setPanOffset(p => ({ x: p.x + dx, y: p.y + dy }));
            lastPanPosRef.current = { x: e.clientX, y: e.clientY };
            return;
          }
          // Original placement mode logic
          if (!placementMode || !canvasRef.current || !outputSettings) return;
          const rect = canvasRef.current.getBoundingClientRect();
          const mouseX = e.clientX - rect.left;
          const mouseY = e.clientY - rect.top;
          // Convert screen coords to G-code coords (must match drawCanvas calculations EXACTLY)
          const padding = 10;
          const cw = dimensions.width;
          const ch = dimensions.height;
          const useGCode = parsedGCode.paths.length > 0;
          const bounds = parsedGCode.bounds;
          // Must match drawCanvas conditional logic EXACTLY
          let viewMinX: number, viewMinY: number, viewMaxX: number, viewMaxY: number;
          if (useGCode && outputSettings) {
            // G-code paths exist: show machine coordinate space (origin to work area bounds)
            const margin = 5;
            const workAreaMaxX = outputSettings.offsetX + outputSettings.targetWidth;
            const workAreaMaxY = outputSettings.offsetY + outputSettings.targetHeight;
            viewMinX = -margin;
            viewMinY = -margin;
            viewMaxX = workAreaMaxX + margin;
            viewMaxY = workAreaMaxY + margin;
          } else if (useGCode) {
            // G-code paths but no outputSettings: use G-code bounds
            const margin = 5;
            viewMinX = bounds.minX - margin;
            viewMinY = bounds.minY - margin;
            viewMaxX = bounds.maxX + margin;
            viewMaxY = bounds.maxY + margin;
          } else {
            // No G-code: use canvas coordinate space for canvas paths
            viewMinX = 0;
            viewMinY = 0;
            viewMaxX = width;
            viewMaxY = height;
          }
          const viewWidth = viewMaxX - viewMinX;
          const viewHeight = viewMaxY - viewMinY;
          const availableWidth = cw - padding * 2;
          const availableHeight = ch - padding * 2;
          const baseScale = Math.min(availableWidth / viewWidth, availableHeight / viewHeight);
          const scale = baseScale * zoomLevel;
          // Calculate centering offsets (must match drawCanvas with zoom/pan)
          const scaledWidth = viewWidth * scale;
          const scaledHeight = viewHeight * scale;
          const offsetX = padding + (availableWidth - scaledWidth) / 2 + panOffset.x;
          const offsetY = padding + (availableHeight - scaledHeight) / 2 + panOffset.y;
          const gcodeX = ((mouseX - offsetX) / scale) + viewMinX;
          const gcodeY = ((mouseY - offsetY) / scale) + viewMinY;
          setHoverPosition({ x: Math.round(gcodeX), y: Math.round(gcodeY) });
        }}
        onMouseLeave={() => {
          setHoverPosition(null);
          isPanningRef.current = false;
        }}
        onClick={(e) => {
          if (!placementMode || !canvasRef.current || !outputSettings) return;
          const rect = canvasRef.current.getBoundingClientRect();
          const mouseX = e.clientX - rect.left;
          const mouseY = e.clientY - rect.top;
          // Convert screen coords to G-code coords (must match drawCanvas calculations EXACTLY)
          const padding = 10;
          const cw = dimensions.width;
          const ch = dimensions.height;
          const useGCode = parsedGCode.paths.length > 0;
          const bounds = parsedGCode.bounds;
          // Must match drawCanvas conditional logic EXACTLY
          let viewMinX: number, viewMinY: number, viewMaxX: number, viewMaxY: number;
          if (useGCode && outputSettings) {
            // G-code paths exist: show machine coordinate space (origin to work area bounds)
            const margin = 5;
            const workAreaMaxX = outputSettings.offsetX + outputSettings.targetWidth;
            const workAreaMaxY = outputSettings.offsetY + outputSettings.targetHeight;
            viewMinX = -margin;
            viewMinY = -margin;
            viewMaxX = workAreaMaxX + margin;
            viewMaxY = workAreaMaxY + margin;
          } else if (useGCode) {
            // G-code paths but no outputSettings: use G-code bounds
            const margin = 5;
            viewMinX = bounds.minX - margin;
            viewMinY = bounds.minY - margin;
            viewMaxX = bounds.maxX + margin;
            viewMaxY = bounds.maxY + margin;
          } else {
            // No G-code: use canvas coordinate space for canvas paths
            viewMinX = 0;
            viewMinY = 0;
            viewMaxX = width;
            viewMaxY = height;
          }
          const viewWidth = viewMaxX - viewMinX;
          const viewHeight = viewMaxY - viewMinY;
          const availableWidth = cw - padding * 2;
          const availableHeight = ch - padding * 2;
          const baseScale = Math.min(availableWidth / viewWidth, availableHeight / viewHeight);
          const scale = baseScale * zoomLevel;
          // Calculate centering offsets (must match drawCanvas with zoom/pan)
          const scaledWidth = viewWidth * scale;
          const scaledHeight = viewHeight * scale;
          const offsetX = padding + (availableWidth - scaledWidth) / 2 + panOffset.x;
          const offsetY = padding + (availableHeight - scaledHeight) / 2 + panOffset.y;
          const gcodeX = ((mouseX - offsetX) / scale) + viewMinX;
          const gcodeY = ((mouseY - offsetY) / scale) + viewMinY;
          setClickedPosition({ x: Math.round(gcodeX), y: Math.round(gcodeY) });
        }}
      >
        <canvas
          ref={canvasRef}
          style={{ width: dimensions.width, height: dimensions.height }}
          className="block"
        />

        {/* Placement mode overlay */}
        {placementMode && (
          <div className="absolute inset-0 pointer-events-none">
            {/* Header */}
            <div className="absolute top-2 left-2 right-2 bg-purple-600/90 rounded-lg px-3 py-2 pointer-events-auto">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className="w-4 h-4 rounded-full border-2 border-white"
                    style={{ backgroundColor: placementMode.color }}
                  />
                  <span className="text-white text-sm font-medium">
                    Setting Color {placementMode.colorIndex} Position
                  </span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onPlacementCancel?.();
                    setClickedPosition(null);
                    setHoverPosition(null);
                  }}
                  className="text-white/80 hover:text-white text-xs"
                >
                  Cancel
                </button>
              </div>
            </div>

            {/* Live coordinates */}
            {(hoverPosition || clickedPosition) && (
              <div className="absolute bottom-16 left-1/2 -translate-x-1/2 bg-black/80 rounded-lg px-3 py-2 text-white text-sm font-mono">
                X: {(clickedPosition || hoverPosition)!.x} &nbsp; Y: {(clickedPosition || hoverPosition)!.y}
              </div>
            )}

            {/* Confirm/Cancel buttons */}
            {clickedPosition && (
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-2 pointer-events-auto">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onPlacementConfirm?.(clickedPosition.x, clickedPosition.y);
                    setClickedPosition(null);
                    setHoverPosition(null);
                  }}
                  className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg font-medium flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Confirm
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setClickedPosition(null);
                  }}
                  className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg font-medium"
                >
                  Reposition
                </button>
              </div>
            )}
          </div>
        )}

        {/* Controls overlay */}
        {!placementMode && (
          <div className="absolute bottom-2 right-2 pointer-events-auto">
            <div className="flex items-end gap-1.5 bg-slate-900/80 backdrop-blur-sm rounded-lg p-1.5 border border-slate-700/50">
              {/* View toggles group */}
              <div className="flex gap-0.5">
                <button
                  onClick={() => setShowInkDips(s => !s)}
                  className={`w-7 h-7 rounded flex items-center justify-center transition-colors ${
                    showInkDips
                      ? 'bg-blue-500 text-white'
                      : 'bg-slate-700/50 text-slate-500 hover:text-slate-300 hover:bg-slate-700'
                  }`}
                  title={showInkDips ? 'Hide ink wells' : 'Show ink wells'}
                >
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2c-5.33 8.33-8 12.67-8 16a8 8 0 1 0 16 0c0-3.33-2.67-7.67-8-16z" />
                  </svg>
                </button>
                <button
                  onClick={() => setShowWorkArea(s => !s)}
                  className={`w-7 h-7 rounded flex items-center justify-center transition-colors ${
                    showWorkArea
                      ? 'bg-blue-500 text-white'
                      : 'bg-slate-700/50 text-slate-500 hover:text-slate-300 hover:bg-slate-700'
                  }`}
                  title={showWorkArea ? 'Hide work area' : 'Show work area'}
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <rect x="3" y="3" width="18" height="18" rx="2" strokeWidth="2" strokeDasharray="4 2" />
                  </svg>
                </button>
              </div>

              {/* Divider */}
              <div className="w-px h-6 bg-slate-600/50" />

              {/* Pan toggle */}
              <button
                onClick={() => setPanMode(p => !p)}
                className={`w-7 h-7 rounded flex items-center justify-center transition-colors ${
                  panMode
                    ? 'bg-blue-500 text-white'
                    : 'bg-slate-700/50 text-slate-500 hover:text-slate-300 hover:bg-slate-700'
                }`}
                title={panMode ? 'Exit pan mode' : 'Pan mode (drag to pan)'}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11" />
                </svg>
              </button>

              {/* Divider */}
              <div className="w-px h-6 bg-slate-600/50" />

              {/* Zoom controls */}
              <div className="flex items-center gap-0.5">
                <button
                  onClick={() => setZoomLevel(z => Math.max(z / 1.25, 0.25))}
                  className="w-7 h-7 bg-slate-700/50 hover:bg-slate-700 text-slate-400 hover:text-slate-200 rounded flex items-center justify-center transition-colors"
                  title="Zoom out"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                  </svg>
                </button>
                <button
                  onClick={() => {
                    setZoomLevel(1);
                    setPanOffset({ x: 0, y: 0 });
                  }}
                  className="min-w-[42px] h-7 px-1.5 bg-slate-700/50 hover:bg-slate-700 text-slate-300 rounded flex items-center justify-center text-xs font-medium tabular-nums transition-colors"
                  title="Reset view"
                >
                  {Math.round(zoomLevel * 100)}%
                </button>
                <button
                  onClick={() => setZoomLevel(z => Math.min(z * 1.25, 10))}
                  className="w-7 h-7 bg-slate-700/50 hover:bg-slate-700 text-slate-400 hover:text-slate-200 rounded flex items-center justify-center transition-colors"
                  title="Zoom in"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}
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

  // Compare paths - always re-render if reference changed (paths content may differ)
  if (prev.paths !== next.paths) return false;

  // Compare gcodeLines - always re-render if reference changed (content may differ)
  if (prev.gcodeLines !== next.gcodeLines) return false;

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

  // Placement mode changes
  if (prev.placementMode !== next.placementMode) return false;

  // Color wells changes
  if (prev.colorWells !== next.colorWells) {
    if (prev.colorWells?.length !== next.colorWells?.length) return false;
  }

  // Clip setting changes
  if (prev.clipToWorkArea !== next.clipToWorkArea) return false;

  return true;
});
