import { memo, useCallback } from 'react';
import { Handle, Position } from '@xyflow/react';

interface CodeNodeData extends Record<string, unknown> {
  label: string;
  code: string;
  error?: string;
}

type CodeNodeProps = {
  id: string;
  data: CodeNodeData;
};

function CodeNodeComponent({ data, id }: CodeNodeProps) {
  const handleOpenEditor = useCallback(() => {
    const event = new CustomEvent('openCodeEditor', {
      detail: { nodeId: id, code: data.code || '' },
    });
    window.dispatchEvent(event);
  }, [id, data.code]);

  // Get first few lines of code for preview
  const codePreview = (data.code || '')
    .split('\n')
    .filter(line => !line.trim().startsWith('//')) // Skip comments
    .slice(0, 4)
    .join('\n')
    .trim() || '// Empty';

  return (
    <div className="rounded-lg border-2 border-emerald-500 bg-emerald-500/10 bg-slate-800 shadow-lg min-w-[180px] max-w-[220px]">
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-emerald-400 !border-emerald-600 !w-3 !h-3"
      />

      <div className="px-3 py-2 border-b border-slate-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg font-mono text-emerald-400">{`</>`}</span>
          <span className="font-medium text-white text-sm">{data.label || 'Code'}</span>
        </div>
        <button
          onClick={handleOpenEditor}
          className="p-1 text-slate-400 hover:text-emerald-400 hover:bg-slate-700 rounded transition-colors"
          title="Edit code"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </button>
      </div>

      {data.error && (
        <div className="px-3 py-1.5 bg-red-500/20 border-b border-red-500/30">
          <p className="text-[10px] text-red-400 font-mono truncate" title={data.error}>
            {data.error}
          </p>
        </div>
      )}

      {/* Code preview */}
      <div className="px-3 py-2">
        <pre className="text-[10px] text-slate-400 font-mono overflow-hidden whitespace-pre-wrap leading-tight max-h-[60px]">
          {codePreview}
        </pre>
      </div>

      {/* Edit button */}
      <div className="px-3 py-2 border-t border-slate-700">
        <button
          onClick={handleOpenEditor}
          className="w-full px-3 py-1.5 text-xs text-emerald-400 hover:text-white bg-emerald-500/10 hover:bg-emerald-500/30 rounded transition-colors font-medium"
        >
          Edit Code
        </button>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-emerald-400 !border-emerald-600 !w-3 !h-3"
      />
    </div>
  );
}

export const CodeNode = memo(CodeNodeComponent);
