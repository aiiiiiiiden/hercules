/**
 * A* 길찾기 (8방향, 코너 컷 방지)
 *
 * 사용:
 *   const path = Pathfinding.find(startCol, startRow, endCol, endRow);            // 도보 (기본)
 *   const path = Pathfinding.find(startCol, startRow, endCol, endRow, 'water');   // 보트 (바다 전용)
 *   path = [{c, r}, ...]  또는  null (도달 불가)
 *
 * mode:
 *   'land'  (기본) — 물/나무/울타리 차단. 도보·사자 추적용.
 *   'water'         — 물 타일만 통과. 보트 항행용.
 */
const Pathfinding = {
  // 휴리스틱 (octile distance) - 8방향 이동에 적합
  _h(c, r, ec, er) {
    const dx = Math.abs(c - ec);
    const dy = Math.abs(r - er);
    return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy);
  },

  _walkable(c, r, mode) {
    if (c < 0 || c >= World.cols || r < 0 || r >= World.rows) return false;
    const t = World.map[r][c];
    if (mode === 'water') return t === TILE.WATER;
    return t !== TILE.WATER && t !== TILE.TREE && t !== TILE.FENCE;
  },

  // 도달 불가능한 타일이면 가장 가까운 통과 가능 타일 찾기
  _nearestWalkable(c, r, mode) {
    if (this._walkable(c, r, mode)) return { c, r };
    for (let radius = 1; radius <= 6; radius++) {
      for (let dr = -radius; dr <= radius; dr++) {
        for (let dc = -radius; dc <= radius; dc++) {
          if (Math.abs(dr) !== radius && Math.abs(dc) !== radius) continue;
          const nc = c + dc, nr = r + dr;
          if (this._walkable(nc, nr, mode)) return { c: nc, r: nr };
        }
      }
    }
    return null;
  },

  find(startC, startR, endC, endR, mode = 'land') {
    const start = this._nearestWalkable(startC, startR, mode);
    const end = this._nearestWalkable(endC, endR, mode);
    if (!start || !end) return null;
    if (start.c === end.c && start.r === end.r) return [{ c: start.c, r: start.r }];

    // 8방향 + 코스트
    const dirs = [
      [ 1,  0, 1], [-1,  0, 1], [ 0,  1, 1], [ 0, -1, 1],
      [ 1,  1, Math.SQRT2], [-1,  1, Math.SQRT2],
      [ 1, -1, Math.SQRT2], [-1, -1, Math.SQRT2],
    ];

    const open = new Map();    // key -> node
    const closed = new Set();
    const key = (c, r) => c * 1000 + r;

    const startNode = {
      c: start.c, r: start.r,
      g: 0, h: this._h(start.c, start.r, end.c, end.r),
      parent: null,
    };
    startNode.f = startNode.g + startNode.h;
    open.set(key(start.c, start.r), startNode);

    let iterations = 0;
    const MAX_ITERATIONS = 4000;

    while (open.size > 0) {
      if (++iterations > MAX_ITERATIONS) return null;

      // 가장 낮은 f 값 노드 선택 (Map 선형 스캔 - 작은 그리드라 충분)
      let curr = null, currKey = null;
      for (const [k, n] of open) {
        if (!curr || n.f < curr.f || (n.f === curr.f && n.h < curr.h)) {
          curr = n;
          currKey = k;
        }
      }

      // 도착!
      if (curr.c === end.c && curr.r === end.r) {
        const path = [];
        let n = curr;
        while (n) {
          path.unshift({ c: n.c, r: n.r });
          n = n.parent;
        }
        return path;
      }

      open.delete(currKey);
      closed.add(currKey);

      for (const [dc, dr, cost] of dirs) {
        const nc = curr.c + dc;
        const nr = curr.r + dr;
        if (!this._walkable(nc, nr, mode)) continue;

        // 코너 컷 방지: 대각선 이동 시 양쪽 직교 타일이 모두 통과 가능해야 함
        if (dc !== 0 && dr !== 0) {
          if (!this._walkable(curr.c + dc, curr.r, mode)) continue;
          if (!this._walkable(curr.c, curr.r + dr, mode)) continue;
        }

        const nk = key(nc, nr);
        if (closed.has(nk)) continue;

        const g = curr.g + cost;
        const existing = open.get(nk);
        if (existing && existing.g <= g) continue;

        const node = {
          c: nc, r: nr,
          g, h: this._h(nc, nr, end.c, end.r),
          parent: curr,
        };
        node.f = node.g + node.h;
        open.set(nk, node);
      }
    }

    return null;
  },
};
