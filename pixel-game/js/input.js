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

  // 가상 컨트롤(드래그 조이스틱 + 액션 버튼) → keys/_pressBuffer 채널 주입
  _setupVirtualControls() {
    const press = (key) => {
      const k = key.toLowerCase();
      if (!this.keys[k]) this._pressBuffer.add(k);
      this.keys[k] = true;
    };
    const release = (key) => {
      this.keys[key.toLowerCase()] = false;
    };

    // ===== 액션 버튼 (탭) =====
    const actionBtn = document.getElementById('action-btn');
    if (actionBtn) {
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
    }

    // ===== 조이스틱 (드래그) =====
    const base = document.getElementById('joystick-base');
    const knob = document.getElementById('joystick-knob');
    if (!base || !knob) return;

    const KNOB_MAX = 50;       // 놉이 베이스 중앙에서 최대 이동할 수 있는 거리
    const DEAD_ZONE = 10;      // 이 거리 이하는 입력 없음
    const DIR_THRESHOLD = 0.4; // 정규화된 거리(0~1) 기준 — 이 이상이면 그 방향 키 활성

    let touchId = null;
    let centerX = 0, centerY = 0;
    let mouseDown = false;

    const releaseAllDirs = () => {
      release('ArrowUp'); release('ArrowDown');
      release('ArrowLeft'); release('ArrowRight');
    };

    const updateDirs = (dx, dy) => {
      const len = Math.hypot(dx, dy);
      if (len < DEAD_ZONE) { releaseAllDirs(); return; }
      const nx = dx / KNOB_MAX, ny = dy / KNOB_MAX;
      const setDir = (key, on) => {
        if (on) press(key); else release(key);
      };
      setDir('ArrowRight', nx >  DIR_THRESHOLD);
      setDir('ArrowLeft',  nx < -DIR_THRESHOLD);
      setDir('ArrowDown',  ny >  DIR_THRESHOLD);
      setDir('ArrowUp',    ny < -DIR_THRESHOLD);
    };

    const moveKnob = (dx, dy) => {
      const len = Math.hypot(dx, dy);
      let kx = dx, ky = dy;
      if (len > KNOB_MAX) {
        kx = dx / len * KNOB_MAX;
        ky = dy / len * KNOB_MAX;
      }
      knob.style.transform = `translate(${kx}px, ${ky}px)`;
      updateDirs(kx, ky);
    };

    const onStart = (clientX, clientY) => {
      const rect = base.getBoundingClientRect();
      centerX = rect.left + rect.width / 2;
      centerY = rect.top + rect.height / 2;
      knob.classList.add('dragging');
      moveKnob(clientX - centerX, clientY - centerY);
    };

    const onMove = (clientX, clientY) => {
      moveKnob(clientX - centerX, clientY - centerY);
    };

    const onEnd = () => {
      knob.classList.remove('dragging');
      knob.style.transform = 'translate(0, 0)';
      releaseAllDirs();
      touchId = null;
      mouseDown = false;
    };

    // 터치 이벤트 (조이스틱 전용 touchId 추적)
    base.addEventListener('touchstart', (e) => {
      if (touchId !== null) return;
      const t = e.changedTouches[0];
      touchId = t.identifier;
      e.preventDefault();
      onStart(t.clientX, t.clientY);
    }, { passive: false });

    document.addEventListener('touchmove', (e) => {
      if (touchId === null) return;
      for (const t of e.changedTouches) {
        if (t.identifier === touchId) {
          e.preventDefault();
          onMove(t.clientX, t.clientY);
          return;
        }
      }
    }, { passive: false });

    const handleTouchEnd = (e) => {
      if (touchId === null) return;
      for (const t of e.changedTouches) {
        if (t.identifier === touchId) {
          e.preventDefault();
          onEnd();
          return;
        }
      }
    };
    document.addEventListener('touchend', handleTouchEnd, { passive: false });
    document.addEventListener('touchcancel', handleTouchEnd, { passive: false });

    // 마우스 폴백 (데스크톱 테스트용)
    base.addEventListener('mousedown', (e) => {
      mouseDown = true;
      onStart(e.clientX, e.clientY);
    });
    document.addEventListener('mousemove', (e) => {
      if (mouseDown) onMove(e.clientX, e.clientY);
    });
    document.addEventListener('mouseup', () => {
      if (mouseDown) onEnd();
    });
    base.addEventListener('contextmenu', (e) => e.preventDefault());
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
