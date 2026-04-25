/**
 * 게임 전역 설정
 * 향후 난이도/맵 크기/속도 등을 한곳에서 조정할 수 있도록 분리
 */
const CONFIG = {
  // 화면
  CANVAS_WIDTH: 800,
  CANVAS_HEIGHT: 600,

  // 타일
  TILE_SIZE: 40,
  MAP_COLS: 30,    // 맵 가로 타일 수 (1200px)
  MAP_ROWS: 22,    // 맵 세로 타일 수 (880px)

  // 플레이어
  PLAYER_SPEED: 3,              // px/frame
  PLAYER_INTERACT_RANGE: 50,    // 채집 가능 거리(px)

  // 아이템 스폰
  MAX_FISH: 14,
  RESPAWN_INTERVAL_MS: 5000,    // 물고기가 재생성되는 주기

  // 타임어택
  GAME_TIME_SEC: 60,

  // 디버그
  DEBUG: false,
};

// 타일 종류 enum
const TILE = {
  GRASS: 0,
  PATH: 1,
  WATER: 2,
  SAND: 3,
  TREE: 4,
  STONE: 5,
  FENCE: 6,   // 맵 외곽 울타리 (통과 불가)
};
