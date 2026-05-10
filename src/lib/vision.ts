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

/**
 * Find board region using square constraint + screen width coverage.
 * 
 * Strategy:
 * 1. Scan all rows for "active" content (non-background pixels)
 * 2. Find contiguous clusters of active rows
 * 3. For each cluster, compute width coverage
 * 4. Pick the cluster that: spans most of screen width AND is square-ish
 *    (board is square → width ≈ height in pixels)
 */
export function parseImageData(imgData: ImageDataLike): GameState {
  const data = imgData.data;
  const w = imgData.width;
  const h = imgData.height;

  const bgSampleX = VISION.BACKGROUND_SAMPLE_X;

  // ── Step 1: Score each row for "board-ness" ──
  const rowScores: number[] = new Array(h);
  for (let y = 0; y < h; y++) {
    const rowBg = getPixel(data, w, bgSampleX, y);
    let diffCount = 0;
    for (let x = 0; x < w; x++) {
      if (colorDist(getPixel(data, w, x, y), rowBg) > VISION.COLOR_DIST_BACKGROUND) {
        diffCount++;
      }
    }
    rowScores[y] = diffCount;
  }

  // ── Step 2: Find active rows and group into contiguous clusters ──
  // Lower threshold to catch board rows even with some UI interference
  const activeThreshold = w * 0.5;
  const isRowActive = new Array(h).fill(false);
  for (let y = 0; y < h; y++) {
    isRowActive[y] = rowScores[y] > activeThreshold;
  }

  // Group contiguous active rows into clusters, also track left/right bounds
  interface Cluster {
    top: number;
    bottom: number;
    height: number;
    totalScore: number;
    left: number;
    right: number;
    width: number;
  }
  const clusters: Cluster[] = [];
  let cTop = -1;
  let cScore = 0;
  
  for (let y = 0; y < h; y++) {
    if (isRowActive[y]) {
      if (cTop === -1) cTop = y;
      cScore += rowScores[y];
    } else if (cTop !== -1) {
      // Compute left/right bounds for this cluster
      let cLeft = w;
      let cRight = 0;
      for (let yy = cTop; yy <= (y - 1); yy++) {
        const rowBg = getPixel(data, w, bgSampleX, yy);
        for (let x = 0; x < w; x++) {
          if (colorDist(getPixel(data, w, x, yy), rowBg) > VISION.COLOR_DIST_BACKGROUND) {
            if (x < cLeft) cLeft = x;
            if (x > cRight) cRight = x;
          }
        }
      }
      
      clusters.push({
        top: cTop,
        bottom: y - 1,
        height: y - cTop,
        totalScore: cScore,
        left: cLeft,
        right: cRight,
        width: cRight - cLeft
      });
      cTop = -1;
      cScore = 0;
    }
  }
  if (cTop !== -1) {
    let cLeft = w;
    let cRight = 0;
    for (let yy = cTop; yy < h; yy++) {
      const rowBg = getPixel(data, w, bgSampleX, yy);
      for (let x = 0; x < w; x++) {
        if (colorDist(getPixel(data, w, x, yy), rowBg) > VISION.COLOR_DIST_BACKGROUND) {
          if (x < cLeft) cLeft = x;
          if (x > cRight) cRight = x;
        }
      }
    }
    
    clusters.push({
      top: cTop,
      bottom: h - 1,
      height: h - cTop,
      totalScore: cScore,
      left: cLeft,
      right: cRight,
      width: cRight - cLeft
    });
  }

  // ── Step 3: Pick the best cluster using square + width constraints ──
  // The board is SQUARE: width ≈ height in pixels
  // The board spans MOST of screen width: > 75% of w
  let bestCluster: Cluster | null = null;
  let bestScore = -Infinity;
  
  for (const c of clusters) {
    if (c.height < 50 || c.width < 100) continue; // Skip tiny clusters
    
    let score = 0;
    
    // Criterion 1: Width coverage (board spans most of screen width)
    const widthCoverage = c.width / w;
    if (widthCoverage > 0.75) {
      score += 200000 * widthCoverage; // Strong bonus for wide coverage
    } else {
      score -= 100000; // Penalty for narrow clusters (likely pieces)
    }
    
    // Criterion 2: Aspect ratio near 1.0 (square)
    const aspectRatio = c.width / c.height;
    if (aspectRatio > 0.7 && aspectRatio < 1.3) {
      score += 150000; // Strong bonus for square-ish
    } else if (aspectRatio > 0.5 && aspectRatio < 1.5) {
      score += 50000;  // Moderate bonus
    } else {
      score -= 50000;  // Penalty for non-square
    }
    
    // Criterion 3: Prefer taller clusters (board is usually the largest active region)
    score += c.height * 100;
    
    if (score > bestScore) {
      bestScore = score;
      bestCluster = c;
    }
  }

  // Fallback: pick the widest cluster with most square-like aspect ratio
  if (!bestCluster) {
    let widestSquare: Cluster | null = null;
    let widestSquareScore = -Infinity;
    for (const c of clusters) {
      if (c.height < 50 || c.width < 100) continue;
      const aspectRatio = c.width / c.height;
      // Score how square the cluster is (1.0 = perfect square)
      const squareScore = -Math.abs(aspectRatio - 1.0);
      if (squareScore > widestSquareScore) {
        widestSquareScore = squareScore;
        widestSquare = c;
      }
    }
    bestCluster = widestSquare;
  }

  // Final fallback: pick the widest cluster
  if (!bestCluster) {
    bestCluster = clusters.reduce((best, c) => c.width > best.width ? c : best, clusters[0]);
  }

  const boardTop = bestCluster!.top;
  const boardBottom = bestCluster!.bottom;
  let boardLeft = bestCluster!.left;
  let boardRight = bestCluster!.right;

  // ── Step 4: Refine left/right bounds within the cluster ──
  for (let y = boardTop; y <= boardBottom; y++) {
    const rowBg = getPixel(data, w, bgSampleX, y);
    for (let x = 0; x < w; x++) {
      if (colorDist(getPixel(data, w, x, y), rowBg) > VISION.COLOR_DIST_BACKGROUND) {
        if (x < boardLeft) boardLeft = x;
        if (x > boardRight) boardRight = x;
      }
    }
  }

  let detectedWidth = boardRight - boardLeft;
  const detectedHeight = boardBottom - boardTop;

  // ── Step 5: Aspect ratio validation ──
  const aspectRatio = detectedWidth / Math.max(1, detectedHeight);
  
  // If aspect ratio is way off, use square constraint to fix
  if (aspectRatio < 0.7 || aspectRatio > 1.3) {
    const centerX = Math.floor((boardLeft + boardRight) / 2);
    const boardSize = Math.max(detectedHeight, detectedWidth);
    
    const newLeft = Math.max(0, centerX - Math.floor(boardSize / 2));
    const newRight = Math.min(w, centerX + Math.floor(boardSize / 2));
    
    // Refine from edges
    let refinedLeft = newLeft;
    let refinedRight = newRight;
    for (let y = boardTop; y <= boardBottom && y < h; y++) {
      const rowBg = getPixel(data, w, bgSampleX, y);
      for (let x = newLeft; x < newRight; x++) {
        if (colorDist(getPixel(data, w, x, y), rowBg) > VISION.COLOR_DIST_BACKGROUND) {
          refinedLeft = Math.min(refinedLeft, x);
          refinedRight = Math.max(refinedRight, x + 1);
        }
      }
    }
    
    boardLeft = refinedLeft;
    boardRight = refinedRight;
    detectedWidth = boardRight - boardLeft;
  }

  const boardSize = detectedWidth;

  // ── Step 6: Parse board ──
  const cellSize = boardSize / BOARD_SIZE;
  const board: Board = [];
  
  // Find empty cell color by sampling centers (lowest variance + brightness)
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
      const isFilled = colorDist(color, emptyCellColor) > VISION.COLOR_DIST_FILLED_BOARD;
      boardRow.push(isFilled);
    }
    board.push(boardRow);
  }

  // ── Step 7: Find pieces ──
  const pieceRegionTop = boardBottom + Math.floor(h * VISION.PIECE_REGION_TOP_PADDING);
  const pieceRegionBottom = h - Math.floor(h * VISION.PIECE_REGION_BOTTOM_PADDING);
  const pieceSectionWidth = w / PIECE_COUNT;

  const pieceRects: {x: number, y: number, w: number, h: number}[] = [];

  for (let pIdx = 0; pIdx < PIECE_COUNT; pIdx++) {
    const secLeft = Math.floor(pIdx * pieceSectionWidth);
    const secRight = Math.floor((pIdx + 1) * pieceSectionWidth);
    
    let pTop = -1, pBottom = -1, pLeft = -1, pRight = -1;
    let consecutiveEmptyRows = 0;
    for (let y = pieceRegionTop; y < pieceRegionBottom; y++) {
      const rowBgColor = getPixel(data, w, bgSampleX, y);
      let foundPixel = false;
      for (let x = secLeft; x < secRight; x++) {
        const c = getPixel(data, w, x, y);
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
        
        if (consecutiveEmptyRows > h * VISION.PIECE_GAP_RATIO) { 
          break;
        }
      }
    }

    if (pTop !== -1) {
      pieceRects.push({ x: pLeft, y: pTop, w: pRight - pLeft, h: pBottom - pTop });
    }
  }

  // ── Step 8: Optimize block size ──
  const minBs = cellSize * VISION.PIECE_BLOCK_MIN_RATIO;
  const maxBs = cellSize * VISION.PIECE_BLOCK_MAX_RATIO;
  let bestBs = cellSize * VISION.PIECE_BLOCK_FALLBACK_RATIO;
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
    
    if (cols > VISION.PIECE_MAX_DIMENSION) cols = VISION.PIECE_MAX_DIMENSION;
    if (rows > VISION.PIECE_MAX_DIMENSION) rows = VISION.PIECE_MAX_DIMENSION;
    
    const bsX = rect.w / cols;
    const bsY = rect.h / rows;
    
    const piece: Piece = [];
    for (let r = 0; r < rows; r++) {
      const pieceRow: boolean[] = [];
      for (let c = 0; c < cols; c++) {
        let maxDist = 0;
        for (let dy = -0.25; dy <= 0.25; dy += 0.25) {
          for (let dx = -0.25; dx <= 0.25; dx += 0.25) {
            const cx = Math.floor(rect.x + c * bsX + bsX / 2 + dx * bsX);
            const cy = Math.floor(rect.y + r * bsY + bsY / 2 + dy * bsY);
            const color = getPixel(data, w, cx, cy);
            const rowBgColor = getPixel(data, w, bgSampleX, cy);
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
