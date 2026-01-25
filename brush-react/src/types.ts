export type Point = [number, number];
export type Path = Point[];

export interface GlyphAnchor {
  mode: 'base' | 'center' | 'right';
  dx?: number;
}

export interface Glyph {
  paths: Path[];
  advance: number;
  is_mark?: boolean;
  anchor?: GlyphAnchor;
}

export type GlyphData = Record<string, Glyph>;

export interface Settings {
  targetWidth: number;
  offsetX: number;
  offsetY: number;
  feedRate: number;
  backlashX: number;
  backlashY: number;
  safeZ: number;
  kerning: number;
  lineHeight: number;
  artefactThreshold: number;
  dipInterval: number;
  dipX: number;
  dipY: number;
  continuousPlot: boolean;
  controllerHost: string;
  customDipSequence: string;
}

export interface GeneratedGCode {
  gcode: string;
  lines: string[];
  stats: {
    bounds: { minX: number; maxX: number; minY: number; maxY: number };
    scale: number;
    pathCount: number;
    artefactsRemoved: number;
    dipCount: number;
  };
}
