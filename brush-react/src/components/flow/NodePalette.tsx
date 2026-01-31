import { memo, useState } from 'react';
import { nodeCategories } from './nodeTypes';

interface NodePaletteProps {
  onAddNode: (type: string) => void;
}

function NodePaletteComponent({ onAddNode }: NodePaletteProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Get icon for node type
  const getIcon = (type: string) => {
    const icons: Record<string, string> = {
      line: '/',
      rect: '[]',
      circle: 'O',
      ellipse: '()',
      arc: ')',
      polygon: '<>',
      text: 'Aa',
      batak: 'ᯀ',
      repeat: '#',
      grid: ':::',
      radial: '*',
      translate: '↗',
      rotate: '↻',
      scale: '⤢',
      path: '~',
      algorithmic: 'λ',
      attractor: '∞',
      lsystem: '🌿',
      code: '</>',
      svg: '◇',
      image: '🖼️',
      halftone: '∿',
      ascii: 'Aa',
      mask: '◐',
      slicer: '⬢',
      objloader: '📦',
      supershape: '✦',
      wireframe: '◇',
    };
    return icons[type] || '•';
  };

  if (!isExpanded) {
    // Collapsed state - just show a button
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className="flex items-center gap-2 px-3 py-2 bg-slate-800 rounded-lg border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors shadow-lg"
        title="Add nodes"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
        <span className="text-sm font-medium">Add Node</span>
      </button>
    );
  }

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 shadow-lg w-64 max-h-[calc(100vh-120px)] overflow-hidden flex flex-col">
      {/* Header with collapse button */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-700">
        <h3 className="text-sm font-semibold text-slate-300">Add Node</h3>
        <button
          onClick={() => setIsExpanded(false)}
          className="p-1 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"
          title="Collapse palette"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Scrollable content */}
      <div className="overflow-y-auto flex-1 p-3">
        {/* Shapes */}
        <div className="mb-3">
          <h4 className="text-xs font-medium text-blue-400 mb-2 uppercase tracking-wider px-1">Shapes</h4>
          <div className="grid grid-cols-2 gap-1">
            {nodeCategories.shapes.map((node) => (
              <button
                key={node.type}
                onClick={() => onAddNode(node.type)}
                className="text-left px-2.5 py-2 rounded text-sm text-slate-300 hover:bg-slate-700 hover:text-white transition-colors flex items-center gap-2"
                title={node.description}
              >
                <span className="w-5 text-center text-xs opacity-60">{getIcon(node.type)}</span>
                <span className="truncate">{node.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Iteration */}
        <div className="mb-3">
          <h4 className="text-xs font-medium text-cyan-400 mb-2 uppercase tracking-wider px-1">Iteration</h4>
          <div className="grid grid-cols-2 gap-1">
            {nodeCategories.iteration.map((node) => (
              <button
                key={node.type}
                onClick={() => onAddNode(node.type)}
                className="text-left px-2.5 py-2 rounded text-sm text-slate-300 hover:bg-slate-700 hover:text-white transition-colors flex items-center gap-2"
                title={node.description}
              >
                <span className="w-5 text-center text-xs opacity-60">{getIcon(node.type)}</span>
                <span className="truncate">{node.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Transform */}
        <div className="mb-3">
          <h4 className="text-xs font-medium text-amber-400 mb-2 uppercase tracking-wider px-1">Transform</h4>
          <div className="grid grid-cols-2 gap-1">
            {nodeCategories.transform.map((node) => (
              <button
                key={node.type}
                onClick={() => onAddNode(node.type)}
                className="text-left px-2.5 py-2 rounded text-sm text-slate-300 hover:bg-slate-700 hover:text-white transition-colors flex items-center gap-2"
                title={node.description}
              >
                <span className="w-5 text-center text-xs opacity-60">{getIcon(node.type)}</span>
                <span className="truncate">{node.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Algorithmic */}
        <div className="mb-3">
          <h4 className="text-xs font-medium text-pink-400 mb-2 uppercase tracking-wider px-1">Algorithmic</h4>
          <div className="grid grid-cols-2 gap-1">
            {nodeCategories.algorithmic.map((node) => (
              <button
                key={node.type}
                onClick={() => onAddNode(node.type)}
                className="text-left px-2.5 py-2 rounded text-sm text-slate-300 hover:bg-slate-700 hover:text-white transition-colors flex items-center gap-2"
                title={node.description}
              >
                <span className="w-5 text-center text-xs opacity-60">{getIcon(node.type)}</span>
                <span className="truncate">{node.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Image Processing */}
        <div className="mb-3">
          <h4 className="text-xs font-medium text-amber-400 mb-2 uppercase tracking-wider px-1">Image</h4>
          <div className="grid grid-cols-2 gap-1">
            {nodeCategories.image.map((node) => (
              <button
                key={node.type}
                onClick={() => onAddNode(node.type)}
                className="text-left px-2.5 py-2 rounded text-sm text-slate-300 hover:bg-slate-700 hover:text-white transition-colors flex items-center gap-2"
                title={node.description}
              >
                <span className="w-5 text-center text-xs opacity-60">{getIcon(node.type)}</span>
                <span className="truncate">{node.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Slicer */}
        <div className="mb-3">
          <h4 className="text-xs font-medium text-indigo-400 mb-2 uppercase tracking-wider px-1">Slicer</h4>
          <div className="grid grid-cols-2 gap-1">
            {nodeCategories.slicer.map((node) => (
              <button
                key={node.type}
                onClick={() => onAddNode(node.type)}
                className="text-left px-2.5 py-2 rounded text-sm text-slate-300 hover:bg-slate-700 hover:text-white transition-colors flex items-center gap-2"
                title={node.description}
              >
                <span className="w-5 text-center text-xs opacity-60">{getIcon(node.type)}</span>
                <span className="truncate">{node.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 3D */}
        <div className="mb-2">
          <h4 className="text-xs font-medium text-orange-400 mb-2 uppercase tracking-wider px-1">3D</h4>
          <div className="grid grid-cols-2 gap-1">
            {nodeCategories.threeD.map((node) => (
              <button
                key={node.type}
                onClick={() => onAddNode(node.type)}
                className="text-left px-2.5 py-2 rounded text-sm text-slate-300 hover:bg-slate-700 hover:text-white transition-colors flex items-center gap-2"
                title={node.description}
              >
                <span className="w-5 text-center text-xs opacity-60">{getIcon(node.type)}</span>
                <span className="truncate">{node.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Footer tip */}
      <div className="px-4 py-2.5 border-t border-slate-700 bg-slate-800/50">
        <p className="text-xs text-slate-500">
          Connect nodes to create patterns
        </p>
      </div>
    </div>
  );
}

export const NodePalette = memo(NodePaletteComponent);
