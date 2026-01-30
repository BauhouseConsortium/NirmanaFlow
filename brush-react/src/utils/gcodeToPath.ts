/**
 * G-code to Path converter
 * 
 * Parses G-code output from slicer and extracts XY movements as 2D paths.
 * Separates different types of moves (perimeters, infill, travel).
 */

import type { Path, Point } from './drawingApi';

export interface GCodeMove {
  x: number;
  y: number;
  z: number;
  e: number; // Extrusion amount
  f: number; // Feed rate
  type: 'travel' | 'extrude';
}

export interface LayerPaths {
  z: number;
  perimeters: Path[];
  infill: Path[];
  travel: Path[];
  all: Path[];
}

export interface ParsedGCode {
  layers: LayerPaths[];
  bounds: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    minZ: number;
    maxZ: number;
  };
  stats: {
    totalLayers: number;
    totalMoves: number;
    totalExtrusion: number;
  };
}

/**
 * Parse a single G-code line and extract move parameters
 */
function parseGCodeLine(line: string): { code: string; params: Record<string, number> } | null {
  const trimmed = line.trim();
  
  // Skip comments and empty lines
  if (!trimmed || trimmed.startsWith(';') || trimmed.startsWith('(')) {
    return null;
  }
  
  // Remove inline comments
  const withoutComment = trimmed.split(';')[0].trim();
  if (!withoutComment) return null;
  
  // Parse G/M code and parameters
  const parts = withoutComment.split(/\s+/);
  if (parts.length === 0) return null;
  
  const code = parts[0].toUpperCase();
  const params: Record<string, number> = {};
  
  for (let i = 1; i < parts.length; i++) {
    const param = parts[i];
    if (param.length >= 2) {
      const key = param[0].toUpperCase();
      const value = parseFloat(param.slice(1));
      if (!isNaN(value)) {
        params[key] = value;
      }
    }
  }
  
  return { code, params };
}

/**
 * Determine if we're in a specific section based on comments
 */
function detectSection(line: string): 'perimeter' | 'infill' | 'travel' | 'other' | null {
  const lower = line.toLowerCase();
  
  // Cura-style comments
  if (lower.includes(';type:wall') || lower.includes(';type:outer') || lower.includes(';type:inner')) {
    return 'perimeter';
  }
  if (lower.includes(';type:fill') || lower.includes(';type:infill') || lower.includes(';type:skin')) {
    return 'infill';
  }
  if (lower.includes(';type:travel') || lower.includes(';type:move')) {
    return 'travel';
  }
  
  // PrusaSlicer/SuperSlicer style
  if (lower.includes('perimeter') && !lower.includes('infill')) {
    return 'perimeter';
  }
  if (lower.includes('infill') || lower.includes('solid')) {
    return 'infill';
  }
  
  return null;
}

/**
 * Parse G-code string and extract paths organized by layer
 */
export function parseGCode(gcode: string): ParsedGCode {
  const lines = gcode.split('\n');
  
  // Current state
  let currentX = 0;
  let currentY = 0;
  let currentZ = 0;
  let currentE = 0;
  let lastE = 0;
  let absolutePositioning = true;
  let absoluteExtrusion = true;
  
  // Section tracking
  let currentSection: 'perimeter' | 'infill' | 'travel' | 'other' = 'other';
  
  // Layers map (z -> paths)
  const layersMap = new Map<number, LayerPaths>();
  
  // Current path being built
  let currentPath: Point[] = [];
  let currentPathType: 'perimeter' | 'infill' | 'travel' = 'travel';
  
  // Bounds tracking
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;
  
  // Stats
  let totalMoves = 0;
  let totalExtrusion = 0;
  
  /**
   * Get or create layer paths for a Z height
   */
  function getLayer(z: number): LayerPaths {
    // Round Z to avoid floating point issues
    const roundedZ = Math.round(z * 1000) / 1000;
    
    if (!layersMap.has(roundedZ)) {
      layersMap.set(roundedZ, {
        z: roundedZ,
        perimeters: [],
        infill: [],
        travel: [],
        all: [],
      });
    }
    return layersMap.get(roundedZ)!;
  }
  
  /**
   * Finish current path and add to appropriate layer
   */
  function finishPath() {
    if (currentPath.length >= 2) {
      const layer = getLayer(currentZ);
      const pathCopy = [...currentPath];
      
      layer.all.push(pathCopy);
      
      switch (currentPathType) {
        case 'perimeter':
          layer.perimeters.push(pathCopy);
          break;
        case 'infill':
          layer.infill.push(pathCopy);
          break;
        case 'travel':
          layer.travel.push(pathCopy);
          break;
      }
    }
    currentPath = [];
  }
  
  // Process each line
  for (const line of lines) {
    // Check for section changes
    const section = detectSection(line);
    if (section) {
      // Section changed - finish current path and start new one
      finishPath();
      currentSection = section;
      currentPathType = section === 'other' ? 'travel' : section;
    }
    
    const parsed = parseGCodeLine(line);
    if (!parsed) continue;
    
    const { code, params } = parsed;
    
    switch (code) {
      case 'G0': // Rapid move (usually travel)
      case 'G1': { // Linear move
        // Finish path if switching to travel (G0) from extrusion
        const isExtrusion = 'E' in params && params.E > (absoluteExtrusion ? lastE : 0);
        
        if (code === 'G0' || !isExtrusion) {
          // Travel move - finish current extrusion path
          if (currentPath.length > 0 && currentPathType !== 'travel') {
            finishPath();
          }
          currentPathType = 'travel';
        } else if (isExtrusion) {
          // Extrusion move
          if (currentPathType === 'travel' && currentPath.length > 0) {
            finishPath();
          }
          currentPathType = currentSection === 'other' ? 'perimeter' : 
                           (currentSection === 'travel' ? 'perimeter' : currentSection);
        }
        
        // Update position
        if ('X' in params) {
          currentX = absolutePositioning ? params.X : currentX + params.X;
        }
        if ('Y' in params) {
          currentY = absolutePositioning ? params.Y : currentY + params.Y;
        }
        if ('Z' in params) {
          const newZ = absolutePositioning ? params.Z : currentZ + params.Z;
          if (newZ !== currentZ) {
            // Z changed - finish current path
            finishPath();
            currentZ = newZ;
          }
        }
        if ('E' in params) {
          const newE = absoluteExtrusion ? params.E : currentE + params.E;
          if (newE > currentE) {
            totalExtrusion += newE - currentE;
          }
          lastE = currentE;
          currentE = newE;
        }
        
        // Add point to current path
        currentPath.push([currentX, currentY]);
        totalMoves++;
        
        // Update bounds
        minX = Math.min(minX, currentX);
        minY = Math.min(minY, currentY);
        maxX = Math.max(maxX, currentX);
        maxY = Math.max(maxY, currentY);
        minZ = Math.min(minZ, currentZ);
        maxZ = Math.max(maxZ, currentZ);
        break;
      }
      
      case 'G28': // Home
        currentX = 0;
        currentY = 0;
        currentZ = 0;
        finishPath();
        break;
        
      case 'G90': // Absolute positioning
        absolutePositioning = true;
        break;
        
      case 'G91': // Relative positioning
        absolutePositioning = false;
        break;
        
      case 'M82': // Absolute extrusion
        absoluteExtrusion = true;
        break;
        
      case 'M83': // Relative extrusion
        absoluteExtrusion = false;
        break;
        
      case 'G92': // Set position
        if ('X' in params) currentX = params.X;
        if ('Y' in params) currentY = params.Y;
        if ('Z' in params) currentZ = params.Z;
        if ('E' in params) {
          currentE = params.E;
          lastE = params.E;
        }
        break;
    }
  }
  
  // Finish any remaining path
  finishPath();
  
  // Convert map to sorted array
  const layers = Array.from(layersMap.values()).sort((a, b) => a.z - b.z);
  
  return {
    layers,
    bounds: {
      minX: isFinite(minX) ? minX : 0,
      minY: isFinite(minY) ? minY : 0,
      maxX: isFinite(maxX) ? maxX : 0,
      maxY: isFinite(maxY) ? maxY : 0,
      minZ: isFinite(minZ) ? minZ : 0,
      maxZ: isFinite(maxZ) ? maxZ : 0,
    },
    stats: {
      totalLayers: layers.length,
      totalMoves,
      totalExtrusion,
    },
  };
}

/**
 * Extract paths for a specific layer
 */
export function getLayerPaths(
  parsed: ParsedGCode,
  layerIndex: number,
  options: {
    includeWalls?: boolean;
    includeInfill?: boolean;
    includeTravel?: boolean;
  } = {}
): Path[] {
  const { includeWalls = true, includeInfill = true, includeTravel = false } = options;
  
  if (layerIndex < 0 || layerIndex >= parsed.layers.length) {
    return [];
  }
  
  const layer = parsed.layers[layerIndex];
  const paths: Path[] = [];
  
  if (includeWalls) {
    paths.push(...layer.perimeters);
  }
  if (includeInfill) {
    paths.push(...layer.infill);
  }
  if (includeTravel) {
    paths.push(...layer.travel);
  }
  
  return paths;
}

/**
 * Get all paths from all layers (flattened to 2D)
 */
export function getAllPaths(
  parsed: ParsedGCode,
  options: {
    includeWalls?: boolean;
    includeInfill?: boolean;
    includeTravel?: boolean;
  } = {}
): Path[] {
  const paths: Path[] = [];
  
  for (let i = 0; i < parsed.layers.length; i++) {
    paths.push(...getLayerPaths(parsed, i, options));
  }
  
  return paths;
}

/**
 * Offset paths by layer Z to create stacked visualization
 */
export function getStackedPaths(
  parsed: ParsedGCode,
  options: {
    includeWalls?: boolean;
    includeInfill?: boolean;
    includeTravel?: boolean;
    zScale?: number; // How much to offset Y per Z unit
  } = {}
): Path[] {
  const { zScale = 0.5, ...pathOptions } = options;
  const paths: Path[] = [];
  
  for (const layer of parsed.layers) {
    const layerPaths = getLayerPaths(parsed, parsed.layers.indexOf(layer), pathOptions);
    const yOffset = layer.z * zScale;
    
    for (const path of layerPaths) {
      paths.push(path.map(([x, y]) => [x, y - yOffset] as Point));
    }
  }
  
  return paths;
}

/**
 * Simplify paths by removing points that are too close together
 */
export function simplifyPaths(paths: Path[], tolerance: number = 0.1): Path[] {
  return paths.map(path => {
    if (path.length < 3) return path;
    
    const simplified: Point[] = [path[0]];
    
    for (let i = 1; i < path.length - 1; i++) {
      const prev = simplified[simplified.length - 1];
      const curr = path[i];
      const dx = curr[0] - prev[0];
      const dy = curr[1] - prev[1];
      
      if (Math.sqrt(dx * dx + dy * dy) >= tolerance) {
        simplified.push(curr);
      }
    }
    
    // Always include last point
    simplified.push(path[path.length - 1]);
    
    return simplified;
  }).filter(path => path.length >= 2);
}
