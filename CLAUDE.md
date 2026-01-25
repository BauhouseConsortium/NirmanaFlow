# CLAUDE.md - Surat Batak (Batak Script G-Code Generator)

## Project Overview
**Surat Batak** is a modern React-based web application for generating single-stroke G-code to plot Batak script (Surat Batak Toba) on pen plotters and CNC machines. Users input Latin text, which is automatically transliterated to Batak Unicode, then assembled into optimized G-code for drawing.

## Architecture & Tech Stack
- **Frontend**: React 19 + TypeScript + Vite 7
- **Styling**: Tailwind CSS 4 (dark slate theme)
- **State Management**: React hooks (useState, useCallback, useEffect)
- **Package Manager**: pnpm
- **Node Version**: 24.x (managed via asdf)

## Project Structure

```
brush-react/
├── src/
│   ├── components/
│   │   ├── TextInput.tsx      # Latin/Batak text input with live preview
│   │   ├── SettingsPanel.tsx  # Collapsible settings (Layout, Machine, Ink, etc.)
│   │   ├── Preview.tsx        # Canvas preview with G-code simulation
│   │   ├── GCodeOutput.tsx    # G-code display with stats, copy/download
│   │   ├── Controls.tsx       # Generate/Upload/Run action buttons
│   │   └── Console.tsx        # Timestamped log output panel
│   ├── hooks/
│   │   ├── useSettings.ts     # Settings state management with defaults
│   │   └── useConsole.ts      # Console logging hook
│   ├── utils/
│   │   ├── transliteration.ts # Latin → Batak Unicode conversion
│   │   ├── pathOptimizer.ts   # Path merging & L-R optimization
│   │   ├── backlashFixer.ts   # Mechanical backlash compensation
│   │   ├── gcodeGenerator.ts  # Core G-code generation logic
│   │   └── hardware.ts        # FluidNC controller API (upload/run)
│   ├── data/
│   │   └── glyphs.ts          # Batak glyph path data (~6800 lines)
│   ├── types.ts               # TypeScript type definitions
│   ├── App.tsx                # Main application component
│   ├── main.tsx               # React entry point
│   └── index.css              # Tailwind CSS imports
├── vite.config.ts             # Vite + Tailwind configuration
├── tsconfig.json              # TypeScript configuration
├── package.json               # Dependencies and scripts
└── .tool-versions             # asdf Node.js version (24.2.0)
```

## Core Features

### 1. Text Input & Transliteration (`src/utils/transliteration.ts`)
- Converts Latin text to Batak Unicode characters
- Handles consonant-vowel combinations and inherent 'a'
- Special handling for `ng` → Amborolong (ᯱ)
- Pangolat (virama) for closed syllables
- Live preview shows Batak script as you type

### 2. G-Code Generation (`src/utils/gcodeGenerator.ts`)
- Retrieves glyph paths from `glyphs.ts` based on Unicode
- **Path Optimization**: Sorts strokes L→R, merges connected endpoints
- **Coordinate Mapping**: Normalized glyphs → physical mm with Y-flip
- **Backlash Compensation**: Injects corrective moves on direction changes
- **Ink Dipping**: Auto-inserts dip sequences at configurable intervals

### 3. Preview & Simulation (`src/components/Preview.tsx`)
- Real-time canvas visualization of G-code paths
- **G-code Based Simulation**: Executes G0/G1/G4 commands with proper timing
  - G0 (Rapid): 5000 mm/min
  - G1 (Feed): Uses actual feed rate from G-code
  - G4 (Dwell): Pauses for specified duration at ink well
- Smooth position interpolation with pen head indicator
- Shows travel moves (dashed), start/end markers, ink well location
- Speed control: 0.25x to 20x playback
- Current command display (e.g., "G1 FEED 1600mm/min → X45.2 Y70.1")

### 4. Hardware Control (`src/utils/hardware.ts`)
- Direct communication with FluidNC/Esp3D controllers
- **Upload**: POST G-code as FormData to `/upload`
- **Run**: GET `/command?cmd=$SD/Run=/filename.gcode`
- **Test**: Z-axis wiggle to verify connection
- CORS handling with `no-cors` fallback (blind mode)
- Default controller IP: `http://192.168.0.248`

## Settings (Configurable via UI)

| Category | Setting | Default | Description |
|----------|---------|---------|-------------|
| Layout | Target Width | 120mm | Horizontal scale of output |
| Layout | Offset X/Y | 10/70mm | Starting position |
| Layout | Kerning | 0.1 units | Inter-character spacing |
| Machine | Feed Rate | 1600 mm/min | Drawing speed (G1) |
| Machine | Safe Z | 5mm | Pen retract height |
| Machine | Backlash X/Y | 0mm | Mechanical compensation |
| Ink | Dip Interval | 50mm | Distance before re-dipping |
| Ink | Dip X/Y | 41/5mm | Ink well location |
| Ink | Continuous Plot | false | Disable dipping |
| Filter | Artefact Threshold | 0.05mm | Min path length |
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

## Guidelines for AI Contributors

### Do's
- Keep logic modular in `src/utils/` - each file has a single responsibility
- Use TypeScript types from `src/types.ts` for consistency
- Preserve Z-hop safety logic (pen must lift before travel moves)
- Test G-code output manually or via simulation before hardware changes
- Keep `glyphs.ts` separate - it's large data, rarely needs modification

### Don'ts
- Don't modify glyph path data unless specifically fixing font issues
- Don't remove backlash compensation logic - needed for physical machines
- Don't hardcode machine-specific values - use Settings
- Don't break the G-code simulation timing logic

### Key Files for Common Tasks
- **Add new setting**: `src/hooks/useSettings.ts` + `src/components/SettingsPanel.tsx`
- **Modify G-code output**: `src/utils/gcodeGenerator.ts`
- **Change transliteration rules**: `src/utils/transliteration.ts`
- **Update preview rendering**: `src/components/Preview.tsx`
- **Hardware communication**: `src/utils/hardware.ts`

## G-Code Output Format

```gcode
%
; Batak Script G-code
; Input: tuak batak
G21 G90 ; mm, absolute
G0 Z5   ; safe height
; Initial dip
G0 X41 Y5
G1 Z0 F500
G4 P0.5
G0 Z5
; Drawing
G0 X15.886 Y74.445
G1 Z0 F500 ; pen down
G1 X16.199 Y74.709 F1600
G1 X16.463 Y75.454 F1600
G0 Z5 ; pen up
; ... more paths ...
G0 X10 Y130 ; park
M30 ; end
%
```

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         App.tsx                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐ │
│  │  TextInput   │  │   Controls   │  │    SettingsPanel       │ │
│  │  (Latin/     │  │  (Generate,  │  │  (Layout, Machine,     │ │
│  │   Batak)     │  │   Upload,    │  │   Ink, Hardware)       │ │
│  │              │  │   Run)       │  │                        │ │
│  └──────────────┘  └──────────────┘  └────────────────────────┘ │
│                            │                                     │
│                            ▼                                     │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    generateGCode()                        │   │
│  │  transliteration.ts → pathOptimizer.ts → backlashFixer.ts│   │
│  │                            │                              │   │
│  │                     glyphs.ts (data)                      │   │
│  └──────────────────────────────────────────────────────────┘   │
│                            │                                     │
│              ┌─────────────┴─────────────┐                      │
│              ▼                           ▼                      │
│  ┌────────────────────┐      ┌────────────────────┐            │
│  │      Preview       │      │    GCodeOutput     │            │
│  │  (Canvas + Sim)    │      │  (Text + Stats)    │            │
│  └────────────────────┘      └────────────────────┘            │
│                                         │                       │
│                                         ▼                       │
│                              ┌────────────────────┐            │
│                              │    hardware.ts     │            │
│                              │  (Upload/Run to    │            │
│                              │   FluidNC)         │            │
│                              └────────────────────┘            │
└─────────────────────────────────────────────────────────────────┘
```

## Legacy Version
The original vanilla JS version is still available in the root directory (`index.html`, `script.js`, `glyphs.js`, `style.css`). Run with `make run` (Python SimpleHTTPServer on port 8000).
