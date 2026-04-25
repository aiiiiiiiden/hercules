/**
 * 클릭 피드백 마커
 *  - 'ok'   : 초록 O (이동 가능)
 *  - 'fail' : 빨강 X (이동 불가)
 *
 * Input.click 핸들러에서 show(c, r, type)를 호출하고,
 * Game.render 루프에서 render(ctx, camera)를 호출한다.
 * DURATION 동안 페이드아웃 후 자동 비활성화.
 */
const ClickMarker = {
  active: false,
  type: 'ok',           // 'ok' | 'fail'
  c: 0, r: 0,
  shownAt: 0,           // performance.now() ms
  DURATION: 600,        // ms

  show(c, r, type) {
    this.active = true;
    this.c = c;
    this.r = r;
    this.type = type;
    this.shownAt = performance.now();
  },

  clear() { this.active = false; },

  render(ctx, camera) {
    if (!this.active) return;
    const elapsed = performance.now() - this.shownAt;
    if (elapsed >= this.DURATION) { this.active = false; return; }

    const t = elapsed / this.DURATION;       // 0 → 1
    const alpha = 1 - t;
    const scale = 0.85 + 0.25 * t;            // 살짝 커지며 사라짐

    const ts = CONFIG.TILE_SIZE;
    const cx = this.c * ts + ts / 2 - camera.x;
    const cy = this.r * ts + ts / 2 - camera.y;
    const radius = (ts * 0.36) * scale;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';

    if (this.type === 'ok') {
      // 초록 O — 외곽 흰테로 가독성 보강
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.55)';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = '#34d399';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      // 빨강 X — 외곽 흰테
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.55)';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(cx - radius, cy - radius);
      ctx.lineTo(cx + radius, cy + radius);
      ctx.moveTo(cx + radius, cy - radius);
      ctx.lineTo(cx - radius, cy + radius);
      ctx.stroke();
      ctx.strokeStyle = '#f87171';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(cx - radius, cy - radius);
      ctx.lineTo(cx + radius, cy + radius);
      ctx.moveTo(cx + radius, cy - radius);
      ctx.lineTo(cx - radius, cy + radius);
      ctx.stroke();
    }
    ctx.restore();
  },
};
