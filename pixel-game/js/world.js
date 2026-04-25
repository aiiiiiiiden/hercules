/**
 * 월드/맵 시스템
 * - 절차적으로 생성한 타일 맵
 * - 타일별 렌더링 (픽셀 아트 스타일을 코드로 그려서 외부 이미지 의존 없음)
 */
const World = {
  map: [],
  cols: CONFIG.MAP_COLS,
  rows: CONFIG.MAP_ROWS,
  width: CONFIG.MAP_COLS * CONFIG.TILE_SIZE,
  height: CONFIG.MAP_ROWS * CONFIG.TILE_SIZE,

  // 연못 데이터
  ponds: [],          // [{id, tiles:[{c,r}], size, cx, cy, speciesIds, tierMax}]
  pondMap: [],        // [r][c] -> pondId 또는 -1

  // 시드 기반 의사난수
  _seed: 12345,
  _rand() {
    this._seed = (this._seed * 9301 + 49297) % 233280;
    return this._seed / 233280;
  },

  generate() {
    // 매 라운드마다 새 시드 (동적 지형)
    this._seed = Math.floor(Math.random() * 999983);

    // 1. 모두 바다(물)로 채우기
    this.map = [];
    for (let r = 0; r < this.rows; r++) {
      const row = [];
      for (let c = 0; c < this.cols; c++) row.push(TILE.WATER);
      this.map.push(row);
    }

    // 2. 가운데에 섬 (불규칙 타원 + 노이즈로 들쭉날쭉한 해안)
    this._makeIsland();

    // 3. 섬 안에 작은 호수 0~2개 (랜덤)
    if (this._rand() < 0.7) this._tryMakeInnerPond();
    if (this._rand() < 0.4) this._tryMakeInnerPond();

    // 4. 모래(해변) - 잔디와 물의 경계
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (this.map[r][c] === TILE.GRASS && this._isNear(c, r, TILE.WATER, 1)) {
          this.map[r][c] = TILE.SAND;
        }
      }
    }

    // 5. 길(랜덤 파라미터) - 잔디 위에만 깔림
    this._makeRandomPath();

    // 6. 나무
    const numTrees = 18 + Math.floor(this._rand() * 14);
    for (let i = 0; i < numTrees; i++) {
      const c = Math.floor(this._rand() * this.cols);
      const r = Math.floor(this._rand() * this.rows);
      if (this.map[r][c] === TILE.GRASS) this.map[r][c] = TILE.TREE;
    }

    // 7. 돌
    for (let i = 0; i < 8; i++) {
      const c = Math.floor(this._rand() * this.cols);
      const r = Math.floor(this._rand() * this.rows);
      if (this.map[r][c] === TILE.GRASS) this.map[r][c] = TILE.STONE;
    }

    // 8. 울타리 ❌ (섬에서는 바다가 자연 경계)

    // 9. 연못/바다 식별 + 종 풀 할당
    this._identifyPonds();
  },

  _makeIsland() {
    const cx = this.cols / 2;
    const cy = this.rows / 2;
    // 섬 반지름 (타원). 맵의 약 70% 차지.
    const rx = this.cols * 0.36;
    const ry = this.rows * 0.36;
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const dx = (c - cx) / rx;
        const dy = (r - cy) / ry;
        const dist = Math.sqrt(dx * dx + dy * dy);
        // 결정적 노이즈 (해안선이 들쭉날쭉)
        const noise =
          Math.sin(c * 0.55) * 0.07 +
          Math.cos(r * 0.50) * 0.07 +
          Math.sin(c * 0.30 + r * 0.40) * 0.10;
        if (dist + noise < 1.0) {
          this.map[r][c] = TILE.GRASS;
        }
      }
    }
  },

  _tryMakeInnerPond() {
    // 섬 안쪽에서 잔디 위에 작은 원형 호수
    for (let attempt = 0; attempt < 20; attempt++) {
      const cx = 6 + Math.floor(this._rand() * (this.cols - 12));
      const cy = 5 + Math.floor(this._rand() * (this.rows - 10));
      if (this.map[cy][cx] !== TILE.GRASS) continue;
      const radius = 2 + Math.floor(this._rand() * 2); // 2~3

      // 후보 영역이 잔디로만 둘러싸여 있는지 확인 (해안과 합쳐지지 않게)
      let allGrass = true;
      const margin = radius + 1;
      outer: for (let r = cy - margin; r <= cy + margin; r++) {
        for (let c = cx - margin; c <= cx + margin; c++) {
          if (r < 0 || r >= this.rows || c < 0 || c >= this.cols) { allGrass = false; break outer; }
          if (this.map[r][c] !== TILE.GRASS) { allGrass = false; break outer; }
        }
      }
      if (!allGrass) continue;

      // 호수 파기
      for (let r = cy - radius; r <= cy + radius; r++) {
        for (let c = cx - radius; c <= cx + radius; c++) {
          const ddx = c - cx, ddy = r - cy;
          if (ddx*ddx + ddy*ddy <= radius*radius) {
            this.map[r][c] = TILE.WATER;
          }
        }
      }
      return true;
    }
    return false;
  },

  _makeRandomPath() {
    // 랜덤하게 가로/세로 길 선택
    const horizontal = this._rand() < 0.5;
    const freq = 0.2 + this._rand() * 0.4;
    const amp = 1 + this._rand() * 2.5;
    if (horizontal) {
      const baseRow = Math.floor(this.rows * (0.3 + this._rand() * 0.4));
      for (let c = 1; c < this.cols - 1; c++) {
        const r = baseRow + Math.floor(Math.sin(c * freq) * amp);
        if (r >= 1 && r < this.rows - 1 && this.map[r][c] === TILE.GRASS) this.map[r][c] = TILE.PATH;
        if (r + 1 < this.rows - 1 && this.map[r + 1][c] === TILE.GRASS) this.map[r + 1][c] = TILE.PATH;
      }
    } else {
      const baseCol = Math.floor(this.cols * (0.3 + this._rand() * 0.4));
      for (let r = 1; r < this.rows - 1; r++) {
        const c = baseCol + Math.floor(Math.sin(r * freq) * amp);
        if (c >= 1 && c < this.cols - 1 && this.map[r][c] === TILE.GRASS) this.map[r][c] = TILE.PATH;
        if (c + 1 < this.cols - 1 && this.map[r][c + 1] === TILE.GRASS) this.map[r][c + 1] = TILE.PATH;
      }
    }
  },

  // 연못별 종 풀 할당
  _identifyPonds() {
    const visited = Array.from({ length: this.rows }, () => new Array(this.cols).fill(false));
    this.ponds = [];
    this.pondMap = Array.from({ length: this.rows }, () => new Array(this.cols).fill(-1));

    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (visited[r][c] || this.map[r][c] !== TILE.WATER) continue;

        // BFS flood-fill
        const tiles = [];
        const queue = [[c, r]];
        visited[r][c] = true;
        while (queue.length > 0) {
          const [cc, cr] = queue.shift();
          tiles.push({ c: cc, r: cr });
          for (const [dc, dr] of [[1,0],[-1,0],[0,1],[0,-1]]) {
            const nc = cc + dc, nr = cr + dr;
            if (nr < 0 || nr >= this.rows || nc < 0 || nc >= this.cols) continue;
            if (visited[nr][nc] || this.map[nr][nc] !== TILE.WATER) continue;
            visited[nr][nc] = true;
            queue.push([nc, nr]);
          }
        }

        // habitat 판정: 한 타일이라도 맵 경계에 닿으면 바다, 아니면 민물 호수
        let isSea = false;
        for (const t of tiles) {
          if (t.r === 0 || t.r === this.rows - 1 ||
              t.c === 0 || t.c === this.cols - 1) {
            isSea = true;
            break;
          }
        }
        const habitat = isSea ? 'sea' : 'freshwater';

        // 풀 할당 (크기 기반 tier + habitat 필터)
        const size = tiles.length;
        let tierMax;
        if (size < 8)       tierMax = 1;
        else if (size < 18) tierMax = 2;
        else if (size < 35) tierMax = 3;
        else                tierMax = 4;

        const speciesIds = SPECIES.fish
          .filter(s => s.habitat === habitat && s.tier <= tierMax)
          .map(s => s.id);

        // 중심
        let sumC = 0, sumR = 0;
        for (const t of tiles) { sumC += t.c; sumR += t.r; }
        const ts = CONFIG.TILE_SIZE;
        const cx = (sumC / tiles.length + 0.5) * ts;
        const cy = (sumR / tiles.length + 0.5) * ts;

        const pondId = this.ponds.length;
        for (const t of tiles) this.pondMap[t.r][t.c] = pondId;

        this.ponds.push({ id: pondId, tiles, size, cx, cy, speciesIds, tierMax, habitat });
      }
    }
  },

  // 픽셀 좌표가 어느 연못에 속하는지
  pondAt(px, py) {
    const c = Math.floor(px / CONFIG.TILE_SIZE);
    const r = Math.floor(py / CONFIG.TILE_SIZE);
    if (r < 0 || r >= this.rows || c < 0 || c >= this.cols) return null;
    const id = this.pondMap[r][c];
    if (id < 0) return null;
    return this.ponds[id];
  },

  // 원형 영역을 특정 타일로 채움
  _makeBlob(cx, cy, radius, tile) {
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const dx = c - cx, dy = r - cy;
        const noise = this._rand() * 0.6;
        if (dx*dx + dy*dy <= radius*radius * (1 + noise - 0.3)) {
          this.map[r][c] = tile;
        }
      }
    }
  },

  _isNear(c, r, tile, dist) {
    for (let dr = -dist; dr <= dist; dr++) {
      for (let dc = -dist; dc <= dist; dc++) {
        const nr = r+dr, nc = c+dc;
        if (nr >= 0 && nr < this.rows && nc >= 0 && nc < this.cols) {
          if (this.map[nr][nc] === tile) return true;
        }
      }
    }
    return false;
  },

  // 좌표(픽셀)에 있는 타일 반환
  tileAt(px, py) {
    const c = Math.floor(px / CONFIG.TILE_SIZE);
    const r = Math.floor(py / CONFIG.TILE_SIZE);
    if (r < 0 || r >= this.rows || c < 0 || c >= this.cols) return null;
    return this.map[r][c];
  },

  // 충돌 가능 타일 (물, 나무, 울타리는 통과 못함)
  isBlocked(px, py) {
    const t = this.tileAt(px, py);
    return t === TILE.WATER || t === TILE.TREE || t === TILE.FENCE || t === null;
  },

  // ===== 렌더링 =====
  // 2-pass 방식:
  //  1) 베이스 (잔디/모래/물/길) - 모든 타일을 깔아둠. 나무·돌 자리는 잔디로 깔림
  //  2) 오버레이 (나무·돌) - 베이스 위에 그림. 인접 타일이 절대 덮지 못함.
  render(ctx, camera) {
    const ts = CONFIG.TILE_SIZE;
    const startC = Math.max(0, Math.floor(camera.x / ts));
    const endC = Math.min(this.cols, Math.ceil((camera.x + CONFIG.CANVAS_WIDTH) / ts));
    const startR = Math.max(0, Math.floor(camera.y / ts));
    const endR = Math.min(this.rows, Math.ceil((camera.y + CONFIG.CANVAS_HEIGHT) / ts));

    // Pass 1: base
    for (let r = startR; r < endR; r++) {
      for (let c = startC; c < endC; c++) {
        const x = c * ts - camera.x;
        const y = r * ts - camera.y;
        this._drawBase(ctx, this.map[r][c], x, y);
      }
    }
    // Pass 2: overlay (나무·돌은 더 큰 영역으로 그려서 잘리지 않게)
    for (let r = startR; r < endR; r++) {
      for (let c = startC; c < endC; c++) {
        const x = c * ts - camera.x;
        const y = r * ts - camera.y;
        this._drawOverlay(ctx, this.map[r][c], x, y);
      }
    }
  },

  // 게임 TILE → 스프라이트시트 좌표 매핑 (16×16 셀 단위)
  // (검증된 좌표 - tileset 파일 시각 분석으로 선정)
  _TILE_SOURCE: {
    [TILE.GRASS]: { sheet: 'tiles_field', col: 1, row: 4  },  // 연두색 잔디 중심 셀
    [TILE.PATH]:  { sheet: 'tiles_field', col: 1, row: 10 },  // 분홍빛 모래길
    [TILE.SAND]:  { sheet: 'tiles_field', col: 1, row: 1  },  // 오렌지 모래사장
    [TILE.WATER]: { sheet: 'tiles_water', col: 11, row: 0 },  // 순수 파란 물
    // STONE: 잔디 위에 작은 돌 (1×1 셀)
    [TILE.STONE]: { sheet: 'tiles_nature', col: 9, row: 8, overGrass: true },
    // TREE: 2×2 셀(32×32) 큰 나무
    [TILE.TREE]:  { sheet: 'tiles_nature', col: 0, row: 0, overGrass: true, big: true },
  },

  // Pass 1: 베이스 타일. 나무·돌이 깔린 곳도 일단 잔디로 깔아둠.
  _drawBase(ctx, tile, x, y) {
    const ts = CONFIG.TILE_SIZE;
    const src = this._TILE_SOURCE[tile];
    if (!src) {
      ctx.fillStyle = '#3d9c43';
      ctx.fillRect(x, y, ts, ts);
      return;
    }
    // 풀 위 오브젝트는 베이스로 잔디만 그리고 오버레이는 Pass2에서
    const baseSrc = src.overGrass ? this._TILE_SOURCE[TILE.GRASS] : src;
    Assets.drawCell(
      ctx, baseSrc.sheet, baseSrc.col, baseSrc.row, 16, 16, x, y, ts, ts
    );

    if (CONFIG.DEBUG) {
      ctx.strokeStyle = 'rgba(0,0,0,0.2)';
      ctx.strokeRect(x, y, ts, ts);
    }
  },

  // Pass 2: 잔디 위 오브젝트(나무·돌). 베이스 전부 깐 뒤라 옆 타일이 덮을 수 없음.
  _drawOverlay(ctx, tile, x, y) {
    const ts = CONFIG.TILE_SIZE;
    const src = this._TILE_SOURCE[tile];
    if (!src || !src.overGrass) return;

    if (src.big) {
      // 2×2 셀(32×32 원본). 1타일을 넉넉히 넘어가게 1.5배로.
      const drawW = ts * 1.5;
      const drawH = ts * 1.5;
      Assets.drawCell(
        ctx, src.sheet, src.col, src.row, 32, 32,
        x + (ts - drawW) / 2,
        y + (ts - drawH),       // 바닥 정렬 (트렁크가 타일 바닥에 닿도록)
        drawW, drawH
      );
    } else {
      // 작은 1셀 오브젝트는 타일 가운데 50% 크기로
      const drawSize = ts * 0.6;
      Assets.drawCell(
        ctx, src.sheet, src.col, src.row, 16, 16,
        x + (ts - drawSize) / 2,
        y + (ts - drawSize) / 2 + 4,  // 약간 아래쪽으로 (그림자 느낌)
        drawSize, drawSize
      );
    }
  },
};
