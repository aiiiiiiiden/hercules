/**
 * 플레이어 캐릭터
 * - 4방향 이동 + 충돌
 * - 스프라이트는 캔버스로 직접 그려서 외부 자원 의존 X
 */
const Player = {
  x: 400,           // 픽셀 좌표 (중심)
  y: 300,
  size: 28,
  speed: CONFIG.PLAYER_SPEED,
  dir: 'down',      // up/down/left/right
  walkFrame: 0,
  walking: false,
  name: 'YOU',
  inBoat: false,    // 배 위에 있는가

  // 캐릭터 색상 (커스터마이징 가능)
  color: {
    skin: '#ffd9b3',
    hair: '#5a3a1f',
    shirt: '#3aa6e0',
    pants: '#2c5282',
    shoe: '#222',
  },

  init() {
    this.inBoat = false;
    // 잔디 위 안전한 시작 위치 찾기
    const ts = CONFIG.TILE_SIZE;
    for (let r = Math.floor(World.rows/2); r < World.rows; r++) {
      for (let c = 0; c < World.cols; c++) {
        if (World.map[r][c] === TILE.GRASS || World.map[r][c] === TILE.PATH) {
          this.x = c * ts + ts/2;
          this.y = r * ts + ts/2;
          return;
        }
      }
    }
  },

  // 보트 타기/내리기
  _board() {
    if (Boat.isExpired()) {
      UI.showFloatingText(
        '⛔ 배 시간 다 됨!',
        this.x - Camera.x, this.y - Camera.y - 30,
        '#ef4444'
      );
      return;
    }
    this.inBoat = true;
    this.x = Boat.x;
    this.y = Boat.y;
    Boat.active = true;
    const remain = Math.ceil(Boat.remainingTime());
    UI.showFloatingText(
      `🚣 출항! (${remain}초 남음)`,
      this.x - Camera.x, this.y - Camera.y - 30,
      '#3aa6e0'
    );
  },

  _tryDisembark() {
    // 4방향 + 8방향으로 내릴 곳 찾기
    const tries = [
      [this.size, 0], [-this.size, 0], [0, this.size], [0, -this.size],
      [this.size, this.size], [-this.size, this.size],
      [this.size, -this.size], [-this.size, -this.size],
    ];
    for (const [dx, dy] of tries) {
      const nx = this.x + dx;
      const ny = this.y + dy;
      const t = World.tileAt(nx, ny);
      if (t === TILE.SAND || t === TILE.GRASS || t === TILE.PATH) {
        // 배는 마지막 위치에 머무름
        Boat.x = this.x;
        Boat.y = this.y;
        Boat.active = false;
        this.x = nx;
        this.y = ny;
        this.inBoat = false;
        UI.showFloatingText('하선!', this.x - Camera.x, this.y - Camera.y - 30, '#fff');
        return true;
      }
    }
    UI.showFloatingText('내릴 곳이 없어요', this.x - Camera.x, this.y - Camera.y - 30, '#ef4444');
    return false;
  },

  update() {
    // 낚시 중일 때 처리
    if (Fishing.state !== 'idle') {
      // B안: 방향키를 누르면 즉시 낚시 취소하고 자유 이동 (도망)
      const tryingToMove =
        Input.isDown('ArrowUp')   || Input.isDown('w') ||
        Input.isDown('ArrowDown') || Input.isDown('s') ||
        Input.isDown('ArrowLeft') || Input.isDown('a') ||
        Input.isDown('ArrowRight')|| Input.isDown('d');

      if (tryingToMove) {
        // 입질/릴링 중에 도망치면 물고기 놓침
        const wasHooked = (Fishing.state === 'biting' || Fishing.state === 'reeling');
        Fishing.reset();
        UI.showFloatingText(
          wasHooked ? '🐟 놓쳤다!' : '🦁 도망!',
          this.x - Camera.x,
          this.y - Camera.y - 30,
          wasHooked ? '#ef4444' : '#fbbf24'
        );
        // fall-through: 같은 프레임에 즉시 이동 시작
      } else {
        // 가만히 서있으면 기존 흐름 (SPACE 처리)
        this.walking = false;
        this.walkFrame = 0;
        if (Input.consume(' ')) {
          Fishing.trySpace();
        }
        return;
      }
    }

    let dx = 0, dy = 0;
    if (Input.isDown('ArrowUp')   || Input.isDown('w')) { dy -= 1; this.dir = 'up'; }
    if (Input.isDown('ArrowDown') || Input.isDown('s')) { dy += 1; this.dir = 'down'; }
    if (Input.isDown('ArrowLeft') || Input.isDown('a')) { dx -= 1; this.dir = 'left'; }
    if (Input.isDown('ArrowRight')|| Input.isDown('d')) { dx += 1; this.dir = 'right'; }

    if (dx !== 0 && dy !== 0) {
      // 대각선 정규화
      dx *= 0.707;
      dy *= 0.707;
    }

    this.walking = (dx !== 0 || dy !== 0);

    // 배 위에서 좌우 이동 시 보트 방향 갱신 (수직 이동에서는 유지)
    if (this.inBoat && Math.abs(dx) > 0.01) {
      Boat.facing = dx >= 0 ? 1 : -1;
    }

    // 충돌 검사 후 이동 (X, Y 분리하여 슬라이딩 가능)
    const nx = this.x + dx * this.speed;
    const ny = this.y + dy * this.speed;
    const r = this.size / 2 - 4;

    if (!this._collidesAt(nx, this.y, r)) this.x = nx;
    if (!this._collidesAt(this.x, ny, r)) this.y = ny;

    // 맵 경계 클램프
    this.x = Math.max(r, Math.min(World.width - r, this.x));
    this.y = Math.max(r, Math.min(World.height - r, this.y));

    // 걷기 애니메이션
    if (this.walking) {
      this.walkFrame += 0.15;
    } else {
      this.walkFrame = 0;
    }

    // SPACE: 정면에 따라 보트 타기 / 내리기 / 낚시
    if (Input.consume(' ')) {
      if (this.inBoat) {
        // 배 위: 정면이 땅 → 하선, 그 외(물) → 캐스팅
        if (this._facingLand()) {
          this._tryDisembark();
        } else {
          Fishing.cast();
        }
      } else {
        // 도보: 정면에 보트가 있으면 탑승, 그 외엔 캐스팅 시도
        if (this._facingBoat()) {
          this._board();
        } else {
          Fishing.cast();
        }
      }
    }
  },

  // 방향 단위 벡터
  _dirVec() {
    return ({
      up:    { x:  0, y: -1 },
      down:  { x:  0, y:  1 },
      left:  { x: -1, y:  0 },
      right: { x:  1, y:  0 },
    })[this.dir] || { x: 0, y: 1 };
  },

  // 정면 1칸이 땅(모래/잔디/길)인가
  _facingLand() {
    const v = this._dirVec();
    const tx = this.x + v.x * CONFIG.TILE_SIZE;
    const ty = this.y + v.y * CONFIG.TILE_SIZE;
    const t = World.tileAt(tx, ty);
    return t === TILE.SAND || t === TILE.GRASS || t === TILE.PATH;
  },

  // 정면 1칸 안에 보트가 있는가 (탑승 가능)
  _facingBoat() {
    const v = this._dirVec();
    const tx = this.x + v.x * CONFIG.TILE_SIZE;
    const ty = this.y + v.y * CONFIG.TILE_SIZE;
    return Math.hypot(Boat.x - tx, Boat.y - ty) < 30;
  },

  _collidesAt(x, y, r) {
    if (this.inBoat) {
      // 보트는 오직 물(바다)에만 다닐 수 있음. 모래·잔디 등 땅은 모두 막힘.
      const corners = [
        World.tileAt(x - r, y - r),
        World.tileAt(x + r, y - r),
        World.tileAt(x - r, y + r),
        World.tileAt(x + r, y + r),
      ];
      return corners.some(t => t !== TILE.WATER);
    }
    // 도보: 물·나무·울타리 막힘 (기존)
    return World.isBlocked(x - r, y - r) ||
           World.isBlocked(x + r, y - r) ||
           World.isBlocked(x - r, y + r) ||
           World.isBlocked(x + r, y + r);
  },

  render(ctx, camera) {
    const sx = this.x - camera.x;
    const sy = this.y - camera.y;

    // 보트 모드: 배에 탄 모습으로 그림 (Boat 모듈 위임)
    if (this.inBoat) {
      Boat.drawWithPerson(ctx, sx, sy, this.dir);
      // 이름표
      ctx.fillStyle = 'rgba(0,0,0,0.85)';
      ctx.fillRect(sx - 16, sy - 38, 32, 10);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(this.name, sx, sy - 30);
      return;
    }

    // 그림자
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(sx, sy + 14, 12, 4, 0, 0, Math.PI*2);
    ctx.fill();

    // 스프라이트 - 16x16을 32x32로 2배 스케일
    const dirCol = { down: 0, up: 1, left: 2, right: 3 }[this.dir] ?? 0;
    const drawSize = 32;
    let frame = 0;
    let key = 'player_idle';
    if (this.walking) {
      key = 'player_walk';
      frame = Math.floor(this.walkFrame * 4) % 4;  // 0~3 walk cycle
    }
    Assets.drawCell(ctx, key, dirCol, frame, 16, 16,
      sx - drawSize/2, sy - drawSize/2 - 4, drawSize, drawSize);

    // 이름표
    ctx.fillStyle = 'rgba(0,0,0,0.85)';
    ctx.fillRect(sx - 16, sy - 30, 32, 10);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(this.name, sx, sy - 22);

    if (CONFIG.DEBUG) {
      ctx.strokeStyle = 'rgba(255,255,0,0.4)';
      ctx.beginPath();
      ctx.arc(sx, sy, CONFIG.PLAYER_INTERACT_RANGE, 0, Math.PI*2);
      ctx.stroke();
    }
  },
};

// 카메라 (플레이어를 따라다님). 월드보다 뷰포트가 크면 월드를 가운데 정렬.
const Camera = {
  x: 0,
  y: 0,

  update(target) {
    // 플레이어를 중앙에
    this.x = target.x - CONFIG.CANVAS_WIDTH / 2;
    this.y = target.y - CONFIG.CANVAS_HEIGHT / 2;

    // X축
    if (World.width <= CONFIG.CANVAS_WIDTH) {
      // 월드가 화면보다 좁다 → 가운데 정렬 (camera 음수 = 월드를 안쪽으로 밀어줌)
      this.x = (World.width - CONFIG.CANVAS_WIDTH) / 2;
    } else {
      this.x = Math.max(0, Math.min(World.width - CONFIG.CANVAS_WIDTH, this.x));
    }
    // Y축
    if (World.height <= CONFIG.CANVAS_HEIGHT) {
      this.y = (World.height - CONFIG.CANVAS_HEIGHT) / 2;
    } else {
      this.y = Math.max(0, Math.min(World.height - CONFIG.CANVAS_HEIGHT, this.y));
    }
  },
};
