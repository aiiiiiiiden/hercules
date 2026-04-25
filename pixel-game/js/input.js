/**
 * 입력 시스템 (강화판)
 *
 * 핵심 개선점:
 *  1. _pressBuffer: 키 다운 이벤트를 set에 누적 → consume()이 16ms 안의 빠른 탭도 절대 놓치지 않음
 *  2. e.repeat 무시: 브라우저 자동반복으로 의도치 않은 입력 누적 방지
 *  3. 윈도우 blur / visibilitychange → keys 초기화: alt-tab 했다가 돌아왔을 때 키가 끼이는 현상 방지
 *  4. 채팅 포커스 토글 시 키 / 버퍼 모두 초기화
 *  5. clear() 단일 진입점으로 외부 모듈도 안전하게 입력 상태 리셋 가능
 *  6. 캔버스 탭/클릭 → A* 길찾기로 이동 (tapPath). 키보드 입력 발생 시 자동 무효화.
 */
const Input = {
  keys: {},                 // 현재 눌려 있는 키 상태 (held)
  _pressBuffer: new Set(),  // 새로 눌린 키들 (consume 대기 중)
  tapPath: null,            // [{c, r}, ...] - 탭으로 설정된 이동 목표 경로

  init() {
    window.addEventListener('keydown', (e) => {
      // 자동반복 이벤트는 버퍼에 안 넣음 (한 번 눌렀을 때 한 번만 consume)
      const k = e.key.toLowerCase();
      const code = e.code ? e.code.toLowerCase() : '';
      if (!e.repeat) {
        this._pressBuffer.add(k);
        if (code) this._pressBuffer.add(code);
      }
      this.keys[k] = true;
      if (code) this.keys[code] = true;

      if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key)) {
        e.preventDefault();
      }
    });

    window.addEventListener('keyup', (e) => {
      const k = e.key.toLowerCase();
      const code = e.code ? e.code.toLowerCase() : '';
      this.keys[k] = false;
      if (code) this.keys[code] = false;
    });

    // 윈도우 포커스 상실 → 키 끼임 방지
    window.addEventListener('blur', () => this.clear());

    // 탭 숨김 → 동일
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.clear();
    });

    // 캔버스 탭/클릭 → 길찾기 이동 (데스크톱 마우스 + 모바일 터치 공통)
    this._setupTapToMove();

    // 터치 기기 → 액션 버튼 노출
    const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
    if (isTouch) {
      const mc = document.getElementById('mobile-controls');
      if (mc) mc.classList.remove('hidden');
      this._setupActionButton();
    }
  },

  // 캔버스 탭 → 해당 타일까지 A* 경로를 tapPath에 저장. Player.update가 소비.
  _setupTapToMove() {
    const canvas = document.getElementById('game-canvas');
    if (!canvas) return;

    canvas.addEventListener('click', (e) => {
      // 캔버스 자체에 대한 탭만 처리 (HUD/액션버튼은 별도 핸들러)
      if (e.target !== canvas) return;
      // 게임이 진행 중이 아닌 경우 무시 (모달/게임오버)
      if (typeof Game !== 'undefined' && Game.state !== 'playing') return;
      if (typeof Pathfinding === 'undefined' || typeof Camera === 'undefined') return;

      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const wx = sx + Camera.x;
      const wy = sy + Camera.y;
      const ts = CONFIG.TILE_SIZE;
      const tc = Math.floor(wx / ts);
      const tr = Math.floor(wy / ts);
      const sc = Math.floor(Player.x / ts);
      const sr = Math.floor(Player.y / ts);

      // 도보 → 'land', 보트 → 'water' (바다에서만 항행)
      const mode = Player.inBoat ? 'water' : 'land';
      const path = Pathfinding.find(sc, sr, tc, tr, mode);
      if (path && path.length > 1) {
        path.shift();  // 현재 타일 제거 — 다음 칸부터 추적
        this.tapPath = path;
      }
    });
  },

  // 액션 버튼(SPACE) — 모바일 전용
  _setupActionButton() {
    const press = (key) => {
      const k = key.toLowerCase();
      if (!this.keys[k]) this._pressBuffer.add(k);
      this.keys[k] = true;
    };
    const release = (key) => {
      this.keys[key.toLowerCase()] = false;
    };

    const actionBtn = document.getElementById('action-btn');
    if (!actionBtn) return;
    const key = actionBtn.dataset.key || ' ';
    const onDown = (e) => { e.preventDefault(); actionBtn.classList.add('active'); press(key); };
    const onUp   = (e) => { e.preventDefault(); actionBtn.classList.remove('active'); release(key); };
    actionBtn.addEventListener('touchstart', onDown, { passive: false });
    actionBtn.addEventListener('touchend',   onUp,   { passive: false });
    actionBtn.addEventListener('touchcancel', onUp,  { passive: false });
    actionBtn.addEventListener('mousedown',  onDown);
    actionBtn.addEventListener('mouseup',    onUp);
    actionBtn.addEventListener('mouseleave', onUp);
    actionBtn.addEventListener('contextmenu', (e) => e.preventDefault());
  },

  // 탭 경로 비우기 (키보드 이동 시작/낚시 도주 등에서 호출)
  clearTapPath() {
    this.tapPath = null;
  },

  // 모든 키 상태 초기화 (포커스 상실/모달 닫힘 등에서 호출)
  clear() {
    this.keys = {};
    this._pressBuffer.clear();
    this.tapPath = null;
  },

  // 키가 현재 눌려 있는가
  isDown(key) {
    return !!this.keys[key.toLowerCase()];
  },

  // 새로 눌린 키를 한 번만 가져옴. 16ms보다 빠른 탭도 절대 안 놓침.
  consume(key) {
    const k = key.toLowerCase();
    if (this._pressBuffer.has(k)) {
      this._pressBuffer.delete(k);
      return true;
    }
    return false;
  },
};
