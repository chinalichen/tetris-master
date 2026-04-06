export type Board = boolean[][]; // [BOARD_SIZE][BOARD_SIZE] matrix
export type Piece = boolean[][]; // 2D matrix of shape

export interface GameState {
  board: Board;
  pieces: Piece[];
  boardRect: { x: number; y: number; w: number; h: number };
  pieceRects: { x: number; y: number; w: number; h: number }[];
}

export interface Placement {
  pieceIndex: number;
  x: number; // board column
  y: number; // board row
}

export interface Solution {
  placements: Placement[];
  score: number;
}