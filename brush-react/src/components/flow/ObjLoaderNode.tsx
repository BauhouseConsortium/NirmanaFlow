import { memo, useCallback, useRef } from 'react';
import { Handle, Position } from '@xyflow/react';
import { parseOBJ, serializeGeometry } from '../../utils/objLoader';

interface ObjLoaderNodeData extends Record<string, unknown> {
  label: string;
  filename?: string;
  geometryData?: string; // Serialized Geometry3D
  vertexCount?: number;
  edgeCount?: number;
  faceCount?: number;
  error?: string;
}

type ObjLoaderNodeProps = {
  id: string;
  data: ObjLoaderNodeData;
};

function ObjLoaderNodeComponent({ data, id }: ObjLoaderNodeProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleChange = useCallback((field: string, value: unknown) => {
    const event = new CustomEvent('nodeDataChange', {
      detail: { nodeId: id, field, value },
    });
    window.dispatchEvent(event);
  }, [id]);

  const handleFileLoad = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const geometry = parseOBJ(content);
        
        // Store serialized geometry and stats
        handleChange('geometryData', serializeGeometry(geometry));
        handleChange('filename', file.name);
        handleChange('vertexCount', geometry.vertices.length);
        handleChange('edgeCount', geometry.edges.length);
        handleChange('faceCount', geometry.faces.length);
        handleChange('error', undefined);
      } catch (err) {
        handleChange('error', err instanceof Error ? err.message : 'Failed to parse OBJ file');
        handleChange('geometryData', undefined);
      }
    };
    reader.onerror = () => {
      handleChange('error', 'Failed to read file');
    };
    reader.readAsText(file);
    
    // Reset input
    e.target.value = '';
  }, [handleChange]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith('.obj') || file.type === 'model/obj')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const content = event.target?.result as string;
          const geometry = parseOBJ(content);
          
          handleChange('geometryData', serializeGeometry(geometry));
          handleChange('filename', file.name);
          handleChange('vertexCount', geometry.vertices.length);
          handleChange('edgeCount', geometry.edges.length);
          handleChange('faceCount', geometry.faces.length);
          handleChange('error', undefined);
        } catch (err) {
          handleChange('error', err instanceof Error ? err.message : 'Failed to parse OBJ file');
          handleChange('geometryData', undefined);
        }
      };
      reader.readAsText(file);
    }
  }, [handleChange]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const hasGeometry = !!data.geometryData;

  return (
    <div className="rounded-lg border-2 border-orange-500 bg-orange-500/10 bg-slate-800 shadow-lg min-w-[200px]">
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-slate-400 !border-slate-600 !w-3 !h-3"
      />

      <div className="px-3 py-2 border-b border-slate-700 flex items-center gap-2">
        <span className="text-lg text-orange-400">📦</span>
        <span className="font-medium text-white text-sm">{data.label || 'OBJ Loader'}</span>
      </div>

      <div className="p-3 space-y-3">
        {/* Drop zone / File picker */}
        <div
          onClick={() => fileInputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors nodrag ${
            hasGeometry
              ? 'border-orange-500/50 bg-orange-500/5'
              : 'border-slate-600 hover:border-orange-500/50 hover:bg-slate-700/50'
          }`}
        >
          {hasGeometry ? (
            <div className="space-y-1">
              <div className="text-orange-400 text-sm font-medium truncate">
                {data.filename}
              </div>
              <div className="text-xs text-slate-400">
                {data.vertexCount} verts • {data.edgeCount} edges • {data.faceCount} faces
              </div>
              <div className="text-xs text-slate-500 mt-2">
                Click to replace
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              <div className="text-slate-400 text-sm">
                Drop .obj file here
              </div>
              <div className="text-xs text-slate-500">
                or click to browse
              </div>
            </div>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".obj"
          onChange={handleFileLoad}
          className="hidden"
        />

        {/* Error display */}
        {data.error && (
          <div className="text-xs text-red-400 bg-red-500/10 px-2 py-1.5 rounded border border-red-500/20">
            {data.error}
          </div>
        )}

        {/* Info */}
        <div className="text-[10px] text-slate-500">
          Connect to Wireframe node →
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-orange-500 !border-orange-600 !w-3 !h-3"
      />
    </div>
  );
}

export const ObjLoaderNode = memo(ObjLoaderNodeComponent);
