function setTheme(theme) {
  if (theme === 'ulos') {
    document.body.classList.add('theme-ulos');
    document.querySelector('h2').innerText = "ULOS BATAK ASSEMBLER";
  } else {
    document.body.classList.remove('theme-ulos');
    document.querySelector('h2').innerText = "GORGA BATAK ASSEMBLER";
  }
}

// Custom Tooltip Logic
document.addEventListener('DOMContentLoaded', () => {
  if (typeof setDipColor === "function") setDipColor(1);

  const tooltip = document.createElement('div');
  tooltip.id = 'custom-tooltip';
  document.body.appendChild(tooltip);

  const elementsWithTitle = document.querySelectorAll('[title]');
  elementsWithTitle.forEach(el => {
    el.setAttribute('data-title', el.getAttribute('title'));
    el.removeAttribute('title'); // Disable native tooltip

    el.addEventListener('mouseenter', (e) => {
      tooltip.innerText = el.getAttribute('data-title');
      tooltip.style.display = 'block';
      tooltip.style.left = e.pageX + 15 + 'px';
      tooltip.style.top = e.pageY + 15 + 'px';
    });

    el.addEventListener('mousemove', (e) => {
      tooltip.style.left = e.pageX + 15 + 'px';
      tooltip.style.top = e.pageY + 15 + 'px';
    });

    el.addEventListener('mouseleave', () => {
      tooltip.style.display = 'none';
    });

    // Also show on focus for keyboard accessibility
    el.addEventListener('focus', () => {
      const rect = el.getBoundingClientRect();
      tooltip.innerText = el.getAttribute('data-title');
      tooltip.style.display = 'block';
      tooltip.style.left = (rect.right + window.scrollX + 5) + 'px';
      tooltip.style.top = (rect.top + window.scrollY) + 'px';
    });

    el.addEventListener('blur', () => {
      tooltip.style.display = 'none';
    });
  });
});

function transliterateToba(text) {
  const consonants = {
    'h': '\u1BC2', 'k': '\u1BC2',
    'g': '\u1BCE', 'n': '\u1BC9', 'm': '\u1BD4',
    'b': '\u1BC5', 't': '\u1BD6', 'd': '\u1BD1', 'p': '\u1BC7',
    'w': '\u1BCB', 's': '\u1BD8', 'y': '\u1BDB', 'l': '\u1BDE',
    'r': '\u1BD2', 'j': '\u1BD0', 'c': '\u1BD0',
    'f': '\u1BC7', 'v': '\u1BC5',
    'a': '\u1BC0', 'i': '\u1BE4', 'u': '\u1BE5'
  };
  const vowels = {
    'i': '\u1BEA', 'u': '\u1BEE', 'e': '\u1BE7', 'o': '\u1BEC'
  };
  const pangolat = '\u1BF2';
  const amborolong = '\u1BF0';
  let t = text.toLowerCase().trim().replace(/ng/g, 'ŋ');
  let res = "";
  let i = 0;
  while (i < t.length) {
    let char = t[i];
    if (char === 'ŋ') { res += amborolong; i++; continue; }
    if (consonants[char]) {
      res += consonants[char];
      if (i + 1 < t.length) {
        let next = t[i + 1];
        if (vowels[next]) {
          // Check closed syllable displacement: C1 + V + C2(closed) -> C1 + C2 + V + Pangolat
          let displaced = false;
          if (i + 2 < t.length) {
            let c2 = t[i + 2];
            // If C2 is a consonant and NOT a base vowel (a/i/u)
            if (consonants[c2] && !['a', 'i', 'u'].includes(c2)) {
              let isOpen = false;
              if (i + 3 < t.length) {
                let c3 = t[i + 3];
                if (vowels[c3] || c3 === 'a') isOpen = true;
              }
              if (!isOpen) {
                res += consonants[c2];
                res += vowels[next];
                res += pangolat;
                i += 3;
                displaced = true;
              }
            }
          }

          if (!displaced) {
            res += vowels[next]; i += 2;
          }
          continue;
        }
        else if (next === 'a') {
          i += 2; continue;
        }

        else {
          // Closed syllable checks
          if (!['a', 'i', 'u'].includes(char)) res += pangolat;
        }
      } else {
        // End of word
        if (!['a', 'i', 'u'].includes(char)) res += pangolat;
      }
    } else if (vowels[char]) {
      let base = char === 'i' ? '\u1BE4' : (char === 'u' ? '\u1BE5' : '\u1BC0');
      res += base;
      if (char === 'e' || char === 'o') res += vowels[char];
    } else {
      res += char;
    }
    i++;
  }
  return res;
}

class BacklashFixer {
  constructor(bx, by) {
    this.bx = bx; this.by = by;
    this.cx = 0; this.cy = 0;
    this.ox = 0; this.oy = 0;
    this.dx = 1; this.dy = 1;
  }
  process(targetX, targetY, isG0, feed) {
    let cmds = [];
    let dx = targetX - this.cx;
    let dy = targetY - this.cy;
    const thres = 0.05; // Tighter threshold

    let backlashTriggered = false;

    // X Axis
    if (Math.abs(dx) > thres) {
      let ndx = dx > 0 ? 1 : -1;
      if (this.dx !== 0 && ndx !== this.dx) {
        let shift = (ndx === 1 ? this.bx : -this.bx);
        this.ox += shift;
        backlashTriggered = true;
      }
      this.dx = ndx;
    }

    // Y Axis
    if (Math.abs(dy) > thres) {
      let ndy = dy > 0 ? 1 : -1;
      if (this.dy !== 0 && ndy !== this.dy) {
        let shift = (ndy === 1 ? this.by : -this.by);
        this.oy += shift;
        backlashTriggered = true;
      }
      this.dy = ndy;
    }

    // If backlash compensation occured (offset changed), insert a rapid move 
    // to the CURRENT position but with the NEW offset.
    // This "takes up the slack" before the actual move begins.
    if (backlashTriggered) {
      let preX = this.cx + this.ox;
      let preY = this.cy + this.oy;
      cmds.push(`G0 X${preX.toFixed(3)} Y${preY.toFixed(3)} ; Backlash Fix`);
    }

    let fx = targetX + this.ox;
    let fy = targetY + this.oy;
    let cmd = isG0 ? "G0" : "G1";
    let line = cmd + " X" + fx.toFixed(3) + " Y" + fy.toFixed(3); if (!isG0) line += " F" + feed;
    cmds.push(line);
    this.cx = targetX; this.cy = targetY;
    return cmds;
  }
}

function log(msg) {
  const c = document.getElementById('console');
  if (c) {
    c.innerText += msg + "\n";
    c.scrollTop = c.scrollHeight;
  }
}

function getPathLength(path) {
  let len = 0;
  for (let i = 1; i < path.length; i++) {
    let dx = path[i][0] - path[i - 1][0];
    let dy = path[i][1] - path[i - 1][1];
    len += Math.sqrt(dx * dx + dy * dy);
  }
  return len;
}

function optimizePaths(paths) {
  if (paths.length === 0) return [];

  // 1. Sort by X of start point for general Left-to-Right flow
  let pool = paths.slice().sort((a, b) => a[0][0] - b[0][0]);

  const mergeThreshold = 0.1; // Increased to 0.1 units
  let merged = true;

  // Iteratively merge until no more merges occur
  while (merged) {
    merged = false;
    let newPool = [];
    let current = pool[0];

    for (let i = 1; i < pool.length; i++) {
      let next = pool[i];
      let lastPt = current[current.length - 1];
      let firstPt = next[0];

      let dx = firstPt[0] - lastPt[0];
      let dy = firstPt[1] - lastPt[1];
      let dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < mergeThreshold) {
        // Merge!
        if (dist === 0) {
          current = current.concat(next.slice(1));
        } else {
          current = current.concat(next);
        }
        merged = true;
      } else {
        newPool.push(current);
        current = next;
      }
    }
    newPool.push(current);
    pool = newPool;
  }
  return pool;
}

function generate() {
  const consoleEl = document.getElementById('console');
  consoleEl.innerText = ""; // Clear console
  log("--- Starting Generation ---");

  if (Object.keys(glyphs).length === 0) { log("Error: No glyphs loaded!"); return; }
  const textStr = document.getElementById('inputText').value;
  const targetW_mm = parseFloat(document.getElementById('width').value);
  const isPlotter = document.getElementById('isPlotter').checked;

  log(`Mode: ${isPlotter ? 'CONTINUOUS PLOT (No Dipping)' : 'Standard (Ink Dipping)'}`);
  log(`Target Width: ${targetW_mm}mm`);
  const offX = parseFloat(document.getElementById('ox').value);
  const offY = parseFloat(document.getElementById('oy').value);
  const feed = parseInt(document.getElementById('feed').value);
  const safeZ = parseFloat(document.getElementById('safeZ').value) || 5;
  const bx = parseFloat(document.getElementById('bx').value);
  const by = parseFloat(document.getElementById('by').value);

  const kVal = parseFloat(document.getElementById('kerning').value);
  const artefactThr = parseFloat(document.getElementById('artefactThr').value) || 0;

  log(`Input Text: "${textStr}"`);
  let batakText = textStr;
  if (/^[a-zA-Z\s]+$/.test(textStr)) {
    batakText = transliterateToba(textStr);
    log(`Transliterated: "${batakText}"`);
  } else {
    log("Using raw input as Batak text.");
  }

  let totalPaths = [];
  let cursorX = 0;
  let lastBaseOriginX = 0;
  let lastBaseAdvance = 0;
  let skippedArtefacts = 0;
  let markShiftX = 0;

  for (let char of batakText) {
    if (char === ' ') {
      cursorX += 0.5;
      lastBaseOriginX = cursorX;
      lastBaseAdvance = 0.5;
      continue;
    }
    const g = glyphs[char];
    if (!g) { log(`Warning: Missing glyph for char code ${char.charCodeAt(0)}`); continue; }

    let drawX = cursorX;
    if (char === '\u1BF2') drawX -= 0.85;

    if (g.is_mark && char !== '\u1BF2') {
      let mode = g.anchor ? g.anchor.mode : 'center';
      let dx = g.anchor ? g.anchor.dx : 0;
      const REF_BASE_ADV = 478.2 / 600.0;

      if (mode === 'right') {
        let shift = lastBaseAdvance - REF_BASE_ADV;
        drawX = lastBaseOriginX + shift;
      } else {
        let shift = (lastBaseAdvance / 2) - (REF_BASE_ADV / 2);
        drawX = lastBaseOriginX + shift;
      }
    }

    // 1. Filter Artefacts
    let cleanPaths = [];
    for (let p of g.paths) {
      if (getPathLength(p) < artefactThr) {
        skippedArtefacts++;
        continue;
      }
      cleanPaths.push(p);
    }

    // 2. Optimize (Sort L->R & Merge)
    let optPaths = optimizePaths(cleanPaths);

    // 3. Add to Total
    for (let p of optPaths) {
      totalPaths.push(p.map(pt => [pt[0] + drawX, pt[1]]));
    }

    if (!g.is_mark || char === '\u1BF2') {
      markShiftX = 0;
      lastBaseOriginX = cursorX;
      lastBaseAdvance = g.advance;
      cursorX += g.advance + kVal;
    } else {
      // Stacking logic: apply current shift
      if (markShiftX > 0) {
        // If we have accumulation, we likely need to apply it
        // But first, let's see if this mark ALREADY has offset logic
        // Our code updated drawX based on anchor.
        // We add markShiftX to that.
        // BUT, we should only do this if this is the SECOND mark (markShiftX > 0).
        // However, markShiftX is 0 for first mark. Correct.
      }

      // Calculate this mark's width for NEXT mark
      let mMin = Infinity, mMax = -Infinity;
      for (let p of g.paths) {
        for (let pt of p) {
          mMin = Math.min(mMin, pt[0]);
          mMax = Math.max(mMax, pt[0]);
        }
      }
      let mWidth = (mMax > mMin) ? (mMax - mMin) : 0;

      // Apply the shift to the paths WE ARE ABOUT TO ADD
      // NOTE: We must update totalPaths loop below to use drawX + markShiftX if we want.
      // Actually, let's update drawX right here ??
      // totalPaths.push(p.map(pt => [pt[0] + drawX, pt[1]]));
      // So if we update drawX, it applies.

      drawX += markShiftX;

      // Increment for NEXT mark
      markShiftX += (mWidth > 0 ? mWidth : 0.4) + 0.5;

      // If mark has advance (spacing), add it!
      if (g.advance > 0) {
        cursorX += g.advance;
      }

      // AUTO-SPACING: If the mark we just drew extends BEYOND the current cursorX (end of base),
      // we must push cursorX to accommodate it.
      // This ensures that the NEXT base glyph (like Pangolat) starts *after* this mark.
      // mMax is relative to 0 (glyph origin).
      // drawX is absolute position of mark origin.
      // Visual Right Edge of Mark = drawX + mMax.
      let markRightEdge = drawX + mMax;
      if (markRightEdge > cursorX) {
        // Add a small buffer (tighten by allowing slight overlap -0.1)
        cursorX = markRightEdge - 0.1;
      }
    }
  }

  if (totalPaths.length === 0) { log("No paths generated."); return; }
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let path of totalPaths) {
    for (let pt of path) {
      minX = Math.min(minX, pt[0]); maxX = Math.max(maxX, pt[0]);
      minY = Math.min(minY, pt[1]); maxY = Math.max(maxY, pt[1]);
    }
  }
  const scale = targetW_mm / (maxX - minX);
  const contentH_mm = (maxY - minY) * scale;

  log(`Bounds: W=${(maxX - minX).toFixed(2)} units -> ${targetW_mm}mm, Scale=${scale.toFixed(3)}`);

  let gcode = ["%", "(Batak Skeleton Assembler Output)", "G21 G90", `G0 Z${safeZ}`];
  const dipLimit = parseFloat(document.getElementById('dipDist').value);
  const dipX = parseFloat(document.getElementById('dipX').value);
  const dipY = parseFloat(document.getElementById('dipY').value);
  // const dipZ = parseFloat(document.getElementById('dipZ').value); // Removed from UI
  let distAcc = 0;
  let lastX = 0, lastY = 0;
  let dipCount = 0;

  const fixer = new BacklashFixer(bx, by);


  // --- Perform Initial Dip (Only if NOT plotter mode) ---
  if (!isPlotter) {
    dipCount++;
    gcode.push(`(Initial Dip #${dipCount})`);
    const rawDip = document.getElementById('dipSeq').value;
    if (rawDip && rawDip.trim().length > 0) {
      // Custom Sequence Logic
      const lines = rawDip.split('\n');
      let refX = null, refY = null;
      for (let l of lines) {
        const mx = /X([0-9\.\-]+)/i.exec(l);
        const my = /Y([0-9\.\-]+)/i.exec(l);
        if (mx && my) { refX = parseFloat(mx[1]); refY = parseFloat(my[1]); break; }
      }
      if (refX !== null && refY !== null) {
        const shiftX = dipX - refX;
        const shiftY = dipY - refY;
        for (let l of lines) {
          let clean = l.split(';')[0].trim();
          if (!clean) continue;
          let newLine = clean.replace(/([XY])([0-9\.\-]+)/gi, (match, axis, val) => {
            let v = parseFloat(val);
            if (axis.toUpperCase() === 'X') return "X" + (v + shiftX).toFixed(3);
            if (axis.toUpperCase() === 'Y') return "Y" + (v + shiftY).toFixed(3);
            return match;
          });
          gcode.push(newLine);
        }
      } else {
        for (let l of lines) {
          let clean = l.split(';')[0].trim();
          if (clean) gcode.push(clean);
        }
      }
    } else {
      gcode.push(`G0 Z${safeZ}`);
      gcode.push(`G0 X${dipX} Y${dipY}`);
      gcode.push(`G1 Z-2 F500`);
      gcode.push("G4 P500");
      gcode.push(`G0 Z${safeZ}`);
    }
    // Return to Z5 safe height
    gcode.push(`G0 Z${safeZ}`);
  }



  for (let path of totalPaths) {
    let first = true;
    for (let pt of path) {
      let tx = (pt[0] - minX) * scale + offX;
      let ty = contentH_mm - (pt[1] - minY) * scale + offY;

      // Calc distance for dipping
      if (!first) {
        let d = Math.sqrt(Math.pow(tx - lastX, 2) + Math.pow(ty - lastY, 2));
        distAcc += d;
      }

      if (first) {
        fixer.process(tx, ty, true, feed).forEach(l => gcode.push(l));
        gcode.push("G1 Z0 F500");
        first = false;
      } else {
        fixer.process(tx, ty, false, feed).forEach(l => gcode.push(l));
      }

      lastX = tx;
      lastY = ty;
    }
    gcode.push(`G0 Z${safeZ}`);

    // Check dip AFTER stroke is complete
    if (!isPlotter && distAcc > dipLimit) {
      dipCount++;
      gcode.push(`(Dip #${dipCount} at dist ${distAcc.toFixed(1)} after stroke)`);
      const rawDip = document.getElementById('dipSeq').value;

      if (rawDip && rawDip.trim().length > 0) {
        // Custom Sequence Logic
        const lines = rawDip.split('\n');
        let refX = null, refY = null;
        // First pass: find first X/Y to use as reference anchor
        for (let l of lines) {
          const mx = /X([0-9\.\-]+)/i.exec(l);
          const my = /Y([0-9\.\-]+)/i.exec(l);
          if (mx && my) { refX = parseFloat(mx[1]); refY = parseFloat(my[1]); break; }
        }

        if (refX !== null && refY !== null) {
          const shiftX = dipX - refX;
          const shiftY = dipY - refY;
          for (let l of lines) {
            let clean = l.split(';')[0].trim();
            if (!clean) continue;
            // Shift coordinates - naive regex replace for X and Y values
            let newLine = clean.replace(/([XY])([0-9\.\-]+)/gi, (match, axis, val) => {
              let v = parseFloat(val);
              if (axis.toUpperCase() === 'X') return "X" + (v + shiftX).toFixed(3);
              if (axis.toUpperCase() === 'Y') return "Y" + (v + shiftY).toFixed(3);
              return match;
            });
            gcode.push(newLine);
          }
        } else {
          // No reference coords found, just append lines as-is
          for (let l of lines) {
            let clean = l.split(';')[0].trim();
            if (clean) gcode.push(clean);
          }
        }
      } else {
        // Default Sequence
        gcode.push(`G0 Z${safeZ}`);
        gcode.push(`G0 X${dipX} Y${dipY}`);
        gcode.push(`G1 Z-2 F500`);
        gcode.push("G4 P500");
        gcode.push(`G0 Z${safeZ}`);
      }

      // Move back to where the NEXT stroke will start? 
      // Actually we are at Z5 (safe).
      // We just need to ensure the next move is G0 to the start of the next stroke.
      // The next iteration of the loop handles the G0 to the start of the next path automatically.
      // But we do need to reset distAcc.
      distAcc = 0;
    }
  }
  gcode.push("G0 X10 Y130", "M30", "%");

  log(`Generation Complete.`);
  if (skippedArtefacts > 0) log(`Cleaned ${skippedArtefacts} small artefacts.`);
  log(`Total Paths: ${totalPaths.length}`);
  log(`Ink Dips Inserted: ${dipCount}`);
  log(`total G-Code Lines: ${gcode.length}`);

  const output = document.getElementById('gcodeOutput');
  if (output) output.value = gcode.join("\n");
  const downBtn = document.getElementById('downloadBtn');
  if (downBtn) downBtn.style.display = 'block';
  const copyBtn = document.getElementById('copyBtn');
  if (copyBtn) copyBtn.style.display = 'block';
  const upBtn = document.getElementById('uploadBtn');
  if (upBtn) upBtn.style.display = 'block';
  const runBtn = document.getElementById('runBtn');
  if (runBtn) runBtn.style.display = 'block';
  const upRunBtn = document.getElementById('upRunBtn');
  if (upRunBtn) upRunBtn.style.display = 'block';
  const testBtn = document.getElementById('testBtn');
  if (testBtn) testBtn.style.display = 'block';
  renderPreview(gcode);
}
function renderPreview(gcodeLines) {
  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');
  const W = 150; // Work area width mm
  const H = 140; // Work area height mm

  const PPU = 5;
  canvas.width = W * PPU;
  canvas.height = H * PPU;

  ctx.fillStyle = "white"; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "#eee"; ctx.lineWidth = 1; ctx.beginPath();
  for (let x = 0; x <= W; x += 10) { ctx.moveTo(x * PPU, 0); ctx.lineTo(x * PPU, H * PPU); }
  for (let y = 0; y <= H; y += 10) { ctx.moveTo(0, y * PPU); ctx.lineTo(W * PPU, y * PPU); }
  ctx.stroke();
  ctx.strokeStyle = "#ccc"; ctx.strokeRect(0, 0, W * PPU, H * PPU);

  let curX = 0, curY = 0, curZ = 5;
  const styleDraw = { color: "#ff0080", width: 4 };
  const styleTravel = { color: "#cccccc", width: 1 };

  ctx.lineCap = "round"; ctx.lineJoin = "round";

  for (let line of gcodeLines) {
    let cmd = line.split('(')[0].trim().toUpperCase();
    if (cmd.length === 0) continue;
    let isG0 = cmd.startsWith("G0");
    let isG1 = cmd.startsWith("G1");
    if (!isG0 && !isG1) continue;

    let nextX = curX, nextY = curY, nextZ = curZ;
    const matchX = /X([0-9\.\-]+)/.exec(cmd); if (matchX) nextX = parseFloat(matchX[1]);
    const matchY = /Y([0-9\.\-]+)/.exec(cmd); if (matchY) nextY = parseFloat(matchY[1]);
    const matchZ = /Z([0-9\.\-]+)/.exec(cmd); if (matchZ) nextZ = parseFloat(matchZ[1]);

    let isDrawing = (Math.abs(curZ) < 0.01 && Math.abs(nextZ) < 0.01) && (curX !== nextX || curY !== nextY);
    let x1 = curX * PPU;
    let y1 = (H - curY) * PPU;
    let x2 = nextX * PPU;
    let y2 = (H - nextY) * PPU;

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);

    if (isDrawing) {
      ctx.strokeStyle = styleDraw.color;
      ctx.lineWidth = styleDraw.width;
      ctx.stroke();
    } else if (x1 !== x2 || y1 !== y2) {
      ctx.strokeStyle = styleTravel.color;
      ctx.lineWidth = styleTravel.width;
      ctx.stroke();
    }
    curX = nextX; curY = nextY; curZ = nextZ;
  }
}

function setDipColor(n) {
  // Base is 41, spacing is 45mm
  const base = 41;
  const spacing = 45;
  const val = base + (n - 1) * spacing;
  const el = document.getElementById('dipX');
  if (el) el.value = val;

  // Visual feedback for round buttons
  const btns = document.querySelectorAll('button[onclick^="setDipColor"]');
  btns.forEach((b, i) => {
    // Selected: 4px border, Unselected: 2px border
    b.style.borderWidth = (i + 1 === n) ? "4px" : "2px";
    b.style.borderColor = (i + 1 === n) ? "var(--accent-gold)" : "#fff";
    b.style.transform = (i + 1 === n) ? "scale(1.1)" : "scale(1)";
  });
}

function downloadGcode() {
  const text = document.getElementById('gcodeOutput').value;
  const inputStr = document.getElementById('inputText').value.trim();
  // Sanitize filename
  const safeName = inputStr.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'output';

  const blob = new Blob([text], { type: 'text/plain' });
  const anchor = document.createElement('a');
  anchor.download = `${safeName}-batak.gcode`;
  anchor.href = window.URL.createObjectURL(blob);
  anchor.click();
}

function copyGcode() {
  const copyText = document.getElementById("gcodeOutput");
  copyText.select();
  document.execCommand("copy");
}

function getBaseUrl() {
  if (window.location.protocol === 'file:') {
    const host = document.getElementById('controllerHost').value.trim() || "brushographwhite.local";
    let url = host.startsWith("http") ? host : "http://" + host;
    log(`Local Mode. Targeting: ${url}`);
    return url;
  }
  // When running on the controller, use the current origin ensures absolute path
  return window.location.origin;
}

async function uploadOnly() {
  const text = document.getElementById('gcodeOutput').value;
  if (!text) { log("No G-code to upload!"); return; }

  const baseUrl = getBaseUrl();
  const inputStr = document.getElementById('inputText').value.trim();
  const safeName = (inputStr.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'output') + "-batak.gcode";

  const blob = new Blob([text], { type: 'text/plain' });
  const formData = new FormData();
  formData.append("path", "/");
  formData.append("myfile", blob, safeName);

  log(`Uploading ${safeName} to ${baseUrl}/upload ...`);

  try {
    const fetchOptions = { method: 'POST', body: formData };
    if (baseUrl) fetchOptions.mode = 'no-cors';

    const upRes = await fetch(`${baseUrl}/upload`, fetchOptions);
    if (!baseUrl && !upRes.ok) throw new Error(`Upload failed: ${upRes.statusText}`);

    log(`Upload initiated! (Response opaque in local mode)`);
  } catch (e) {
    handleError(e);
  }
}

async function uploadAndRun() {
  await uploadOnly();
  // Wait for sync (UI logs handled in uploadOnly)
  log("Waiting 2s for SD sync...");
  await new Promise(r => setTimeout(r, 2000));
  await runGcodeOnly();
}

async function runGcodeOnly() {
  const baseUrl = getBaseUrl();
  const inputStr = document.getElementById('inputText').value.trim();
  const safeName = (inputStr.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'output') + "-batak.gcode";

  const cmd = `$SD/Run=/${safeName}`;
  log(`Sending Run Command: ${cmd}`);

  await sendCommand(baseUrl, cmd);
}

async function testWiggle() {
  const baseUrl = getBaseUrl();
  log("Testing Connection (Wiggle Z)...");
  // G91 (Relative), Z3, Z-3, G90 (Absolute)
  // Send as single line with newlines if supported, or multiple calls?
  // FluidNC single line command parsing for multiple Gcodes is tricky via web API.
  // Let's try simple single G0 Z3 for now to test connection.
  // Better: G0 Z5 (Safe) -> G0 Z8 -> G0 Z5
  const cmd = "G91 G0 Z3 F500";
  await sendCommand(baseUrl, cmd);
  setTimeout(() => sendCommand(baseUrl, "G91 G0 Z-3"), 500);
  setTimeout(() => sendCommand(baseUrl, "G90"), 1000);
}

async function sendCommand(baseUrl, cmdStr) {
  const cmdUrl = `${baseUrl}/command?cmd=${encodeURIComponent(cmdStr)}`;
  const runOptions = { method: 'GET' };
  if (baseUrl) runOptions.mode = 'no-cors';

  try {
    const runRes = await fetch(cmdUrl, runOptions);
    if (!baseUrl && !runRes.ok) throw new Error(`Command failed: ${runRes.statusText}`);

    if (baseUrl) {
      const cleanCmd = cmdStr.length > 20 ? cmdStr.substring(0, 20) + "..." : cmdStr;
      log(`Cmd '${cleanCmd}' sent (Blind mode).`);
    } else {
      const runText = await runRes.text();
      log(`Response: ${runText}`);
    }
  } catch (e) {
    handleError(e);
  }
}

function handleError(e) {
  log(`Error: ${e.message}`);
  console.error(e);
  if (e.message.includes("Failed to fetch")) {
    alert(`Connection Error: "Failed to fetch".\nBrowser blocked response (CORS). Action likely succeeded.`);
  } else {
    alert(`Error: ${e.message}`);
  }
}

function showStatus(msg) { document.getElementById('status').innerText = msg; }

window.onload = () => { showStatus('Glyph library loaded.'); generate(); };
