import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { glyphs as originalGlyphs } from '../../data/glyphs';
import { transliterateToba } from '../../utils/transliteration';

interface Point {
  x: number;
  y: number;
}

interface GlyphEditorProps {
  isOpen: boolean;
  onClose: () => void;
  latinText: string;
}

// Deep clone glyph data for editing
function cloneGlyphs() {
  return JSON.parse(JSON.stringify(originalGlyphs));
}

export function GlyphEditor({ isOpen, onClose, latinText }: GlyphEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [editedGlyphs, setEditedGlyphs] = useState(() => cloneGlyphs());
  const [selectedChar, setSelectedChar] = useState<string | null>(null);
  const [selectedPath, setSelectedPath] = useState<number>(0);
  const [selectedPoint, setSelectedPoint] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [zoom, setZoom] = useState(200);
  const [offset, setOffset] = useState({ x: 150, y: 250 });

  // Get Batak characters from Latin text
  const batakChars = useMemo(() => {
    const batak = transliterateToba(latinText || '');
    return [...new Set(batak.split(''))].filter(c => c !== ' ');
  }, [latinText]);

  // Select first char by default
  useEffect(() => {
    if (batakChars.length > 0 && !selectedChar) {
      setSelectedChar(batakChars[0]);
    }
  }, [batakChars, selectedChar]);

  const currentGlyph = selectedChar ? editedGlyphs[selectedChar] : null;
  const currentPath = currentGlyph?.paths[selectedPath] || [];

  // Draw canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !currentGlyph) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const cw = canvas.width;
    const ch = canvas.height;

    // Clear
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, cw, ch);

    // Draw grid
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;

    // Vertical lines
    for (let x = -1; x <= 1; x += 0.1) {
      const sx = offset.x + x * zoom;
      ctx.beginPath();
      ctx.moveTo(sx, 0);
      ctx.lineTo(sx, ch);
      ctx.stroke();
    }

    // Horizontal lines
    for (let y = -1; y <= 1; y += 0.1) {
      const sy = offset.y + y * zoom;
      ctx.beginPath();
      ctx.moveTo(0, sy);
      ctx.lineTo(cw, sy);
      ctx.stroke();
    }

    // Draw baseline (y=0)
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, offset.y);
    ctx.lineTo(cw, offset.y);
    ctx.stroke();

    // Draw origin (x=0)
    ctx.strokeStyle = '#22c55e';
    ctx.beginPath();
    ctx.moveTo(offset.x, 0);
    ctx.lineTo(offset.x, ch);
    ctx.stroke();

    // Draw all paths
    currentGlyph.paths.forEach((path: number[][], pathIdx: number) => {
      if (path.length < 2) return;

      const isSelected = pathIdx === selectedPath;

      // Draw path
      ctx.strokeStyle = isSelected ? '#f97316' : '#64748b';
      ctx.lineWidth = isSelected ? 3 : 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      ctx.beginPath();
      const [startX, startY] = path[0];
      ctx.moveTo(offset.x + startX * zoom, offset.y + startY * zoom);

      for (let i = 1; i < path.length; i++) {
        const [px, py] = path[i];
        ctx.lineTo(offset.x + px * zoom, offset.y + py * zoom);
      }
      ctx.stroke();

      // Draw points for selected path
      if (isSelected) {
        path.forEach((point: number[], pointIdx: number) => {
          const [px, py] = point;
          const sx = offset.x + px * zoom;
          const sy = offset.y + py * zoom;

          ctx.beginPath();
          ctx.arc(sx, sy, pointIdx === selectedPoint ? 8 : 5, 0, Math.PI * 2);

          if (pointIdx === selectedPoint) {
            ctx.fillStyle = '#f97316';
          } else if (pointIdx === 0) {
            ctx.fillStyle = '#22c55e'; // Start point
          } else if (pointIdx === path.length - 1) {
            ctx.fillStyle = '#ef4444'; // End point
          } else {
            ctx.fillStyle = '#3b82f6';
          }
          ctx.fill();

          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 1;
          ctx.stroke();

          // Point index label
          ctx.fillStyle = '#fff';
          ctx.font = '10px sans-serif';
          ctx.fillText(String(pointIdx), sx + 8, sy - 8);
        });
      }
    });

    // Draw advance marker
    if (currentGlyph.advance) {
      ctx.strokeStyle = '#a855f7';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      const advX = offset.x + currentGlyph.advance * zoom;
      ctx.beginPath();
      ctx.moveTo(advX, 0);
      ctx.lineTo(advX, ch);
      ctx.stroke();
      ctx.setLineDash([]);
    }

  }, [currentGlyph, selectedPath, selectedPoint, zoom, offset]);

  // Handle mouse events for dragging
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!currentGlyph) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    // Scale mouse coordinates to canvas internal dimensions
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;

    // Check if clicking on a point
    const path = currentGlyph.paths[selectedPath];
    if (!path) return;

    for (let i = 0; i < path.length; i++) {
      const [px, py] = path[i];
      const sx = offset.x + px * zoom;
      const sy = offset.y + py * zoom;
      const dist = Math.sqrt((mx - sx) ** 2 + (my - sy) ** 2);

      if (dist < 15) {  // Larger hit area for easier selection
        setSelectedPoint(i);
        setIsDragging(true);
        return;
      }
    }

    setSelectedPoint(null);
  }, [currentGlyph, selectedPath, zoom, offset]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging || selectedPoint === null || !currentGlyph || !selectedChar) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    // Scale mouse coordinates to canvas internal dimensions
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;

    // Convert to glyph coordinates
    const gx = (mx - offset.x) / zoom;
    const gy = (my - offset.y) / zoom;

    // Update the point
    setEditedGlyphs((prev: typeof originalGlyphs) => {
      const updated = { ...prev };
      const glyph = { ...updated[selectedChar] };
      const paths = [...glyph.paths];
      const path = [...paths[selectedPath]];
      path[selectedPoint] = [
        Math.round(gx * 100000) / 100000,
        Math.round(gy * 100000) / 100000
      ];
      paths[selectedPath] = path;
      glyph.paths = paths;
      updated[selectedChar] = glyph;
      return updated;
    });
  }, [isDragging, selectedPoint, selectedChar, selectedPath, zoom, offset]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Delete selected point
  const handleDeletePoint = useCallback(() => {
    if (selectedPoint === null || !selectedChar || !currentGlyph) return;

    const path = currentGlyph.paths[selectedPath];
    if (path.length <= 2) return; // Keep at least 2 points

    setEditedGlyphs((prev: typeof originalGlyphs) => {
      const updated = { ...prev };
      const glyph = { ...updated[selectedChar] };
      const paths = [...glyph.paths];
      const newPath = [...paths[selectedPath]];
      newPath.splice(selectedPoint, 1);
      paths[selectedPath] = newPath;
      glyph.paths = paths;
      updated[selectedChar] = glyph;
      return updated;
    });
    setSelectedPoint(null);
  }, [selectedPoint, selectedChar, currentGlyph, selectedPath]);

  // Add point after selected
  const handleAddPoint = useCallback(() => {
    if (selectedPoint === null || !selectedChar || !currentGlyph) return;

    const path = currentGlyph.paths[selectedPath];
    const nextIdx = Math.min(selectedPoint + 1, path.length - 1);
    const [x1, y1] = path[selectedPoint];
    const [x2, y2] = path[nextIdx];
    const newPoint = [(x1 + x2) / 2, (y1 + y2) / 2];

    setEditedGlyphs((prev: typeof originalGlyphs) => {
      const updated = { ...prev };
      const glyph = { ...updated[selectedChar] };
      const paths = [...glyph.paths];
      const newPath = [...paths[selectedPath]];
      newPath.splice(selectedPoint + 1, 0, newPoint);
      paths[selectedPath] = newPath;
      glyph.paths = paths;
      updated[selectedChar] = glyph;
      return updated;
    });
    setSelectedPoint(selectedPoint + 1);
  }, [selectedPoint, selectedChar, currentGlyph, selectedPath]);

  // Export modified glyphs
  const handleExport = useCallback(() => {
    const content = `import type { GlyphData } from '../types';

export const glyphs: GlyphData = ${JSON.stringify(editedGlyphs, null, 2)};
`;

    const blob = new Blob([content], { type: 'text/typescript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'glyphs.ts';
    a.click();
    URL.revokeObjectURL(url);
  }, [editedGlyphs]);

  // Export only current glyph
  const handleExportSingleGlyph = useCallback(() => {
    if (!selectedChar || !currentGlyph) return;

    const content = JSON.stringify({
      char: selectedChar,
      unicode: selectedChar.codePointAt(0)?.toString(16),
      glyph: currentGlyph
    }, null, 2);

    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `glyph-${selectedChar.codePointAt(0)?.toString(16)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [selectedChar, currentGlyph]);

  // Reset current glyph
  const handleReset = useCallback(() => {
    if (!selectedChar) return;
    setEditedGlyphs((prev: typeof originalGlyphs) => ({
      ...prev,
      [selectedChar]: JSON.parse(JSON.stringify(originalGlyphs[selectedChar]))
    }));
  }, [selectedChar]);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 flex items-center justify-center bg-black/70" style={{ zIndex: 9999 }}>
      <div className="bg-slate-900 rounded-xl shadow-2xl w-[95vw] h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
          <h2 className="text-lg font-bold text-white">Glyph Editor</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportSingleGlyph}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg"
            >
              Export Glyph
            </button>
            <button
              onClick={handleExport}
              className="px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white text-sm rounded-lg"
            >
              Export All
            </button>
            <button
              onClick={onClose}
              className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-lg"
            >
              Close
            </button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Left sidebar - Character selection */}
          <div className="w-48 border-r border-slate-700 p-3 overflow-y-auto">
            <h3 className="text-sm font-medium text-slate-400 mb-2">Characters in "{latinText}"</h3>
            <div className="space-y-1">
              {batakChars.map((char) => (
                <button
                  key={char}
                  onClick={() => {
                    setSelectedChar(char);
                    setSelectedPath(0);
                    setSelectedPoint(null);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between ${
                    selectedChar === char
                      ? 'bg-orange-600 text-white'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  <span className="text-xl">{char}</span>
                  <span className="text-xs opacity-70">
                    U+{char.codePointAt(0)?.toString(16).toUpperCase()}
                  </span>
                </button>
              ))}
            </div>

            {/* Path selection */}
            {currentGlyph && (
              <div className="mt-4">
                <h3 className="text-sm font-medium text-slate-400 mb-2">
                  Paths ({currentGlyph.paths.length})
                </h3>
                <div className="space-y-1">
                  {currentGlyph.paths.map((_: number[][], idx: number) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setSelectedPath(idx);
                        setSelectedPoint(null);
                      }}
                      className={`w-full text-left px-3 py-1.5 rounded text-sm ${
                        selectedPath === idx
                          ? 'bg-orange-600 text-white'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      Path {idx + 1} ({currentGlyph.paths[idx].length} pts)
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Main canvas area */}
          <div className="flex-1 flex flex-col">
            {/* Toolbar */}
            <div className="flex items-center gap-4 px-4 py-2 border-b border-slate-700 bg-slate-800">
              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-400">Zoom:</label>
                <input
                  type="range"
                  min="50"
                  max="500"
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="w-24"
                />
                <span className="text-xs text-slate-300 w-12">{zoom}px</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleAddPoint}
                  disabled={selectedPoint === null}
                  className="px-2 py-1 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-xs rounded"
                >
                  Add Point
                </button>
                <button
                  onClick={handleDeletePoint}
                  disabled={selectedPoint === null || currentPath.length <= 2}
                  className="px-2 py-1 bg-red-600 hover:bg-red-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-xs rounded"
                >
                  Delete Point
                </button>
                <button
                  onClick={handleReset}
                  className="px-2 py-1 bg-slate-600 hover:bg-slate-500 text-white text-xs rounded"
                >
                  Reset Glyph
                </button>
              </div>

              {selectedPoint !== null && currentPath[selectedPoint] && (
                <div className="flex items-center gap-2 ml-auto text-xs text-slate-300">
                  <span>Point {selectedPoint}:</span>
                  <span className="font-mono">
                    x={currentPath[selectedPoint][0].toFixed(5)},
                    y={currentPath[selectedPoint][1].toFixed(5)}
                  </span>
                </div>
              )}
            </div>

            {/* Canvas */}
            <div className="flex-1 overflow-hidden bg-slate-950 relative">
              <canvas
                ref={canvasRef}
                width={800}
                height={600}
                className="w-full h-full"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                style={{ cursor: isDragging ? 'grabbing' : 'crosshair' }}
              />

              {/* Legend */}
              <div className="absolute bottom-4 left-4 bg-slate-800/90 rounded-lg p-3 text-xs">
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-3 h-3 rounded-full bg-green-500"></span>
                  <span className="text-slate-300">Start point</span>
                </div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-3 h-3 rounded-full bg-red-500"></span>
                  <span className="text-slate-300">End point</span>
                </div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                  <span className="text-slate-300">Control point</span>
                </div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-3 h-0.5 bg-red-500"></span>
                  <span className="text-slate-300">Baseline (y=0)</span>
                </div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-3 h-0.5 bg-green-500"></span>
                  <span className="text-slate-300">Origin (x=0)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-0.5 bg-purple-500" style={{ borderStyle: 'dashed' }}></span>
                  <span className="text-slate-300">Advance width</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right sidebar - Glyph info */}
          {currentGlyph && (
            <div className="w-64 border-l border-slate-700 p-3 overflow-y-auto">
              <h3 className="text-sm font-medium text-slate-400 mb-3">Glyph Properties</h3>

              <div className="space-y-3 text-sm">
                <div>
                  <label className="text-xs text-slate-500">Advance</label>
                  <input
                    type="number"
                    step="0.001"
                    value={currentGlyph.advance}
                    onChange={(e) => {
                      if (!selectedChar) return;
                      setEditedGlyphs((prev: typeof originalGlyphs) => ({
                        ...prev,
                        [selectedChar]: {
                          ...prev[selectedChar],
                          advance: parseFloat(e.target.value) || 0
                        }
                      }));
                    }}
                    className="w-full bg-slate-800 text-white px-2 py-1 rounded border border-slate-600 text-xs"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-500">Is Mark</label>
                  <select
                    value={currentGlyph.is_mark ? 'true' : 'false'}
                    onChange={(e) => {
                      if (!selectedChar) return;
                      setEditedGlyphs((prev: typeof originalGlyphs) => ({
                        ...prev,
                        [selectedChar]: {
                          ...prev[selectedChar],
                          is_mark: e.target.value === 'true'
                        }
                      }));
                    }}
                    className="w-full bg-slate-800 text-white px-2 py-1 rounded border border-slate-600 text-xs"
                  >
                    <option value="false">No (Base character)</option>
                    <option value="true">Yes (Diacritic/Mark)</option>
                  </select>
                </div>

                {currentGlyph.anchor && (
                  <>
                    <div>
                      <label className="text-xs text-slate-500">Anchor Mode</label>
                      <select
                        value={currentGlyph.anchor.mode}
                        onChange={(e) => {
                          if (!selectedChar) return;
                          setEditedGlyphs((prev: typeof originalGlyphs) => ({
                            ...prev,
                            [selectedChar]: {
                              ...prev[selectedChar],
                              anchor: {
                                ...prev[selectedChar].anchor,
                                mode: e.target.value
                              }
                            }
                          }));
                        }}
                        className="w-full bg-slate-800 text-white px-2 py-1 rounded border border-slate-600 text-xs"
                      >
                        <option value="base">Base</option>
                        <option value="center">Center</option>
                        <option value="right">Right</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs text-slate-500">Anchor DX</label>
                      <input
                        type="number"
                        step="0.001"
                        value={currentGlyph.anchor.dx || 0}
                        onChange={(e) => {
                          if (!selectedChar) return;
                          setEditedGlyphs((prev: typeof originalGlyphs) => ({
                            ...prev,
                            [selectedChar]: {
                              ...prev[selectedChar],
                              anchor: {
                                ...prev[selectedChar].anchor,
                                dx: parseFloat(e.target.value) || 0
                              }
                            }
                          }));
                        }}
                        className="w-full bg-slate-800 text-white px-2 py-1 rounded border border-slate-600 text-xs"
                      />
                    </div>
                  </>
                )}

                {/* Selected path points */}
                <div className="mt-4">
                  <h4 className="text-xs text-slate-500 mb-2">Path {selectedPath + 1} Points</h4>
                  <div className="max-h-60 overflow-y-auto space-y-1">
                    {currentPath.map((point: number[], idx: number) => (
                      <div
                        key={idx}
                        onClick={() => setSelectedPoint(idx)}
                        className={`flex items-center gap-2 px-2 py-1 rounded cursor-pointer text-xs font-mono ${
                          selectedPoint === idx
                            ? 'bg-orange-600 text-white'
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        <span className="w-4">{idx}</span>
                        <span>{point[0].toFixed(3)}</span>
                        <span>,</span>
                        <span>{point[1].toFixed(3)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
