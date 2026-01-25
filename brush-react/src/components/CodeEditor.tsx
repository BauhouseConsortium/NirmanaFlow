import Editor from '@monaco-editor/react';
import type { Monaco } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import { useRef, useCallback } from 'react';

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
}

// API type definitions for autocomplete
const apiDefinitions = `
declare const api: {
  width: number;
  height: number;
};

declare const width: number;
declare const height: number;

// Drawing primitives
declare function line(x1: number, y1: number, x2: number, y2: number): void;
declare function rect(x: number, y: number, w: number, h: number): void;
declare function circle(cx: number, cy: number, r: number, segments?: number): void;
declare function ellipse(cx: number, cy: number, rx: number, ry: number, segments?: number): void;
declare function arc(cx: number, cy: number, r: number, startAngle: number, endAngle: number, segments?: number): void;
declare function polygon(points: [number, number][]): void;
declare function polyline(points: [number, number][]): void;

// Path building
declare function beginPath(): void;
declare function moveTo(x: number, y: number): void;
declare function lineTo(x: number, y: number): void;
declare function endPath(): void;

// Curves
declare function bezier(x1: number, y1: number, cx1: number, cy1: number, cx2: number, cy2: number, x2: number, y2: number, segments?: number): void;
declare function quadratic(x1: number, y1: number, cx: number, cy: number, x2: number, y2: number, segments?: number): void;

// Noise
declare function noise(x: number, y?: number, z?: number): number;
declare function noiseSeed(seed: number): void;

// Random
declare function random(min?: number, max?: number): number;
declare function randomSeed(seed: number): void;

// Math helpers
declare function map(value: number, start1: number, stop1: number, start2: number, stop2: number): number;
declare function constrain(value: number, min: number, max: number): number;
declare function lerp(start: number, stop: number, amt: number): number;
declare function dist(x1: number, y1: number, x2: number, y2: number): number;

// Trig (degrees)
declare function sin(angle: number): number;
declare function cos(angle: number): number;
declare function radians(degrees: number): number;
declare function degrees(radians: number): number;
`;

export function CodeEditor({ value, onChange, error }: CodeEditorProps) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);

  const handleEditorDidMount = useCallback((editorInstance: editor.IStandaloneCodeEditor, monaco: Monaco) => {
    editorRef.current = editorInstance;

    // Add custom type definitions
    monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: false,
      noSyntaxValidation: false,
    });

    monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
      target: monaco.languages.typescript.ScriptTarget.ES2020,
      allowNonTsExtensions: true,
      moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
      module: monaco.languages.typescript.ModuleKind.CommonJS,
      noEmit: true,
      lib: ['es2020'],
    });

    // Add API definitions
    monaco.languages.typescript.javascriptDefaults.addExtraLib(
      apiDefinitions,
      'ts:filename/drawing-api.d.ts'
    );

    // Custom theme
    monaco.editor.defineTheme('plotter-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '6b7280' },
        { token: 'keyword', foreground: 'c084fc' },
        { token: 'string', foreground: '86efac' },
        { token: 'number', foreground: '7dd3fc' },
        { token: 'identifier', foreground: 'e2e8f0' },
      ],
      colors: {
        'editor.background': '#1e293b',
        'editor.foreground': '#e2e8f0',
        'editor.lineHighlightBackground': '#334155',
        'editor.selectionBackground': '#475569',
        'editorCursor.foreground': '#60a5fa',
        'editorLineNumber.foreground': '#64748b',
        'editorLineNumber.activeForeground': '#94a3b8',
      },
    });

    monaco.editor.setTheme('plotter-dark');
  }, []);

  const handleChange = useCallback((val: string | undefined) => {
    onChange(val || '');
  }, [onChange]);

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 min-h-0 rounded-lg overflow-hidden border border-slate-700">
        <Editor
          height="100%"
          defaultLanguage="javascript"
          value={value}
          onChange={handleChange}
          onMount={handleEditorDidMount}
          options={{
            minimap: { enabled: false },
            fontSize: 13,
            fontFamily: 'JetBrains Mono, Menlo, Monaco, Consolas, monospace',
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
            wordWrap: 'on',
            padding: { top: 12, bottom: 12 },
            scrollbar: {
              verticalScrollbarSize: 8,
              horizontalScrollbarSize: 8,
            },
          }}
          loading={
            <div className="h-full flex items-center justify-center bg-slate-800 text-slate-400">
              Loading editor...
            </div>
          }
        />
      </div>
      {error && (
        <div className="mt-2 p-2 bg-red-900/50 border border-red-700 rounded-lg text-sm text-red-300 font-mono">
          {error}
        </div>
      )}
    </div>
  );
}
