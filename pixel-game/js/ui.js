/**
 * UI / HUD - DOM 기반
 * - 점수, 인벤토리, 도감, 떠다니는 텍스트 효과
 */
const UI = {
  score: 0,
  fishCount: 0,
  catchModalOpen: false,   // 잡기 결과 모달이 열려 있는 동안 게임 일시정지
  missModalOpen: false,    // 놓침 모달이 열려 있는 동안도 동일
  startModalOpen: false,   // 시작 모달 (게임 시작 전)

  init() {
    document.getElementById('dex-close').addEventListener('click', () => this.closeDex());
    document.getElementById('restart-btn').addEventListener('click', () => Game.restart());
    document.getElementById('catch-ok-btn').addEventListener('click', () => this.closeCatchResult());
    document.getElementById('miss-ok-btn').addEventListener('click', () => this.closeMissResult());
    document.getElementById('start-btn').addEventListener('click', () => this.closeStartModal());

    // 모든 버튼은 클릭 직후 포커스 해제 → 이후 SPACE/ENTER가 게임 입력으로 정상 전달되게
    document.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => btn.blur());
    });

    // 'M' 키로도 도감 열기
    window.addEventListener('keydown', (e) => {
      // 시작 모달이 우선 - ENTER로 시작
      if (this.startModalOpen) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.closeStartModal();
        }
        return;
      }
      // 잡기/놓침 모달이 열려 있으면 ENTER로만 닫기
      if (this.catchModalOpen || this.missModalOpen) {
        if (e.key === 'Enter') {
          e.preventDefault();
          if (this.catchModalOpen) this.closeCatchResult();
          else if (this.missModalOpen) this.closeMissResult();
        }
        return;
      }

      if (e.key.toLowerCase() === 'm') {
        const modal = document.getElementById('dex-modal');
        if (modal.classList.contains('hidden')) this.openDex();
        else this.closeDex();
      }
      // 게임오버 화면에서 ENTER로 재시작
      if (e.key === 'Enter') {
        const over = document.getElementById('gameover-modal');
        if (!over.classList.contains('hidden')) Game.restart();
      }
    });

    // 힌트 자동 페이드아웃
    setTimeout(() => {
      const hint = document.getElementById('hint-banner');
      if (hint) hint.style.opacity = '0';
    }, 6000);
  },

  reset() {
    this.score = 0;
    this.fishCount = 0;
    this.catchModalOpen = false;
    this.missModalOpen = false;
    document.getElementById('score-value').textContent = '0';
    document.getElementById('fish-count').textContent = '0';
    document.getElementById('timer-value').textContent = CONFIG.GAME_TIME_SEC;
    document.getElementById('timer-box').classList.remove('warning');
    document.getElementById('gameover-modal').classList.add('hidden');
    document.getElementById('catch-modal').classList.add('hidden');
    document.getElementById('miss-modal').classList.add('hidden');
  },

  // 어떤 모달이든 열려 있으면 게임 일시정지
  isAnyModalOpen() {
    return this.catchModalOpen || this.missModalOpen || this.startModalOpen;
  },

  // 시작 모달
  showStartModal() {
    this.startModalOpen = true;
    document.getElementById('start-modal').classList.remove('hidden');
  },

  closeStartModal() {
    this.startModalOpen = false;
    document.getElementById('start-modal').classList.add('hidden');
    Input.clear();
  },

  // 물고기 놓침 결과 모달
  showMissResult(reason) {
    const reasons = {
      bite_timeout: '입질 타이밍을 놓쳤다',
      reel_escape:  '연타가 부족해서 도망갔다',
      generic:      '물고기가 도망갔다',
    };
    document.getElementById('miss-reason').textContent = reasons[reason] || reasons.generic;
    this.missModalOpen = true;
    document.getElementById('miss-modal').classList.remove('hidden');
  },

  closeMissResult() {
    this.missModalOpen = false;
    document.getElementById('miss-modal').classList.add('hidden');
    Input.clear();
  },

  // 물고기 잡기 결과 모달
  showCatchResult(species) {
    document.getElementById('catch-emoji').textContent = species.emoji;
    document.getElementById('catch-name').textContent = species.name;

    const stars = species.tier ? '★'.repeat(species.tier) + '☆'.repeat(4 - species.tier) : '';
    const starsEl = document.getElementById('catch-stars');
    starsEl.textContent = stars;
    const tierColors = ['#a8e6cf','#74b9ff','#fbbf24','#f59e0b'];
    starsEl.style.color = tierColors[(species.tier || 1) - 1];

    document.getElementById('catch-score').textContent = `+${species.score} 점`;

    const totalCount = Items.collected[species.id] || 1;
    document.getElementById('catch-count').textContent =
      totalCount === 1 ? '🆕 처음 잡았다!' : `이번 라운드 ${totalCount}마리째`;

    // 전설 등급 강조
    const content = document.querySelector('.catch-content');
    content.classList.toggle('legendary', species.tier === 4);

    this.catchModalOpen = true;
    document.getElementById('catch-modal').classList.remove('hidden');
  },

  closeCatchResult() {
    this.catchModalOpen = false;
    document.getElementById('catch-modal').classList.add('hidden');
    // 모달 동안 누른 SPACE/ENTER 등이 게임에 영향 주지 않도록 입력 상태 초기화
    Input.clear();
  },

  // 매 프레임 호출 - 남은 시간 표시
  updateTimer(remainingSec) {
    const display = Math.max(0, Math.ceil(remainingSec));
    document.getElementById('timer-value').textContent = display;
    const box = document.getElementById('timer-box');
    if (display <= 10) box.classList.add('warning');
    else box.classList.remove('warning');
  },

  // 배 시간은 캔버스에서 플레이어 머리 위에 그림 (Player.render 참고). 호환을 위해 빈 메서드.
  updateBoatTimer() {},

  showGameOver(reason) {
    // 종료 사유별 타이틀
    const title = document.getElementById('gameover-title');
    if (reason === 'lion') {
      title.textContent = '🦁 사자에게 잡혔다!';
      title.style.color = '#ef4444';
    } else if (reason === 'boat_timeout') {
      title.textContent = '🌊 표류했다!';
      title.style.color = '#3aa6e0';
    } else {
      title.textContent = '⏰ TIME UP!';
      title.style.color = '#ff5252';
    }
    document.getElementById('final-score').textContent = this.score;
    document.getElementById('final-fish').textContent = this.fishCount;

    // 점수 기반 등급
    let rank, color;
    if (this.score >= 300)      { rank = '🏆 전설의 채집가!'; color = '#ffd966'; }
    else if (this.score >= 200) { rank = '⭐ 마스터';         color = '#a8e6cf'; }
    else if (this.score >= 100) { rank = '🌟 숙련자';         color = '#74b9ff'; }
    else if (this.score >= 50)  { rank = '🎯 견습생';         color = '#fdcb6e'; }
    else                        { rank = '🌱 초보자';         color = '#dfe6e9'; }

    const rankEl = document.getElementById('final-rank');
    rankEl.textContent = rank;
    rankEl.style.background = color;

    document.getElementById('gameover-modal').classList.remove('hidden');
  },

  addScore(amount) {
    this.score += amount;
    document.getElementById('score-value').textContent = this.score;
  },

  bumpInventory(type) {
    if (type === 'fish') {
      this.fishCount++;
      document.getElementById('fish-count').textContent = this.fishCount;
    }
  },

  // 화면에서 위로 떠오르며 사라지는 텍스트
  showFloatingText(text, x, y, color = '#ffd966') {
    const container = document.getElementById('game-container');
    const el = document.createElement('div');
    el.className = 'float-text';
    el.textContent = text;
    el.style.color = color;
    el.style.left = (x - 30) + 'px';
    el.style.top = (y - 30) + 'px';
    container.appendChild(el);
    setTimeout(() => el.remove(), 1100);
  },

  openDex() {
    const grid = document.getElementById('dex-grid');
    grid.innerHTML = '';

    const groups = [
      { habitat: 'freshwater', label: '🪷 민물 물고기', color: '#74b9ff' },
      { habitat: 'sea',        label: '🌊 바다 물고기', color: '#3aa6e0' },
    ];

    for (const g of groups) {
      const heading = document.createElement('div');
      heading.className = 'dex-section-heading';
      heading.style.color = g.color;
      heading.textContent = g.label;
      grid.appendChild(heading);

      for (const sp of SPECIES.fish.filter(s => s.habitat === g.habitat)) {
        const count = Items.collected[sp.id] || 0;
        const cell = document.createElement('div');
        cell.className = 'dex-cell ' + (count > 0 ? 'found' : 'locked');
        const stars = sp.tier ? '★'.repeat(sp.tier) + '☆'.repeat(4 - sp.tier) : '';
        cell.innerHTML = `
          <span class="big-icon">${count > 0 ? sp.emoji : '❓'}</span>
          <strong>${count > 0 ? sp.name : '???'}</strong><br>
          ${count > 0 && stars ? `<span style="color:#f59e0b;font-size:11px">${stars}</span><br>` : ''}
          <span style="color:#888;font-size:10px">${count > 0 ? `${count}마리 · ${sp.score}점` : '미발견'}</span>
        `;
        grid.appendChild(cell);
      }
    }

    document.getElementById('dex-modal').classList.remove('hidden');
  },

  closeDex() {
    document.getElementById('dex-modal').classList.add('hidden');
  },
};
