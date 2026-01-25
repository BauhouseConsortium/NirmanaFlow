import { useRef, useEffect } from 'react';

interface PreviewProps {
  gcodeLines: string[];
  width?: number;
  height?: number;
}

interface ParsedPoint {
  x: number;
  y: number;
  z: number;
  isRapid: boolean;
}

function parseGCodeLines(lines: string[]): ParsedPoint[] {
  const points: ParsedPoint[] = [];
  let x = 0, y = 0, z = 5;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith(';') || trimmed === '%') continue;

    const isG0 = trimmed.startsWith('G0');
    const isG1 = trimmed.startsWith('G1');

    if (!isG0 && !isG1) continue;

    const xMatch = trimmed.match(/X(-?[\d.]+)/);
    const yMatch = trimmed.match(/Y(-?[\d.]+)/);
    const zMatch = trimmed.match(/Z(-?[\d.]+)/);

    if (xMatch) x = parseFloat(xMatch[1]);
    if (yMatch) y = parseFloat(yMatch[1]);
    if (zMatch) z = parseFloat(zMatch[1]);

    points.push({ x, y, z, isRapid: isG0 });
  }

  return points;
}

export function Preview({ gcodeLines, width = 600, height = 400 }: PreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Get device pixel ratio for sharp rendering
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    // Clear canvas
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    // Draw grid
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 0.5;

    const gridSize = 20; // 20mm grid
    const scale = Math.min(width, height) / 160; // Scale to fit ~150mm work area

    for (let x = 0; x <= width; x += gridSize * scale) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    for (let y = 0; y <= height; y += gridSize * scale) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Draw work area boundary
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1;
    ctx.strokeRect(2, 2, 150 * scale, 140 * scale);

    // Parse and draw G-code
    const points = parseGCodeLines(gcodeLines);

    if (points.length === 0) {
      // No G-code yet - show placeholder
      ctx.fillStyle = '#94a3b8';
      ctx.font = '14px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('Enter text to generate preview', width / 2, height / 2);
      return;
    }

    let prevPoint: ParsedPoint | null = null;
    const penDown = (z: number) => z <= 0.1;

    for (const point of points) {
      if (prevPoint) {
        const fromX = prevPoint.x * scale;
        const fromY = (140 - prevPoint.y) * scale; // Flip Y
        const toX = point.x * scale;
        const toY = (140 - point.y) * scale;

        ctx.beginPath();
        ctx.moveTo(fromX, fromY);
        ctx.lineTo(toX, toY);

        if (penDown(point.z) && penDown(prevPoint.z)) {
          // Drawing stroke
          ctx.strokeStyle = '#3b82f6';
          ctx.lineWidth = 2;
        } else {
          // Travel move
          ctx.strokeStyle = '#e5e7eb';
          ctx.lineWidth = 0.5;
        }

        ctx.stroke();
      }

      prevPoint = point;
    }

    // Draw start/end markers
    if (points.length > 0) {
      // Start marker (green)
      ctx.fillStyle = '#22c55e';
      ctx.beginPath();
      ctx.arc(points[0].x * scale, (140 - points[0].y) * scale, 4, 0, Math.PI * 2);
      ctx.fill();

      // End marker (red)
      const lastPoint = points[points.length - 1];
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(lastPoint.x * scale, (140 - lastPoint.y) * scale, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [gcodeLines, width, height]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-slate-300">Preview</h3>
        <div className="flex items-center gap-4 text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-500"></span> Start
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-500"></span> End
          </span>
        </div>
      </div>
      <div className="bg-white rounded-lg overflow-hidden shadow-inner">
        <canvas
          ref={canvasRef}
          style={{ width, height }}
          className="block"
        />
      </div>
    </div>
  );
}
