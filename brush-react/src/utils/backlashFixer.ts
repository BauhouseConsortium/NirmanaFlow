export class BacklashFixer {
  private bx: number;
  private by: number;
  private cx: number = 0;
  private cy: number = 0;
  private ox: number = 0;
  private oy: number = 0;
  private dx: number = 1; // 1 = positive, -1 = negative (start positive like reference)
  private dy: number = 1;

  constructor(bx: number, by: number) {
    this.bx = bx;
    this.by = by;
  }

  process(targetX: number, targetY: number, isG0: boolean, feed: number): string[] {
    const commands: string[] = [];
    const dx = targetX - this.cx;
    const dy = targetY - this.cy;
    const thres = 0.05; // Tighter threshold (matching reference)

    let backlashTriggered = false;

    // X Axis
    if (Math.abs(dx) > thres) {
      const ndx = dx > 0 ? 1 : -1;
      if (this.dx !== 0 && ndx !== this.dx) {
        const shift = ndx === 1 ? this.bx : -this.bx;
        this.ox += shift; // Accumulate offset (matching reference)
        backlashTriggered = true;
      }
      this.dx = ndx;
    }

    // Y Axis
    if (Math.abs(dy) > thres) {
      const ndy = dy > 0 ? 1 : -1;
      if (this.dy !== 0 && ndy !== this.dy) {
        const shift = ndy === 1 ? this.by : -this.by;
        this.oy += shift; // Accumulate offset (matching reference)
        backlashTriggered = true;
      }
      this.dy = ndy;
    }

    // If backlash compensation occurred (offset changed), insert a rapid move
    // to the CURRENT position but with the NEW offset.
    // This "takes up the slack" before the actual move begins.
    if (backlashTriggered) {
      const preX = this.cx + this.ox;
      const preY = this.cy + this.oy;
      commands.push(`G0 X${preX.toFixed(3)} Y${preY.toFixed(3)} ; Backlash Fix`);
    }

    const fx = targetX + this.ox;
    const fy = targetY + this.oy;
    const cmd = isG0 ? 'G0' : 'G1';
    const feedStr = isG0 ? '' : ` F${feed}`;
    commands.push(`${cmd} X${fx.toFixed(3)} Y${fy.toFixed(3)}${feedStr}`);

    this.cx = targetX;
    this.cy = targetY;

    return commands;
  }

  reset(): void {
    this.cx = 0;
    this.cy = 0;
    this.ox = 0;
    this.oy = 0;
    this.dx = 1;
    this.dy = 1;
  }
}
