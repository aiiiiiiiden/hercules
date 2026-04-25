/**
 * 입력 시스템 (강화판)
 *
 * 핵심 개선점:
 *  1. _pressBuffer: 키 다운 이벤트를 set에 누적 → consume()이 16ms 안의 빠른 탭도 절대 놓치지 않음
 *  2. e.repeat 무시: 브라우저 자동반복으로 의도치 않은 입력 누적 방지
 *  3. 윈도우 blur / visibilitychange → keys 초기화: alt-tab 했다가 돌아왔을 때 키가 끼이는 현상 방지
 *  4. 채팅 포커스 토글 시 키 / 버퍼 모두 초기화
 *  5. clear() 단일 진입점으로 외부 모듈도 안전하게 입력 상태 리셋 가능
 */
const Input = {
  keys: {},                 // 현재 눌려 있는 키 상태 (held)
  _pressBuffer: new Set(),  // 새로 눌린 키들 (consume 대기 중)

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

    // 터치 기기 → 가상 컨트롤 활성화
    const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
    if (isTouch) {
      const mc = document.getElementById('mobile-controls');
      if (mc) mc.classList.remove('hidden');
      this._setupVirtualControls();
    }
  },

  // 가상 컨트롤(D-pad + 액션 버튼) 입력 → 키보드와 동일한 keys/_pressBuffer 채널로 주입
  _setupVirtualControls() {
    const press = (key) => {
      const k = key.toLowerCase();
      if (!this.keys[k]) this._pressBuffer.add(k);
      this.keys[k] = true;
    };
    const release = (key) => {
      this.keys[key.toLowerCase()] = false;
    };

    const bind = (el) => {
      const key = el.dataset.key;
      if (!key) return;
      const onDown = (e) => {
        e.preventDefault();
        el.classList.add('active');
        press(key);
      };
      const onUp = (e) => {
        e.preventDefault();
        el.classList.remove('active');
        release(key);
      };
      el.addEventListener('touchstart', onDown, { passive: false });
      el.addEventListener('touchend',   onUp,   { passive: false });
      el.addEventListener('touchcancel', onUp,  { passive: false });
      el.addEventListener('mousedown',  onDown);
      el.addEventListener('mouseup',    onUp);
      el.addEventListener('mouseleave', onUp);
      el.addEventListener('contextmenu', (e) => e.preventDefault());
    };

    document.querySelectorAll('.dpad-btn').forEach(bind);
    const actionBtn = document.getElementById('action-btn');
    if (actionBtn) bind(actionBtn);
  },

  // 모든 키 상태 초기화 (포커스 상실/모달 닫힘 등에서 호출)
  clear() {
    this.keys = {};
    this._pressBuffer.clear();
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
