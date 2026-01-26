import { useCallback, useRef, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Editor from '@monaco-editor/react';
import type { editor } from 'monaco-editor';

interface CodeEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  nodeId: string;
  initialCode: string;
}

const API_REFERENCE = `// ═══════════════════════════════════════════════════════════════
// CODE NODE API REFERENCE
// ═══════════════════════════════════════════════════════════════
//
// INPUTS:
//   input    - Path[] from connected nodes (array of paths)
//   api      - Drawing API helpers (see below)
//   Math     - Safe math functions
//
// RETURN:
//   Path[]   - Array of paths, where Path = Point[] and Point = [x, y]
//
// ───────────────────────────────────────────────────────────────
// SHAPE GENERATORS (return single Path)
// ───────────────────────────────────────────────────────────────
//   api.line(x1, y1, x2, y2)              → [[x1,y1], [x2,y2]]
//   api.rect(x, y, w, h)                  → rectangle path
//   api.circle(cx, cy, r, segs=36)        → circle path
//   api.ellipse(cx, cy, rx, ry, segs=36)  → ellipse path
//   api.arc(cx, cy, r, start°, end°, segs=24) → arc path
//   api.polygon(sides, cx, cy, r)         → regular polygon
//   api.polyline([[x,y], ...])            → path from points
//
// ───────────────────────────────────────────────────────────────
// TRANSFORM HELPERS (return Path[])
// ───────────────────────────────────────────────────────────────
//   api.transform(paths, dx, dy, rot=0, scale=1, cx=0, cy=0)
//   api.translate(paths, dx, dy)
//   api.rotate(paths, angle°, cx=0, cy=0)
//   api.scale(paths, sx, sy?, cx=0, cy=0)
//
// ───────────────────────────────────────────────────────────────
// UTILITY
// ───────────────────────────────────────────────────────────────
//   api.centroid(paths)     → [x, y] center point
//   api.bounds(paths)       → { minX, minY, maxX, maxY }
//
// ───────────────────────────────────────────────────────────────
// NOISE & RANDOM
// ───────────────────────────────────────────────────────────────
//   api.noise(x, y?, z?)    → 0-1 (Perlin-like)
//   api.random()            → 0-1
//   api.random(max)         → 0-max
//   api.random(min, max)    → min-max
//   api.randomSeed(seed)    → set seed for reproducibility
//
// ───────────────────────────────────────────────────────────────
// MATH HELPERS
// ───────────────────────────────────────────────────────────────
//   api.map(val, in1, in2, out1, out2) → remap value
//   api.lerp(a, b, t)                  → linear interpolation
//   api.constrain(val, min, max)       → clamp value
//   api.dist(x1, y1, x2, y2)           → distance
//
// ───────────────────────────────────────────────────────────────
// TRIGONOMETRY (degrees)
// ───────────────────────────────────────────────────────────────
//   api.sin(deg), api.cos(deg), api.tan(deg)
//   api.atan2(y, x) → degrees
//   api.radians(deg), api.degrees(rad)
//   api.PI, api.TWO_PI, api.HALF_PI
//
// ═══════════════════════════════════════════════════════════════

`;

export function CodeEditorModal({ isOpen, onClose, nodeId, initialCode }: CodeEditorModalProps) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const [code, setCode] = useState(initialCode);

  // Sync code when modal opens with new initialCode
  useEffect(() => {
    if (isOpen) {
      setCode(initialCode);
    }
  }, [isOpen, initialCode]);

  const handleEditorMount = useCallback((editor: editor.IStandaloneCodeEditor) => {
    editorRef.current = editor;
    // Focus the editor when mounted
    editor.focus();
  }, []);

  const handleCodeChange = useCallback((value: string | undefined) => {
    setCode(value || '');
  }, []);

  const handleSave = useCallback(() => {
    // Dispatch event to update node data
    const event = new CustomEvent('nodeDataChange', {
      detail: { nodeId, field: 'code', value: code },
    });
    window.dispatchEvent(event);
    onClose();
  }, [nodeId, code, onClose]);

  const handleInsertTemplate = useCallback((template: string) => {
    const editor = editorRef.current;
    if (editor) {
      const selection = editor.getSelection();
      if (selection) {
        editor.executeEdits('insert-template', [{
          range: selection,
          text: template,
        }]);
      }
    }
  }, []);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 's' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleSave();
      }
    };

    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onClose, handleSave]);

  if (!isOpen) return null;

  const templates = [
    {
      name: 'Pass Through',
      code: `// Pass input through unchanged
return input;`,
    },
    {
      name: 'Noise Displace',
      code: `// Displace points using noise
const output = [];
for (const path of input) {
  const newPath = path.map(([x, y]) => {
    const n = api.noise(x * 0.05, y * 0.05);
    return [x + (n - 0.5) * 10, y + (n - 0.5) * 10];
  });
  output.push(newPath);
}
return output;`,
    },
    {
      name: 'Grid Clone',
      code: `// Clone input in a grid pattern
const output = [];
const cols = 3, rows = 3;
const spacing = 40;

for (let row = 0; row < rows; row++) {
  for (let col = 0; col < cols; col++) {
    const dx = col * spacing;
    const dy = row * spacing;
    output.push(...api.translate(input, dx, dy));
  }
}
return output;`,
    },
    {
      name: 'Spiral Pattern',
      code: `// Generate spiral pattern
const output = [];
const turns = 5;
const points = 200;

for (let i = 0; i < points; i++) {
  const t = i / points;
  const angle = t * turns * api.TWO_PI;
  const r = 5 + t * 50;
  const x = 75 + Math.cos(angle) * r;
  const y = 60 + Math.sin(angle) * r;

  if (i > 0) {
    const prev = output[output.length - 1];
    prev.push([x, y]);
  } else {
    output.push([[x, y]]);
  }
}
return output;`,
    },
    {
      name: 'Generate Circles',
      code: `// Generate random circles
const output = [];
api.randomSeed(42);

for (let i = 0; i < 20; i++) {
  const x = api.random(20, 130);
  const y = api.random(20, 100);
  const r = api.random(3, 15);
  output.push(api.circle(x, y, r, 24));
}
return output;`,
    },
  ];

  const modal = (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ zIndex: 9999 }}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-slate-900 rounded-xl shadow-2xl border border-slate-700 w-[900px] max-w-[95vw] h-[700px] max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <span className="text-lg font-mono text-emerald-400">{`</>`}</span>
            <span className="font-medium text-white">Code Editor</span>
            <span className="text-xs text-slate-500">Node: {nodeId}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Cmd/Ctrl+S to save</span>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Templates bar */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-slate-800 bg-slate-800/50">
          <span className="text-xs text-slate-500">Templates:</span>
          {templates.map((t) => (
            <button
              key={t.name}
              onClick={() => handleInsertTemplate(t.code)}
              className="px-2 py-1 text-xs text-slate-300 hover:text-white bg-slate-700 hover:bg-slate-600 rounded transition-colors"
            >
              {t.name}
            </button>
          ))}
        </div>

        {/* Editor */}
        <div className="flex-1 overflow-hidden">
          <Editor
            height="100%"
            defaultLanguage="javascript"
            value={API_REFERENCE + code}
            onChange={(value) => {
              // Strip the API reference when saving
              const newValue = value || '';
              const refEnd = newValue.indexOf('// ═══════════════════════════════════════════════════════════════\n\n');
              if (refEnd !== -1) {
                handleCodeChange(newValue.slice(refEnd + 68)); // Length of the closing line + 2 newlines
              } else {
                handleCodeChange(newValue);
              }
            }}
            onMount={handleEditorMount}
            theme="vs-dark"
            options={{
              minimap: { enabled: true },
              fontSize: 13,
              lineNumbers: 'on',
              folding: true,
              scrollBeyondLastLine: false,
              wordWrap: 'on',
              automaticLayout: true,
              padding: { top: 16, bottom: 16 },
              scrollbar: {
                vertical: 'auto',
                horizontal: 'auto',
                verticalScrollbarSize: 10,
              },
              tabSize: 2,
              renderLineHighlight: 'line',
              cursorBlinking: 'smooth',
              smoothScrolling: true,
            }}
          />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-700 bg-slate-800/50">
          <div className="text-xs text-slate-500">
            Press <kbd className="px-1.5 py-0.5 bg-slate-700 rounded text-slate-300">Esc</kbd> to cancel
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 text-sm text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors font-medium"
            >
              Save & Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
