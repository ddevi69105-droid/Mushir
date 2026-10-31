/**
 * Mushir Dynamic Audio Wave Visualizer
 * Clean Black and White Monochrome Wave Renderer.
 */

export class VisualizerRenderer {
  constructor(canvasElement) {
    this.canvas = canvasElement;
    this.ctx = canvasElement ? canvasElement.getContext('2d') : null;
    this.phase = 0;
    this.isActive = false;
    this.mode = 'idle'; // 'idle', 'listening', 'speaking'
    this.animationId = null;

    if (this.canvas) {
      this.startLoop();
    }
  }

  setMode(mode) {
    this.mode = mode;
  }

  startLoop() {
    const render = () => {
      this.draw();
      this.phase += (this.mode === 'speaking' ? 0.08 : (this.mode === 'listening' ? 0.05 : 0.015));
      this.animationId = requestAnimationFrame(render);
    };
    this.animationId = requestAnimationFrame(render);
  }

  draw() {
    if (!this.canvas || !this.ctx) return;

    const width = this.canvas.width = this.canvas.clientWidth || 140;
    const height = this.canvas.height = this.canvas.clientHeight || 45;
    const ctx = this.ctx;

    ctx.clearRect(0, 0, width, height);

    const centerY = height / 2;
    let amplitude = 3;

    if (this.mode === 'speaking') {
      amplitude = 12;
    } else if (this.mode === 'listening') {
      amplitude = 15;
    }

    // Clean white harmonic lines
    [
      { freq: 0.045, amp: amplitude, alpha: 0.95, offset: 0 },
      { freq: 0.065, amp: amplitude * 0.7, alpha: 0.5, offset: Math.PI / 3 }
    ].forEach(wave => {
      ctx.beginPath();
      ctx.strokeStyle = '#ffffff';
      ctx.globalAlpha = wave.alpha;
      ctx.lineWidth = 1.8;

      for (let x = 0; x <= width; x += 3) {
        const windowMultiplier = Math.sin((x / width) * Math.PI);
        const y = centerY + Math.sin(x * wave.freq + this.phase + wave.offset) * wave.amp * windowMultiplier;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    });

    ctx.globalAlpha = 1.0;
  }
}
