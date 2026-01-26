import { memo, useCallback } from 'react';
import { Handle, Position } from '@xyflow/react';

interface ShapeNodeData extends Record<string, unknown> {
  label: string;
  color?: 1 | 2 | 3 | 4;
}

// Default colors for the 4 color wells (matches VectorSettings defaults)
const COLOR_WELL_COLORS = ['#1e40af', '#dc2626', '#16a34a', '#171717'];

type ShapeNodeProps = {
  id: string;
  data: ShapeNodeData;
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
      <label className="text-xs text-slate-400 w-6">{label}</label>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(field, parseFloat(e.target.value) || 0)}
        className="flex-1 bg-slate-700 text-white text-xs px-2 py-1 rounded border border-slate-600 focus:border-blue-500 focus:outline-none w-16"
      />
    </div>
  );
}

// Generic shape node that can render different shape types
function ShapeNodeComponent({ data, id }: ShapeNodeProps) {
  const handleChange = useCallback((field: string, value: number) => {
    // Dispatch custom event for data update
    const event = new CustomEvent('nodeDataChange', {
      detail: { nodeId: id, field, value },
    });
    window.dispatchEvent(event);
  }, [id]);

  const handleColorChange = useCallback((colorIndex: 1 | 2 | 3 | 4 | undefined) => {
    const event = new CustomEvent('nodeDataChange', {
      detail: { nodeId: id, field: 'color', value: colorIndex },
    });
    window.dispatchEvent(event);
  }, [id]);

  // Determine which fields to show based on node type
  const nodeData = data as Record<string, unknown>;
  const label = (nodeData.label as string) || 'Shape';

  // Get node type icon and color
  const getNodeStyle = () => {
    switch (label.toLowerCase()) {
      case 'line':
        return { icon: '/', color: 'border-blue-500 bg-blue-500/10' };
      case 'rectangle':
        return { icon: '[]', color: 'border-green-500 bg-green-500/10' };
      case 'circle':
        return { icon: 'O', color: 'border-yellow-500 bg-yellow-500/10' };
      case 'ellipse':
        return { icon: '()', color: 'border-orange-500 bg-orange-500/10' };
      case 'arc':
        return { icon: ')', color: 'border-pink-500 bg-pink-500/10' };
      case 'polygon':
        return { icon: '<>', color: 'border-purple-500 bg-purple-500/10' };
      default:
        return { icon: '*', color: 'border-slate-500 bg-slate-500/10' };
    }
  };

  const { icon, color } = getNodeStyle();

  // Render fields based on what data is present
  const renderFields = () => {
    const fields: JSX.Element[] = [];

    if ('x1' in nodeData) {
      fields.push(
        <div key="line-coords" className="grid grid-cols-2 gap-1">
          <InputField label="x1" value={nodeData.x1 as number} field="x1" onChange={handleChange} />
          <InputField label="y1" value={nodeData.y1 as number} field="y1" onChange={handleChange} />
          <InputField label="x2" value={nodeData.x2 as number} field="x2" onChange={handleChange} />
          <InputField label="y2" value={nodeData.y2 as number} field="y2" onChange={handleChange} />
        </div>
      );
    }

    if ('width' in nodeData && 'height' in nodeData) {
      fields.push(
        <div key="rect-params" className="space-y-1">
          <div className="grid grid-cols-2 gap-1">
            <InputField label="x" value={nodeData.x as number} field="x" onChange={handleChange} />
            <InputField label="y" value={nodeData.y as number} field="y" onChange={handleChange} />
          </div>
          <div className="grid grid-cols-2 gap-1">
            <InputField label="w" value={nodeData.width as number} field="width" onChange={handleChange} />
            <InputField label="h" value={nodeData.height as number} field="height" onChange={handleChange} />
          </div>
        </div>
      );
    }

    if ('cx' in nodeData && 'cy' in nodeData && 'radius' in nodeData && !('startAngle' in nodeData) && !('sides' in nodeData)) {
      fields.push(
        <div key="circle-params" className="space-y-1">
          <div className="grid grid-cols-2 gap-1">
            <InputField label="cx" value={nodeData.cx as number} field="cx" onChange={handleChange} />
            <InputField label="cy" value={nodeData.cy as number} field="cy" onChange={handleChange} />
          </div>
          <InputField label="r" value={nodeData.radius as number} field="radius" onChange={handleChange} />
        </div>
      );
    }

    if ('rx' in nodeData && 'ry' in nodeData) {
      fields.push(
        <div key="ellipse-params" className="space-y-1">
          <div className="grid grid-cols-2 gap-1">
            <InputField label="cx" value={nodeData.cx as number} field="cx" onChange={handleChange} />
            <InputField label="cy" value={nodeData.cy as number} field="cy" onChange={handleChange} />
          </div>
          <div className="grid grid-cols-2 gap-1">
            <InputField label="rx" value={nodeData.rx as number} field="rx" onChange={handleChange} />
            <InputField label="ry" value={nodeData.ry as number} field="ry" onChange={handleChange} />
          </div>
        </div>
      );
    }

    if ('startAngle' in nodeData && 'endAngle' in nodeData) {
      fields.push(
        <div key="arc-params" className="space-y-1">
          <div className="grid grid-cols-2 gap-1">
            <InputField label="cx" value={nodeData.cx as number} field="cx" onChange={handleChange} />
            <InputField label="cy" value={nodeData.cy as number} field="cy" onChange={handleChange} />
          </div>
          <InputField label="r" value={nodeData.radius as number} field="radius" onChange={handleChange} />
          <div className="grid grid-cols-2 gap-1">
            <InputField label="s" value={nodeData.startAngle as number} field="startAngle" onChange={handleChange} />
            <InputField label="e" value={nodeData.endAngle as number} field="endAngle" onChange={handleChange} />
          </div>
        </div>
      );
    }

    if ('sides' in nodeData) {
      fields.push(
        <div key="polygon-params" className="space-y-1">
          <div className="grid grid-cols-2 gap-1">
            <InputField label="cx" value={nodeData.cx as number} field="cx" onChange={handleChange} />
            <InputField label="cy" value={nodeData.cy as number} field="cy" onChange={handleChange} />
          </div>
          <div className="grid grid-cols-2 gap-1">
            <InputField label="r" value={nodeData.radius as number} field="radius" onChange={handleChange} />
            <InputField label="n" value={nodeData.sides as number} field="sides" onChange={handleChange} />
          </div>
        </div>
      );
    }

    return fields;
  };

  return (
    <div className={`rounded-lg border-2 ${color} bg-slate-800 shadow-lg min-w-[160px]`}>
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-slate-400 !border-slate-600 !w-3 !h-3"
      />

      <div className="px-3 py-2 border-b border-slate-700 flex items-center gap-2">
        <span className="text-lg font-mono text-slate-300">{icon}</span>
        <span className="font-medium text-white text-sm">{label}</span>
      </div>

      <div className="p-2 space-y-2">
        {renderFields()}

        {/* Color selector for multi-color mode */}
        <div className="flex items-center gap-1 pt-1 border-t border-slate-700">
          <span className="text-xs text-slate-500 mr-1">Ink:</span>
          <button
            onClick={() => handleColorChange(undefined)}
            className={`w-5 h-5 rounded text-[10px] font-medium transition-all ${
              !nodeData.color
                ? 'bg-slate-600 text-white ring-1 ring-white'
                : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
            }`}
            title="Use main color"
          >
            M
          </button>
          {[1, 2, 3, 4].map((i) => (
            <button
              key={i}
              onClick={() => handleColorChange(i as 1 | 2 | 3 | 4)}
              className={`w-5 h-5 rounded transition-all ${
                nodeData.color === i
                  ? 'ring-1 ring-white scale-110'
                  : 'opacity-60 hover:opacity-100'
              }`}
              style={{ backgroundColor: COLOR_WELL_COLORS[i - 1] }}
              title={`Color ${i}`}
            />
          ))}
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-slate-400 !border-slate-600 !w-3 !h-3"
      />
    </div>
  );
}

export const ShapeNode = memo(ShapeNodeComponent);
