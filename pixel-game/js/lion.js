/**
 * 사자(추격자)
 * - 라운드 시작 시 플레이어와 가장 먼 잔디 타일에 스폰
 * - 시간이 흐를수록 속도가 선형 증가 (MIN_SPEED → MAX_SPEED)
 * - 물 / 나무 못 통과 (World.isBlocked)
 * - 일정 거리 안으로 들어오면 게임오버 트리거
 */
const Lion = {
  x: 0, y: 0,
  size: 36,
  facing: 1,            // 수평 이동: 1=오른쪽, -1=왼쪽 (사이드 시트 좌우반전)
  vFacing: 'down',      // 수직 이동: 'down' | 'up' (위로 갈 땐 정면 시트 상하 반전)
  moveAxis: 'horizontal', // 'horizontal' | 'vertical'
  walkFrame: 0,
  active: false,

  // 튜닝
  SPEED: 0.6,             // 사자 이동 속도 (0.75 → 0.6 = 기존의 80%. 플레이어 = 3.0)
  CATCH_DIST: 22,         // 이 거리 안 = 게임오버
  WARN_DIST: 160,         // 이 거리 안 = 화면 빨간 비네트
  PATH_RECALC_MS: 350,    // 경로 재계산 주기
  WAYPOINT_REACH_DIST: 8, // 다음 경유점으로 넘어가는 거리

  // 길찾기
  path: null,
  lastPathTime: 0,

  reset() {
    this.active = false;
    this.x = 0; this.y = 0;
    this.facing = 1;
    this.walkFrame = 0;
    this.path = null;
    this.lastPathTime = 0;
  },

  init() {
    this.reset();
    // 플레이어와 가장 먼 통과 가능한 타일 찾기
    const ts = CONFIG.TILE_SIZE;
    let bestX = 0, bestY = 0, bestD = -1;
    for (let r = 0; r < World.rows; r++) {
      for (let c = 0; c < World.cols; c++) {
        const t = World.map[r][c];
        if (t !== TILE.GRASS && t !== TILE.PATH && t !== TILE.SAND) continue;
        const x = c * ts + ts / 2;
        const y = r * ts + ts / 2;
        const d = Math.hypot(x - Player.x, y - Player.y);
        if (d > bestD) { bestD = d; bestX = x; bestY = y; }
      }
    }
    this.x = bestX;
    this.y = bestY;
    this.active = true;
  },

  currentSpeed() {
    return this.SPEED;
  },

  distToPlayer() {
    return Math.hypot(this.x - Player.x, this.y - Player.y);
  },

  update() {
    if (!this.active) return;

    // 잡힘 판정 (직선거리)
    const dxp = Player.x - this.x;
    const dyp = Player.y - this.y;
    const dp = Math.hypot(dxp, dyp);
    if (dp < this.CATCH_DIST) {
      Game.endByLion();
      return;
    }

    // 주기적으로 A* 경로 재계산 (플레이어 위치 변경 반영)
    const now = Date.now();
    if (!this.path || now - this.lastPathTime > this.PATH_RECALC_MS) {
      this._recomputePath();
      this.lastPathTime = now;
    }

    const speed = this.currentSpeed();

    // 경로 따라가기
    if (this.path && this.path.length > 0) {
      // 다음 웨이포인트
      const wp = this.path[0];
      const ts = CONFIG.TILE_SIZE;
      const tx = wp.c * ts + ts / 2;
      const ty = wp.r * ts + ts / 2;

      const tdx = tx - this.x;
      const tdy = ty - this.y;
      const td = Math.hypot(tdx, tdy);

      if (td < this.WAYPOINT_REACH_DIST) {
        // 도착 → 다음 웨이포인트
        this.path.shift();
      } else {
        const ux = tdx / td;
        const uy = tdy / td;
        const nx = this.x + ux * speed;
        const ny = this.y + uy * speed;
        const r = this.size / 2 - 8;
        if (!this._collidesAt(nx, this.y, r)) this.x = nx;
        if (!this._collidesAt(this.x, ny, r)) this.y = ny;

        // 이동축 결정: 더 큰 성분이 수평/수직 결정
        this._updateAxis(tdx, tdy);
      }
    } else {
      // 경로 없음 → 직선 시도
      if (dp > 0.01) {
        const ux = dxp / dp;
        const uy = dyp / dp;
        const nx = this.x + ux * speed * 0.5;
        const ny = this.y + uy * speed * 0.5;
        const r = this.size / 2 - 8;
        if (!this._collidesAt(nx, this.y, r)) this.x = nx;
        if (!this._collidesAt(this.x, ny, r)) this.y = ny;
        this._updateAxis(dxp, dyp);
      }
    }

    this.walkFrame += 0.18;
  },

  // 이동 벡터 → 이동축(horizontal/vertical) + facing
  _updateAxis(dx, dy) {
    if (Math.abs(dx) >= Math.abs(dy)) {
      this.moveAxis = 'horizontal';
      if (Math.abs(dx) > 0.5) this.facing = dx >= 0 ? 1 : -1;
    } else {
      this.moveAxis = 'vertical';
      if (Math.abs(dy) > 0.5) this.vFacing = dy >= 0 ? 'down' : 'up';
    }
  },

  _recomputePath() {
    const ts = CONFIG.TILE_SIZE;
    const sc = Math.floor(this.x / ts);
    const sr = Math.floor(this.y / ts);
    const ec = Math.floor(Player.x / ts);
    const er = Math.floor(Player.y / ts);
    const path = Pathfinding.find(sc, sr, ec, er);
    if (path && path.length > 0) {
      // 첫 노드(현재 타일)는 제거 - 다음 칸부터 진행
      path.shift();
      this.path = path;
    } else {
      this.path = null;
    }
  },

  _collidesAt(x, y, r) {
    return World.isBlocked(x - r, y - r) ||
           World.isBlocked(x + r, y - r) ||
           World.isBlocked(x - r, y + r) ||
           World.isBlocked(x + r, y + r);
  },

  // ===== 렌더 =====
  render(ctx, camera) {
    if (!this.active) return;

    // 디버그: 경로 시각화
    if (CONFIG.DEBUG && this.path && this.path.length > 0) {
      const ts = CONFIG.TILE_SIZE;
      ctx.fillStyle = 'rgba(255, 0, 0, 0.45)';
      for (const wp of this.path) {
        const wx = wp.c * ts + ts/2 - camera.x;
        const wy = wp.r * ts + ts/2 - camera.y;
        ctx.fillRect(wx - 3, wy - 3, 6, 6);
      }
      // 라인
      ctx.strokeStyle = 'rgba(255, 0, 0, 0.6)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(this.x - camera.x, this.y - camera.y);
      for (const wp of this.path) {
        ctx.lineTo(wp.c * ts + ts/2 - camera.x, wp.r * ts + ts/2 - camera.y);
      }
      ctx.stroke();
      ctx.lineWidth = 1;
    }

    const sx = this.x - camera.x;
    const sy = this.y - camera.y;

    // 화면 밖이면 가장자리 화살표만
    if (sx < -30 || sx > CONFIG.CANVAS_WIDTH + 30 ||
        sy < -30 || sy > CONFIG.CANVAS_HEIGHT + 30) {
      this._renderEdgeIndicator(ctx);
      return;
    }

    // 그림자
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.ellipse(sx, sy + 14, 18, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // 이동축에 따라 시트 선택:
    //  - 수평 이동: 사이드 시트 (60x16, 2프레임 30x16, 좌우 반전 적용)
    //  - 수직 이동: 정면 시트 (32x23, 2프레임 16x23, 반전 X)
    const useSide = (this.moveAxis === 'horizontal')
      && Assets.get('lion_side') && Assets.get('lion_side').complete;
    const sheetKey = useSide ? 'lion_side' : 'lion';
    const cellW = useSide ? 30 : 16;
    const cellH = useSide ? 16 : 23;
    const SCALE = 2;
    const dispW = cellW * SCALE;
    const dispH = cellH * SCALE;

    // 시간 기반 2프레임 토글 (≈4Hz, 프레임레이트 독립)
    const FRAME_MS = 220;
    const frame = Math.floor(Date.now() / FRAME_MS) % 2;
    // 발맞춤 상하 흔들림
    const bob = frame === 1 ? -1.5 : 1.5;

    ctx.save();
    // 사자의 시각적 중심으로 원점 이동 후 반전 → 위치 변하지 않고 제자리 반전
    ctx.translate(sx, sy + bob + 6);
    if (useSide) {
      ctx.scale(this.facing, 1);                                  // 좌우 반전
    } else if (this.moveAxis === 'vertical' && this.vFacing === 'up') {
      ctx.scale(1, -1);                                           // 위로 이동 시 상하 반전 (뒷모습)
    }
    Assets.drawCell(
      ctx, sheetKey,
      frame, 0, cellW, cellH,
      -dispW / 2, -dispH / 2, dispW, dispH
    );
    ctx.restore();
  },

  _renderEdgeIndicator(ctx) {
    // 화면 밖 사자 방향 가장자리에 🦁 아이콘
    const cx = CONFIG.CANVAS_WIDTH / 2;
    const cy = CONFIG.CANVAS_HEIGHT / 2;
    const dx = (this.x - Camera.x) - cx;
    const dy = (this.y - Camera.y) - cy;
    const len = Math.hypot(dx, dy);
    if (len < 1) return;
    const ux = dx / len, uy = dy / len;

    const margin = 36;
    // 가장자리 박스에 닿게 클램프
    const tx = Math.max(-cx + margin, Math.min(cx - margin, ux * 9999));
    const ty = Math.max(-cy + margin, Math.min(cy - margin, uy * 9999));
    const limit = Math.min(
      Math.abs((cx - margin) / (ux || 0.001)),
      Math.abs((cy - margin) / (uy || 0.001))
    );
    const ix = cx + ux * limit;
    const iy = cy + uy * limit;

    // 펄스 빨간 동그라미
    const pulse = (Math.sin(Date.now() / 200) + 1) / 2;
    ctx.fillStyle = `rgba(239, 68, 68, ${0.5 + pulse * 0.4})`;
    ctx.beginPath();
    ctx.arc(ix, iy, 18, 0, Math.PI * 2);
    ctx.fill();

    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🦁', ix, iy);
    ctx.textBaseline = 'alphabetic';
  },

  // 위험 비네트 (플레이어와 가까울 때 화면 가장자리 빨갛게)
  renderVignette(ctx) {
    if (!this.active) return;
    const d = this.distToPlayer();
    if (d > this.WARN_DIST) return;
    const intensity = 1 - d / this.WARN_DIST;
    const pulse = (Math.sin(Date.now() / 150) + 1) / 2;
    const alpha = intensity * (0.4 + pulse * 0.3);

    const w = CONFIG.CANVAS_WIDTH;
    const h = CONFIG.CANVAS_HEIGHT;
    const grad = ctx.createRadialGradient(w/2, h/2, Math.min(w,h)/3, w/2, h/2, Math.max(w,h)/1.2);
    grad.addColorStop(0, 'rgba(239, 68, 68, 0)');
    grad.addColorStop(1, `rgba(239, 68, 68, ${alpha})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // 위험 텍스트
    if (d < this.WARN_DIST * 0.6) {
      ctx.fillStyle = `rgba(255,255,255,${0.7 + pulse * 0.3})`;
      ctx.font = 'bold 18px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('🦁 사자가 가까워졌다!', w/2, 60);
    }
  },
};
