import { memo, useCallback, useRef, useEffect } from 'react';
import { Handle, Position } from '@xyflow/react';

interface ImageNodeData extends Record<string, unknown> {
  label: string;
  imageData?: string;
  width?: number;
  height?: number;
  filename?: string;
  color?: 1 | 2 | 3 | 4;
}

type ImageNodeProps = {
  id: string;
  data: ImageNodeData;
};

function ImageNodeComponent({ data, id }: ImageNodeProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const debounceTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      debounceTimers.current.forEach((timer) => clearTimeout(timer));
    };
  }, []);

  const handleFieldChange = useCallback((field: string, value: unknown, immediate = false) => {
    // Clear existing timer for this field
    const existingTimer = debounceTimers.current.get(field);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }
    
    // Image data should update immediately, other fields can be debounced
    if (immediate) {
      const event = new CustomEvent('nodeDataChange', {
        detail: { nodeId: id, field, value },
      });
      window.dispatchEvent(event);
      return;
    }
    
    // Set new debounced timer
    const timer = setTimeout(() => {
      const event = new CustomEvent('nodeDataChange', {
        detail: { nodeId: id, field, value },
      });
      window.dispatchEvent(event);
      debounceTimers.current.delete(field);
    }, 150);
    
    debounceTimers.current.set(field, timer);
  }, [id]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file type
    if (!file.type.startsWith('image/')) {
      console.warn('Selected file is not an image');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      
      // Get image dimensions
      const img = new Image();
      img.onload = () => {
        // Update node data with image info (immediate, no debounce)
        handleFieldChange('imageData', dataUrl, true);
        handleFieldChange('width', img.width, true);
        handleFieldChange('height', img.height, true);
        handleFieldChange('filename', file.name, true);
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  }, [handleFieldChange]);

  const handleClear = useCallback(() => {
    handleFieldChange('imageData', undefined, true);
    handleFieldChange('width', undefined, true);
    handleFieldChange('height', undefined, true);
    handleFieldChange('filename', undefined, true);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [handleFieldChange]);

  const { imageData, width, height, filename } = data;

  return (
    <div className="bg-slate-800 border-2 border-amber-500 bg-amber-500/10 rounded-lg shadow-lg min-w-[180px]">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-700">
        <span className="text-amber-400 text-xs font-mono">🖼️</span>
        <span className="text-sm font-medium text-slate-200">{data.label || 'Image'}</span>
      </div>

      {/* Content */}
      <div className="p-3 space-y-3">
        {/* File input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />
        
        {!imageData ? (
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full py-3 px-4 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs rounded border border-slate-600 border-dashed transition-colors"
          >
            Click to load image
          </button>
        ) : (
          <div className="space-y-2">
            {/* Image preview */}
            <div className="relative bg-slate-900 rounded overflow-hidden flex items-center justify-center"
                 style={{ minHeight: '60px', maxHeight: '100px' }}>
              <img
                src={imageData}
                alt="Preview"
                className="max-w-full max-h-[100px] object-contain"
              />
            </div>
            
            {/* Image info */}
            <div className="text-xs text-slate-400 space-y-1">
              {filename && (
                <div className="truncate" title={filename}>
                  📁 {filename}
                </div>
              )}
              {width && height && (
                <div>
                  📐 {width} × {height} px
                </div>
              )}
            </div>

            {/* Clear button */}
            <button
              onClick={handleClear}
              className="w-full py-1.5 px-3 bg-red-900/30 hover:bg-red-900/50 text-red-400 text-xs rounded border border-red-900/50 transition-colors"
            >
              Clear Image
            </button>
          </div>
        )}
      </div>

      {/* Output handle */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="source"
        className="w-3 h-3 bg-amber-500 border-2 border-slate-800"
      />
    </div>
  );
}

export const ImageNode = memo(ImageNodeComponent);
