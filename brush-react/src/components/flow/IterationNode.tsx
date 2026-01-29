import { memo, useCallback, type ReactElement } from 'react';
import { Handle, Position } from '@xyflow/react';

interface IterationNodeData extends Record<string, unknown> {
  label: string;
}

type IterationNodeProps = {
  id: string;
  data: IterationNodeData;
};

interface InputFieldProps {
  label: string;
  value: number;
  field: string;
  onChange: (field: string, value: number) => void;
}

function InputField({ label, value, field, onChange }: InputFieldProps) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-xs text-slate-400 w-8">{label}</label>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(field, parseFloat(e.target.value) || 0)}
        className="flex-1 bg-slate-700 text-white text-xs px-2 py-1 rounded border border-slate-600 focus:border-cyan-500 focus:outline-none w-14"
      />
    </div>
  );
}

function IterationNodeComponent({ data, id }: IterationNodeProps) {
  const handleChange = useCallback((field: string, value: number) => {
    const event = new CustomEvent('nodeDataChange', {
      detail: { nodeId: id, field, value },
    });
    window.dispatchEvent(event);
  }, [id]);

  const nodeData = data as Record<string, unknown>;
  const label = (nodeData.label as string) || 'Iteration';

  const getNodeStyle = () => {
    switch (label.toLowerCase()) {
      case 'repeat':
        return { icon: '#', color: 'border-cyan-500 bg-cyan-500/10' };
      case 'grid':
        return { icon: ':::' , color: 'border-emerald-500 bg-emerald-500/10' };
      case 'radial':
        return { icon: '*', color: 'border-rose-500 bg-rose-500/10' };
      default:
        return { icon: '~', color: 'border-slate-500 bg-slate-500/10' };
    }
  };

  const { icon, color } = getNodeStyle();

  const renderFields = () => {
    const fields: ReactElement[] = [];

    if ('count' in nodeData && 'offsetX' in nodeData) {
      // Repeat node
      fields.push(
        <div key="repeat-params" className="space-y-1">
          <InputField label="n" value={nodeData.count as number} field="count" onChange={handleChange} />
          <div className="grid grid-cols-2 gap-1">
            <InputField label="dx" value={nodeData.offsetX as number} field="offsetX" onChange={handleChange} />
            <InputField label="dy" value={nodeData.offsetY as number} field="offsetY" onChange={handleChange} />
          </div>
          <div className="grid grid-cols-2 gap-1">
            <InputField label="rot" value={nodeData.rotation as number} field="rotation" onChange={handleChange} />
            <InputField label="scl" value={nodeData.scale as number} field="scale" onChange={handleChange} />
          </div>
        </div>
      );
    }

    if ('cols' in nodeData && 'rows' in nodeData) {
      // Grid node
      fields.push(
        <div key="grid-params" className="space-y-1">
          <div className="grid grid-cols-2 gap-1">
            <InputField label="cols" value={nodeData.cols as number} field="cols" onChange={handleChange} />
            <InputField label="rows" value={nodeData.rows as number} field="rows" onChange={handleChange} />
          </div>
          <div className="grid grid-cols-2 gap-1">
            <InputField label="sx" value={nodeData.spacingX as number} field="spacingX" onChange={handleChange} />
            <InputField label="sy" value={nodeData.spacingY as number} field="spacingY" onChange={handleChange} />
          </div>
          <div className="grid grid-cols-2 gap-1">
            <InputField label="x0" value={nodeData.startX as number} field="startX" onChange={handleChange} />
            <InputField label="y0" value={nodeData.startY as number} field="startY" onChange={handleChange} />
          </div>
        </div>
      );
    }

    if ('count' in nodeData && 'radius' in nodeData && 'startAngle' in nodeData) {
      // Radial node
      fields.push(
        <div key="radial-params" className="space-y-1">
          <InputField label="n" value={nodeData.count as number} field="count" onChange={handleChange} />
          <div className="grid grid-cols-2 gap-1">
            <InputField label="cx" value={nodeData.cx as number} field="cx" onChange={handleChange} />
            <InputField label="cy" value={nodeData.cy as number} field="cy" onChange={handleChange} />
          </div>
          <div className="grid grid-cols-2 gap-1">
            <InputField label="r" value={nodeData.radius as number} field="radius" onChange={handleChange} />
            <InputField label="ang" value={nodeData.startAngle as number} field="startAngle" onChange={handleChange} />
          </div>
        </div>
      );
    }

    return fields;
  };

  return (
    <div className={`rounded-lg border-2 ${color} bg-slate-800 shadow-lg min-w-[180px]`}>
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-slate-400 !border-slate-600 !w-3 !h-3"
      />

      <div className="px-3 py-2 border-b border-slate-700 flex items-center gap-2">
        <span className="text-lg font-mono text-slate-300">{icon}</span>
        <span className="font-medium text-white text-sm">{label}</span>
      </div>

      <div className="p-2 space-y-1">
        {renderFields()}
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-slate-400 !border-slate-600 !w-3 !h-3"
      />
    </div>
  );
}

export const IterationNode = memo(IterationNodeComponent);
