export class BacklashFixer {
  private bx: number;
  private by: number;
  private cx: number = 0;
  private cy: number = 0;
  private ox: number = 0;
  private oy: number = 0;
  private dx: number = 0; // 1 = positive, -1 = negative, 0 = neutral
  private dy: number = 0;

  constructor(bx: number, by: number) {
    this.bx = bx;
    this.by = by;
  }

  process(targetX: number, targetY: number, isG0: boolean, feed: number): string[] {
    const commands: string[] = [];

    if (this.bx === 0 && this.by === 0) {
      // No backlash compensation needed
      const cmd = isG0 ? 'G0' : 'G1';
      const feedStr = isG0 ? '' : ` F${feed}`;
      commands.push(`${cmd} X${targetX.toFixed(3)} Y${targetY.toFixed(3)}${feedStr}`);
      this.cx = targetX;
      this.cy = targetY;
      return commands;
    }

    // Calculate direction
    const newDx = targetX > this.cx ? 1 : targetX < this.cx ? -1 : this.dx;
    const newDy = targetY > this.cy ? 1 : targetY < this.cy ? -1 : this.dy;

    // Check for direction reversal on X
    if (this.dx !== 0 && newDx !== 0 && this.dx !== newDx) {
      this.ox = newDx * this.bx;
      // Insert compensation move
      commands.push(`G0 X${(this.cx + this.ox).toFixed(3)} Y${(this.cy + this.oy).toFixed(3)}`);
    }

    // Check for direction reversal on Y
    if (this.dy !== 0 && newDy !== 0 && this.dy !== newDy) {
      this.oy = newDy * this.by;
      // Insert compensation move
      commands.push(`G0 X${(this.cx + this.ox).toFixed(3)} Y${(this.cy + this.oy).toFixed(3)}`);
    }

    // Main move with offset
    const cmd = isG0 ? 'G0' : 'G1';
    const feedStr = isG0 ? '' : ` F${feed}`;
    commands.push(`${cmd} X${(targetX + this.ox).toFixed(3)} Y${(targetY + this.oy).toFixed(3)}${feedStr}`);

    this.cx = targetX;
    this.cy = targetY;
    this.dx = newDx;
    this.dy = newDy;

    return commands;
  }

  reset(): void {
    this.cx = 0;
    this.cy = 0;
    this.ox = 0;
    this.oy = 0;
    this.dx = 0;
    this.dy = 0;
  }
}
