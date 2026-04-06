import type { GameState, Board, Piece } from './types';
import { BOARD_SIZE, PIECE_COUNT, VISION } from './constants';

// Helper to get pixel color
function getPixel(data: Uint8ClampedArray, width: number, x: number, y: number) {
  const i = (y * width + x) * 4;
  return {
    r: data[i],
    g: data[i + 1],
    b: data[i + 2],
    a: data[i + 3]
  };
}

// Distance between colors
function colorDist(c1: {r:number, g:number, b:number}, c2: {r:number, g:number, b:number}) {
  return Math.abs(c1.r - c2.r) + Math.abs(c1.g - c2.g) + Math.abs(c1.b - c2.b);
}

export interface ImageDataLike {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

export function parseImageData(imgData: ImageDataLike): GameState {
  const data = imgData.data;
  const w = imgData.width;
  const h = imgData.height;

  let boardTop = -1;
  let boardBottom = -1;
  let boardLeft = -1;
  let boardRight = -1;

  // We look for a large dark rectangular area.
  // Using the left edge as a reference for the background color of each row
  // to cancel out any vertical gradient on the screen.
  let firstY = -1;

  for (let y = 0; y < h; y++) {
    const rowBgColor = getPixel(data, w, VISION.BACKGROUND_SAMPLE_X, y);
    let diffCount = 0;
    let firstX = -1;
    let lastX = -1;
    for (let x = 0; x < w; x++) {
      const c = getPixel(data, w, x, y);
      if (colorDist(c, rowBgColor) > VISION.COLOR_DIST_BACKGROUND) {
        diffCount++;
        if (firstX === -1) firstX = x;
        lastX = x;
      }
    }
    
    // The board usually spans most of the width
    if (diffCount > w * VISION.BOARD_WIDTH_RATIO) {
      if (firstY === -1) firstY = y;
      
      // Stop updating board bounds if we've moved significantly past the board
      // Assuming board height is roughly equal to its width.
      if (boardRight !== -1 && boardLeft !== -1) {
         const currentEstSize = boardRight - boardLeft;
         if (y > firstY + currentEstSize + 50) {
             break; // We've likely hit an ad or the pieces region
         }
      }

      if (boardLeft === -1 || firstX < boardLeft) boardLeft = firstX;
      if (boardRight === -1 || lastX > boardRight) boardRight = lastX;
    } else {
      // If we found the board and now the diffCount is very low, it might be the gap below the board
      if (firstY !== -1 && diffCount < w * VISION.BOARD_BOTTOM_GAP_RATIO) {
         const currentEstSize = boardRight - boardLeft;
         if (y > firstY + currentEstSize * 0.8) {
             // We've passed the bottom of the board
             break;
         }
      }
    }
  }

  // Refine board boundaries
  boardTop = firstY;
  const detectedWidth = boardRight - boardLeft;
  
  // Verify it's roughly a square
  const boardSize = detectedWidth;
  boardBottom = boardTop + boardSize;
  const cellSize = boardSize / BOARD_SIZE;

  // 2. Parse BOARD_SIZE x BOARD_SIZE Board
  const board: Board = [];
  
  // First, find the empty cell color by sampling all centers 
  // Empty cells are characterized by having the lowest color variance (saturation/colorful-ness).
  // We use a score that heavily penalizes variance, and slightly penalizes brightness.
  let minScore = Infinity;
  let emptyCellColor = { r: 0, g: 0, b: 0 };
  const cellCenters: {r: number, c: number, color: {r: number, g: number, b: number}}[] = [];

  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      const cx = Math.floor(boardLeft + col * cellSize + cellSize / 2);
      const cy = Math.floor(boardTop + row * cellSize + cellSize / 2);
      const color = getPixel(data, w, cx, cy);
      cellCenters.push({ r: row, c: col, color });
      
      const variance = Math.max(color.r, color.g, color.b) - Math.min(color.r, color.g, color.b);
      const brightness = color.r + color.g + color.b;
      const score = variance + brightness * 0.05;
      
      if (score < minScore) {
        minScore = score;
        emptyCellColor = color;
      }
    }
  }

  let i = 0;
  for (let row = 0; row < BOARD_SIZE; row++) {
    const boardRow: boolean[] = [];
    for (let col = 0; col < BOARD_SIZE; col++) {
      const color = cellCenters[i++].color;
      // If the color is significantly different from the background, it's filled
      const isFilled = colorDist(color, emptyCellColor) > VISION.COLOR_DIST_FILLED_BOARD;
      boardRow.push(isFilled);
    }
    board.push(boardRow);
  }

  // 3. Find pieces below the board
  // Scan from boardBottom + padding to bottom of screen (ignore bottom padding for watermarks/ads)
  const pieceRegionTop = boardBottom + Math.floor(h * VISION.PIECE_REGION_TOP_PADDING);
  const pieceRegionBottom = h - Math.floor(h * VISION.PIECE_REGION_BOTTOM_PADDING);
  const pieceSectionWidth = w / PIECE_COUNT;

  const pieceRects: {x: number, y: number, w: number, h: number}[] = [];

  for (let pIdx = 0; pIdx < PIECE_COUNT; pIdx++) {
    const secLeft = Math.floor(pIdx * pieceSectionWidth);
    const secRight = Math.floor((pIdx + 1) * pieceSectionWidth);
    
    // Find bounding box of non-background pixels in this section
    let pTop = -1, pBottom = -1, pLeft = -1, pRight = -1;
    let consecutiveEmptyRows = 0;
    for (let y = pieceRegionTop; y < pieceRegionBottom; y++) {
      const rowBgColor = getPixel(data, w, VISION.BACKGROUND_SAMPLE_X, y); // local background
      let foundPixel = false;
      for (let x = secLeft; x < secRight; x++) {
        const c = getPixel(data, w, x, y);
        // Compare to local background to avoid vertical gradient issues
        if (colorDist(c, rowBgColor) > VISION.COLOR_DIST_BACKGROUND) { 
          if (pTop === -1) pTop = y;
          pBottom = y;
          if (pLeft === -1 || x < pLeft) pLeft = x;
          if (pRight === -1 || x > pRight) pRight = x;
          foundPixel = true;
        }
      }
      if (pTop !== -1) {
        if (!foundPixel) consecutiveEmptyRows++;
        else consecutiveEmptyRows = 0;
        
        // If we've seen a piece and now there's a large gap (e.g., > 2% pixels), stop.
        // This avoids merging with ads/dock at the bottom of the screen.
        if (consecutiveEmptyRows > h * VISION.PIECE_GAP_RATIO) { 
          break;
        }
      }
    }

    if (pTop !== -1) {
      pieceRects.push({ x: pLeft, y: pTop, w: pRight - pLeft, h: pBottom - pTop });
    }
  }

  // Optimize block size based on all piece dimensions
  const minBs = cellSize * VISION.PIECE_BLOCK_MIN_RATIO;
  const maxBs = cellSize * VISION.PIECE_BLOCK_MAX_RATIO;
  let bestBs = cellSize * VISION.PIECE_BLOCK_FALLBACK_RATIO; // fallback
  let minError = Infinity;

  for (let bs = minBs; bs <= maxBs; bs += 0.5) {
    let err = 0;
    for (const rect of pieceRects) {
      const cols = Math.max(1, Math.round(rect.w / bs));
      const rows = Math.max(1, Math.round(rect.h / bs));
      err += Math.abs(rect.w - cols * bs) + Math.abs(rect.h - rows * bs);
    }
    if (err < minError) {
      minError = err;
      bestBs = bs;
    }
  }

  const pieces: Piece[] = [];
  for (const rect of pieceRects) {
    let cols = Math.max(1, Math.round(rect.w / bestBs));
    let rows = Math.max(1, Math.round(rect.h / bestBs));
    
    // In rare cases due to float errors or weird pieces, constrain max dimensions
    if (cols > VISION.PIECE_MAX_DIMENSION) cols = VISION.PIECE_MAX_DIMENSION;
    if (rows > VISION.PIECE_MAX_DIMENSION) rows = VISION.PIECE_MAX_DIMENSION;
    
    const bsX = rect.w / cols;
    const bsY = rect.h / rows;
    
    const piece: Piece = [];
    for (let r = 0; r < rows; r++) {
      const pieceRow: boolean[] = [];
      for (let c = 0; c < cols; c++) {
        let maxDist = 0;
        // Check a few points near the center to be robust against flat colors
        for (let dy = -0.25; dy <= 0.25; dy += 0.25) {
          for (let dx = -0.25; dx <= 0.25; dx += 0.25) {
            const cx = Math.floor(rect.x + c * bsX + bsX / 2 + dx * bsX);
            const cy = Math.floor(rect.y + r * bsY + bsY / 2 + dy * bsY);
            const color = getPixel(data, w, cx, cy);
            const rowBgColor = getPixel(data, w, VISION.BACKGROUND_SAMPLE_X, cy);
            const dist = colorDist(color, rowBgColor);
            if (dist > maxDist) maxDist = dist;
          }
        }
        const isFilled = maxDist > VISION.COLOR_DIST_FILLED_PIECE;
        pieceRow.push(isFilled);
      }
      piece.push(pieceRow);
    }
    pieces.push(piece);
  }

  return {
    board,
    pieces,
    boardRect: { x: boardLeft, y: boardTop, w: boardSize, h: boardSize },
    pieceRects
  };
}