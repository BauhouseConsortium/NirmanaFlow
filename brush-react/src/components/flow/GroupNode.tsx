import { memo, useState, useCallback } from 'react';
import { Handle, Position, NodeResizer } from '@xyflow/react';

interface GroupNodeData {
  label: string;
  collapsed?: boolean;
}

type GroupNodeProps = {
  id: string;
  data: GroupNodeData;
  selected?: boolean;
};

function GroupNodeComponent({ id, data, selected }: GroupNodeProps) {
  const [isCollapsed, setIsCollapsed] = useState(data.collapsed || false);
  const [isEditing, setIsEditing] = useState(false);
  const [labelValue, setLabelValue] = useState(data.label || 'Group');

  const handleToggleCollapse = useCallback(() => {
    const newCollapsed = !isCollapsed;
    setIsCollapsed(newCollapsed);

    // Dispatch event to update node data and toggle children visibility
    const event = new CustomEvent('groupCollapse', {
      detail: { nodeId: id, collapsed: newCollapsed },
    });
    window.dispatchEvent(event);
  }, [id, isCollapsed]);

  const handleLabelChange = useCallback(() => {
    setIsEditing(false);
    const event = new CustomEvent('nodeDataChange', {
      detail: { nodeId: id, field: 'label', value: labelValue },
    });
    window.dispatchEvent(event);
  }, [id, labelValue]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleLabelChange();
    }
    if (e.key === 'Escape') {
      setIsEditing(false);
      setLabelValue(data.label || 'Group');
    }
  }, [handleLabelChange, data.label]);

  return (
    <>
      <NodeResizer
        minWidth={150}
        minHeight={100}
        isVisible={selected}
        lineClassName="!border-violet-500"
        handleClassName="!w-2 !h-2 !bg-violet-500 !border-violet-600"
      />

      <div
        className={`h-full w-full rounded-lg border-2 border-dashed transition-colors ${
          selected ? 'border-violet-500' : 'border-slate-600'
        } ${isCollapsed ? 'border-solid' : ''}`}
        style={{ backgroundColor: 'rgba(139, 92, 246, 0.05)' }}
      >
        {/* Header */}
        <div className="absolute -top-7 left-0 right-0 flex items-center gap-2">
          {/* Collapse toggle */}
          <button
            onClick={handleToggleCollapse}
            className="w-5 h-5 flex items-center justify-center rounded bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors"
            title={isCollapsed ? 'Expand group' : 'Collapse group'}
          >
            <svg
              className={`w-3 h-3 transition-transform ${isCollapsed ? '' : 'rotate-90'}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {/* Label */}
          {isEditing ? (
            <input
              type="text"
              value={labelValue}
              onChange={(e) => setLabelValue(e.target.value)}
              onBlur={handleLabelChange}
              onKeyDown={handleKeyDown}
              autoFocus
              className="bg-slate-700 text-violet-300 text-sm px-2 py-0.5 rounded border border-violet-500 focus:outline-none w-32"
            />
          ) : (
            <span
              onClick={() => setIsEditing(true)}
              className="text-sm font-medium text-violet-400 cursor-pointer hover:text-violet-300 px-2 py-0.5 rounded hover:bg-slate-700/50"
            >
              {data.label || 'Group'}
            </span>
          )}
        </div>

        {/* Collapsed indicator */}
        {isCollapsed && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-slate-500 text-sm flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <span>Collapsed</span>
            </div>
          </div>
        )}

        {/* Connection handles */}
        <Handle
          type="target"
          position={Position.Top}
          className="!bg-violet-500 !border-slate-700 !w-3 !h-3"
        />
        <Handle
          type="source"
          position={Position.Bottom}
          className="!bg-violet-500 !border-slate-700 !w-3 !h-3"
        />
      </div>
    </>
  );
}

export const GroupNode = memo(GroupNodeComponent);
