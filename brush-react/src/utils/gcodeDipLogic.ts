export const WIGGLE_DIP_SEQUENCE = `; Colour 1 pickup
G1 Z10 F1000;
G0 X41 Y5 F1600;
G1 Z0 F1000;
G1 X40.102 Y7.295 Z0 S800 F1200;
G1 X40.026 Y7.642 Z0 F1200;
G1 X40 Y8 Z0 F1200;
G1 X40.026 Y8.358 Z0 F1200;
G1 X40.102 Y8.705 Z0 F1200;
G1 X40.225 Y9.041 Z0 F1200;
G1 X40.393 Y9.362 Z0 F1200;
G1 X40.603 Y9.668 Z0 F1200;
G1 X40.854 Y9.957 Z0 F1200;
G1 X41.142 Y10.226 Z0 F1200;
G1 X41.464 Y10.475 Z0 F1200;
G1 X41.82 Y10.701 Z0 F1200;
G1 X42.204 Y10.902 Z0 F1200;
G1 X42.617 Y11.078 Z0 F1200;
G1 X43.054 Y11.225 Z0 F1200;
G1 X43.513 Y11.343 Z0 F1200;
G1 X43.992 Y11.429 Z0 F1200;
G1 X44.489 Y11.482 Z0 F1200;
G1 X45 Y11.5 Z0 F1200;
G1 X45.511 Y11.482 Z0 F1200;
G1 X46.008 Y11.429 Z0 F1200;
G1 X46.487 Y11.343 Z0 F1200;
G1 X46.946 Y11.225 Z0 F1200;
G1 X47.383 Y11.078 Z0 F1200;
G1 X47.796 Y10.902 Z0 F1200;
G1 X48.18 Y10.701 Z0 F1200;
G1 X48.536 Y10.475 Z0 F1200;
G1 X48.858 Y10.226 Z0 F1200;
G1 X49.146 Y9.957 Z0 F1200;
G1 X49.397 Y9.668 Z0 F1200;
G1 X49.607 Y9.362 Z0 F1200;
G1 X49.775 Y9.041 Z0 F1200;
G1 X49.898 Y8.705 Z0 F1200;
G1 X49.974 Y8.358 Z0 F1200;
G1 X50 Y8 Z0 F1200;
G1 X49.974 Y7.642 Z0 F1200;
G1 X49.898 Y7.295 Z0 F1200;
G1 X49.775 Y6.959 Z0 F1200;
G1 X49.607 Y6.638 Z0 F1200;
G1 X49.397 Y6.332 Z0 F1200;
G1 X49.146 Y6.043 Z0 F1200;
G1 X48.858 Y5.774 Z0 F1200;
G1 X48.536 Y5.525 Z0 F1200;
G1 X48.18 Y5.299 Z0 F1200;
G1 X47.796 Y5.098 Z0 F1200;
G1 X47.383 Y4.922 Z0 F1200;
G1 X46.946 Y4.775 Z0 F1200;
G1 X46.487 Y4.657 Z0 F1200;
G1 X46.008 Y4.571 Z0 F1200;
G1 X45.511 Y4.518 Z0 F1200;
G1 X45 Y4.5 Z0 F1200;
G1 X44.489 Y4.518 Z0 F1200;
G1 X43.992 Y4.571 Z0 F1200;
G1 X43.513 Y4.657 Z0 F1200;
G1 X43.054 Y4.775 Z0 F1200;
G1 X42.617 Y4.922 Z0 F1200;
G1 X42.204 Y5.098 Z0 F1200;
G1 X41.82 Y5.299 Z0 F1200;
G1 X41.464 Y5.525 Z0 F1200;
G1 X41.142 Y5.774 Z0 F1200;
G1 X40.854 Y6.043 Z0 F1200;
G1 X40.603 Y6.332 Z0 F1200;
G1 X40.393 Y6.638 Z0 F1200;
G1 X40.225 Y6.959 Z0 F1200;
G1 Z7 F800;
G1 X34 Y8 Z1 F1200;
G1 X24 Y18 Z8 F500;
G1 F1200;`;

/**
 * Processes a raw G-code sequence string, shifting its X/Y coordinates
 * so that the first found X and Y in the sequence align with the target dipX/dipY.
 */
export function processDipSequence(
    sequence: string,
    targetDipX: number,
    targetDipY: number
): string[] {
    const lines = sequence.split('\n');
    const resultLines: string[] = [];

    // 1. Find the reference X and Y (the "anchor" points) from the sequence
    let refX: number | null = null;
    let refY: number | null = null;

    for (const line of lines) {
        // Regex looking for X<number> and Y<number>
        const mx = /X([0-9.\-]+)/i.exec(line);
        const my = /Y([0-9.\-]+)/i.exec(line);

        if (mx && my) {
            refX = parseFloat(mx[1]);
            refY = parseFloat(my[1]);
            break; // Found our anchor
        }
    }

    // 2. If we have a valid anchor, calculate shifts and apply
    if (refX !== null && refY !== null) {
        const shiftX = targetDipX - refX;
        const shiftY = targetDipY - refY;

        for (const line of lines) {
            const clean = line.split(';')[0].trim();
            if (!clean) continue;

            // Replace all X.. and Y.. values with shifted versions
            const newLine = clean.replace(/([XY])([0-9.\-]+)/gi, (_match, axis, val) => {
                const v = parseFloat(val);
                if (axis.toUpperCase() === 'X') return `X${(v + shiftX).toFixed(3)}`;
                if (axis.toUpperCase() === 'Y') return `Y${(v + shiftY).toFixed(3)}`;
                return _match; // Should not happen based on regex
            });

            resultLines.push(newLine);
        }
    } else {
        // No anchor found (e.g. sequence has no X/Y moves), return as cleanly split lines
        for (const line of lines) {
            const clean = line.split(';')[0].trim();
            if (clean) {
                resultLines.push(clean);
            }
        }
    }

    return resultLines;
}
