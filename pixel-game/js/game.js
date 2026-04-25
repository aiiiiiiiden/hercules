/**
 * 메인 게임 루프 (타임어택 모드)
 * - 60초 카운트다운
 * - 시간 종료 시 입력/이동 정지, 결과 모달 표시
 */
const Game = {
  canvas: null,
  ctx: null,
  lastTime: 0,
  running: false,

  // 타이머
  timeLeft: CONFIG.GAME_TIME_SEC,
  state: 'playing',  // 'playing' | 'over'

  init() {
    this.canvas = document.getElementById('game-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;

    this._resize();
    window.addEventListener('resize', () => this._resize());

    // 자산 로드 완료 후 시작 모달 표시 → 클릭 시 게임 시작
    Assets.load(() => {
      Input.init();
      UI.init();
      this._startNewRound();
      // 시작 모달 띄움 (모달이 열려 있는 동안은 isAnyModalOpen()이 true라 timer/사자/물고기 등 모두 일시정지)
      UI.showStartModal();
      this.running = true;
      requestAnimationFrame((t) => this.loop(t));
    });
  },

  _resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const dpr = window.devicePixelRatio || 1;

    this.canvas.width = w * dpr;
    this.canvas.height = h * dpr;
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    // 그리기 좌표는 논리적(CSS px) 단위로 유지
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.ctx.imageSmoothingEnabled = false;

    CONFIG.CANVAS_WIDTH = w;
    CONFIG.CANVAS_HEIGHT = h;

    // 카메라가 즉시 새 사이즈에 맞춰지도록
    if (typeof Player !== 'undefined' && Player.x !== undefined) {
      Camera.update(Player);
    }
  },

  // 새 라운드 (init과 restart 모두에서 호출)
  _startNewRound() {
    World.generate();
    Items.init();
    Boat.init();              // 해안에 배 스폰
    Player.init();
    Fishing.reset();
    Lion.init();              // 사자도 스폰
    UI.reset();
    Camera.update(Player);
    this.timeLeft = CONFIG.GAME_TIME_SEC;
    this.state = 'playing';
    this.endReason = null;
  },

  restart() {
    this._startNewRound();
  },

  loop(timestamp) {
    if (!this.running) return;

    const dt = (timestamp - this.lastTime) / 1000 || 0;
    this.lastTime = timestamp;

    this.update(dt);
    this.render();

    requestAnimationFrame((t) => this.loop(t));
  },

  update(dt) {
    // 어떤 모달이든 열려있는 동안 모든 게 일시정지
    if (UI.isAnyModalOpen()) return;

    if (this.state === 'playing') {
      // 타이머 감소
      this.timeLeft -= dt;
      UI.updateTimer(this.timeLeft);

      if (this.timeLeft <= 0) {
        this.timeLeft = 0;
        this._endRound('time');
      } else {
        Player.update();
        Fishing.update();
        Items.update();
        Lion.update();           // 사자 추적

        // 배 탑승 시간 누적
        if (Player.inBoat) {
          Boat.tickActive(dt);
          if (Boat.isExpired()) {
            this._endRound('boat_timeout');
            return;
          }
        }
        UI.updateBoatTimer();

        Camera.update(Player);
      }
    } else {
      // 게임 종료 후에도 물고기는 헤엄치도록 (배경 효과)
      Items.update();
    }
  },

  _endRound(reason) {
    this.state = 'over';
    this.endReason = reason || 'time';
    UI.showGameOver(this.endReason);
  },

  // 사자에게 잡혔을 때 (Lion 모듈에서 호출)
  endByLion() {
    if (this.state !== 'playing') return;
    this._endRound('lion');
  },

  render() {
    const ctx = this.ctx;
    // 월드보다 큰 뷰포트 영역은 바다(진청)로 채워서 자연스럽게 이어지게
    ctx.fillStyle = '#2c8fc4';
    ctx.fillRect(0, 0, CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT);

    World.render(ctx, Camera);
    Items.render(ctx, Camera);
    Boat.render(ctx, Camera);     // 빈 보트 (플레이어가 안 탔을 때)
    Fishing.render(ctx, Camera);
    Lion.render(ctx, Camera);     // 사자 (플레이어보다 뒤)
    Player.render(ctx, Camera);
    ClickMarker.render(ctx, Camera);  // 클릭 피드백 (O/X)

    if (this.state === 'playing') {
      Lion.renderVignette(ctx);   // 위험 시 화면 빨간 비네트
      this._drawInteractionHint(ctx);
    }
  },

  _drawInteractionHint(ctx) {
    // 낚시 중에는 힌트 안 띄움 (Fishing 모듈이 직접 안내함)
    if (Fishing.state !== 'idle') return;

    const sx = Player.x - Camera.x;
    const sy = Player.y - Camera.y - 38;
    const bob = Math.sin(Date.now() / 200) * 2;

    let label = null;

    if (Player.inBoat) {
      // 배 위: 정면이 땅이면 내리기, 물이면 낚시
      if (Player._facingLand()) {
        label = '🚣 [SPACE] 내리기';
      } else if (Fishing.findCastTarget()) {
        label = '🎣 [SPACE] 낚시';
      }
    } else {
      // 도보: 정면에 보트가 있으면 타기, 그 외엔 물 보고 있으면 낚시
      if (Player._facingBoat()) {
        label = '🚣 [SPACE] 타기';
      } else if (Fishing.findCastTarget()) {
        label = '🎣 [SPACE] 낚시';
      }
    }

    if (!label) return;

    ctx.font = 'bold 9px monospace';
    const w = ctx.measureText(label).width + 14;
    ctx.fillStyle = 'rgba(0,0,0,0.85)';
    ctx.fillRect(sx - w/2, sy - 12 + bob, w, 14);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText(label, sx, sy - 2 + bob);
  },
};

window.addEventListener('load', () => Game.init());
