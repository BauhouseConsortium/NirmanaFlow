/**
 * Drawing API for algorithmic art generation
 * Provides a p5.js-like interface that captures vector paths for G-code generation
 */

export type Point = [number, number];
export type Path = Point[];

export interface DrawingContext {
  width: number;
  height: number;
  paths: Path[];
  currentPath: Path | null;
}

export interface DrawingAPI {
  // Canvas dimensions
  width: number;
  height: number;

  // Drawing primitives
  line: (x1: number, y1: number, x2: number, y2: number) => void;
  rect: (x: number, y: number, w: number, h: number) => void;
  circle: (cx: number, cy: number, r: number, segments?: number) => void;
  ellipse: (cx: number, cy: number, rx: number, ry: number, segments?: number) => void;
  arc: (cx: number, cy: number, r: number, startAngle: number, endAngle: number, segments?: number) => void;
  polygon: (points: Point[]) => void;
  polyline: (points: Point[]) => void;

  // Path building (pen control)
  beginPath: () => void;
  moveTo: (x: number, y: number) => void;
  lineTo: (x: number, y: number) => void;
  endPath: () => void;

  // Curves
  bezier: (x1: number, y1: number, cx1: number, cy1: number, cx2: number, cy2: number, x2: number, y2: number, segments?: number) => void;
  quadratic: (x1: number, y1: number, cx: number, cy: number, x2: number, y2: number, segments?: number) => void;

  // Noise functions
  noise: (x: number, y?: number, z?: number) => number;
  noiseSeed: (seed: number) => void;

  // Random functions
  random: (min?: number, max?: number) => number;
  randomSeed: (seed: number) => void;

  // Math helpers
  map: (value: number, start1: number, stop1: number, start2: number, stop2: number) => number;
  constrain: (value: number, min: number, max: number) => number;
  lerp: (start: number, stop: number, amt: number) => number;
  dist: (x1: number, y1: number, x2: number, y2: number) => number;

  // Trig shortcuts (degrees)
  sin: (angle: number) => number;
  cos: (angle: number) => number;
  radians: (degrees: number) => number;
  degrees: (radians: number) => number;
}

// Simplex noise implementation (simplified)
class SimplexNoise {
  private perm: number[] = [];

  constructor(seed: number = Math.random() * 65536) {
    this.seed(seed);
  }

  seed(s: number) {
    const p = [];
    for (let i = 0; i < 256; i++) {
      p[i] = i;
    }

    // Fisher-Yates shuffle with seed
    let rng = s;
    const nextRng = () => {
      rng = (rng * 1103515245 + 12345) & 0x7fffffff;
      return rng / 0x7fffffff;
    };

    for (let i = 255; i > 0; i--) {
      const j = Math.floor(nextRng() * (i + 1));
      [p[i], p[j]] = [p[j], p[i]];
    }

    this.perm = [...p, ...p];
  }

  noise2D(x: number, y: number): number {
    const F2 = 0.5 * (Math.sqrt(3) - 1);
    const G2 = (3 - Math.sqrt(3)) / 6;

    const s = (x + y) * F2;
    const i = Math.floor(x + s);
    const j = Math.floor(y + s);

    const t = (i + j) * G2;
    const X0 = i - t;
    const Y0 = j - t;
    const x0 = x - X0;
    const y0 = y - Y0;

    const i1 = x0 > y0 ? 1 : 0;
    const j1 = x0 > y0 ? 0 : 1;

    const x1 = x0 - i1 + G2;
    const y1 = y0 - j1 + G2;
    const x2 = x0 - 1 + 2 * G2;
    const y2 = y0 - 1 + 2 * G2;

    const ii = i & 255;
    const jj = j & 255;

    const grad = (hash: number, gx: number, gy: number): number => {
      const h = hash & 7;
      const u = h < 4 ? gx : gy;
      const v = h < 4 ? gy : gx;
      return ((h & 1) ? -u : u) + ((h & 2) ? -2 * v : 2 * v);
    };

    let n0 = 0, n1 = 0, n2 = 0;

    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 >= 0) {
      t0 *= t0;
      n0 = t0 * t0 * grad(this.perm[ii + this.perm[jj]], x0, y0);
    }

    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 >= 0) {
      t1 *= t1;
      n1 = t1 * t1 * grad(this.perm[ii + i1 + this.perm[jj + j1]], x1, y1);
    }

    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 >= 0) {
      t2 *= t2;
      n2 = t2 * t2 * grad(this.perm[ii + 1 + this.perm[jj + 1]], x2, y2);
    }

    return 70 * (n0 + n1 + n2) * 0.5 + 0.5; // Normalize to 0-1
  }

  noise3D(x: number, y: number, z: number): number {
    // Simplified 3D noise using 2D slices
    const xy = this.noise2D(x, y);
    const xz = this.noise2D(x, z);
    const yz = this.noise2D(y, z);
    return (xy + xz + yz) / 3;
  }
}

// Seeded random number generator
class SeededRandom {
  private seed: number;

  constructor(seed: number = Math.random() * 65536) {
    this.seed = seed;
  }

  setSeed(s: number) {
    this.seed = s;
  }

  next(): number {
    this.seed = (this.seed * 1103515245 + 12345) & 0x7fffffff;
    return this.seed / 0x7fffffff;
  }

  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }
}

export function createDrawingAPI(width: number, height: number): { api: DrawingAPI; context: DrawingContext } {
  const context: DrawingContext = {
    width,
    height,
    paths: [],
    currentPath: null,
  };

  const noise = new SimplexNoise();
  const rng = new SeededRandom();

  const addPath = (path: Path) => {
    if (path.length > 0) {
      context.paths.push(path);
    }
  };

  const api: DrawingAPI = {
    width,
    height,

    // Basic shapes
    line(x1, y1, x2, y2) {
      addPath([[x1, y1], [x2, y2]]);
    },

    rect(x, y, w, h) {
      addPath([
        [x, y],
        [x + w, y],
        [x + w, y + h],
        [x, y + h],
        [x, y], // Close the rectangle
      ]);
    },

    circle(cx, cy, r, segments = 36) {
      const points: Path = [];
      for (let i = 0; i <= segments; i++) {
        const angle = (i / segments) * Math.PI * 2;
        points.push([
          cx + Math.cos(angle) * r,
          cy + Math.sin(angle) * r,
        ]);
      }
      addPath(points);
    },

    ellipse(cx, cy, rx, ry, segments = 36) {
      const points: Path = [];
      for (let i = 0; i <= segments; i++) {
        const angle = (i / segments) * Math.PI * 2;
        points.push([
          cx + Math.cos(angle) * rx,
          cy + Math.sin(angle) * ry,
        ]);
      }
      addPath(points);
    },

    arc(cx, cy, r, startAngle, endAngle, segments = 24) {
      const points: Path = [];
      const startRad = (startAngle * Math.PI) / 180;
      const endRad = (endAngle * Math.PI) / 180;
      const range = endRad - startRad;

      for (let i = 0; i <= segments; i++) {
        const angle = startRad + (i / segments) * range;
        points.push([
          cx + Math.cos(angle) * r,
          cy + Math.sin(angle) * r,
        ]);
      }
      addPath(points);
    },

    polygon(points) {
      if (points.length > 0) {
        const closed = [...points, points[0]];
        addPath(closed);
      }
    },

    polyline(points) {
      if (points.length > 1) {
        addPath([...points]);
      }
    },

    // Path building
    beginPath() {
      context.currentPath = [];
    },

    moveTo(x, y) {
      if (context.currentPath && context.currentPath.length > 0) {
        addPath(context.currentPath);
      }
      context.currentPath = [[x, y]];
    },

    lineTo(x, y) {
      if (context.currentPath) {
        context.currentPath.push([x, y]);
      } else {
        context.currentPath = [[x, y]];
      }
    },

    endPath() {
      if (context.currentPath && context.currentPath.length > 0) {
        addPath(context.currentPath);
      }
      context.currentPath = null;
    },

    // Curves
    bezier(x1, y1, cx1, cy1, cx2, cy2, x2, y2, segments = 20) {
      const points: Path = [];
      for (let i = 0; i <= segments; i++) {
        const t = i / segments;
        const t2 = t * t;
        const t3 = t2 * t;
        const mt = 1 - t;
        const mt2 = mt * mt;
        const mt3 = mt2 * mt;

        points.push([
          mt3 * x1 + 3 * mt2 * t * cx1 + 3 * mt * t2 * cx2 + t3 * x2,
          mt3 * y1 + 3 * mt2 * t * cy1 + 3 * mt * t2 * cy2 + t3 * y2,
        ]);
      }
      addPath(points);
    },

    quadratic(x1, y1, cx, cy, x2, y2, segments = 20) {
      const points: Path = [];
      for (let i = 0; i <= segments; i++) {
        const t = i / segments;
        const mt = 1 - t;

        points.push([
          mt * mt * x1 + 2 * mt * t * cx + t * t * x2,
          mt * mt * y1 + 2 * mt * t * cy + t * t * y2,
        ]);
      }
      addPath(points);
    },

    // Noise
    noise(x, y = 0, z?: number) {
      if (z !== undefined) {
        return noise.noise3D(x, y, z);
      }
      return noise.noise2D(x, y);
    },

    noiseSeed(seed) {
      noise.seed(seed);
    },

    // Random
    random(min?: number, max?: number) {
      if (min === undefined) {
        return rng.next();
      }
      if (max === undefined) {
        return rng.range(0, min);
      }
      return rng.range(min, max);
    },

    randomSeed(seed) {
      rng.setSeed(seed);
    },

    // Math helpers
    map(value, start1, stop1, start2, stop2) {
      return start2 + (stop2 - start2) * ((value - start1) / (stop1 - start1));
    },

    constrain(value, min, max) {
      return Math.min(Math.max(value, min), max);
    },

    lerp(start, stop, amt) {
      return start + (stop - start) * amt;
    },

    dist(x1, y1, x2, y2) {
      const dx = x2 - x1;
      const dy = y2 - y1;
      return Math.sqrt(dx * dx + dy * dy);
    },

    // Trig (degrees)
    sin(angle) {
      return Math.sin((angle * Math.PI) / 180);
    },

    cos(angle) {
      return Math.cos((angle * Math.PI) / 180);
    },

    radians(degrees) {
      return (degrees * Math.PI) / 180;
    },

    degrees(radians) {
      return (radians * 180) / Math.PI;
    },
  };

  return { api, context };
}

export interface ExecutionResult {
  success: boolean;
  paths: Path[];
  error?: string;
  executionTime: number;
}

export function executeDrawingCode(code: string, width: number, height: number): ExecutionResult {
  const startTime = performance.now();

  try {
    const { api, context } = createDrawingAPI(width, height);

    // Create a safe function with the API exposed
    const drawFunction = new Function(
      'api',
      'width',
      'height',
      // Expose all API methods as local variables
      'line',
      'rect',
      'circle',
      'ellipse',
      'arc',
      'polygon',
      'polyline',
      'beginPath',
      'moveTo',
      'lineTo',
      'endPath',
      'bezier',
      'quadratic',
      'noise',
      'noiseSeed',
      'random',
      'randomSeed',
      'map',
      'constrain',
      'lerp',
      'dist',
      'sin',
      'cos',
      'radians',
      'degrees',
      `
      ${code}

      // Auto-call draw if it exists
      if (typeof draw === 'function') {
        draw(api);
      }
      `
    );

    drawFunction(
      api,
      width,
      height,
      api.line.bind(api),
      api.rect.bind(api),
      api.circle.bind(api),
      api.ellipse.bind(api),
      api.arc.bind(api),
      api.polygon.bind(api),
      api.polyline.bind(api),
      api.beginPath.bind(api),
      api.moveTo.bind(api),
      api.lineTo.bind(api),
      api.endPath.bind(api),
      api.bezier.bind(api),
      api.quadratic.bind(api),
      api.noise.bind(api),
      api.noiseSeed.bind(api),
      api.random.bind(api),
      api.randomSeed.bind(api),
      api.map.bind(api),
      api.constrain.bind(api),
      api.lerp.bind(api),
      api.dist.bind(api),
      api.sin.bind(api),
      api.cos.bind(api),
      api.radians.bind(api),
      api.degrees.bind(api)
    );

    // Close any open path
    if (context.currentPath && context.currentPath.length > 0) {
      context.paths.push(context.currentPath);
    }

    return {
      success: true,
      paths: context.paths,
      executionTime: performance.now() - startTime,
    };
  } catch (err) {
    return {
      success: false,
      paths: [],
      error: err instanceof Error ? err.message : String(err),
      executionTime: performance.now() - startTime,
    };
  }
}
