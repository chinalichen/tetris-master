export const BOARD_SIZE = 8;
export const PIECE_COUNT = 3;

// Solver Heuristic Weights
export const SCORING = {
  EMPTY_CELL: 10,
  HOLE: 50,
  LINE_CLEARED: 100,
  HOLE_4_SIDES: 3,
  HOLE_3_SIDES: 1,
} as const;

// Vision Thresholds
export const VISION = {
  // Screen/Board ratios
  BOARD_WIDTH_RATIO: 0.6,
  BOARD_BOTTOM_GAP_RATIO: 0.2,
  PIECE_REGION_TOP_PADDING: 0.05,
  PIECE_REGION_BOTTOM_PADDING: 0.1,
  PIECE_GAP_RATIO: 0.02,
  
  // Piece block size heuristics
  PIECE_BLOCK_MIN_RATIO: 0.45,
  PIECE_BLOCK_MAX_RATIO: 0.65,
  PIECE_BLOCK_FALLBACK_RATIO: 0.5,
  PIECE_MAX_DIMENSION: 5,
  
  // Color thresholds
  COLOR_DIST_BACKGROUND: 40,
  COLOR_DIST_FILLED_BOARD: 20,
  COLOR_DIST_FILLED_PIECE: 25,
  
  // Pixel coordinates
  BACKGROUND_SAMPLE_X: 5,
} as const;
