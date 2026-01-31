/**
 * Slicer Service
 * 
 * Provides slicing functionality with two modes:
 * 1. CuraWASM mode - Full 3D slicing using Cura engine (when available)
 * 2. Fallback mode - Pure JavaScript infill pattern generation
 * 
 * The fallback mode generates common infill patterns directly,
 * which is much faster and doesn't require WASM loading.
 */

import type { Path, Point } from './drawingApi';
import { pathsToStl, getPathsBounds } from './pathToStl';
import { parseGCode, getLayerPaths, getAllPaths } from './gcodeToPath';
import { offsetPaths as clipperOffset, loadClipper2 } from './clipperService';

// Types
export type InfillPattern = 'lines' | 'grid' | 'triangles' | 'honeycomb' | 'gyroid' | 'concentric';

export interface SlicerSettings {
  extrudeHeight: number;
  wallThickness: number;
  layerHeight: number;
  extractLayer: number; // -1 = all layers
  infillPattern: InfillPattern;
  infillDensity: number; // 0-100
  infillAngle: number;
  includeWalls: boolean;
  includeInfill: boolean;
  includeTravel: boolean;
}

export interface SliceResult {
  paths: Path[];
  layers: number;
  mode: 'cura' | 'fallback';
  stats?: {
    triangles?: number;
    gcodeLines?: number;
    executionTime: number;
  };
}

export interface SliceProgress {
  stage: 'preparing' | 'generating-stl' | 'slicing' | 'parsing' | 'complete' | 'error';
  progress: number; // 0-100
  message?: string;
}

export type ProgressCallback = (progress: SliceProgress) => void;

// ============ Fallback Infill Pattern Generator ============

/**
 * Generate line infill pattern
 */
function generateLineInfill(
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
  density: number,
  angle: number
): Path[] {
  const paths: Path[] = [];
  const spacing = Math.max(1, 100 / Math.max(density, 1));
  
  // Convert angle to radians
  const rad = (angle * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  
  // Calculate bounds diagonal for full coverage
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;
  const diagonal = Math.sqrt(width * width + height * height);
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;
  
  // Generate lines perpendicular to angle
  for (let offset = -diagonal / 2; offset <= diagonal / 2; offset += spacing) {
    // Line perpendicular to angle direction
    const x1 = centerX + offset * cos - diagonal * sin;
    const y1 = centerY + offset * sin + diagonal * cos;
    const x2 = centerX + offset * cos + diagonal * sin;
    const y2 = centerY + offset * sin - diagonal * cos;
    
    paths.push([[x1, y1], [x2, y2]]);
  }
  
  return paths;
}

/**
 * Generate grid infill pattern
 */
function generateGridInfill(
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
  density: number,
  angle: number
): Path[] {
  const paths: Path[] = [];
  
  // Generate lines at base angle
  paths.push(...generateLineInfill(bounds, density, angle));
  
  // Generate lines perpendicular
  paths.push(...generateLineInfill(bounds, density, angle + 90));
  
  return paths;
}

/**
 * Generate triangle infill pattern
 */
function generateTriangleInfill(
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
  density: number,
  angle: number
): Path[] {
  const paths: Path[] = [];
  
  // Three sets of lines at 60 degree angles
  paths.push(...generateLineInfill(bounds, density, angle));
  paths.push(...generateLineInfill(bounds, density, angle + 60));
  paths.push(...generateLineInfill(bounds, density, angle + 120));
  
  return paths;
}

/**
 * Generate honeycomb infill pattern
 */
function generateHoneycombInfill(
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
  density: number,
  angle: number
): Path[] {
  const paths: Path[] = [];
  const cellSize = Math.max(5, 200 / Math.max(density, 1));
  
  const cos = Math.cos((angle * Math.PI) / 180);
  const sin = Math.sin((angle * Math.PI) / 180);
  
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;
  
  // Hexagon dimensions
  const hexWidth = cellSize * Math.sqrt(3);
  const hexHeight = cellSize * 2;
  
  const cols = Math.ceil(width / hexWidth) + 2;
  const rows = Math.ceil(height / (hexHeight * 0.75)) + 2;
  
  for (let row = -rows / 2; row <= rows / 2; row++) {
    for (let col = -cols / 2; col <= cols / 2; col++) {
      // Hexagon center
      const offsetX = col * hexWidth + (row % 2) * (hexWidth / 2);
      const offsetY = row * hexHeight * 0.75;
      
      // Generate hexagon path
      const hexPath: Point[] = [];
      for (let i = 0; i <= 6; i++) {
        const hexAngle = (i * Math.PI) / 3 + Math.PI / 6;
        const hx = offsetX + Math.cos(hexAngle) * cellSize;
        const hy = offsetY + Math.sin(hexAngle) * cellSize;
        
        // Rotate and translate
        const rx = centerX + hx * cos - hy * sin;
        const ry = centerY + hx * sin + hy * cos;
        
        hexPath.push([rx, ry]);
      }
      
      paths.push(hexPath);
    }
  }
  
  return paths;
}

/**
 * Generate gyroid-like infill pattern (simplified 2D approximation)
 */
function generateGyroidInfill(
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
  density: number,
  angle: number
): Path[] {
  const paths: Path[] = [];
  const wavelength = Math.max(5, 150 / Math.max(density, 1));
  const amplitude = wavelength / 2;
  
  const cos = Math.cos((angle * Math.PI) / 180);
  const sin = Math.sin((angle * Math.PI) / 180);
  
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;
  
  const diagonal = Math.sqrt(width * width + height * height);
  
  // Generate sine waves
  for (let offset = -diagonal / 2; offset <= diagonal / 2; offset += wavelength) {
    const path: Point[] = [];
    
    for (let t = -diagonal / 2; t <= diagonal / 2; t += 2) {
      const x = t;
      const y = offset + Math.sin((t / wavelength) * Math.PI * 2) * amplitude;
      
      // Rotate and translate
      const rx = centerX + x * cos - y * sin;
      const ry = centerY + x * sin + y * cos;
      
      path.push([rx, ry]);
    }
    
    if (path.length >= 2) {
      paths.push(path);
    }
  }
  
  // Generate perpendicular sine waves (offset phase)
  for (let offset = -diagonal / 2; offset <= diagonal / 2; offset += wavelength) {
    const path: Point[] = [];
    
    for (let t = -diagonal / 2; t <= diagonal / 2; t += 2) {
      const x = offset + Math.sin((t / wavelength) * Math.PI * 2 + Math.PI / 2) * amplitude;
      const y = t;
      
      // Rotate and translate
      const rx = centerX + x * cos - y * sin;
      const ry = centerY + x * sin + y * cos;
      
      path.push([rx, ry]);
    }
    
    if (path.length >= 2) {
      paths.push(path);
    }
  }
  
  return paths;
}

/**
 * Calculate the normal vector at each vertex of a polygon
 * Returns inward-pointing normals
 */
function calculateVertexNormals(polygon: Point[]): Point[] {
  const n = polygon.length;
  const normals: Point[] = [];
  
  for (let i = 0; i < n; i++) {
    const prev = polygon[(i - 1 + n) % n];
    const curr = polygon[i];
    const next = polygon[(i + 1) % n];
    
    // Edge vectors
    const e1x = curr[0] - prev[0];
    const e1y = curr[1] - prev[1];
    const e2x = next[0] - curr[0];
    const e2y = next[1] - curr[1];
    
    // Perpendicular (inward normal) for each edge
    // Rotate 90° clockwise for inward normal (assuming CCW winding)
    const n1x = e1y;
    const n1y = -e1x;
    const n2x = e2y;
    const n2y = -e2x;
    
    // Normalize
    const len1 = Math.sqrt(n1x * n1x + n1y * n1y) || 1;
    const len2 = Math.sqrt(n2x * n2x + n2y * n2y) || 1;
    
    // Average the two normals for smooth corners
    const avgX = (n1x / len1 + n2x / len2) / 2;
    const avgY = (n1y / len1 + n2y / len2) / 2;
    
    // Normalize the average
    const avgLen = Math.sqrt(avgX * avgX + avgY * avgY) || 1;
    normals.push([avgX / avgLen, avgY / avgLen]);
  }
  
  return normals;
}

/**
 * Offset a polygon inward by a given distance
 */
function offsetPolygon(polygon: Point[], distance: number): Point[] | null {
  if (polygon.length < 3) return null;
  
  const normals = calculateVertexNormals(polygon);
  const offset: Point[] = [];
  
  for (let i = 0; i < polygon.length; i++) {
    const x = polygon[i][0] + normals[i][0] * distance;
    const y = polygon[i][1] + normals[i][1] * distance;
    offset.push([x, y]);
  }
  
  // Check if the offset polygon is still valid (not self-intersecting)
  // Simple check: area should be positive and smaller than original
  let area = 0;
  for (let i = 0; i < offset.length; i++) {
    const j = (i + 1) % offset.length;
    area += offset[i][0] * offset[j][1];
    area -= offset[j][0] * offset[i][1];
  }
  area = area / 2;
  
  // If area is too small or negative, the polygon has collapsed
  if (area < 1) return null;
  
  return offset;
}

/**
 * Generate concentric (contour-following) infill pattern
 * Creates inset copies of the boundary polygon
 * Uses basic vertex-normal offset (fallback)
 */
function generateConcentricInfill(
  polygon: Point[] | null,
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
  density: number
): Path[] {
  if (!polygon || polygon.length < 3) {
    // Fallback to simple lines if no valid polygon
    return generateLineInfill(bounds, density, 45);
  }
  
  const paths: Path[] = [];
  
  // Calculate spacing based on density
  // Higher density = smaller spacing = more contours
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;
  const maxDim = Math.max(width, height);
  const spacing = Math.max(1, maxDim * (1 - density / 100) / 10);
  
  // Generate inset contours until polygon collapses
  let currentPolygon = [...polygon];
  let offset = spacing;
  const maxIterations = 100; // Safety limit
  
  for (let i = 0; i < maxIterations; i++) {
    const insetPolygon = offsetPolygon(currentPolygon, offset);
    
    if (!insetPolygon) break; // Polygon collapsed
    
    // Close the path
    const closedPath: Point[] = [...insetPolygon, insetPolygon[0]];
    paths.push(closedPath);
    
    currentPolygon = insetPolygon;
    offset = spacing; // Keep same offset for each iteration
  }
  
  return paths;
}

/**
 * Generate concentric infill using Clipper2 for accurate offsetting
 * Falls back to basic method if Clipper2 is not available
 */
async function generateConcentricInfillClipper(
  polygon: Point[] | null,
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
  density: number
): Promise<Path[]> {
  if (!polygon || polygon.length < 3) {
    return generateLineInfill(bounds, density, 45);
  }
  
  // Try to use Clipper2 for accurate offsetting
  const clipperAvailable = await loadClipper2();
  if (!clipperAvailable) {
    return generateConcentricInfill(polygon, bounds, density);
  }
  
  const paths: Path[] = [];
  
  // Calculate spacing based on density
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;
  const maxDim = Math.max(width, height);
  const spacing = Math.max(1, maxDim * (1 - density / 100) / 10);
  
  // Close the polygon if needed
  let currentPaths: Path[] = [[...polygon]];
  const first = polygon[0];
  const last = polygon[polygon.length - 1];
  if (Math.abs(first[0] - last[0]) > 0.01 || Math.abs(first[1] - last[1]) > 0.01) {
    currentPaths[0].push([...first]);
  }
  
  const maxIterations = 100;
  
  for (let i = 0; i < maxIterations; i++) {
    // Use Clipper2 for inward offset (negative delta)
    const insetPaths = await clipperOffset(currentPaths, -spacing, 'round', 'polygon');
    
    if (insetPaths.length === 0) break;
    
    // Add all resulting paths (Clipper handles complex shapes)
    for (const insetPath of insetPaths) {
      if (insetPath.length >= 3) {
        // Close the path
        const closedPath: Point[] = [...insetPath];
        const f = closedPath[0];
        const l = closedPath[closedPath.length - 1];
        if (Math.abs(f[0] - l[0]) > 0.01 || Math.abs(f[1] - l[1]) > 0.01) {
          closedPath.push([...f]);
        }
        paths.push(closedPath);
      }
    }
    
    currentPaths = insetPaths;
  }
  
  return paths;
}

/**
 * Generate infill pattern based on type
 */
function generateInfillPattern(
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
  pattern: InfillPattern,
  density: number,
  angle: number,
  polygon?: Point[] | null
): Path[] {
  switch (pattern) {
    case 'lines':
      return generateLineInfill(bounds, density, angle);
    case 'grid':
      return generateGridInfill(bounds, density, angle);
    case 'triangles':
      return generateTriangleInfill(bounds, density, angle);
    case 'honeycomb':
      return generateHoneycombInfill(bounds, density, angle);
    case 'gyroid':
      return generateGyroidInfill(bounds, density, angle);
    case 'concentric':
      return generateConcentricInfill(polygon ?? null, bounds, density);
    default:
      return generateLineInfill(bounds, density, angle);
  }
}

/**
 * Check if a point is inside a polygon using ray casting algorithm
 */
function pointInPolygon(point: Point, polygon: Point[]): boolean {
  const [x, y] = point;
  let inside = false;
  
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0], yi = polygon[i][1];
    const xj = polygon[j][0], yj = polygon[j][1];
    
    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  
  return inside;
}

/**
 * Find intersection point of two line segments
 * Returns null if no intersection
 */
function lineIntersection(
  p1: Point, p2: Point,
  p3: Point, p4: Point
): Point | null {
  const x1 = p1[0], y1 = p1[1];
  const x2 = p2[0], y2 = p2[1];
  const x3 = p3[0], y3 = p3[1];
  const x4 = p4[0], y4 = p4[1];
  
  const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  if (Math.abs(denom) < 1e-10) return null;
  
  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
  const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;
  
  if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
    return [x1 + t * (x2 - x1), y1 + t * (y2 - y1)];
  }
  
  return null;
}

/**
 * Clip a line segment to a polygon
 * Returns array of clipped segments (may be multiple if line enters/exits multiple times)
 */
function clipLineToPolygon(p1: Point, p2: Point, polygon: Point[]): Path[] {
  if (polygon.length < 3) return [];
  
  // Collect all intersection points with the polygon edges
  const intersections: { point: Point; t: number }[] = [];
  
  const dx = p2[0] - p1[0];
  const dy = p2[1] - p1[1];
  
  for (let i = 0; i < polygon.length; i++) {
    const j = (i + 1) % polygon.length;
    const intersection = lineIntersection(p1, p2, polygon[i], polygon[j]);
    
    if (intersection) {
      // Calculate parameter t along the line segment
      const t = Math.abs(dx) > Math.abs(dy)
        ? (intersection[0] - p1[0]) / dx
        : (intersection[1] - p1[1]) / dy;
      
      if (t >= 0 && t <= 1) {
        intersections.push({ point: intersection, t });
      }
    }
  }
  
  // Sort intersections by parameter t
  intersections.sort((a, b) => a.t - b.t);
  
  // Build clipped segments
  const segments: Path[] = [];
  const points: Point[] = [p1, ...intersections.map(i => i.point), p2];
  
  for (let i = 0; i < points.length - 1; i++) {
    const midX = (points[i][0] + points[i + 1][0]) / 2;
    const midY = (points[i][1] + points[i + 1][1]) / 2;
    
    // Check if midpoint is inside polygon
    if (pointInPolygon([midX, midY], polygon)) {
      segments.push([points[i], points[i + 1]]);
    }
  }
  
  return segments;
}

/**
 * Clip paths to polygon boundary
 */
function clipPathsToPolygon(paths: Path[], polygon: Point[]): Path[] {
  if (polygon.length < 3) return [];
  
  const clipped: Path[] = [];
  
  for (const path of paths) {
    // For each segment in the path
    for (let i = 0; i < path.length - 1; i++) {
      const segments = clipLineToPolygon(path[i], path[i + 1], polygon);
      clipped.push(...segments);
    }
  }
  
  // Merge consecutive segments that share endpoints
  const merged: Path[] = [];
  let currentPath: Point[] = [];
  
  for (const segment of clipped) {
    if (segment.length < 2) continue;
    
    if (currentPath.length === 0) {
      currentPath = [...segment];
    } else {
      const lastPoint = currentPath[currentPath.length - 1];
      const firstPoint = segment[0];
      const dx = Math.abs(lastPoint[0] - firstPoint[0]);
      const dy = Math.abs(lastPoint[1] - firstPoint[1]);
      
      if (dx < 0.01 && dy < 0.01) {
        // Points are close enough - extend current path
        currentPath.push(segment[1]);
      } else {
        // Start new path
        if (currentPath.length >= 2) {
          merged.push(currentPath);
        }
        currentPath = [...segment];
      }
    }
  }
  
  if (currentPath.length >= 2) {
    merged.push(currentPath);
  }
  
  return merged.length > 0 ? merged : clipped;
}

/**
 * Clip paths to bounding box (simple rectangular clipping)
 */
function clipPathsToBounds(
  paths: Path[],
  bounds: { minX: number; minY: number; maxX: number; maxY: number }
): Path[] {
  const clipped: Path[] = [];
  
  for (const path of paths) {
    const clippedPath: Point[] = [];
    
    for (const [x, y] of path) {
      // Simple bounding box clip
      if (x >= bounds.minX && x <= bounds.maxX && y >= bounds.minY && y <= bounds.maxY) {
        clippedPath.push([x, y]);
      } else if (clippedPath.length >= 2) {
        // Path exited bounds, start new segment
        clipped.push([...clippedPath]);
        clippedPath.length = 0;
      }
    }
    
    if (clippedPath.length >= 2) {
      clipped.push(clippedPath);
    }
  }
  
  return clipped;
}

// ============ CuraWASM Integration ============

// CuraWASM module (loaded dynamically)
let curaWasmModule: unknown = null;
let curaWasmLoading = false;
let curaWasmError: string | null = null;

/**
 * Check if CuraWASM is available
 */
export function isCuraWasmAvailable(): boolean {
  return curaWasmModule !== null;
}

/**
 * Load CuraWASM module (async)
 */
export async function loadCuraWasm(): Promise<boolean> {
  if (curaWasmModule) return true;
  if (curaWasmLoading) {
    // Wait for existing load
    return new Promise((resolve) => {
      const check = setInterval(() => {
        if (!curaWasmLoading) {
          clearInterval(check);
          resolve(curaWasmModule !== null);
        }
      }, 100);
    });
  }
  
  curaWasmLoading = true;
  
  try {
    // Dynamic import of cura-wasm
    // Note: This requires the cura-wasm package to be installed
    // Using dynamic import with a variable to avoid static analysis
    const moduleName = 'cura-wasm';
    const module = await import(/* @vite-ignore */ moduleName);
    curaWasmModule = module;
    curaWasmError = null;
    return true;
  } catch (err) {
    curaWasmError = err instanceof Error ? err.message : String(err);
    console.warn('CuraWASM not available, using fallback infill generator:', curaWasmError);
    return false;
  } finally {
    curaWasmLoading = false;
  }
}

/**
 * Slice using CuraWASM (when available)
 */
async function sliceWithCura(
  stlData: ArrayBuffer,
  settings: SlicerSettings,
  onProgress?: ProgressCallback
): Promise<SliceResult> {
  if (!curaWasmModule) {
    throw new Error('CuraWASM not loaded');
  }
  
  const startTime = performance.now();
  
  // This is a placeholder for actual CuraWASM integration
  // The actual API depends on the cura-wasm version
  // @ts-expect-error - Dynamic module
  const CuraWASM = curaWasmModule.default || curaWasmModule;
  
  onProgress?.({
    stage: 'slicing',
    progress: 10,
    message: 'Initializing CuraWASM...',
  });
  
  // Create slicer instance with settings
  const slicer = new CuraWASM({
    // Cura engine definition (would need to be bundled or fetched)
    definition: 'fdmprinter',
    // Override settings
    overrides: {
      layer_height: settings.layerHeight,
      wall_thickness: settings.wallThickness,
      infill_sparse_density: settings.infillDensity,
      infill_pattern: settings.infillPattern,
      infill_angles: [settings.infillAngle],
    },
  });
  
  onProgress?.({
    stage: 'slicing',
    progress: 30,
    message: 'Loading model...',
  });
  
  // Load STL
  await slicer.load(stlData);
  
  onProgress?.({
    stage: 'slicing',
    progress: 50,
    message: 'Slicing...',
  });
  
  // Slice
  const gcode = await slicer.slice();
  
  onProgress?.({
    stage: 'parsing',
    progress: 80,
    message: 'Parsing G-code...',
  });
  
  // Parse G-code
  const parsed = parseGCode(gcode);
  
  // Extract paths
  let paths: Path[];
  if (settings.extractLayer === -1) {
    paths = getAllPaths(parsed, {
      includeWalls: settings.includeWalls,
      includeInfill: settings.includeInfill,
      includeTravel: settings.includeTravel,
    });
  } else {
    paths = getLayerPaths(parsed, settings.extractLayer, {
      includeWalls: settings.includeWalls,
      includeInfill: settings.includeInfill,
      includeTravel: settings.includeTravel,
    });
  }
  
  onProgress?.({
    stage: 'complete',
    progress: 100,
    message: 'Slicing complete',
  });
  
  return {
    paths,
    layers: parsed.layers.length,
    mode: 'cura',
    stats: {
      gcodeLines: gcode.split('\n').length,
      executionTime: performance.now() - startTime,
    },
  };
}

// ============ Helper Functions ============

/**
 * Extract all closed polygons from paths
 * Returns array of polygons (each with sufficient area)
 */
function extractClosedPolygons(paths: Path[], minArea: number = 1): Point[][] {
  const polygons: Point[][] = [];
  
  for (const path of paths) {
    if (path.length < 3) continue;
    
    // Check if path is closed (first and last points are close)
    const first = path[0];
    const last = path[path.length - 1];
    const dx = Math.abs(first[0] - last[0]);
    const dy = Math.abs(first[1] - last[1]);
    const isClosed = dx < 0.1 && dy < 0.1;
    
    if (!isClosed) continue;
    
    // Remove duplicate closing point
    const pts = path.slice(0, -1);
    
    // Calculate area using shoelace formula
    let area = 0;
    for (let i = 0; i < pts.length; i++) {
      const j = (i + 1) % pts.length;
      area += pts[i][0] * pts[j][1];
      area -= pts[j][0] * pts[i][1];
    }
    area = Math.abs(area) / 2;
    
    if (area >= minArea) {
      polygons.push(pts);
    }
  }
  
  return polygons;
}

/**
 * Create a composite polygon from closed paths for clipping
 * Uses the largest (by area) closed path as the clipping boundary
 * Falls back to bounding box if no closed paths found
 */
function createClippingPolygon(paths: Path[], useBoundingBoxFallback: boolean = true): Point[] | null {
  const polygons = extractClosedPolygons(paths);
  
  if (polygons.length > 0) {
    // Return the largest polygon
    let bestPolygon: Point[] | null = null;
    let bestArea = 0;
    
    for (const pts of polygons) {
      let area = 0;
      for (let i = 0; i < pts.length; i++) {
        const j = (i + 1) % pts.length;
        area += pts[i][0] * pts[j][1];
        area -= pts[j][0] * pts[i][1];
      }
      area = Math.abs(area) / 2;
      
      if (area > bestArea) {
        bestArea = area;
        bestPolygon = pts;
      }
    }
    
    return bestPolygon;
  }
  
  // Fallback: create bounding box polygon for open paths (like text)
  if (useBoundingBoxFallback && paths.length > 0) {
    const bounds = getPathsBounds(paths);
    if (bounds.width > 0 && bounds.height > 0) {
      // Add small padding
      const pad = Math.min(bounds.width, bounds.height) * 0.05;
      return [
        [bounds.minX - pad, bounds.minY - pad],
        [bounds.maxX + pad, bounds.minY - pad],
        [bounds.maxX + pad, bounds.maxY + pad],
        [bounds.minX - pad, bounds.maxY + pad],
      ];
    }
  }
  
  return null;
}

/**
 * Get bounds for a single polygon
 */
function getPolygonBounds(polygon: Point[]): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  
  for (const [x, y] of polygon) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  
  return { minX, minY, maxX, maxY };
}

// ============ Main Slicer Function ============

/**
 * Slice paths using either CuraWASM or fallback pattern generator
 */
export async function slicePaths(
  inputPaths: Path[],
  settings: SlicerSettings,
  onProgress?: ProgressCallback
): Promise<SliceResult> {
  const startTime = performance.now();
  
  if (inputPaths.length === 0) {
    return {
      paths: [],
      layers: 0,
      mode: 'fallback',
      stats: { executionTime: 0 },
    };
  }
  
  onProgress?.({
    stage: 'preparing',
    progress: 0,
    message: 'Preparing paths...',
  });
  
  // Get bounds for infill generation
  const bounds = getPathsBounds(inputPaths);
  
  // Try CuraWASM first if available
  const curaAvailable = await loadCuraWasm();
  
  if (curaAvailable) {
    try {
      onProgress?.({
        stage: 'generating-stl',
        progress: 5,
        message: 'Generating 3D model...',
      });
      
      // Convert to STL
      const stlData = pathsToStl(inputPaths, settings.extrudeHeight, settings.wallThickness);
      
      // Slice with Cura
      return await sliceWithCura(stlData, settings, onProgress);
    } catch (err) {
      console.warn('CuraWASM slicing failed, falling back to pattern generator:', err);
    }
  }
  
  // Fallback: Generate infill patterns directly
  onProgress?.({
    stage: 'slicing',
    progress: 30,
    message: 'Generating infill pattern...',
  });
  
  const outputPaths: Path[] = [];
  
  // Include original paths as perimeters if enabled
  if (settings.includeWalls) {
    outputPaths.push(...inputPaths);
  }
  
  // Generate infill if enabled
  if (settings.includeInfill && settings.infillDensity > 0) {
    // Extract all closed polygons from input
    const polygons = extractClosedPolygons(inputPaths);
    
    if (polygons.length > 0) {
      // Process each polygon separately for proper multi-shape infill
      let processed = 0;
      for (const polygon of polygons) {
        onProgress?.({
          stage: 'slicing',
          progress: 30 + Math.floor((processed / polygons.length) * 50),
          message: `Generating ${settings.infillPattern} pattern (${processed + 1}/${polygons.length})...`,
        });
        
        const polyBounds = getPolygonBounds(polygon);
        
        // Generate infill pattern for this polygon's bounds
        const infillPaths = generateInfillPattern(
          polyBounds,
          settings.infillPattern,
          settings.infillDensity,
          settings.infillAngle,
          polygon
        );
        
        // Clip infill to this specific polygon
        let clippedInfill: Path[];
        if (settings.infillPattern === 'concentric') {
          clippedInfill = infillPaths;
        } else {
          clippedInfill = clipPathsToPolygon(infillPaths, polygon);
        }
        
        outputPaths.push(...clippedInfill);
        processed++;
      }
    } else {
      // Fallback: no closed polygons found, use bounding box approach
      onProgress?.({
        stage: 'slicing',
        progress: 50,
        message: `Generating ${settings.infillPattern} pattern...`,
      });
      
      const clipPolygon = createClippingPolygon(inputPaths);
      
      const infillPaths = generateInfillPattern(
        bounds,
        settings.infillPattern,
        settings.infillDensity,
        settings.infillAngle,
        clipPolygon
      );
      
      let clippedInfill: Path[];
      if (settings.infillPattern === 'concentric') {
        clippedInfill = infillPaths;
      } else if (clipPolygon && clipPolygon.length >= 3) {
        clippedInfill = clipPathsToPolygon(infillPaths, clipPolygon);
      } else {
        clippedInfill = clipPathsToBounds(infillPaths, bounds);
      }
      outputPaths.push(...clippedInfill);
    }
  }
  
  onProgress?.({
    stage: 'complete',
    progress: 100,
    message: 'Pattern generation complete',
  });
  
  // Calculate simulated layers based on extrude height and layer height
  const layers = Math.ceil(settings.extrudeHeight / settings.layerHeight);
  
  return {
    paths: outputPaths,
    layers,
    mode: 'fallback',
    stats: {
      executionTime: performance.now() - startTime,
    },
  };
}

/**
 * Synchronous slicer function for use in flow executor
 * Uses fallback pattern generation (no CuraWASM)
 * Processes each closed polygon separately for proper multi-shape infill
 */
export function slicePathsSync(
  inputPaths: Path[],
  settings: SlicerSettings
): Path[] {
  if (inputPaths.length === 0) {
    return [];
  }
  
  const outputPaths: Path[] = [];
  
  // Include original paths as perimeters if enabled
  if (settings.includeWalls) {
    outputPaths.push(...inputPaths);
  }
  
  // Generate infill if enabled
  if (settings.includeInfill && settings.infillDensity > 0) {
    // Extract all closed polygons from input
    const polygons = extractClosedPolygons(inputPaths);
    
    if (polygons.length > 0) {
      // Process each polygon separately for proper multi-shape infill
      for (const polygon of polygons) {
        const polyBounds = getPolygonBounds(polygon);
        
        // Generate infill pattern for this polygon's bounds
        const infillPaths = generateInfillPattern(
          polyBounds,
          settings.infillPattern,
          settings.infillDensity,
          settings.infillAngle,
          polygon
        );
        
        // Clip infill to this specific polygon
        let clippedInfill: Path[];
        if (settings.infillPattern === 'concentric') {
          clippedInfill = infillPaths; // Already follows contour
        } else {
          clippedInfill = clipPathsToPolygon(infillPaths, polygon);
        }
        
        outputPaths.push(...clippedInfill);
      }
    } else {
      // Fallback: no closed polygons found, use bounding box approach
      const bounds = getPathsBounds(inputPaths);
      const clipPolygon = createClippingPolygon(inputPaths);
      
      const infillPaths = generateInfillPattern(
        bounds,
        settings.infillPattern,
        settings.infillDensity,
        settings.infillAngle,
        clipPolygon
      );
      
      let clippedInfill: Path[];
      if (settings.infillPattern === 'concentric') {
        clippedInfill = infillPaths;
      } else if (clipPolygon && clipPolygon.length >= 3) {
        clippedInfill = clipPathsToPolygon(infillPaths, clipPolygon);
      } else {
        clippedInfill = clipPathsToBounds(infillPaths, bounds);
      }
      
      outputPaths.push(...clippedInfill);
    }
  }
  
  return outputPaths;
}

/**
 * Async slicer function that can use Clipper2 for better results
 * Falls back to sync version if Clipper2 is not available
 * Processes each closed polygon separately for proper multi-shape infill
 */
export async function slicePathsAsync(
  inputPaths: Path[],
  settings: SlicerSettings
): Promise<Path[]> {
  if (inputPaths.length === 0) {
    return [];
  }
  
  const outputPaths: Path[] = [];
  
  if (settings.includeWalls) {
    outputPaths.push(...inputPaths);
  }
  
  // For concentric pattern, try to use Clipper2 for better results
  if (settings.infillPattern === 'concentric' && settings.includeInfill && settings.infillDensity > 0) {
    const polygons = extractClosedPolygons(inputPaths);
    
    if (polygons.length > 0) {
      // Process each polygon separately
      for (const polygon of polygons) {
        const polyBounds = getPolygonBounds(polygon);
        
        // Use Clipper2-enhanced concentric generation for each polygon
        const infillPaths = await generateConcentricInfillClipper(
          polygon,
          polyBounds,
          settings.infillDensity
        );
        
        outputPaths.push(...infillPaths);
      }
      return outputPaths;
    } else {
      // Fallback: use bounding box
      const bounds = getPathsBounds(inputPaths);
      const clipPolygon = createClippingPolygon(inputPaths);
      
      const infillPaths = await generateConcentricInfillClipper(
        clipPolygon,
        bounds,
        settings.infillDensity
      );
      
      outputPaths.push(...infillPaths);
      return outputPaths;
    }
  }
  
  // For other patterns, use sync version (already handles multi-shape)
  return slicePathsSync(inputPaths, settings);
}

/**
 * Hash settings and paths for caching
 */
export function hashSliceInput(paths: Path[], settings: SlicerSettings): string {
  const pathStr = JSON.stringify(paths.map(p => p.map(([x, y]) => [
    Math.round(x * 100),
    Math.round(y * 100),
  ])));
  
  const settingsStr = JSON.stringify({
    h: settings.extrudeHeight,
    w: settings.wallThickness,
    l: settings.layerHeight,
    e: settings.extractLayer,
    p: settings.infillPattern,
    d: settings.infillDensity,
    a: settings.infillAngle,
    iw: settings.includeWalls,
    ii: settings.includeInfill,
    it: settings.includeTravel,
  });
  
  // Simple hash
  let hash = 5381;
  const combined = pathStr + settingsStr;
  for (let i = 0; i < combined.length; i++) {
    hash = ((hash << 5) + hash) ^ combined.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
}
