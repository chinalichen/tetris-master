import type { Board, Piece } from './types';
import { BOARD_SIZE } from './constants';

export function cloneBoard(board: Board): Board {
  return board.map((row) => [...row]);
}

export function canPlace(board: Board, piece: Piece, x: number, y: number): boolean {
  for (let r = 0; r < piece.length; r++) {
    for (let c = 0; c < piece[r].length; c++) {
      if (piece[r][c]) {
        const br = y + r;
        const bc = x + c;
        if (br < 0 || br >= BOARD_SIZE || bc < 0 || bc >= BOARD_SIZE) return false;
        if (board[br][bc]) return false;
      }
    }
  }
  return true;
}

export function placePiece(board: Board, piece: Piece, x: number, y: number): Board {
  const newBoard = cloneBoard(board);
  for (let r = 0; r < piece.length; r++) {
    for (let c = 0; c < piece[r].length; c++) {
      if (piece[r][c]) {
        newBoard[y + r][x + c] = true;
      }
    }
  }
  return newBoard;
}

export function clearLines(board: Board): { newBoard: Board, linesCleared: number } {
  const newBoard = cloneBoard(board);
  const rowsToClear = new Set<number>();
  const colsToClear = new Set<number>();

  for (let r = 0; r < BOARD_SIZE; r++) {
    if (newBoard[r].every((cell) => cell)) {
      rowsToClear.add(r);
    }
  }

  for (let c = 0; c < BOARD_SIZE; c++) {
    let full = true;
    for (let r = 0; r < BOARD_SIZE; r++) {
      if (!newBoard[r][c]) {
        full = false;
        break;
      }
    }
    if (full) colsToClear.add(c);
  }

  rowsToClear.forEach((r) => {
    for (let c = 0; c < BOARD_SIZE; c++) newBoard[r][c] = false;
  });

  colsToClear.forEach((c) => {
    for (let r = 0; r < BOARD_SIZE; r++) newBoard[r][c] = false;
  });

  return { newBoard, linesCleared: rowsToClear.size + colsToClear.size };
}
