import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';

interface OutputNodeData {
  label: string;
}

type OutputNodeProps = {
  data: OutputNodeData;
};

function OutputNodeComponent({ data }: OutputNodeProps) {
  return (
    <div
      className="flex items-center gap-2 px-4 py-2 rounded-full border-2 border-emerald-500"
      style={{ backgroundColor: '#1e293b' }}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-emerald-500 !border-slate-700 !w-3 !h-3"
      />
      <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
      <span className="font-medium text-emerald-400 text-sm">
        {data.label || 'Output'}
      </span>
    </div>
  );
}

export const OutputNode = memo(OutputNodeComponent);
