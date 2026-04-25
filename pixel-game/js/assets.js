/**
 * 자산 로더
 *  - 모든 이미지를 비동기 로드
 *  - 로드 완료 후 콜백 (게임 시작)
 *
 * 사용:
 *   Assets.load(() => Game.start());
 *   const img = Assets.get('player');
 */
const Assets = {
  images: {},
  ready: false,

  // 로드할 이미지 목록 (key → src)
  manifest: {
    player_walk: 'assets/player_walk.png',  // 64x64, col=direction(down/up/left/right), row=frame(0~3)
    player_idle: 'assets/player_idle.png',  // 64x16, 1 row × 4 directions
    lion:        'assets/lion.png',         // 32x23 (front view, 2 frames of 16x23)
    lion_side:   'assets/lion_side.png',    // 60x16 (side view, 2 frames of 30x16) - 걷기 애니용
    boat:        'assets/boat.png',         // 80x32 side-view boat
    fish_green:  'assets/fish_green.png',   // 64x64 grid
    fish_red:    'assets/fish_red.png',     // 64x64 grid
    ripple:      'assets/ripple.png',       // 64x16, 4 frames of 16x16
    rod:         'assets/rod.png',          // 10x14 small icon

    // 지형 타일셋 (16x16 cell, 일부만 사용)
    tiles_field:  'assets/tileset_field.png',  // 80x240, 5×15 cells
    tiles_water:  'assets/tileset_water.png',  // 448x272, 28×17 cells
    tiles_nature: 'assets/tileset_nature.png', // 384x336, 24×21 cells
  },

  load(onReady) {
    const entries = Object.entries(this.manifest);
    let loaded = 0;
    const total = entries.length;
    if (total === 0) { this.ready = true; onReady(); return; }

    const tick = () => {
      loaded++;
      if (loaded >= total) { this.ready = true; onReady(); }
    };
    for (const [key, src] of entries) {
      const img = new Image();
      img.onload = tick;
      img.onerror = () => {
        console.error('자산 로드 실패:', src);
        tick();  // 실패해도 진행
      };
      img.src = src;
      this.images[key] = img;
    }
  },

  get(key) { return this.images[key]; },

  // 스프라이트시트의 한 셀을 그리기
  drawCell(ctx, key, col, row, cellW, cellH, dx, dy, dw, dh) {
    const img = this.images[key];
    if (!img || !img.complete) return;
    ctx.drawImage(img, col * cellW, row * cellH, cellW, cellH, dx, dy, dw, dh);
  },
};
