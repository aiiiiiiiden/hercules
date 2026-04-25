/**
 * 물고기 시스템 (낚시 전용)
 * - 물 타일 위에 떠다니는 시각적 물고기
 * - 일정 주기로 자동 리스폰
 * - 실제 잡는 처리는 Fishing 모듈이 담당
 */

// 도감용 종 데이터 (확장 가능)
// habitat: 'freshwater'(민물) / 'sea'(바다)
// tier: 1(잡어) ~ 4(전설)
const SPECIES = {
  fish: [
    // ===== 민물 (내륙 호수에서만 잡힘) =====
    { id: 'fish_1', name: '피라미',    emoji: '🐟', color: '#a8e6cf', score: 5,   tier: 1, habitat: 'freshwater' },
    { id: 'fish_2', name: '붕어',      emoji: '🐟', color: '#ff8a4a', score: 12,  tier: 1, habitat: 'freshwater' },
    { id: 'fish_3', name: '잉어',      emoji: '🐠', color: '#ffd966', score: 20,  tier: 2, habitat: 'freshwater' },
    { id: 'fish_4', name: '메기',      emoji: '🐡', color: '#a8a8a8', score: 18,  tier: 2, habitat: 'freshwater' },
    // ===== 바다 (큰 바다에서만 잡힘) =====
    { id: 'fish_5', name: '농어',      emoji: '🐠', color: '#74b9ff', score: 30,  tier: 2, habitat: 'sea' },
    { id: 'fish_6', name: '고등어',    emoji: '🐟', color: '#5a8db5', score: 25,  tier: 2, habitat: 'sea' },
    { id: 'fish_7', name: '연어',      emoji: '🐟', color: '#ff6b9d', score: 38,  tier: 3, habitat: 'sea' },
    { id: 'fish_8', name: '돔',        emoji: '🐠', color: '#e76f51', score: 42,  tier: 3, habitat: 'sea' },
    { id: 'fish_9', name: '참치',      emoji: '🐟', color: '#3aa6e0', score: 60,  tier: 4, habitat: 'sea' },
    { id: 'fish_10', name: '대왕물고기', emoji: '🐳', color: '#4a90e2', score: 100, tier: 4, habitat: 'sea' },
  ],
};

const Items = {
  list: [],         // 활성 물고기들
  collected: {},    // {speciesId: count}
  lastSpawnAt: 0,

  init() {
    this.list = [];
    this.collected = {};
    this.lastSpawnAt = 0;
    this.spawnAll();
  },

  spawnAll() {
    // 각 연못에 최소 1마리씩 보장 (큰 바다든 작은 호수든 시각적으로 보이게)
    for (const pond of World.ponds) {
      if (pond.tiles.length >= 4) {
        this._spawnInPond(pond);
      }
    }
    // 그 다음 MAX_FISH까지 랜덤 채움 (큰 바다에 더 많이 자연스럽게 분포)
    while (this.list.length < CONFIG.MAX_FISH) {
      if (!this._spawnOne()) break;
    }
  },

  _spawnInPond(pond) {
    const ts = CONFIG.TILE_SIZE;
    for (let attempts = 0; attempts < 20; attempts++) {
      const tile = pond.tiles[Math.floor(Math.random() * pond.tiles.length)];
      const x = tile.c * ts + ts / 2 + (Math.random() - 0.5) * 16;
      const y = tile.r * ts + ts / 2 + (Math.random() - 0.5) * 16;
      if (this.list.some(it => Math.hypot(it.x - x, it.y - y) < 30)) continue;

      const candidates = pond.speciesIds.map(id => SPECIES.fish.find(s => s.id === id)).filter(Boolean);
      const visualPool = candidates.filter(s => s.tier <= 2);
      const pool = visualPool.length > 0 ? visualPool : candidates;
      if (pool.length === 0) return false;

      const species = pool[Math.floor(Math.random() * pool.length)];
      const angle = Math.random() * Math.PI * 2;
      this.list.push({
        species, x, y,
        bornAt: Date.now(),
        wobble: Math.random() * Math.PI * 2,
        angle,
        speed: 0.4 + Math.random() * 0.4,
        facing: Math.cos(angle) >= 0 ? 1 : -1,
        nextTurnAt: Date.now() + 1000 + Math.random() * 2000,
      });
      return true;
    }
    return false;
  },

  _spawnOne() {
    for (let attempts = 0; attempts < 50; attempts++) {
      const c = Math.floor(Math.random() * World.cols);
      const r = Math.floor(Math.random() * World.rows);
      if (World.map[r][c] !== TILE.WATER) continue;

      const x = c * CONFIG.TILE_SIZE + CONFIG.TILE_SIZE / 2 + (Math.random() - 0.5) * 16;
      const y = r * CONFIG.TILE_SIZE + CONFIG.TILE_SIZE / 2 + (Math.random() - 0.5) * 16;

      // 너무 가까이 겹치지 않도록
      if (this.list.some(it => Math.hypot(it.x - x, it.y - y) < 30)) continue;

      // 이 연못에 사는 종들 중에서만 (시각적으로도 연못마다 다르게)
      const pond = World.pondAt(x, y);
      const pondSpecies = pond
        ? pond.speciesIds.map(id => SPECIES.fish.find(s => s.id === id))
        : SPECIES.fish.filter(s => s.tier <= 2);
      // 시각 스폰은 tier 1~2 위주 (큰 물고기는 거의 안 보이게)
      const visualPool = pondSpecies.filter(s => s.tier <= 2);
      const pool = visualPool.length > 0 ? visualPool : pondSpecies;
      const species = pool[Math.floor(Math.random() * pool.length)];
      const angle = Math.random() * Math.PI * 2;
      this.list.push({
        species,
        x, y,
        bornAt: Date.now(),
        wobble: Math.random() * Math.PI * 2,
        angle,
        speed: 0.4 + Math.random() * 0.4,
        facing: Math.cos(angle) >= 0 ? 1 : -1,
        nextTurnAt: Date.now() + 1000 + Math.random() * 2000,
      });
      return true;
    }
    return false;
  },

  update() {
    const now = Date.now();

    // 1) 물고기 헤엄
    for (const it of this.list) {
      this._moveItem(it, now);
    }

    // 2) 주기적 리스폰
    if (now - this.lastSpawnAt > CONFIG.RESPAWN_INTERVAL_MS) {
      this.lastSpawnAt = now;
      if (this.list.length < CONFIG.MAX_FISH) this._spawnOne();
    }
  },

  // 물고기 이동 - 물 영역을 벗어나지 않도록 회피
  _moveItem(it, now) {
    if (now > it.nextTurnAt) {
      it.angle += (Math.random() - 0.5) * 1.2;
      it.nextTurnAt = now + 800 + Math.random() * 1800;
    }

    const nx = it.x + Math.cos(it.angle) * it.speed;
    const ny = it.y + Math.sin(it.angle) * it.speed;

    if (World.tileAt(nx, ny) !== TILE.WATER) {
      it.angle += Math.PI + (Math.random() - 0.5) * 0.6;
      return;
    }

    it.x = nx;
    it.y = ny;

    const dirX = Math.cos(it.angle);
    if (Math.abs(dirX) > 0.1) {
      it.facing = dirX >= 0 ? 1 : -1;
    }
  },

  render(ctx, camera) {
    for (const it of this.list) {
      const sx = it.x - camera.x;
      const sy = it.y - camera.y;

      if (sx < -20 || sx > CONFIG.CANVAS_WIDTH + 20) continue;
      if (sy < -20 || sy > CONFIG.CANVAS_HEIGHT + 20) continue;

      const t = (Date.now() / 200) + it.wobble;
      const wob = Math.sin(t) * 2;
      this._drawFish(ctx, sx, sy + wob, it);
    }
  },

  _drawFish(ctx, x, y, item) {
    // 물 위 반짝임
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.fillRect(x - 5, y + 6, 10, 1);

    // 종에 따라 다른 시트 (바다=red, 민물=green) — 4프레임 swim 애니메이션
    const sheetKey = item.species.habitat === 'sea' ? 'fish_red' : 'fish_green';
    const frame = Math.floor(Date.now() / 200 + item.wobble) % 4;

    ctx.save();
    ctx.translate(x, y);
    // 진행 방향에 따라 좌우 반전
    ctx.scale(item.facing, 1);
    // 16x16 → 18x18로 살짝 확대해서 보이게
    Assets.drawCell(ctx, sheetKey, 0, frame, 16, 16, -9, -9, 18, 18);
    ctx.restore();
  },
};
