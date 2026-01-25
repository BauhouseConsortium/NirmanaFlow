/**
 * Example algorithms for the algorithmic drawing tool
 */

export interface Example {
  name: string;
  description: string;
  code: string;
}

export const examples: Example[] = [
  {
    name: 'Maze',
    description: 'Recursive backtracker maze generation',
    code: `// Recursive Backtracker Maze
function draw(api) {
  const cols = 15;
  const rows = 12;
  const cellW = api.width / cols;
  const cellH = api.height / rows;

  // Initialize grid
  const grid = [];
  for (let y = 0; y < rows; y++) {
    grid[y] = [];
    for (let x = 0; x < cols; x++) {
      grid[y][x] = {
        visited: false,
        walls: { top: true, right: true, bottom: true, left: true }
      };
    }
  }

  // Recursive backtracker
  const stack = [];
  let current = { x: 0, y: 0 };
  grid[0][0].visited = true;

  const getNeighbors = (x, y) => {
    const neighbors = [];
    if (y > 0 && !grid[y-1][x].visited) neighbors.push({ x, y: y-1, dir: 'top' });
    if (x < cols-1 && !grid[y][x+1].visited) neighbors.push({ x: x+1, y, dir: 'right' });
    if (y < rows-1 && !grid[y+1][x].visited) neighbors.push({ x, y: y+1, dir: 'bottom' });
    if (x > 0 && !grid[y][x-1].visited) neighbors.push({ x: x-1, y, dir: 'left' });
    return neighbors;
  };

  const removeWalls = (curr, next, dir) => {
    if (dir === 'top') { grid[curr.y][curr.x].walls.top = false; grid[next.y][next.x].walls.bottom = false; }
    if (dir === 'right') { grid[curr.y][curr.x].walls.right = false; grid[next.y][next.x].walls.left = false; }
    if (dir === 'bottom') { grid[curr.y][curr.x].walls.bottom = false; grid[next.y][next.x].walls.top = false; }
    if (dir === 'left') { grid[curr.y][curr.x].walls.left = false; grid[next.y][next.x].walls.right = false; }
  };

  // Generate maze
  while (true) {
    const neighbors = getNeighbors(current.x, current.y);
    if (neighbors.length > 0) {
      const next = neighbors[Math.floor(random() * neighbors.length)];
      stack.push(current);
      removeWalls(current, next, next.dir);
      current = { x: next.x, y: next.y };
      grid[current.y][current.x].visited = true;
    } else if (stack.length > 0) {
      current = stack.pop();
    } else {
      break;
    }
  }

  // Draw maze
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const cell = grid[y][x];
      const px = x * cellW;
      const py = y * cellH;

      if (cell.walls.top) line(px, py, px + cellW, py);
      if (cell.walls.left) line(px, py, px, py + cellH);
    }
  }

  // Draw outer walls
  line(api.width, 0, api.width, api.height);
  line(0, api.height, api.width, api.height);
}`,
  },
  {
    name: 'Spirograph',
    description: 'Parametric spirograph curves',
    code: `// Spirograph
function draw(api) {
  const cx = api.width / 2;
  const cy = api.height / 2;

  // Spirograph parameters
  const R = 50;  // Fixed circle radius
  const r = 30;  // Rolling circle radius
  const d = 40;  // Distance from center of rolling circle

  const steps = 2000;
  const rotations = 10;

  beginPath();
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 2 * rotations;

    const x = cx + (R - r) * Math.cos(t) + d * Math.cos((R - r) / r * t);
    const y = cy + (R - r) * Math.sin(t) - d * Math.sin((R - r) / r * t);

    if (i === 0) {
      moveTo(x, y);
    } else {
      lineTo(x, y);
    }
  }
  endPath();

  // Add a second pattern with different parameters
  const R2 = 55;
  const r2 = 15;
  const d2 = 30;

  beginPath();
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 2 * rotations;

    const x = cx + (R2 - r2) * Math.cos(t) + d2 * Math.cos((R2 - r2) / r2 * t);
    const y = cy + (R2 - r2) * Math.sin(t) - d2 * Math.sin((R2 - r2) / r2 * t);

    if (i === 0) {
      moveTo(x, y);
    } else {
      lineTo(x, y);
    }
  }
  endPath();
}`,
  },
  {
    name: 'Flow Field',
    description: 'Perlin noise flow field',
    code: `// Perlin Noise Flow Field
function draw(api) {
  const numLines = 150;
  const steps = 50;
  const stepLength = 3;
  const noiseScale = 0.02;

  noiseSeed(42);
  randomSeed(123);

  for (let i = 0; i < numLines; i++) {
    let x = random(api.width);
    let y = random(api.height);

    beginPath();
    moveTo(x, y);

    for (let j = 0; j < steps; j++) {
      const angle = noise(x * noiseScale, y * noiseScale) * Math.PI * 4;

      x += Math.cos(angle) * stepLength;
      y += Math.sin(angle) * stepLength;

      // Stay in bounds
      if (x < 0 || x > api.width || y < 0 || y > api.height) break;

      lineTo(x, y);
    }
    endPath();
  }
}`,
  },
  {
    name: 'Truchet Tiles',
    description: 'Random quarter-circle tile pattern',
    code: `// Truchet Tiles
function draw(api) {
  const tileSize = 20;
  const cols = Math.ceil(api.width / tileSize);
  const rows = Math.ceil(api.height / tileSize);

  randomSeed(42);

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const px = x * tileSize;
      const py = y * tileSize;

      // Randomly choose tile orientation
      if (random() > 0.5) {
        // Arc from top-left to bottom-right corners
        arc(px, py, tileSize / 2, 0, 90, 12);
        arc(px + tileSize, py + tileSize, tileSize / 2, 180, 270, 12);
      } else {
        // Arc from top-right to bottom-left corners
        arc(px + tileSize, py, tileSize / 2, 90, 180, 12);
        arc(px, py + tileSize, tileSize / 2, 270, 360, 12);
      }
    }
  }
}`,
  },
  {
    name: 'L-System Tree',
    description: 'Fractal tree using L-system rules',
    code: `// L-System Fractal Tree
function draw(api) {
  // L-system rules
  const axiom = 'F';
  const rules = { 'F': 'FF+[+F-F-F]-[-F+F+F]' };
  const iterations = 4;
  const angle = 25;
  const length = 5;

  // Generate L-system string
  let current = axiom;
  for (let i = 0; i < iterations; i++) {
    let next = '';
    for (const char of current) {
      next += rules[char] || char;
    }
    current = next;
  }

  // Draw the tree
  let x = api.width / 2;
  let y = api.height;
  let dir = -90; // Start pointing up
  const stack = [];

  for (const char of current) {
    if (char === 'F') {
      const newX = x + Math.cos(radians(dir)) * length;
      const newY = y + Math.sin(radians(dir)) * length;
      line(x, y, newX, newY);
      x = newX;
      y = newY;
    } else if (char === '+') {
      dir += angle;
    } else if (char === '-') {
      dir -= angle;
    } else if (char === '[') {
      stack.push({ x, y, dir });
    } else if (char === ']') {
      const state = stack.pop();
      x = state.x;
      y = state.y;
      dir = state.dir;
    }
  }
}`,
  },
  {
    name: 'Concentric Circles',
    description: 'Simple concentric circle pattern',
    code: `// Concentric Circles
function draw(api) {
  const cx = api.width / 2;
  const cy = api.height / 2;
  const maxRadius = Math.min(api.width, api.height) / 2 - 10;
  const spacing = 5;

  for (let r = spacing; r <= maxRadius; r += spacing) {
    circle(cx, cy, r);
  }
}`,
  },
  {
    name: 'Grid Pattern',
    description: 'Simple grid with diagonal crosses',
    code: `// Grid with Diagonal Crosses
function draw(api) {
  const cellSize = 20;
  const cols = Math.floor(api.width / cellSize);
  const rows = Math.floor(api.height / cellSize);
  const margin = (api.width - cols * cellSize) / 2;
  const marginY = (api.height - rows * cellSize) / 2;

  // Draw grid
  for (let i = 0; i <= cols; i++) {
    const x = margin + i * cellSize;
    line(x, marginY, x, marginY + rows * cellSize);
  }

  for (let i = 0; i <= rows; i++) {
    const y = marginY + i * cellSize;
    line(margin, y, margin + cols * cellSize, y);
  }

  // Draw diagonal crosses in alternating cells
  randomSeed(42);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (random() > 0.5) {
        const px = margin + x * cellSize;
        const py = marginY + y * cellSize;

        if (random() > 0.5) {
          line(px, py, px + cellSize, py + cellSize);
        } else {
          line(px + cellSize, py, px, py + cellSize);
        }
      }
    }
  }
}`,
  },
  {
    name: 'Spiral',
    description: 'Archimedean spiral',
    code: `// Archimedean Spiral
function draw(api) {
  const cx = api.width / 2;
  const cy = api.height / 2;
  const spacing = 3;
  const rotations = 8;
  const steps = rotations * 100;

  beginPath();
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * rotations * Math.PI * 2;
    const r = spacing * t / (Math.PI * 2);

    const x = cx + Math.cos(t) * r;
    const y = cy + Math.sin(t) * r;

    if (i === 0) {
      moveTo(x, y);
    } else {
      lineTo(x, y);
    }
  }
  endPath();
}`,
  },
  {
    name: 'Hatching',
    description: 'Cross-hatching pattern',
    code: `// Cross-Hatching
function draw(api) {
  const spacing = 8;
  const angle1 = 45;
  const angle2 = -45;

  const drawHatchLines = (angle) => {
    const rad = radians(angle);
    const dx = Math.cos(rad);
    const dy = Math.sin(rad);

    // Perpendicular direction for spacing
    const px = -dy;
    const py = dx;

    const diagonal = Math.sqrt(api.width * api.width + api.height * api.height);
    const numLines = Math.ceil(diagonal / spacing) * 2;

    for (let i = -numLines / 2; i < numLines / 2; i++) {
      const cx = api.width / 2 + px * i * spacing;
      const cy = api.height / 2 + py * i * spacing;

      const x1 = cx - dx * diagonal;
      const y1 = cy - dy * diagonal;
      const x2 = cx + dx * diagonal;
      const y2 = cy + dy * diagonal;

      // Clip to bounds
      const points = clipLine(x1, y1, x2, y2, 0, 0, api.width, api.height);
      if (points) {
        line(points[0], points[1], points[2], points[3]);
      }
    }
  };

  // Simple line clipping
  function clipLine(x1, y1, x2, y2, minX, minY, maxX, maxY) {
    // Cohen-Sutherland clipping (simplified)
    const INSIDE = 0, LEFT = 1, RIGHT = 2, BOTTOM = 4, TOP = 8;

    const code = (x, y) => {
      let c = INSIDE;
      if (x < minX) c |= LEFT;
      else if (x > maxX) c |= RIGHT;
      if (y < minY) c |= TOP;
      else if (y > maxY) c |= BOTTOM;
      return c;
    };

    let c1 = code(x1, y1);
    let c2 = code(x2, y2);

    while (true) {
      if (!(c1 | c2)) return [x1, y1, x2, y2];
      if (c1 & c2) return null;

      const c = c1 || c2;
      let x, y;

      if (c & BOTTOM) { x = x1 + (x2 - x1) * (maxY - y1) / (y2 - y1); y = maxY; }
      else if (c & TOP) { x = x1 + (x2 - x1) * (minY - y1) / (y2 - y1); y = minY; }
      else if (c & RIGHT) { y = y1 + (y2 - y1) * (maxX - x1) / (x2 - x1); x = maxX; }
      else if (c & LEFT) { y = y1 + (y2 - y1) * (minX - x1) / (x2 - x1); x = minX; }

      if (c === c1) { x1 = x; y1 = y; c1 = code(x1, y1); }
      else { x2 = x; y2 = y; c2 = code(x2, y2); }
    }
  }

  drawHatchLines(angle1);
  drawHatchLines(angle2);
}`,
  },
  {
    name: 'Waves',
    description: 'Sine wave interference pattern',
    code: `// Wave Interference
function draw(api) {
  const numWaves = 20;
  const amplitude = 10;
  const frequency = 0.05;
  const phase = 0.3;

  for (let w = 0; w < numWaves; w++) {
    const baseY = (w + 1) * (api.height / (numWaves + 1));

    beginPath();
    for (let x = 0; x <= api.width; x += 2) {
      // Two interfering sine waves
      const y1 = Math.sin(x * frequency + w * phase) * amplitude;
      const y2 = Math.sin(x * frequency * 1.5 + w * phase * 0.7) * amplitude * 0.5;
      const y = baseY + y1 + y2;

      if (x === 0) {
        moveTo(x, y);
      } else {
        lineTo(x, y);
      }
    }
    endPath();
  }
}`,
  },
];

export const defaultCode = examples[0].code;
