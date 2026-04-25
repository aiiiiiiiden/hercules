/**
 * 배 시스템
 * - 라운드 시작 시 해안(모래 옆 물) 한 곳에 배 한 척 스폰
 * - 플레이어가 가까이 가서 E 키 → 타기
 * - 배 위에서는 잔디/나무 대신 물·모래만 통과 가능 (사실상 바다 자유 항해)
 * - 다시 E 키 → 인접한 모래/잔디로 내리기 (내릴 곳 없으면 안내)
 *
 * 배는 한 척만 존재. 플레이어가 내리면 그 자리에 머무름 → 다시 와서 재탑승 가능.
 */
const Boat = {
  x: 0, y: 0,
  active: false,    // true = 플레이어가 타고 있음 (위치는 Player 따라감)
  facing: 1,        // 1=오른쪽, -1=왼쪽 (수평 이동 시 반전)

  // 누적 탑승 시간 제한
  MAX_TIME: 30,     // 최대 누적 30초
  usedTime: 0,      // 현재까지 사용한 누적 시간 (초)

  reset() {
    this.x = 0; this.y = 0;
    this.active = false;
    this.facing = 1;
    this.usedTime = 0;
  },

  tickActive(dt) {
    this.usedTime += dt;
  },

  remainingTime() {
    return Math.max(0, this.MAX_TIME - this.usedTime);
  },

  isExpired() {
    return this.usedTime >= this.MAX_TIME;
  },

  init() {
    this.reset();

    // 가장 큰 연못(=바다) 식별 - 보트는 바다에서만 자유롭게 항해 가능
    let oceanId = -1;
    let oceanSize = 0;
    for (const p of World.ponds) {
      if (p.size > oceanSize) { oceanSize = p.size; oceanId = p.id; }
    }
    if (oceanId < 0) return;

    // 바다 안에서 모래에 접한 + 인접 물 타일도 충분한 (배가 갇히지 않게) 후보 찾기
    const candidates = [];
    for (let r = 1; r < World.rows - 1; r++) {
      for (let c = 1; c < World.cols - 1; c++) {
        if (World.map[r][c] !== TILE.WATER) continue;
        if (World.pondMap[r][c] !== oceanId) continue;

        // 물 주변 카운트 (배가 자유롭게 움직이려면 최소 2칸 이상 물 인접)
        let waterCount = 0;
        let touchesSand = false;
        for (const [dc, dr] of [[1,0],[-1,0],[0,1],[0,-1]]) {
          const nc = c + dc, nr = r + dr;
          if (!World.map[nr]) continue;
          const t = World.map[nr][nc];
          if (t === TILE.WATER) waterCount++;
          if (t === TILE.SAND) touchesSand = true;
        }
        if (touchesSand && waterCount >= 2) {
          candidates.push({ c, r });
        }
      }
    }
    if (candidates.length === 0) return;

    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    const ts = CONFIG.TILE_SIZE;
    this.x = pick.c * ts + ts / 2;
    this.y = pick.r * ts + ts / 2;
  },

  distTo(px, py) {
    return Math.hypot(px - this.x, py - this.y);
  },

  // ===== 렌더 =====
  render(ctx, camera) {
    if (this.active) return; // 플레이어가 타고 있을 때는 Player가 그림

    const sx = this.x - camera.x;
    const sy = this.y - camera.y;
    if (sx < -30 || sx > CONFIG.CANVAS_WIDTH + 30) return;
    if (sy < -30 || sy > CONFIG.CANVAS_HEIGHT + 30) return;

    this._drawBody(ctx, sx, sy, false);
  },

  _drawBody(ctx, sx, sy, inUse) {
    const bob = Math.sin(Date.now() / 400 + sx * 0.01) * 1.2;
    sy += bob;

    // 그림자
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(sx, sy + 14, 30, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // 보트 스프라이트 (80x32). 진행 방향에 따라 좌우 반전.
    const img = Assets.get('boat');
    const drawW = 80;
    const drawH = 32;
    if (img && img.complete) {
      ctx.save();
      ctx.translate(sx, sy + 4);
      ctx.scale(this.facing, 1);
      ctx.drawImage(img, 0, 0, 80, 32, -drawW / 2, -drawH / 2, drawW, drawH);
      ctx.restore();
    }

    if (!inUse) {
      // 빈 배 - 깜빡이는 [SPACE] 안내
      const t = (Math.sin(Date.now() / 300) + 1) / 2;
      ctx.fillStyle = `rgba(255, 240, 100, ${0.6 + t * 0.4})`;
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('[SPACE]', sx, sy - 22);
    }
  },

  // 플레이어가 보트 위에 있을 때 (배 + 사람 미니 스프라이트)
  drawWithPerson(ctx, sx, sy, dir) {
    this._drawBody(ctx, sx, sy, true);

    // 보트 위에 캐릭터 작게 표시 (16x16)
    const dirCol = { down: 0, up: 1, left: 2, right: 3 }[dir] ?? 0;
    const bob = Math.sin(Date.now() / 400 + sx * 0.01) * 1.2;
    Assets.drawCell(ctx, 'player_idle', dirCol, 0, 16, 16,
      sx - 12, sy - 22 + bob, 24, 24);
  },
};
