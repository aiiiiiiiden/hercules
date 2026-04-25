/**
 * 낚시 시스템 (파워 캐스팅 + 거리별 등급)
 *
 * 상태머신:
 *   idle    → SPACE 누르면 aiming 진입 (파워 게이지 등장)
 *   aiming  → SPACE 다시 누르면 그 순간의 power(0~1)로 캐스팅 → waiting
 *   waiting → 1.0~3.5초 후 자동으로 biting 진입
 *   biting  → 1.1초 안에 SPACE → reeling (훅킹 성공)
 *   reeling → 물고기가 도망(거리 증가). SPACE 연타로 끌어오기.
 *             거리=0 → 잡힘! / 거리=1 → 도망감
 *   놓침/회수 → idle 복귀
 *
 * 거리 / 등급 매핑:
 *   power 0.00~0.30 → 1칸  : tier1 (잡어)
 *   power 0.30~0.60 → 2~3칸: tier1~2 (중급)
 *   power 0.60~0.85 → 4칸  : tier1~3 (대형 가능)
 *   power 0.85~1.00 → 5칸  : tier1~4 (전설 가능)
 */
const Fishing = {
  state: 'idle',
  bobber: null,        // {x, y}
  power: 0,            // 0..1
  castPower: 0,        // 던질 때 확정된 파워
  aimStartedAt: 0,
  nextBiteAt: 0,
  biteStartedAt: 0,

  // 튜닝값
  AIM_CYCLE_MS: 1000,        // 게이지가 0→1→0 도는 데 걸리는 시간
  MIN_WAIT_MS: 1000,
  MAX_WAIT_MS: 3500,
  BITE_WINDOW_MS: 1100,
  MAX_CAST_TILES: 5,

  // 릴링 (연타) 튜닝
  REEL_START: 0.45,           // 시작 거리 (0=잡힘, 1=도망)
  REEL_DRIFT_PER_SEC: 0.40,   // 가만히 있을 때 멀어지는 속도/초
  REEL_PULL_PER_TAP: 0.10,    // SPACE 한 번에 당겨오는 양
  REEL_TIER_PENALTY: 0.10,    // tier당 추가 도망속도 (큰 물고기 = 저항 큼)

  // 릴링 상태
  reelDist: 0,
  reelLastTime: 0,
  reelTaps: 0,
  reelTapPulse: 0,
  reelDriftRate: 0,

  reset() {
    this.bobber = null;
    this.state = 'idle';
    this.power = 0;
    this.castPower = 0;
    this.aimStartedAt = 0;
    this.nextBiteAt = 0;
    this.biteStartedAt = 0;
    this.reelDist = 0;
    this.reelLastTime = 0;
    this.reelTaps = 0;
    this.reelTapPulse = 0;
    this.reelDriftRate = 0;
  },

  _dirVec() {
    return ({
      up:    { x:  0, y: -1 },
      down:  { x:  0, y:  1 },
      left:  { x: -1, y:  0 },
      right: { x:  1, y:  0 },
    })[Player.dir] || { x: 0, y: 1 };
  },

  // 시야 내 어디든 물이 있어야 캐스팅 시작 가능
  _anyWaterInRange() {
    const v = this._dirVec();
    const ts = CONFIG.TILE_SIZE;
    for (let i = 1; i <= this.MAX_CAST_TILES; i++) {
      if (World.tileAt(Player.x + v.x * ts * i, Player.y + v.y * ts * i) === TILE.WATER) return true;
    }
    return false;
  },

  // player.update에서 idle일 때 SPACE 처리. 호환을 위해 이름 유지.
  findCastTarget() {
    return this._anyWaterInRange() ? true : null;
  },

  // 첫 SPACE: 파워 게이지 시작
  cast() {
    if (!this._anyWaterInRange()) {
      UI.showFloatingText('물이 안 보여요!', Player.x - Camera.x, Player.y - Camera.y - 30, '#fff');
      return false;
    }
    this.state = 'aiming';
    this.power = 0;
    this.aimStartedAt = Date.now();
    return true;
  },

  // 두 번째 SPACE (aiming) → 캐스트 확정
  _lockCast() {
    const v = this._dirVec();
    const ts = CONFIG.TILE_SIZE;
    const dist = this._powerToTiles(this.power);
    const tx = Player.x + v.x * ts * dist;
    const ty = Player.y + v.y * ts * dist;

    if (World.tileAt(tx, ty) !== TILE.WATER) {
      UI.showFloatingText('빗나갔다!', Player.x - Camera.x, Player.y - Camera.y - 30, '#ef4444');
      this.reset();
      return;
    }

    this.castPower = this.power;
    this.bobber = { x: tx, y: ty, dipPhase: 0 };
    this.state = 'waiting';
    this.nextBiteAt = Date.now() + this.MIN_WAIT_MS + Math.random() * (this.MAX_WAIT_MS - this.MIN_WAIT_MS);

    // 캐스팅 평가 메시지
    if (this.castPower >= 0.85) {
      UI.showFloatingText('완벽! 🎯 깊은 곳까지!', tx - Camera.x, ty - Camera.y - 30, '#ffd966');
    } else if (this.castPower >= 0.6) {
      UI.showFloatingText('멀리 던졌다!', tx - Camera.x, ty - Camera.y - 30, '#10b981');
    } else if (this.castPower < 0.2) {
      UI.showFloatingText('너무 가까워...', tx - Camera.x, ty - Camera.y - 30, '#ef4444');
    }
  },

  _powerToTiles(p) {
    if (p < 0.30) return 1;
    if (p < 0.60) return Math.random() < 0.5 ? 2 : 3;
    if (p < 0.85) return 4;
    return this.MAX_CAST_TILES;
  },

  _maxTierFromPower(p) {
    if (p < 0.30) return 1;
    if (p < 0.60) return 2;
    if (p < 0.85) return 3;
    return 4;
  },

  update() {
    if (this.state === 'idle') return;
    const now = Date.now();

    // 파워 게이지: 선형 0→1→0 왕복
    if (this.state === 'aiming') {
      const cycle = this.AIM_CYCLE_MS;
      const t = ((now - this.aimStartedAt) % cycle) / cycle; // 0..1
      this.power = t < 0.5 ? (t * 2) : (2 - t * 2);          // 0→1→0
      return;
    }

    // 찌 흔들림
    if (this.bobber) this.bobber.dipPhase += 0.06;

    if (this.state === 'waiting' && now >= this.nextBiteAt) {
      this.state = 'biting';
      this.biteStartedAt = now;
    }
    if (this.state === 'biting' && now - this.biteStartedAt > this.BITE_WINDOW_MS) {
      this.reset();
      UI.showMissResult('bite_timeout');
    }

    // 릴링: 매 프레임 거리가 늘어남(도망). SPACE 연타로 줄임.
    if (this.state === 'reeling') {
      const dt = (now - this.reelLastTime) / 1000;
      this.reelLastTime = now;
      this.reelDist += this.reelDriftRate * dt;
      this.reelTapPulse = Math.max(0, this.reelTapPulse - dt * 4);

      if (this.reelDist >= 1) {
        this.reset();
        UI.showMissResult('reel_escape');
      }
    }
  },

  trySpace() {
    if (this.state === 'idle') return false;
    if (this.state === 'aiming') {
      this._lockCast();
      return true;
    }
    if (this.state === 'biting') {
      this._startReeling();
      return true;
    }
    if (this.state === 'reeling') {
      this._pull();
      return true;
    }
    // waiting 중 SPACE → 회수
    this.reset();
    return true;
  },

  // 입질 → 훅킹 성공: 릴링 진입
  _startReeling() {
    this.state = 'reeling';
    this.reelDist = this.REEL_START;
    this.reelLastTime = Date.now();
    this.reelTaps = 0;
    this.reelTapPulse = 0;
    // 큰 물고기일수록 저항이 커서 빨리 도망 (캐스트 파워 기준)
    const tier = this._maxTierFromPower(this.castPower);
    this.reelDriftRate = this.REEL_DRIFT_PER_SEC + (tier - 1) * this.REEL_TIER_PENALTY;
  },

  // SPACE 연타: 한 번 당기기
  _pull() {
    this.reelDist = Math.max(0, this.reelDist - this.REEL_PULL_PER_TAP);
    this.reelTaps++;
    this.reelTapPulse = 1;
    if (this.reelDist <= 0) {
      this._catchSuccess();
    }
  },

  _catchSuccess() {
    const maxTier = this._maxTierFromPower(this.castPower);
    // 찌가 떨어진 연못의 종 풀(이미 habitat 필터 적용됨)에서만
    const pond = World.pondAt(this.bobber.x, this.bobber.y);
    let pool;
    if (pond && pond.speciesIds.length > 0) {
      pool = pond.speciesIds.map(id => SPECIES.fish.find(s => s.id === id)).filter(Boolean);
    } else {
      pool = [...SPECIES.fish];
    }

    let candidates = pool.filter(s => s.tier <= maxTier);
    // 약한 캐스팅이라 후보가 없으면 pool에서 가장 작은 tier로 (예: 약한 캐스팅 in 바다 → 가장 작은 바다 물고기)
    if (candidates.length === 0 && pool.length > 0) {
      const minTier = Math.min(...pool.map(s => s.tier));
      candidates = pool.filter(s => s.tier === minTier);
    }
    // 가중치: 가장 높은 tier일수록 살짝 더 잘 나오게
    const weights = candidates.map(s => {
      if (s.tier === maxTier) return s.tier === 4 ? 2 : 3;
      return 2;
    });
    const total = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    let pick = candidates[0];
    for (let i = 0; i < candidates.length; i++) {
      r -= weights[i];
      if (r <= 0) { pick = candidates[i]; break; }
    }

    Items.collected[pick.id] = (Items.collected[pick.id] || 0) + 1;
    UI.addScore(pick.score);
    UI.bumpInventory('fish');

    // 시각적 피드백: 근처 swimming 물고기 한 마리 제거
    let nearestVisual = null, nd = Infinity;
    for (const it of Items.list) {
      if (it.type !== 'fish') continue;
      const d = Math.hypot(it.x - this.bobber.x, it.y - this.bobber.y);
      if (d < nd) { nd = d; nearestVisual = it; }
    }
    if (nearestVisual && nd < 100) {
      const idx = Items.list.indexOf(nearestVisual);
      if (idx >= 0) Items.list.splice(idx, 1);
    }

    this.reset();

    // 잡기 결과 모달 → 확인 누를 때까지 게임 멈춤
    UI.showCatchResult(pick);
  },

  // ===== 렌더 =====
  render(ctx, camera) {
    if (this.state === 'aiming') {
      this._renderTrajectory(ctx, camera);
      this._renderPowerBar(ctx);
      this._renderEscapeHint(ctx);
      return;
    }
    if (!this.bobber) return;

    // 릴링 중에는 찌가 캐스트 방향으로 더 멀리 끌려나감.
    // 당기는 순간 펄스로 살짝 플레이어 쪽으로 튕김.
    const v = this._dirVec();
    let drift = 0;
    if (this.state === 'reeling') {
      // reelDist 0~1 → 추가 픽셀 0~80px 멀리
      drift = (this.reelDist - this.REEL_START) * 80 - this.reelTapPulse * 18;
    }
    const bx = this.bobber.x + v.x * drift;
    const by = this.bobber.y + v.y * drift;

    const sx = bx - camera.x;
    const sy = by - camera.y;
    const px = Player.x - camera.x;
    const py = Player.y - camera.y - 4;

    // 낚시줄 (릴링 시 빨강+팽팽함)
    ctx.strokeStyle = this.state === 'reeling' ? 'rgba(255,90,90,0.95)' : 'rgba(255,255,255,0.85)';
    ctx.lineWidth = this.state === 'reeling' ? 2 : 1;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(sx, sy);
    ctx.stroke();
    ctx.lineWidth = 1;

    // 찌 상하 흔들림
    let dipY;
    if (this.state === 'biting' || this.state === 'reeling') {
      dipY = Math.sin(Date.now() / 60) * (this.state === 'reeling' ? 5 : 4);
    } else {
      dipY = Math.sin(this.bobber.dipPhase) * 1.2;
    }
    // 좌우 흔들림 (릴링 시 격렬)
    let shakeX = 0;
    if (this.state === 'reeling') {
      shakeX = Math.sin(Date.now() / 40) * 2;
    }

    ctx.fillStyle = '#ef4444';
    ctx.fillRect(sx - 3 + shakeX, sy - 5 + dipY, 6, 4);
    ctx.fillStyle = '#fff';
    ctx.fillRect(sx - 3 + shakeX, sy - 1 + dipY, 6, 4);
    ctx.fillStyle = '#000';
    ctx.fillRect(sx - 1 + shakeX, sy - 1 + dipY, 2, 2);

    // 물결
    if (this.state === 'biting' || this.state === 'reeling') {
      const r = ((Date.now() / 100) % 12) + 4;
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(sx, sy + dipY + 3, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 모든 낚시 상태에서 공통: 방향키 도망 안내
    this._renderEscapeHint(ctx);

    // 상태별 오버레이
    if (this.state === 'biting') {
      // "!" 풍선
      const bob = Math.sin(Date.now() / 100) * 2;
      ctx.fillStyle = '#fff';
      ctx.fillRect(sx - 7, sy - 26 + bob, 14, 16);
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(sx - 8, sy - 25 + bob, 16, 14);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('!', sx, sy - 18 + bob);
      ctx.textBaseline = 'alphabetic';

      // 가운데 안내
      ctx.fillStyle = 'rgba(0,0,0,0.75)';
      ctx.fillRect(CONFIG.CANVAS_WIDTH/2 - 80, 110, 160, 30);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText('지금! [SPACE]', CONFIG.CANVAS_WIDTH/2, 130);
    } else if (this.state === 'waiting') {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(CONFIG.CANVAS_WIDTH/2 - 90, 110, 180, 28);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('🎣 입질을 기다리세요...', CONFIG.CANVAS_WIDTH/2, 129);
    } else if (this.state === 'reeling') {
      this._renderReelBar(ctx);
    }
  },

  // 방향키로 낚시 취소 가능 안내 (모든 낚시 상태)
  _renderEscapeHint(ctx) {
    const text = '↑↓←→ 방향키로 도망';
    const x = CONFIG.CANVAS_WIDTH - 12;
    const y = CONFIG.CANVAS_HEIGHT - 56;
    ctx.font = 'bold 11px sans-serif';
    const w = ctx.measureText(text).width + 14;
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(x - w, y - 14, w, 18);
    ctx.fillStyle = '#fbbf24';
    ctx.textAlign = 'right';
    ctx.fillText(text, x - 7, y - 1);
  },

  _renderReelBar(ctx) {
    const cx = CONFIG.CANVAS_WIDTH / 2;
    const cy = 165;
    const w = 360, h = 20;

    // 박스
    ctx.fillStyle = 'rgba(0,0,0,0.85)';
    ctx.fillRect(cx - w/2 - 14, cy - 30, w + 28, 92);

    // 헤더 (살짝 펄스)
    const pulse = Math.sin(Date.now() / 100) * 0.5 + 0.5;
    ctx.fillStyle = `rgb(255, ${Math.floor(120 + pulse * 80)}, ${Math.floor(40 + pulse * 50)})`;
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🔥 SPACE 연타로 끌어와! 🔥', cx, cy - 12);

    // 트랙
    const trackX = cx - w/2 + 36;
    const trackY = cy + 4;
    const trackW = w - 72;

    ctx.fillStyle = '#3a3a3a';
    ctx.fillRect(trackX, trackY, trackW, h);

    // 안전 구간 (왼쪽 = 잡힘)
    ctx.fillStyle = '#14532d';
    ctx.fillRect(trackX, trackY, trackW * 0.18, h);
    // 위험 구간 (오른쪽 = 도망)
    ctx.fillStyle = '#7f1d1d';
    ctx.fillRect(trackX + trackW * 0.82, trackY, trackW * 0.18, h);

    // 양 끝 라벨
    ctx.font = '20px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🎣', trackX - 18, trackY + h/2);
    ctx.fillText('🌊', trackX + trackW + 18, trackY + h/2);

    // 물고기 (현재 거리). 당김 펄스로 잠깐 커짐.
    const fishX = trackX + Math.max(0, Math.min(1, this.reelDist)) * trackW;
    const scale = 1 + this.reelTapPulse * 0.5;
    ctx.font = `${Math.floor(22 * scale)}px sans-serif`;
    ctx.fillText('🐟', fishX, trackY + h/2);
    ctx.textBaseline = 'alphabetic';

    // 카운터
    ctx.font = 'bold 11px sans-serif';
    ctx.fillStyle = '#fbbf24';
    ctx.fillText(`연타: ${this.reelTaps}회`, cx, cy + h/2 + 32);
  },

  // 캐스트 예상 궤적 (조준 중)
  _renderTrajectory(ctx, camera) {
    const v = this._dirVec();
    const ts = CONFIG.TILE_SIZE;
    const dist = this._powerToTiles(this.power);
    const tx = Player.x + v.x * ts * dist;
    const ty = Player.y + v.y * ts * dist;
    const px = Player.x - camera.x;
    const py = Player.y - camera.y - 4;
    const sx = tx - camera.x;
    const sy = ty - camera.y;

    // 점선 trajectory
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(sx, sy);
    ctx.stroke();
    ctx.setLineDash([]);

    // 착지 표시 (물이면 초록, 아니면 빨강)
    const ok = World.tileAt(tx, ty) === TILE.WATER;
    ctx.strokeStyle = ok ? '#10b981' : '#ef4444';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(sx, sy, 9, 0, Math.PI * 2);
    ctx.stroke();
    if (ok) {
      // 등급 표시
      const tier = this._maxTierFromPower(this.power);
      const stars = '★'.repeat(tier) + '☆'.repeat(4 - tier);
      ctx.fillStyle = ['#a8e6cf','#74b9ff','#fbbf24','#ffd966'][tier-1];
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(stars, sx, sy - 14);
    }
    ctx.lineWidth = 1;
  },

  // 파워 게이지
  _renderPowerBar(ctx) {
    const cx = CONFIG.CANVAS_WIDTH / 2;
    const cy = CONFIG.CANVAS_HEIGHT - 90;
    const w = 300, h = 22;

    // 박스 배경
    ctx.fillStyle = 'rgba(0,0,0,0.85)';
    ctx.fillRect(cx - w/2 - 10, cy - h/2 - 26, w + 20, h + 52);

    // 색 구간
    const zones = [
      { from: 0.0,  to: 0.30, color: '#ef4444', label: '1칸'  },
      { from: 0.30, to: 0.60, color: '#fbbf24', label: '2~3칸'},
      { from: 0.60, to: 0.85, color: '#10b981', label: '4칸'  },
      { from: 0.85, to: 1.00, color: '#ffd966', label: '5칸 ★'},
    ];
    for (const z of zones) {
      ctx.fillStyle = z.color;
      ctx.fillRect(cx - w/2 + z.from * w, cy - h/2, (z.to - z.from) * w, h);
    }

    // 마커
    const mx = cx - w/2 + this.power * w;
    ctx.fillStyle = '#fff';
    ctx.fillRect(mx - 2, cy - h/2 - 6, 4, h + 12);
    ctx.fillStyle = '#000';
    ctx.fillRect(mx - 1, cy - h/2 - 5, 2, h + 10);

    // 위 안내
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🎣 SPACE 다시 눌러 던지기!', cx, cy - h/2 - 10);

    // 아래 라벨
    ctx.font = '10px sans-serif';
    ctx.fillStyle = '#ddd';
    ctx.fillText('가까이 ←     파워     → 멀리 (큰 물고기 🏆)', cx, cy + h/2 + 16);
  },
};
