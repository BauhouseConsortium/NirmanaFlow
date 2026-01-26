import { memo } from 'react';
import { nodeCategories } from './nodeTypes';

interface NodePaletteProps {
  onAddNode: (type: string) => void;
}

function NodePaletteComponent({ onAddNode }: NodePaletteProps) {
  return (
    <div className="bg-slate-800/95 backdrop-blur-sm rounded-lg border border-slate-700 p-3 w-48">
      <h3 className="text-sm font-semibold text-slate-300 mb-3">Add Node</h3>

      {/* Shapes */}
      <div className="mb-3">
        <h4 className="text-xs font-medium text-blue-400 mb-2 uppercase tracking-wider">Shapes</h4>
        <div className="space-y-1">
          {nodeCategories.shapes.map((node) => (
            <button
              key={node.type}
              onClick={() => onAddNode(node.type)}
              className="w-full text-left px-2 py-1.5 rounded text-sm text-slate-300 hover:bg-slate-700 hover:text-white transition-colors flex items-center gap-2"
              title={node.description}
            >
              <span className="w-4 text-center text-xs opacity-60">
                {node.type === 'line' && '/'}
                {node.type === 'rect' && '[]'}
                {node.type === 'circle' && 'O'}
                {node.type === 'ellipse' && '()'}
                {node.type === 'arc' && ')'}
                {node.type === 'polygon' && '<>'}
                {node.type === 'text' && 'Aa'}
              </span>
              {node.label}
            </button>
          ))}
        </div>
      </div>

      {/* Iteration */}
      <div className="mb-3">
        <h4 className="text-xs font-medium text-cyan-400 mb-2 uppercase tracking-wider">Iteration</h4>
        <div className="space-y-1">
          {nodeCategories.iteration.map((node) => (
            <button
              key={node.type}
              onClick={() => onAddNode(node.type)}
              className="w-full text-left px-2 py-1.5 rounded text-sm text-slate-300 hover:bg-slate-700 hover:text-white transition-colors flex items-center gap-2"
              title={node.description}
            >
              <span className="w-4 text-center text-xs opacity-60">
                {node.type === 'repeat' && '#'}
                {node.type === 'grid' && ':::'}
                {node.type === 'radial' && '*'}
              </span>
              {node.label}
            </button>
          ))}
        </div>
      </div>

      {/* Transform */}
      <div className="mb-3">
        <h4 className="text-xs font-medium text-amber-400 mb-2 uppercase tracking-wider">Transform</h4>
        <div className="space-y-1">
          {nodeCategories.transform.map((node) => (
            <button
              key={node.type}
              onClick={() => onAddNode(node.type)}
              className="w-full text-left px-2 py-1.5 rounded text-sm text-slate-300 hover:bg-slate-700 hover:text-white transition-colors flex items-center gap-2"
              title={node.description}
            >
              <span className="w-4 text-center text-xs opacity-60">
                {node.type === 'translate' && '↗'}
                {node.type === 'rotate' && '↻'}
                {node.type === 'scale' && '⤢'}
              </span>
              {node.label}
            </button>
          ))}
        </div>
      </div>

      {/* Algorithmic */}
      <div className="mb-3">
        <h4 className="text-xs font-medium text-pink-400 mb-2 uppercase tracking-wider">Algorithmic</h4>
        <div className="space-y-1">
          {nodeCategories.algorithmic.map((node) => (
            <button
              key={node.type}
              onClick={() => onAddNode(node.type)}
              className="w-full text-left px-2 py-1.5 rounded text-sm text-slate-300 hover:bg-slate-700 hover:text-white transition-colors flex items-center gap-2"
              title={node.description}
            >
              <span className="w-4 text-center text-xs opacity-60">λ</span>
              {node.label}
            </button>
          ))}
        </div>
      </div>

      {/* Quick tips */}
      <div className="mt-4 pt-3 border-t border-slate-700">
        <p className="text-xs text-slate-500">
          Drag to pan, scroll to zoom. Connect nodes to create patterns.
        </p>
      </div>
    </div>
  );
}

export const NodePalette = memo(NodePaletteComponent);
