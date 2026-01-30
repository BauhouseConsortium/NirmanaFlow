import { useEffect, useRef, useMemo, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { WIGGLE_DIP_SEQUENCE, processDipSequence } from '../utils/gcodeDipLogic';

interface DipSequenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  customSequence: string;
  onSequenceChange: (sequence: string) => void;
  dipX: number;
  dipY: number;
}

interface PathPoint {
  x: number;
  y: number;
  z: number;
  f?: number; // feed rate
  isRapid: boolean;
}

// Parse G-code into editable points
function parseGCodeToPoints(gcode: string): PathPoint[] {
  const points: PathPoint[] = [];
  let currentX: number | null = null;
  let currentY: number | null = null;
  let currentZ = 10;
  let currentF = 1600;

  const lines = gcode.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith(';') || trimmed.startsWith('(')) continue;

    const isRapid = trimmed.startsWith('G0');
    const isMove = trimmed.startsWith('G0') || trimmed.startsWith('G1');

    if (isMove) {
      const xMatch = trimmed.match(/X([+-]?\d*\.?\d+)/i);
      const yMatch = trimmed.match(/Y([+-]?\d*\.?\d+)/i);
      const zMatch = trimmed.match(/Z([+-]?\d*\.?\d+)/i);
      const fMatch = trimmed.match(/F([+-]?\d*\.?\d+)/i);

      if (xMatch) currentX = parseFloat(xMatch[1]);
      if (yMatch) currentY = parseFloat(yMatch[1]);
      if (zMatch) currentZ = parseFloat(zMatch[1]);
      if (fMatch) currentF = parseFloat(fMatch[1]);

      // Only add point if we have valid X and Y coordinates
      if (currentX !== null && currentY !== null) {
        points.push({ x: currentX, y: currentY, z: currentZ, f: currentF, isRapid });
      }
    }
  }

  return points;
}

// Generate G-code from points
function pointsToGCode(points: PathPoint[]): string {
  if (points.length === 0) return '';

  const lines: string[] = [];
  let lastZ: number | null = null;
  let lastF: number | null = null;

  for (const pt of points) {
    const cmd = pt.isRapid ? 'G0' : 'G1';
    let line = `${cmd} X${pt.x.toFixed(3)} Y${pt.y.toFixed(3)}`;

    if (pt.z !== lastZ) {
      line += ` Z${pt.z.toFixed(1)}`;
      lastZ = pt.z;
    }

    if (!pt.isRapid && pt.f && pt.f !== lastF) {
      line += ` F${pt.f}`;
      lastF = pt.f;
    }

    lines.push(line);
  }

  return lines.join('\n');
}

export function DipSequenceModal({
  isOpen,
  onClose,
  customSequence,
  onSequenceChange,
  dipX,
  dipY,
}: DipSequenceModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [activeTab, setActiveTab] = useState<'preview' | 'draw' | 'edit'>('preview');
  const [zoom, setZoom] = useState(15); // pixels per mm
  const [offset, setOffset] = useState({ x: 200, y: 250 });

  // Editable points for draw mode
  const [points, setPoints] = useState<PathPoint[]>(() => {
    const template = customSequence || WIGGLE_DIP_SEQUENCE;
    return parseGCodeToPoints(template);
  });
  const [selectedPoint, setSelectedPoint] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // Sync points when customSequence changes externally
  useEffect(() => {
    if (activeTab !== 'draw') {
      const template = customSequence || WIGGLE_DIP_SEQUENCE;
      setPoints(parseGCodeToPoints(template));
    }
  }, [customSequence, activeTab]);

  // Get the template being used
  const template = customSequence || WIGGLE_DIP_SEQUENCE;

  // Get processed G-code for preview
  const processedGCode = useMemo(() => {
    return processDipSequence(template, dipX, dipY).join('\n');
  }, [template, dipX, dipY]);

  const previewPoints = useMemo(() => parseGCodeToPoints(processedGCode), [processedGCode]);

  // Calculate bounds for auto-fit
  const bounds = useMemo(() => {
    const pts = activeTab === 'draw' ? points : previewPoints;
    if (pts.length === 0) return { minX: 0, maxX: 100, minY: 0, maxY: 50 };

    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;

    for (const p of pts) {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
    }

    const padX = (maxX - minX) * 0.1 || 10;
    const padY = (maxY - minY) * 0.1 || 10;

    return { minX: minX - padX, maxX: maxX + padX, minY: minY - padY, maxY: maxY + padY };
  }, [points, previewPoints, activeTab]);

  // Convert canvas coords to world coords
  const canvasToWorld = useCallback((cx: number, cy: number): { x: number; y: number } => {
    return {
      x: (cx - offset.x) / zoom,
      y: -(cy - offset.y) / zoom, // Y-flip
    };
  }, [offset, zoom]);

  // Convert world coords to canvas coords
  const worldToCanvas = useCallback((wx: number, wy: number): { x: number; y: number } => {
    return {
      x: offset.x + wx * zoom,
      y: offset.y - wy * zoom, // Y-flip
    };
  }, [offset, zoom]);

  // Draw canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !isOpen) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const cw = canvas.width;
    const ch = canvas.height;
    const pts = activeTab === 'draw' ? points : previewPoints;

    // Offset so first point appears at visual (0,0) in both preview and draw modes
    const viewOffset = (pts.length > 0)
      ? { x: pts[0].x, y: pts[0].y }
      : { x: 0, y: 0 };

    // Adjusted worldToCanvas (shifts so start is at visual origin)
    const toCanvas = (wx: number, wy: number): { x: number; y: number } => {
      const adjX = wx - viewOffset.x;
      const adjY = wy - viewOffset.y;
      return {
        x: offset.x + adjX * zoom,
        y: offset.y - adjY * zoom,
      };
    };

    // Clear
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, cw, ch);

    // Draw grid
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;

    const gridStep = zoom >= 10 ? 5 : 10; // 5mm or 10mm grid
    const startX = Math.floor(canvasToWorld(0, 0).x / gridStep) * gridStep;
    const endX = Math.ceil(canvasToWorld(cw, 0).x / gridStep) * gridStep;
    const startY = Math.floor(canvasToWorld(0, ch).y / gridStep) * gridStep;
    const endY = Math.ceil(canvasToWorld(0, 0).y / gridStep) * gridStep;

    for (let x = startX; x <= endX; x += gridStep) {
      const { x: sx } = worldToCanvas(x, 0);
      ctx.beginPath();
      ctx.moveTo(sx, 0);
      ctx.lineTo(sx, ch);
      ctx.stroke();
    }

    for (let y = startY; y <= endY; y += gridStep) {
      const { y: sy } = worldToCanvas(0, y);
      ctx.beginPath();
      ctx.moveTo(0, sy);
      ctx.lineTo(cw, sy);
      ctx.stroke();
    }

    // Draw axes
    ctx.lineWidth = 2;
    // X-axis (Y=0)
    const { y: axisY } = worldToCanvas(0, 0);
    ctx.strokeStyle = '#334155';
    ctx.beginPath();
    ctx.moveTo(0, axisY);
    ctx.lineTo(cw, axisY);
    ctx.stroke();

    // Y-axis (X=0)
    const { x: axisX } = worldToCanvas(0, 0);
    ctx.beginPath();
    ctx.moveTo(axisX, 0);
    ctx.lineTo(axisX, ch);
    ctx.stroke();

    // Draw anchor position marker (only in draw mode)
    if (activeTab === 'draw' && pts.length > 0) {
      const markerX = pts[0].x;
      const markerY = pts[0].y;
      const markerPos = toCanvas(markerX, markerY);

      ctx.strokeStyle = '#a855f7';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(markerPos.x, markerPos.y, 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(markerPos.x - 12, markerPos.y);
      ctx.lineTo(markerPos.x + 12, markerPos.y);
      ctx.moveTo(markerPos.x, markerPos.y - 12);
      ctx.lineTo(markerPos.x, markerPos.y + 12);
      ctx.stroke();

      // Label
      ctx.fillStyle = '#a855f7';
      ctx.font = '10px sans-serif';
      ctx.fillText('Anchor', markerPos.x + 12, markerPos.y - 12);
    }

    // Draw path
    if (pts.length > 1) {
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      for (let i = 1; i < pts.length; i++) {
        const prev = pts[i - 1];
        const curr = pts[i];
        const p1 = toCanvas(prev.x, prev.y);
        const p2 = toCanvas(curr.x, curr.y);

        // Color based on Z and move type
        if (curr.isRapid) {
          ctx.strokeStyle = '#64748b';
          ctx.setLineDash([6, 4]);
          ctx.lineWidth = 1;
        } else if (curr.z <= 0) {
          ctx.strokeStyle = '#3b82f6';
          ctx.setLineDash([]);
          ctx.lineWidth = 3;
        } else {
          ctx.strokeStyle = '#f59e0b';
          ctx.setLineDash([4, 4]);
          ctx.lineWidth = 2;
        }

        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }

      ctx.setLineDash([]);
    }

    // Draw points (only in draw mode)
    if (activeTab === 'draw') {
      pts.forEach((pt, idx) => {
        const pos = toCanvas(pt.x, pt.y);

        // Point circle
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, idx === selectedPoint ? 10 : 6, 0, Math.PI * 2);

        if (idx === selectedPoint) {
          ctx.fillStyle = '#f97316';
        } else if (idx === 0) {
          ctx.fillStyle = '#22c55e';
        } else if (idx === pts.length - 1) {
          ctx.fillStyle = '#ef4444';
        } else if (pt.z <= 0) {
          ctx.fillStyle = '#3b82f6';
        } else {
          ctx.fillStyle = '#f59e0b';
        }
        ctx.fill();

        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Point index
        ctx.fillStyle = '#fff';
        ctx.font = '10px sans-serif';
        ctx.fillText(String(idx), pos.x + 10, pos.y - 10);
      });
    } else {
      // In preview mode, just mark start/end (start is at 0,0 due to offset)
      if (pts.length > 0) {
        const start = toCanvas(pts[0].x, pts[0].y);
        ctx.fillStyle = '#22c55e';
        ctx.beginPath();
        ctx.arc(start.x, start.y, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = '10px sans-serif';
        ctx.fillText('Start (0,0)', start.x + 8, start.y + 4);
      }
      if (pts.length > 1) {
        const end = toCanvas(pts[pts.length - 1].x, pts[pts.length - 1].y);
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(end.x, end.y, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.fillText('End', end.x + 8, end.y + 4);
      }
    }

  }, [isOpen, points, previewPoints, activeTab, selectedPoint, zoom, offset, dipX, dipY, canvasToWorld, worldToCanvas]);

  // Mouse handlers for drawing
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const cx = (e.clientX - rect.left) * scaleX;
    const cy = (e.clientY - rect.top) * scaleY;

    // Right-click, middle mouse, or shift+click for panning (works in all modes)
    if (e.button === 2 || e.button === 1 || e.shiftKey) {
      e.preventDefault();
      setIsPanning(true);
      setPanStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
      return;
    }

    if (activeTab !== 'draw') return;

    // Check if clicking on a point (account for view offset from first point)
    const viewOffsetX = points.length > 0 ? points[0].x : 0;
    const viewOffsetY = points.length > 0 ? points[0].y : 0;
    for (let i = 0; i < points.length; i++) {
      // Calculate visual position (offset so first point is at origin)
      const visualX = points[i].x - viewOffsetX;
      const visualY = points[i].y - viewOffsetY;
      const pos = worldToCanvas(visualX, visualY);
      const dist = Math.sqrt((cx - pos.x) ** 2 + (cy - pos.y) ** 2);
      if (dist < 15) {
        setSelectedPoint(i);
        setIsDragging(true);
        return;
      }
    }

    // Double-click to add point
    if (e.detail === 2 && points.length > 0) {
      const visualCoords = canvasToWorld(cx, cy);
      // Add back the offset from first point to get actual world coords
      const firstPt = points[0];
      const newPoint: PathPoint = {
        x: Math.round((visualCoords.x + firstPt.x) * 100) / 100,
        y: Math.round((visualCoords.y + firstPt.y) * 100) / 100,
        z: 0,
        f: 1200,
        isRapid: false,
      };
      setPoints(prev => [...prev, newPoint]);
      setSelectedPoint(points.length);
      return;
    }

    setSelectedPoint(null);
  }, [activeTab, points, offset, canvasToWorld, worldToCanvas]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isPanning) {
      setOffset({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      });
      return;
    }

    if (!isDragging || selectedPoint === null || activeTab !== 'draw') return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const cx = (e.clientX - rect.left) * scaleX;
    const cy = (e.clientY - rect.top) * scaleY;

    // Convert canvas to visual coords, then add back the first point offset
    const visualCoords = canvasToWorld(cx, cy);

    setPoints(prev => {
      // Add back the offset from first point to get actual world coords
      const firstPt = prev[0];
      const worldX = visualCoords.x + firstPt.x;
      const worldY = visualCoords.y + firstPt.y;

      const updated = [...prev];
      updated[selectedPoint] = {
        ...updated[selectedPoint],
        x: Math.round(worldX * 100) / 100,
        y: Math.round(worldY * 100) / 100,
      };
      return updated;
    });
  }, [isDragging, isPanning, selectedPoint, activeTab, panStart, canvasToWorld]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setIsPanning(false);
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(prev => Math.max(2, Math.min(50, prev * delta)));
  }, []);

  // Point manipulation
  const handleDeletePoint = useCallback(() => {
    if (selectedPoint === null || points.length <= 2) return;
    setPoints(prev => prev.filter((_, i) => i !== selectedPoint));
    setSelectedPoint(null);
  }, [selectedPoint, points.length]);

  const handleAddPointAfter = useCallback(() => {
    if (selectedPoint === null) return;
    const curr = points[selectedPoint];
    const next = points[Math.min(selectedPoint + 1, points.length - 1)];
    const newPoint: PathPoint = {
      x: Math.round((curr.x + next.x) / 2 * 100) / 100,
      y: Math.round((curr.y + next.y) / 2 * 100) / 100,
      z: curr.z,
      f: curr.f,
      isRapid: false,
    };
    setPoints(prev => {
      const updated = [...prev];
      updated.splice(selectedPoint + 1, 0, newPoint);
      return updated;
    });
    setSelectedPoint(selectedPoint + 1);
  }, [selectedPoint, points]);

  const handleTogglePenState = useCallback(() => {
    if (selectedPoint === null) return;
    setPoints(prev => {
      const updated = [...prev];
      updated[selectedPoint] = {
        ...updated[selectedPoint],
        z: updated[selectedPoint].z <= 0 ? 5 : 0,
      };
      return updated;
    });
  }, [selectedPoint]);

  const handleToggleRapid = useCallback(() => {
    if (selectedPoint === null) return;
    setPoints(prev => {
      const updated = [...prev];
      updated[selectedPoint] = {
        ...updated[selectedPoint],
        isRapid: !updated[selectedPoint].isRapid,
      };
      return updated;
    });
  }, [selectedPoint]);

  // Apply drawn path to custom sequence
  const handleApplyPath = useCallback(() => {
    const gcode = pointsToGCode(points);
    onSequenceChange(gcode);
    setActiveTab('preview');
  }, [points, onSequenceChange]);

  // Fit view to content
  const handleFitView = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rangeX = bounds.maxX - bounds.minX;
    const rangeY = bounds.maxY - bounds.minY;
    const newZoom = Math.min(
      (canvas.width - 80) / rangeX,
      (canvas.height - 80) / rangeY
    );
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;

    setZoom(Math.max(2, Math.min(50, newZoom)));
    setOffset({
      x: canvas.width / 2 - centerX * newZoom,
      y: canvas.height / 2 + centerY * newZoom,
    });
  }, [bounds]);

  // Load default sequence into editor
  const handleLoadDefault = useCallback(() => {
    setPoints(parseGCodeToPoints(WIGGLE_DIP_SEQUENCE));
    setSelectedPoint(null);
  }, []);

  if (!isOpen) return null;

  const isUsingDefault = !customSequence;
  const selectedPt = selectedPoint !== null ? points[selectedPoint] : null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={onClose}>
      <div
        className="bg-slate-800 rounded-lg shadow-xl w-[95vw] max-w-6xl h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <div>
            <h2 className="text-lg font-semibold text-white">Dip Sequence Editor</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {isUsingDefault ? 'Using default wiggle sequence' : 'Using custom sequence'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-700">
          <button
            onClick={() => setActiveTab('preview')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === 'preview' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-slate-400 hover:text-white'
            }`}
          >
            Preview
          </button>
          <button
            onClick={() => setActiveTab('draw')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === 'draw' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-slate-400 hover:text-white'
            }`}
          >
            Draw Path
          </button>
          <button
            onClick={() => setActiveTab('edit')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === 'edit' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-slate-400 hover:text-white'
            }`}
          >
            Edit G-Code
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex">
          {/* Canvas */}
          <div className="flex-1 flex flex-col">
            {/* Toolbar */}
            {activeTab === 'draw' && (
              <div className="flex items-center gap-3 px-4 py-2 bg-slate-900 border-b border-slate-700">
                <button
                  onClick={handleAddPointAfter}
                  disabled={selectedPoint === null}
                  className="px-2 py-1 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-xs rounded"
                >
                  Add Point
                </button>
                <button
                  onClick={handleDeletePoint}
                  disabled={selectedPoint === null || points.length <= 2}
                  className="px-2 py-1 bg-red-600 hover:bg-red-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-xs rounded"
                >
                  Delete
                </button>
                <button
                  onClick={handleTogglePenState}
                  disabled={selectedPoint === null}
                  className="px-2 py-1 bg-slate-600 hover:bg-slate-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-xs rounded"
                >
                  Toggle Pen
                </button>
                <button
                  onClick={handleToggleRapid}
                  disabled={selectedPoint === null}
                  className="px-2 py-1 bg-slate-600 hover:bg-slate-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-xs rounded"
                >
                  Toggle Rapid
                </button>
                <div className="w-px h-4 bg-slate-600" />
                <button
                  onClick={handleFitView}
                  className="px-2 py-1 bg-slate-600 hover:bg-slate-500 text-white text-xs rounded"
                >
                  Fit View
                </button>
                <button
                  onClick={handleLoadDefault}
                  className="px-2 py-1 bg-slate-600 hover:bg-slate-500 text-white text-xs rounded"
                >
                  Load Default
                </button>
                <div className="flex items-center gap-2 ml-auto">
                  <span className="text-xs text-slate-400">Zoom:</span>
                  <input
                    type="range"
                    min="2"
                    max="50"
                    value={zoom}
                    onChange={e => setZoom(Number(e.target.value))}
                    className="w-20"
                  />
                  <span className="text-xs text-slate-300 w-8">{zoom.toFixed(0)}</span>
                </div>
              </div>
            )}

            {activeTab !== 'edit' && (
              <div className="flex-1 relative">
                <canvas
                  ref={canvasRef}
                  width={800}
                  height={500}
                  className="w-full h-full"
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                  onWheel={handleWheel}
                  onContextMenu={e => e.preventDefault()}
                  style={{ cursor: isPanning ? 'grabbing' : isDragging ? 'grabbing' : activeTab === 'draw' ? 'crosshair' : 'grab' }}
                />

                {/* Legend */}
                <div className="absolute bottom-4 left-4 bg-slate-800/90 rounded-lg p-3 text-xs">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-3 h-0.5 bg-blue-500"></div>
                    <span className="text-slate-300">Pen down (Z&le;0)</span>
                  </div>
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-3 h-0.5 bg-amber-500"></div>
                    <span className="text-slate-300">Pen up (Z&gt;0)</span>
                  </div>
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-3 h-0.5 bg-slate-500"></div>
                    <span className="text-slate-300">Rapid (G0)</span>
                  </div>
                  {activeTab === 'draw' && (
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                      <span className="text-slate-300">Anchor (1st point)</span>
                    </div>
                  )}
                  <div className="mt-2 pt-2 border-t border-slate-700 text-slate-400">
                    Right-drag to pan<br />
                    Scroll to zoom
                    {activeTab === 'draw' && (
                      <>
                        <br />Double-click to add point
                        <span className="text-purple-400 mt-1 block">
                          Anchor point will align to Dip X/Y
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'edit' && (
              <div className="flex-1 flex flex-col p-4">
                <div className="text-xs text-slate-400 mb-2">Custom G-Code Template</div>
                <textarea
                  value={customSequence}
                  onChange={e => onSequenceChange(e.target.value)}
                  placeholder="Paste custom G-code here...&#10;&#10;Leave empty to use default wiggle sequence.&#10;&#10;Coordinates will be shifted to match the dip position."
                  className="flex-1 bg-slate-900 text-slate-300 border border-slate-700 rounded-lg p-3 text-xs font-mono resize-none focus:outline-none focus:border-blue-500"
                  spellCheck={false}
                />
              </div>
            )}
          </div>

          {/* Right panel */}
          <div className="w-72 border-l border-slate-700 flex flex-col overflow-hidden">
            {activeTab === 'draw' && selectedPt && (
              <div className="p-3 border-b border-slate-700">
                <h3 className="text-sm font-medium text-white mb-3">Point {selectedPoint}</h3>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-slate-400 w-8">X:</label>
                    <input
                      type="number"
                      step="0.5"
                      value={selectedPt.x}
                      onChange={e => {
                        const val = parseFloat(e.target.value) || 0;
                        setPoints(prev => {
                          const updated = [...prev];
                          updated[selectedPoint!] = { ...updated[selectedPoint!], x: val };
                          return updated;
                        });
                      }}
                      className="flex-1 bg-slate-900 text-white px-2 py-1 rounded border border-slate-600 text-xs"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-slate-400 w-8">Y:</label>
                    <input
                      type="number"
                      step="0.5"
                      value={selectedPt.y}
                      onChange={e => {
                        const val = parseFloat(e.target.value) || 0;
                        setPoints(prev => {
                          const updated = [...prev];
                          updated[selectedPoint!] = { ...updated[selectedPoint!], y: val };
                          return updated;
                        });
                      }}
                      className="flex-1 bg-slate-900 text-white px-2 py-1 rounded border border-slate-600 text-xs"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-slate-400 w-8">Z:</label>
                    <input
                      type="number"
                      step="1"
                      value={selectedPt.z}
                      onChange={e => {
                        const val = parseFloat(e.target.value) || 0;
                        setPoints(prev => {
                          const updated = [...prev];
                          updated[selectedPoint!] = { ...updated[selectedPoint!], z: val };
                          return updated;
                        });
                      }}
                      className="flex-1 bg-slate-900 text-white px-2 py-1 rounded border border-slate-600 text-xs"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-slate-400 w-8">F:</label>
                    <input
                      type="number"
                      step="100"
                      value={selectedPt.f || 1200}
                      onChange={e => {
                        const val = parseFloat(e.target.value) || 1200;
                        setPoints(prev => {
                          const updated = [...prev];
                          updated[selectedPoint!] = { ...updated[selectedPoint!], f: val };
                          return updated;
                        });
                      }}
                      className="flex-1 bg-slate-900 text-white px-2 py-1 rounded border border-slate-600 text-xs"
                    />
                  </div>
                  <div className="flex items-center gap-4 mt-2">
                    <label className="flex items-center gap-1 text-xs text-slate-400">
                      <input
                        type="checkbox"
                        checked={selectedPt.isRapid}
                        onChange={e => {
                          setPoints(prev => {
                            const updated = [...prev];
                            updated[selectedPoint!] = { ...updated[selectedPoint!], isRapid: e.target.checked };
                            return updated;
                          });
                        }}
                        className="rounded"
                      />
                      Rapid (G0)
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* Points list */}
            {activeTab === 'draw' && (
              <div className="flex-1 overflow-y-auto p-3 flex flex-col">
                <h3 className="text-xs text-slate-400 mb-2">Points ({points.length})</h3>
                <div className="flex-1 overflow-y-auto space-y-1">
                  {points.map((pt, idx) => (
                    <div
                      key={idx}
                      onClick={() => setSelectedPoint(idx)}
                      className={`flex items-center gap-2 px-2 py-1 rounded cursor-pointer text-xs font-mono ${
                        selectedPoint === idx
                          ? 'bg-orange-600 text-white'
                          : 'bg-slate-900 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      <span className="w-4">{idx}</span>
                      <span className={pt.z <= 0 ? 'text-blue-400' : 'text-amber-400'}>
                        {pt.x.toFixed(1)}, {pt.y.toFixed(1)}
                      </span>
                      <span className="text-slate-500">Z{pt.z.toFixed(0)}</span>
                      {pt.isRapid && <span className="text-slate-500">G0</span>}
                    </div>
                  ))}
                </div>
                {/* Coordinate shift info */}
                <div className="mt-3 pt-3 border-t border-slate-700">
                  <p className="text-xs text-slate-500">
                    <strong className="text-purple-400">Anchor:</strong> Point 0 ({points[0]?.x.toFixed(1)}, {points[0]?.y.toFixed(1)})
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    <strong className="text-slate-400">Target:</strong> Dip X{dipX}, Y{dipY}
                  </p>
                  <p className="text-xs text-slate-400 mt-2">
                    Path will shift so anchor aligns to target dip position.
                  </p>
                </div>
              </div>
            )}

            {/* Preview G-code */}
            {activeTab === 'preview' && (
              <div className="flex-1 overflow-y-auto p-3">
                <h3 className="text-xs text-slate-400 mb-2">
                  Processed G-Code ({processedGCode.split('\n').length} lines)
                </h3>
                <pre className="text-xs font-mono text-slate-300 whitespace-pre bg-slate-900 rounded p-2">
                  {processedGCode}
                </pre>
              </div>
            )}

            {/* Edit mode info */}
            {activeTab === 'edit' && (
              <div className="p-3">
                <h3 className="text-xs text-slate-400 mb-2">Info</h3>
                <p className="text-xs text-slate-500">
                  {customSequence
                    ? `Custom: ${customSequence.split('\n').length} lines`
                    : 'Empty (using default wiggle)'
                  }
                </p>
                <p className="text-xs text-slate-500 mt-2">
                  Dip position: X{dipX} Y{dipY}
                </p>
                <button
                  onClick={() => onSequenceChange('')}
                  disabled={!customSequence}
                  className="mt-3 w-full px-3 py-1.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white text-xs rounded"
                >
                  Reset to Default
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-between gap-2 p-4 border-t border-slate-700">
          <div className="flex gap-2">
            {activeTab === 'draw' && (
              <button
                onClick={handleApplyPath}
                className="px-4 py-2 text-sm bg-green-600 hover:bg-green-500 text-white rounded transition-colors"
              >
                Apply Path
              </button>
            )}
            <button
              onClick={() => onSequenceChange(WIGGLE_DIP_SEQUENCE)}
              className="px-4 py-2 text-sm bg-slate-700 hover:bg-slate-600 text-white rounded transition-colors"
            >
              Load Default
            </button>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => navigator.clipboard.writeText(processedGCode)}
              className="px-4 py-2 text-sm bg-slate-700 hover:bg-slate-600 text-white rounded transition-colors"
            >
              Copy Processed
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
