# CLAUDE.md - Batak Skeleton Assembler

## Project Overview
**Batak Skeleton Assembler** is a web-based tool designed to generate single-stroke G-code for plotting Batak script (Surat Batak Toba). It allows users to input Latin text, automatically transliterates it to Batak, and assembles pre-defined skeleton glyphs into a G-code file suitable for pen plotters/drawing machines.

## Architecture & Tech Stack
- **Frontend**: Vanilla HTML5, CSS3, JavaScript (ES6+). No build step required (just restart the server).
- **Backend/Run**: Python SimpleHTTPServer (Dev), generic web server (Prod), or hosted directly on a CNC controller (FluidNC).
- **Data**: Glyph paths are stored in `glyphs.js` as normalized coordinate arrays.
- **Communication**: Interacts with CNC controllers via HTTP (upload/run G-code).

### File Structure
- `index.html`: Main UI and layout. Links everything together.
- `script.js`: Core application logic (Transliteration, G-code generation, UI handlers).
- `glyphs.js`: Large data file containing the vector paths for Batak characters.
- `style.css`: Visual styling (Gorga/Ulos themes).
- `Makefile`: Helper to run the local dev server (`make run`).

## Core Features & Logic Flow
1.  **Transliteration** (`transliterateToba` in `script.js`):
    -   Converts Latin text input into Batak Unicode characters.
    -   Handles logic for inherent vowels, "pangolat" (virama), and "ng" digraphs.
2.  **Glyph Assembly** (`generate` in `script.js`):
    -   Retrieves paths from `glyphs.js` based on Unicode.
    -   **Optimization**: Sorts paths Left-to-Right and merges connected segments to minimize pen-up moves.
    -   **Scaling**: Maps normalized glyph coordinates to the target physical width (mm).
3.  **G-Code Generation**:
    -   **Backlash Compensation** (`BacklashFixer` class): Corrects for physical machine slack/play by overshooting/re-adjusting moves.
    -   **Ink Dipping**: Automatically inserts "dip" sequences (move to ink well) after a certain travel distance to refill the pen. Supports custom G-code sequences for specific machine setups.
4.  **Hardware Control**:
    -   Supports direct upload and execution of G-code to FluidNC-based controllers via `fetch`.

## Guidelines for AI Contributors
-   **Refactoring**: logic is currently split between `script.js` (app) and `glyphs.js` (data). Keep this separation. `glyphs.js` is large; avoid reading/editing it unless modifying the font data itself.
-   **UI Design**: The app uses a specific "Gorga" aesthetic (red/black/gold). Maintain this design language. Do not use generic CSS frameworks (Bootstrap/Tailwind) unless rewritten to match the theme.
-   **No Build Tools**: Keep the project simple. Do not introduce Webpack/Vite/React unless explicitly requested for a major rewrite. The goal is to be runnable from a simple file server or SD card.
-   **Safety**: When touching G-code generation logic, ensure Z-hop (safe Z) logic is preserved to prevent the machine from dragging the pen across the paper.

## Plot Generation Logic (Deep Dive)
The core generation runs in the `generate()` function in `script.js`.

1.  **Text Analysis**:
    -   Input is effectively a list of Batak characters.
    -   Space characters advance the `cursorX` by a set amount (0.5 units).
    -   **Digraphs & Special Chars**: `ng` becomes `\u1BF0` (Amborolong). `transliterateToba` handles this mapping.

2.  **Path Retrieval & Scaling**:
    -   For each character, the tool looks up `glyphs[char].paths`.
    -   These paths are "normalized" (approx height 0 to -0.7).
    -   They are placed at the current `cursorX`.
    -   **Artefact Filtering**: Paths with length < `artefactThr` are discarded (removes scanning noise).

3.  **Optimization (Traveling Salesman-ish)**:
    -   `optimizePaths(paths)` reorders the strokes of a *single glyph* to write left-to-right.
    -   It merges end-points of strokes if they are very close (`mergeThreshold`), turning multiple lines into a continuous polyline.
    -   **Goal**: Reduce "pen up" (G0) moves to speed up plotting and reduce machine wear.

4.  **Coordinate Mapping**:
    -   The internal coordinate system is converted to physical millimeters.
    -   `scale = targetW_mm / total_internal_width`
    -   Formula: `PhysicalX = (InternalX - minX) * scale + OffsetX`
    -   Y-axis is flipped (Canvas/SVG is Y-down, G-code is Y-up).

5.  **G-Code Construction**:
    -   Iterates through the optimized 2D points.
    -   **Backlash Compensation**: If `bx` or `by` > 0, the `BacklashFixer` injects small moves to take up mechanical slack before changing direction.
    -   **Ink Dipping**:
        -   Tracks `distAcc` (distance traveled since last dip).
        -   If `distAcc > dipDist`, it pauses the plot.
        -   Inserts a "Dip Sequence": `G0` to the dip location (`dipX`, `dipY`), lowers pen, waits, raises pen.
        -   Resumes plotting.

## Machine Interaction (FluidNC)
The tool is designed to talk directly to CNC controllers running [FluidNC](http://wiki.fluidnc.com/) or Esp3D.

-   **Connectivity**: 
    -   **Local Mode**: Browser file page -> Controller IP (CORS issues may apply, hence `no-cors` mode).
    -   **Hosted Mode**: If `index.html` is served *by* the controller, it uses relative paths.

-   **Upload Protocol (`uploadOnly`)**:
    -   Constructs a `FormData` object with the G-code text as a blob.
    -   POSTs to `/upload`.
    -   Filename is sanitized from the input text (max 20 chars usually).

-   **Run Protocol (`runGcodeOnly`)**:
    -   Sends a GET request to `/command`.
    -   Command: `$SD/Run=/filename.gcode`.
    -   This tells the controller to start interpreting the file from the SD card immediately.

-   **Blind Mode (CORS)**:
    -   When running locally (file://), browsers block the response from the controller IP due to CORS security.
    -   The request *reaches* the controller and executes, but the JS cannot read the "Success" message.
    -   The UI assumes success and logs "Blind mode" status.

## Commands
-   **Run Local Server**: `make run` (Starts Python server on port 8000)
-   **Clean**: `rm -f *.pyc`
