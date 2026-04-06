import type { Board, Piece, Placement, Solution } from './types';
import { canPlace, placePiece, clearLines } from './engine';
import { BOARD_SIZE, SCORING } from './constants';

function getPermutations(arr: number[]): number[][] {
  if (arr.length <= 1) return [arr];
  const perms: number[][] = [];
  for (let i = 0; i < arr.length; i++) {
    const rest = getPermutations(arr.slice(0, i).concat(arr.slice(i + 1)));
    for (const p of rest) {
      perms.push([arr[i], ...p]);
    }
  }
  return perms;
}

function evaluateBoard(board: Board): number {
  let score = 0;
  let emptyCount = 0;
  let holes = 0;

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (!board[r][c]) {
        emptyCount++;
        // Check for holes (surrounded by blocks or walls)
        let blockedSides = 0;
        if (r === 0 || board[r - 1][c]) blockedSides++;
        if (r === BOARD_SIZE - 1 || board[r + 1][c]) blockedSides++;
        if (c === 0 || board[r][c - 1]) blockedSides++;
        if (c === BOARD_SIZE - 1 || board[r][c + 1]) blockedSides++;
        
        if (blockedSides === 4) holes += SCORING.HOLE_4_SIDES;
        else if (blockedSides === 3) holes += SCORING.HOLE_3_SIDES;
      }
    }
  }

  score += emptyCount * SCORING.EMPTY_CELL;
  score -= holes * SCORING.HOLE;

  return score;
}

export function solve(board: Board, pieces: Piece[]): Solution | null {
  const pieceIndices = pieces.map((_, i) => i);
  const permutations = getPermutations(pieceIndices);
  
  let bestSolution: Solution | null = null;
  let maxScore = -Infinity;

  for (const perm of permutations) {
    // DFS for this permutation
    const dfs = (
      currentBoard: Board,
      depth: number,
      currentPlacements: Placement[],
      totalLinesCleared: number
    ) => {
      if (depth === pieces.length) {
        const score = evaluateBoard(currentBoard) + totalLinesCleared * SCORING.LINE_CLEARED;
        if (score > maxScore) {
          maxScore = score;
          bestSolution = {
            placements: [...currentPlacements],
            score
          };
        }
        return;
      }

      const pieceIndex = perm[depth];
      const piece = pieces[pieceIndex];

      for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
          if (canPlace(currentBoard, piece, c, r)) {
            const nextBoard = placePiece(currentBoard, piece, c, r);
            const { newBoard: clearedBoard, linesCleared } = clearLines(nextBoard);
            
            currentPlacements.push({ pieceIndex, x: c, y: r });
            dfs(clearedBoard, depth + 1, currentPlacements, totalLinesCleared + linesCleared);
            currentPlacements.pop();
          }
        }
      }
      
      // If we couldn't place the piece, we still need to evaluate this branch if we want partial solutions
      // But the rules usually say you lose if you can't place all 3. 
      // We will just not continue the DFS.
    };

    dfs(board, 0, [], 0);
  }

  return bestSolution;
}