/**
 * Simple stroke font for rendering text as vector paths
 * Each character is defined as an array of polylines
 * Coordinates are normalized to a 0-1 unit cell (width x height)
 */

import type { Point } from '../../utils/drawingApi';

type StrokePath = Point[];
type CharacterDef = StrokePath[];

// Simple sans-serif stroke font
// Each character fits in a 5x7 grid, normalized to 0-1
const CHAR_WIDTH = 5;
const CHAR_HEIGHT = 7;

function normalize(paths: number[][][]): CharacterDef {
  return paths.map(path =>
    path.map(([x, y]) => [x / CHAR_WIDTH, y / CHAR_HEIGHT] as Point)
  );
}

const characters: Record<string, CharacterDef> = {
  'A': normalize([
    [[0, 7], [2.5, 0], [5, 7]],
    [[1, 4], [4, 4]],
  ]),
  'B': normalize([
    [[0, 0], [0, 7], [3.5, 7], [5, 5.5], [5, 5], [3.5, 3.5], [0, 3.5]],
    [[3.5, 3.5], [5, 2], [5, 1.5], [3.5, 0], [0, 0]],
  ]),
  'C': normalize([
    [[5, 1], [4, 0], [1, 0], [0, 1], [0, 6], [1, 7], [4, 7], [5, 6]],
  ]),
  'D': normalize([
    [[0, 0], [0, 7], [3, 7], [5, 5], [5, 2], [3, 0], [0, 0]],
  ]),
  'E': normalize([
    [[5, 0], [0, 0], [0, 7], [5, 7]],
    [[0, 3.5], [4, 3.5]],
  ]),
  'F': normalize([
    [[5, 0], [0, 0], [0, 7]],
    [[0, 3.5], [4, 3.5]],
  ]),
  'G': normalize([
    [[5, 1], [4, 0], [1, 0], [0, 1], [0, 6], [1, 7], [4, 7], [5, 6], [5, 4], [3, 4]],
  ]),
  'H': normalize([
    [[0, 0], [0, 7]],
    [[5, 0], [5, 7]],
    [[0, 3.5], [5, 3.5]],
  ]),
  'I': normalize([
    [[1, 0], [4, 0]],
    [[2.5, 0], [2.5, 7]],
    [[1, 7], [4, 7]],
  ]),
  'J': normalize([
    [[1, 0], [5, 0]],
    [[3.5, 0], [3.5, 6], [2.5, 7], [1, 7], [0, 6]],
  ]),
  'K': normalize([
    [[0, 0], [0, 7]],
    [[5, 0], [0, 3.5], [5, 7]],
  ]),
  'L': normalize([
    [[0, 0], [0, 7], [5, 7]],
  ]),
  'M': normalize([
    [[0, 7], [0, 0], [2.5, 4], [5, 0], [5, 7]],
  ]),
  'N': normalize([
    [[0, 7], [0, 0], [5, 7], [5, 0]],
  ]),
  'O': normalize([
    [[1, 0], [4, 0], [5, 1], [5, 6], [4, 7], [1, 7], [0, 6], [0, 1], [1, 0]],
  ]),
  'P': normalize([
    [[0, 7], [0, 0], [4, 0], [5, 1], [5, 3], [4, 4], [0, 4]],
  ]),
  'Q': normalize([
    [[1, 0], [4, 0], [5, 1], [5, 6], [4, 7], [1, 7], [0, 6], [0, 1], [1, 0]],
    [[3, 5], [5, 7]],
  ]),
  'R': normalize([
    [[0, 7], [0, 0], [4, 0], [5, 1], [5, 3], [4, 4], [0, 4]],
    [[3, 4], [5, 7]],
  ]),
  'S': normalize([
    [[5, 1], [4, 0], [1, 0], [0, 1], [0, 2.5], [1, 3.5], [4, 3.5], [5, 4.5], [5, 6], [4, 7], [1, 7], [0, 6]],
  ]),
  'T': normalize([
    [[0, 0], [5, 0]],
    [[2.5, 0], [2.5, 7]],
  ]),
  'U': normalize([
    [[0, 0], [0, 6], [1, 7], [4, 7], [5, 6], [5, 0]],
  ]),
  'V': normalize([
    [[0, 0], [2.5, 7], [5, 0]],
  ]),
  'W': normalize([
    [[0, 0], [1, 7], [2.5, 3], [4, 7], [5, 0]],
  ]),
  'X': normalize([
    [[0, 0], [5, 7]],
    [[5, 0], [0, 7]],
  ]),
  'Y': normalize([
    [[0, 0], [2.5, 3.5], [5, 0]],
    [[2.5, 3.5], [2.5, 7]],
  ]),
  'Z': normalize([
    [[0, 0], [5, 0], [0, 7], [5, 7]],
  ]),

  // Numbers
  '0': normalize([
    [[1, 0], [4, 0], [5, 1], [5, 6], [4, 7], [1, 7], [0, 6], [0, 1], [1, 0]],
    [[1, 6], [4, 1]],
  ]),
  '1': normalize([
    [[1, 1], [2.5, 0], [2.5, 7]],
    [[1, 7], [4, 7]],
  ]),
  '2': normalize([
    [[0, 1], [1, 0], [4, 0], [5, 1], [5, 2.5], [0, 7], [5, 7]],
  ]),
  '3': normalize([
    [[0, 0], [5, 0], [5, 3], [2.5, 3.5], [5, 4], [5, 6], [4, 7], [1, 7], [0, 6]],
  ]),
  '4': normalize([
    [[4, 7], [4, 0], [0, 4.5], [5, 4.5]],
  ]),
  '5': normalize([
    [[5, 0], [0, 0], [0, 3], [4, 3], [5, 4], [5, 6], [4, 7], [1, 7], [0, 6]],
  ]),
  '6': normalize([
    [[4, 0], [1, 0], [0, 1], [0, 6], [1, 7], [4, 7], [5, 6], [5, 4], [4, 3], [0, 3]],
  ]),
  '7': normalize([
    [[0, 0], [5, 0], [2, 7]],
  ]),
  '8': normalize([
    [[1, 3.5], [0, 2.5], [0, 1], [1, 0], [4, 0], [5, 1], [5, 2.5], [4, 3.5], [1, 3.5], [0, 4.5], [0, 6], [1, 7], [4, 7], [5, 6], [5, 4.5], [4, 3.5]],
  ]),
  '9': normalize([
    [[5, 4], [1, 4], [0, 3], [0, 1], [1, 0], [4, 0], [5, 1], [5, 6], [4, 7], [1, 7]],
  ]),

  // Punctuation and symbols
  '.': normalize([
    [[2, 7], [3, 7], [3, 6], [2, 6], [2, 7]],
  ]),
  ',': normalize([
    [[2.5, 6], [2.5, 7], [2, 8]],
  ]),
  '!': normalize([
    [[2.5, 0], [2.5, 4.5]],
    [[2.5, 6], [2.5, 7]],
  ]),
  '?': normalize([
    [[0, 1], [1, 0], [4, 0], [5, 1], [5, 2], [2.5, 4]],
    [[2.5, 6], [2.5, 7]],
  ]),
  '-': normalize([
    [[1, 3.5], [4, 3.5]],
  ]),
  '+': normalize([
    [[2.5, 1.5], [2.5, 5.5]],
    [[0.5, 3.5], [4.5, 3.5]],
  ]),
  '=': normalize([
    [[0.5, 2.5], [4.5, 2.5]],
    [[0.5, 4.5], [4.5, 4.5]],
  ]),
  '/': normalize([
    [[0, 7], [5, 0]],
  ]),
  ':': normalize([
    [[2.5, 2], [2.5, 2.5]],
    [[2.5, 5.5], [2.5, 6]],
  ]),
  '(': normalize([
    [[3, 0], [1.5, 1.5], [1.5, 5.5], [3, 7]],
  ]),
  ')': normalize([
    [[2, 0], [3.5, 1.5], [3.5, 5.5], [2, 7]],
  ]),
  ' ': [],

  // Lowercase (simplified - same as uppercase but smaller area)
  'a': normalize([
    [[1, 3], [4, 3], [5, 4], [5, 7], [1, 7], [0, 6], [0, 5], [1, 4], [5, 4]],
  ]),
  'b': normalize([
    [[0, 0], [0, 7], [4, 7], [5, 6], [5, 4], [4, 3], [0, 3]],
  ]),
  'c': normalize([
    [[5, 4], [4, 3], [1, 3], [0, 4], [0, 6], [1, 7], [4, 7], [5, 6]],
  ]),
  'd': normalize([
    [[5, 0], [5, 7], [1, 7], [0, 6], [0, 4], [1, 3], [5, 3]],
  ]),
  'e': normalize([
    [[0, 5], [5, 5], [5, 4], [4, 3], [1, 3], [0, 4], [0, 6], [1, 7], [4, 7], [5, 6]],
  ]),
  'f': normalize([
    [[5, 1], [4, 0], [2.5, 0], [1.5, 1], [1.5, 7]],
    [[0, 3], [3.5, 3]],
  ]),
  'g': normalize([
    [[5, 3], [1, 3], [0, 4], [0, 6], [1, 7], [5, 7], [5, 8.5], [4, 9.5], [1, 9.5]],
  ]),
  'h': normalize([
    [[0, 0], [0, 7]],
    [[0, 4], [4, 3], [5, 4], [5, 7]],
  ]),
  'i': normalize([
    [[2.5, 1], [2.5, 1.5]],
    [[2.5, 3], [2.5, 7]],
  ]),
  'j': normalize([
    [[3, 1], [3, 1.5]],
    [[3, 3], [3, 8.5], [2, 9.5], [1, 9.5]],
  ]),
  'k': normalize([
    [[0, 0], [0, 7]],
    [[5, 3], [0, 5], [5, 7]],
  ]),
  'l': normalize([
    [[2, 0], [2.5, 0], [2.5, 6], [3, 7], [4, 7]],
  ]),
  'm': normalize([
    [[0, 7], [0, 3], [1, 3], [2.5, 4.5], [2.5, 7]],
    [[2.5, 4.5], [4, 3], [5, 3], [5, 7]],
  ]),
  'n': normalize([
    [[0, 7], [0, 3], [4, 3], [5, 4], [5, 7]],
  ]),
  'o': normalize([
    [[1, 3], [4, 3], [5, 4], [5, 6], [4, 7], [1, 7], [0, 6], [0, 4], [1, 3]],
  ]),
  'p': normalize([
    [[0, 9.5], [0, 3], [4, 3], [5, 4], [5, 6], [4, 7], [0, 7]],
  ]),
  'q': normalize([
    [[5, 9.5], [5, 3], [1, 3], [0, 4], [0, 6], [1, 7], [5, 7]],
  ]),
  'r': normalize([
    [[0, 7], [0, 3], [2, 3], [4, 3], [5, 4]],
  ]),
  's': normalize([
    [[5, 4], [4, 3], [1, 3], [0, 4], [1, 5], [4, 5], [5, 6], [4, 7], [1, 7], [0, 6]],
  ]),
  't': normalize([
    [[2.5, 0], [2.5, 6], [3.5, 7], [4.5, 7]],
    [[0.5, 3], [4.5, 3]],
  ]),
  'u': normalize([
    [[0, 3], [0, 6], [1, 7], [5, 7], [5, 3]],
  ]),
  'v': normalize([
    [[0, 3], [2.5, 7], [5, 3]],
  ]),
  'w': normalize([
    [[0, 3], [1, 7], [2.5, 5], [4, 7], [5, 3]],
  ]),
  'x': normalize([
    [[0, 3], [5, 7]],
    [[5, 3], [0, 7]],
  ]),
  'y': normalize([
    [[0, 3], [2.5, 6]],
    [[5, 3], [2.5, 6], [1, 9.5]],
  ]),
  'z': normalize([
    [[0, 3], [5, 3], [0, 7], [5, 7]],
  ]),
};

export interface TextRenderOptions {
  x: number;
  y: number;
  size: number;
  spacing?: number; // Letter spacing multiplier (default 1.2)
  lineHeight?: number; // Line height multiplier (default 1.5)
}

/**
 * Render text as vector paths
 * Characters are rendered directly - preview Y-flip handles coordinate inversion
 */
export function renderText(text: string, options: TextRenderOptions): Point[][] {
  const { x, y, size, spacing = 1.2, lineHeight = 1.5 } = options;
  const paths: Point[][] = [];

  const charWidth = size * spacing;
  const charHeight = size * (CHAR_HEIGHT / CHAR_WIDTH);
  const lineHeightPx = charHeight * lineHeight;

  let cursorX = x;
  let cursorY = y;

  for (const char of text) {
    if (char === '\n') {
      cursorX = x;
      cursorY += lineHeightPx;
      continue;
    }

    const charDef = characters[char] || characters[char.toUpperCase()];
    if (charDef) {
      for (const stroke of charDef) {
        const transformedPath: Point[] = stroke.map(([px, py]) => [
          cursorX + px * size,
          // Flip Y within character so text reads correctly after preview Y-flip
          cursorY + (1 - py) * charHeight,
        ]);
        if (transformedPath.length > 1) {
          paths.push(transformedPath);
        }
      }
    }

    cursorX += charWidth;
  }

  return paths;
}

export { characters };
