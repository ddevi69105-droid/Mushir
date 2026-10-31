/**
 * Mushir 360° Spatial Radar & Heading HUD Renderer
 * Clean High-Contrast Monochrome Black & White Style.
 * Visualizes 70° forward camera cone vs unobserved 360° perimeter.
 */

export class RadarRenderer {
  constructor(canvasElement) {
    this.canvas = canvasElement;
    this.ctx = canvasElement ? canvasElement.getContext('2d') : null;
    this.sweepAngle = 0;
    this.animationId = null;
    this.latestDetections = [];
    this.currentHeading = 0;
    this.fovDegrees = 70;

    if (this.canvas) {
      this.startLoop();
    }
  }

  updateData(detections, orientationData) {
    this.latestDetections = detections || [];
    if (orientationData) {
      this.currentHeading = orientationData.heading || 0;
      this.fovDegrees = orientationData.fov || 70;
    }
  }

  startLoop() {
    const render = () => {
      this.draw();
      this.sweepAngle = (this.sweepAngle + 0.035) % (Math.PI * 2);
      this.animationId = requestAnimationFrame(render);
    };
    this.animationId = requestAnimationFrame(render);
  }

  stopLoop() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  draw() {
    if (!this.canvas || !this.ctx) return;

    const size = this.canvas.width = this.canvas.clientWidth || 320;
    this.canvas.height = size;
    const ctx = this.ctx;
    const cx = size / 2;
    const cy = size / 2;
    const maxRadius = size * 0.44;

    ctx.clearRect(0, 0, size, size);

    // 1. Radar Circular Background (Pure Black)
    ctx.beginPath();
    ctx.arc(cx, cy, maxRadius, 0, Math.PI * 2);
    ctx.fillStyle = '#050505';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();

    // 2. Concentric Distance Rings (1m, 2.5m, 5m)
    const rings = [
      { r: maxRadius * 0.35, label: '1m' },
      { r: maxRadius * 0.65, label: '2.5m' },
      { r: maxRadius, label: '5m' }
    ];

    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.font = '10px JetBrains Mono, monospace';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';

    rings.forEach(ring => {
      ctx.beginPath();
      ctx.arc(cx, cy, ring.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillText(ring.label, cx, cy - ring.r + 12);
    });
    ctx.setLineDash([]);

    // 3. Crosshairs
    ctx.beginPath();
    ctx.moveTo(cx - maxRadius, cy);
    ctx.lineTo(cx + maxRadius, cy);
    ctx.moveTo(cx, cy - maxRadius);
    ctx.lineTo(cx, cy + maxRadius);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.stroke();

    // 4. Highlight Camera Active FOV Cone (70° facing top)
    const halfFovRad = (this.fovDegrees * Math.PI) / 360;
    const startAngle = -Math.PI / 2 - halfFovRad;
    const endAngle = -Math.PI / 2 + halfFovRad;

    // Unobserved 360° zone (Behind & Periphery)
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, maxRadius, endAngle, startAngle);
    ctx.closePath();
    ctx.fillStyle = 'rgba(20, 20, 20, 0.85)';
    ctx.fill();

    // Text indicating unobserved area constraint
    ctx.font = '9px Outfit, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.textAlign = 'center';
    ctx.fillText('CAMERA BLIND SPOT', cx, cy + maxRadius * 0.55);
    ctx.fillText('(Single Lens Limitation)', cx, cy + maxRadius * 0.70);
    ctx.restore();

    // Active Camera FOV Cone (Crisp White Glow)
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, maxRadius, startAngle, endAngle);
    ctx.closePath();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();

    // 5. Rotating Radar Scanner Beam within FOV
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    const beamAngle = startAngle + ((Math.sin(this.sweepAngle) + 1) / 2) * (endAngle - startAngle);
    ctx.lineTo(cx + Math.cos(beamAngle) * maxRadius, cy + Math.sin(beamAngle) * maxRadius);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    // 6. Draw Detected Objects on Radar (Monochrome High Contrast)
    this.latestDetections.forEach(det => {
      const distFraction = Math.min(1.0, Math.max(0.2, det.distance / 5.0));
      const distR = distFraction * maxRadius;

      let relativeDeg = 0;
      if (det.zone === 'left') relativeDeg = -22;
      else if (det.zone === 'right') relativeDeg = 22;
      else if (det.zone === 'centre-right') relativeDeg = 10;
      else if (det.zone === 'centre-left') relativeDeg = -10;

      const angleRad = -Math.PI / 2 + (relativeDeg * Math.PI) / 180;
      const blipX = cx + Math.cos(angleRad) * distR;
      const blipY = cy + Math.sin(angleRad) * distR;

      ctx.save();
      // Outer ring
      ctx.beginPath();
      ctx.arc(blipX, blipY, 7, 0, Math.PI * 2);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Solid inner core
      ctx.beginPath();
      ctx.arc(blipX, blipY, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();

      // Label badge
      const labelText = `${det.label} ${det.distance}m`;
      ctx.font = 'bold 10px JetBrains Mono, monospace';
      ctx.textAlign = 'center';

      const tw = ctx.measureText(labelText).width;
      ctx.fillStyle = '#000000';
      ctx.fillRect(blipX - tw / 2 - 4, blipY - 20, tw + 8, 14);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.strokeRect(blipX - tw / 2 - 4, blipY - 20, tw + 8, 14);

      ctx.fillStyle = '#ffffff';
      ctx.fillText(labelText, blipX, blipY - 9);
      ctx.restore();
    });

    // 7. Center Camera Marker
    ctx.beginPath();
    ctx.arc(cx, cy, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#000000';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Heading Arrow pointing forward
    ctx.beginPath();
    ctx.moveTo(cx, cy - 8);
    ctx.lineTo(cx - 4, cy - 2);
    ctx.lineTo(cx + 4, cy - 2);
    ctx.closePath();
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  }
}
