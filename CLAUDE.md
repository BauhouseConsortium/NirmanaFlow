# CLAUDE.md - Algorithmic Plotter (G-Code Generator)

## Project Overview
**Algorithmic Plotter** is a modern React-based creative coding tool for generating vector drawings and G-code for pen plotters and CNC machines. Users write JavaScript code using a p5.js-like drawing API, which generates vector paths that are then converted to optimized G-code.

## Architecture & Tech Stack
- **Frontend**: React 19 + TypeScript + Vite 7
- **Code Editor**: Monaco Editor with custom API autocomplete
- **Styling**: Tailwind CSS 4 (dark slate theme)
- **Layout**: Allotment (resizable split panes)
- **State Management**: React hooks (useState, useCallback, useEffect)
- **Package Manager**: pnpm
- **Node Version**: 24.x (managed via asdf)

## Project Structure

```
brush-react/
├── src/
│   ├── components/
│   │   ├── CodeEditor.tsx        # Monaco editor with Drawing API autocomplete
│   │   ├── VectorPreview.tsx     # Canvas preview with G-code simulation
│   │   ├── VectorSettingsPanel.tsx # Collapsible settings panel
│   │   ├── Toolbar.tsx           # Run/Export/Upload buttons + Examples dropdown
│   │   ├── Console.tsx           # Timestamped log output panel
│   │   └── [legacy components]   # Old Batak-specific components (unused)
│   ├── hooks/
│   │   ├── useVectorSettings.ts  # Settings state for vector drawing
│   │   └── useConsole.ts         # Console logging hook
│   ├── utils/
│   │   ├── drawingApi.ts         # Core Drawing API (p5-like interface)
│   │   ├── vectorGcodeGenerator.ts # Vector paths → G-code conversion
│   │   ├── pathOptimizer.ts      # Path merging & L-R optimization
│   │   ├── backlashFixer.ts      # Mechanical backlash compensation
│   │   └── hardware.ts           # FluidNC controller API
│   ├── data/
│   │   └── examples.ts           # Built-in algorithm examples
│   ├── App.tsx                   # Main application with split-pane layout
│   ├── main.tsx                  # React entry point
│   └── index.css                 # Tailwind + Allotment styles
├── vite.config.ts
├── tsconfig.json
├── package.json
└── .tool-versions
```

## Core Features

### 1. Drawing API (`src/utils/drawingApi.ts`)
A p5.js-like API that captures vector paths for plotting:

```javascript
// Available functions
line(x1, y1, x2, y2)          // Draw line
rect(x, y, w, h)              // Draw rectangle
circle(cx, cy, r)             // Draw circle
ellipse(cx, cy, rx, ry)       // Draw ellipse
arc(cx, cy, r, start, end)    // Draw arc
polygon(points)               // Draw closed polygon
polyline(points)              // Draw open polyline
bezier(x1,y1, cx1,cy1, cx2,cy2, x2,y2)  // Cubic bezier
quadratic(x1,y1, cx,cy, x2,y2)          // Quadratic bezier

// Path building
beginPath() / moveTo(x,y) / lineTo(x,y) / endPath()

// Noise & random
noise(x, y?, z?)              // Perlin-like noise (0-1)
noiseSeed(seed)
random(min?, max?)            // Seeded random
randomSeed(seed)

// Math helpers
map(val, in1, in2, out1, out2)
constrain(val, min, max)
lerp(start, stop, amt)
dist(x1, y1, x2, y2)
sin(degrees) / cos(degrees)
radians(deg) / degrees(rad)
```

### 2. Code Execution
- User code is executed via `new Function()` with the API exposed as local variables
- If code defines a `draw(api)` function, it's called automatically
- Execution is debounced (500ms) for live preview updates
- Errors are displayed inline in the editor

### 3. G-Code Generation (`src/utils/vectorGcodeGenerator.ts`)
- Converts vector paths to G-code with proper scaling
- **Path Optimization**: Sorts strokes L→R, merges connected endpoints
- **Backlash Compensation**: Injects corrective moves on direction changes
- **Ink Dipping**: Optional auto-dip sequences at configurable intervals
- **SVG Export**: Generates clean SVG alongside G-code

### 4. Preview & Simulation (`src/components/VectorPreview.tsx`)
- Real-time canvas visualization of vector paths
- G-code simulation with timing based on feed rates
- Speed control (1x to 20x playback)
- Pen up/down state indicator

### 5. Built-in Examples (`src/data/examples.ts`)
- **Maze**: Recursive backtracker maze generation
- **Spirograph**: Parametric spirograph curves
- **Flow Field**: Perlin noise flow field
- **Truchet Tiles**: Random quarter-circle pattern
- **L-System Tree**: Fractal tree
- **Concentric Circles**: Simple circle pattern
- **Grid Pattern**: Diagonal cross pattern
- **Spiral**: Archimedean spiral
- **Hatching**: Cross-hatching pattern
- **Waves**: Sine wave interference

## Settings (Configurable via UI)

| Category | Setting | Default | Description |
|----------|---------|---------|-------------|
| Canvas | Width/Height | 150/120 | Input coordinate space |
| Output | Target Width/Height | 120/100mm | Physical output size |
| Output | Offset X/Y | 15/20mm | Starting position |
| Machine | Feed Rate | 1600 mm/min | Drawing speed |
| Machine | Safe Z | 5mm | Pen retract height |
| Machine | Backlash X/Y | 0mm | Mechanical compensation |
| Ink | Continuous Plot | true | Disable ink dipping |
| Ink | Dip Interval | 80mm | Distance before re-dipping |
| Hardware | Controller Host | http://192.168.0.248 | FluidNC IP |

## Commands

```bash
# Development
cd brush-react
pnpm install          # Install dependencies
pnpm run dev          # Start dev server (http://localhost:5173)
pnpm run build        # Production build
pnpm run preview      # Preview production build

# Node version (via asdf)
asdf set nodejs 24.2.0
```

## UI Layout

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Algorithmic Plotter  │  ▶ Run  │  Examples ▼  │  SVG  │  G-Code  │ Upload │
├────────────────────────────────┬────────────────────────────────────────────┤
│                                │                                            │
│   CODE EDITOR (Monaco)         │   LIVE PREVIEW                             │
│   ─────────────────────────    │   ────────────────────────────             │
│                                │                                            │
│   function draw(api) {         │   [Canvas with vector paths]              │
│     const cols = 15;           │                                            │
│     ...                        │   ▶ Simulate  │ Speed: 5x                 │
│   }                            │                                            │
│                                ├────────────────────────────────────────────┤
│                                │  SETTINGS         │  CONSOLE               │
│                                │  Canvas: 150x120  │  [12:34] 150 paths     │
│                                │  Output: 120mm    │  [12:34] 423 lines     │
└────────────────────────────────┴────────────────────────────────────────────┘
```

## Guidelines for AI Contributors

### Do's
- Keep logic modular in `src/utils/` - each file has single responsibility
- Use TypeScript types consistently
- Preserve Z-hop safety logic (pen must lift before travel moves)
- Test G-code output via simulation before hardware changes
- Add new examples to `src/data/examples.ts`

### Don'ts
- Don't execute user code directly - use the Drawing API sandbox
- Don't remove backlash compensation logic
- Don't hardcode machine-specific values - use Settings
- Don't break the G-code simulation timing logic

### Key Files for Common Tasks
- **Add new drawing primitive**: `src/utils/drawingApi.ts`
- **Add new example**: `src/data/examples.ts`
- **Modify G-code output**: `src/utils/vectorGcodeGenerator.ts`
- **Change preview rendering**: `src/components/VectorPreview.tsx`
- **Add new setting**: `src/hooks/useVectorSettings.ts` + `VectorSettingsPanel.tsx`

## G-Code Output Format

```gcode
%
(Algorithmic Drawing G-code)
G21 G90          ; mm, absolute
G0 Z5            ; safe height
G0 X41 Y5        ; go to ink well
G1 Z-2 F500      ; dip pen
G4 P0.5          ; dwell
G0 Z5            ; lift
G0 X15.0 Y20.0   ; rapid to start
G1 Z0 F500       ; pen down
G1 X45.0 Y50.0 F1600  ; draw
G0 Z5            ; pen up
; ... more paths ...
G0 X10 Y130      ; park
M30              ; end
%
```

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         App.tsx                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐ │
│  │  CodeEditor  │  │   Toolbar    │  │  VectorSettingsPanel   │ │
│  │  (Monaco)    │  │  (Run/Export │  │  (Canvas, Output,      │ │
│  │              │  │   Examples)  │  │   Machine, Hardware)   │ │
│  └──────────────┘  └──────────────┘  └────────────────────────┘ │
│         │                                                        │
│         ▼                                                        │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │           executeDrawingCode(code, width, height)         │   │
│  │                         │                                 │   │
│  │                 drawingApi.ts                             │   │
│  │  (line, rect, circle, noise, random, etc.)               │   │
│  └──────────────────────────────────────────────────────────┘   │
│                            │                                     │
│                     Path[] (vector paths)                        │
│                            │                                     │
│              ┌─────────────┴─────────────┐                      │
│              ▼                           ▼                      │
│  ┌────────────────────┐      ┌────────────────────┐            │
│  │   VectorPreview    │      │ vectorGcodeGenerator│            │
│  │   (Canvas + Sim)   │      │  (G-code + SVG)    │            │
│  └────────────────────┘      └────────────────────┘            │
│                                         │                       │
│                                         ▼                       │
│                              ┌────────────────────┐            │
│                              │    hardware.ts     │            │
│                              │  (Upload to        │            │
│                              │   FluidNC)         │            │
│                              └────────────────────┘            │
└─────────────────────────────────────────────────────────────────┘
```

## Legacy Files (Batak Script)
The original Batak script generator files are still present but unused:
- `src/components/TextInput.tsx` - Batak text input
- `src/utils/transliteration.ts` - Latin → Batak conversion
- `src/data/glyphs.ts` - Batak glyph data (~6800 lines)
- `src/utils/gcodeGenerator.ts` - Batak-specific G-code generator

These can be removed or kept for reference.
