import React, { useState, useRef, useCallback } from 'react';
import type { GameState, Board, Piece } from '../lib/types';
import { BOARD_SIZE, PIECE_COUNT } from '../lib/constants';

interface EditorProps {
  imageUrl: string;
  initialState: GameState;
  onSave: (state: GameState) => void;
}

export default function GameStateEditor({ imageUrl, initialState, onSave }: EditorProps) {
  const [board, setBoard] = useState<Board>(initialState.board.map(row => [...row]));
  const [pieces, setPieces] = useState<Piece[]>(initialState.pieces.map(p => p.map(row => [...row])));
  const [selectedPiece, setSelectedPiece] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<'board' | 'pieces'>('board');
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const toggleBoardCell = useCallback((row: number, col: number) => {
    setBoard(prev => {
      const next = prev.map(r => [...r]);
      next[row][col] = !next[row][col];
      return next;
    });
  }, []);

  const togglePieceCell = useCallback((pieceIdx: number, row: number, col: number) => {
    setPieces(prev => {
      const next = prev.map((p, i) => 
        i === pieceIdx ? p.map(r => [...r]) : p
      );
      next[pieceIdx][row][col] = !next[pieceIdx][row][col];
      return next;
    });
  }, []);

  const addPieceRow = useCallback((pieceIdx: number) => {
    setPieces(prev => {
      const next = prev.map((p, i) => i === pieceIdx ? p.map(r => [...r]) : p);
      const cols = next[pieceIdx][0]?.length || 1;
      next[pieceIdx].push(new Array(cols).fill(false));
      return next;
    });
  }, []);

  const removePieceRow = useCallback((pieceIdx: number) => {
    setPieces(prev => {
      const next = prev.map((p, i) => i === pieceIdx ? p.map(r => [...r]) : p);
      if (next[pieceIdx].length > 1) {
        next[pieceIdx].pop();
      }
      return next;
    });
  }, []);

  const addPieceCol = useCallback((pieceIdx: number) => {
    setPieces(prev => {
      const next = prev.map((p, i) => i === pieceIdx ? p.map(r => [...r]) : p);
      next[pieceIdx] = next[pieceIdx].map(row => [...row, false]);
      return next;
    });
  }, []);

  const removePieceCol = useCallback((pieceIdx: number) => {
    setPieces(prev => {
      const next = prev.map((p, i) => i === pieceIdx ? p.map(r => [...r]) : p);
      if (next[pieceIdx][0]?.length > 1) {
        next[pieceIdx] = next[pieceIdx].map(row => row.slice(0, -1));
      }
      return next;
    });
  }, []);

  const handleSave = useCallback(() => {
    onSave({
      board,
      pieces,
      boardRect: initialState.boardRect,
      pieceRects: initialState.pieceRects,
    });
  }, [board, pieces, initialState, onSave]);

  const clearBoard = useCallback(() => {
    setBoard(Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(false)));
  }, []);

  const fillBoard = useCallback(() => {
    setBoard(Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(true)));
  }, []);

  return (
    <div className="flex flex-col gap-4 p-4 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold">游戏状态编辑器</h1>
      
      {/* Image Preview */}
      <div className="border rounded-lg p-4 bg-gray-50">
        <h2 className="text-lg font-semibold mb-2">截图预览</h2>
        <img 
          src={imageUrl} 
          alt="Game screenshot" 
          className="max-h-96 object-contain border"
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab('board')}
          className={`px-4 py-2 rounded-lg font-medium ${
            activeTab === 'board' 
              ? 'bg-blue-500 text-white' 
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          编辑棋盘 (8x8)
        </button>
        <button
          onClick={() => setActiveTab('pieces')}
          className={`px-4 py-2 rounded-lg font-medium ${
            activeTab === 'pieces' 
              ? 'bg-blue-500 text-white' 
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          编辑形状 ({PIECE_COUNT}个)
        </button>
      </div>

      {/* Board Editor */}
      {activeTab === 'board' && (
        <div className="border rounded-lg p-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">棋盘状态</h2>
            <div className="flex gap-2">
              <button onClick={clearBoard} className="px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200">
                清空
              </button>
              <button onClick={fillBoard} className="px-3 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200">
                填满
              </button>
            </div>
          </div>
          <div className="inline-block border-2 border-gray-800">
            {board.map((row, r) => (
              <div key={r} className="flex">
                {row.map((cell, c) => (
                  <button
                    key={c}
                    onClick={() => toggleBoardCell(r, c)}
                    className={`w-10 h-10 border border-gray-300 transition-colors ${
                      cell ? 'bg-blue-500 hover:bg-blue-600' : 'bg-white hover:bg-gray-100'
                    }`}
                    title={`Row ${r}, Col ${c}`}
                  />
                ))}
              </div>
            ))}
          </div>
          <p className="text-sm text-gray-500 mt-2">
            点击格子切换填充/空白状态。蓝色表示已填充。
          </p>
        </div>
      )}

      {/* Pieces Editor */}
      {activeTab === 'pieces' && (
        <div className="border rounded-lg p-4">
          <h2 className="text-lg font-semibold mb-4">形状编辑</h2>
          
          {/* Piece Selector */}
          <div className="flex gap-2 mb-4">
            {pieces.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setSelectedPiece(idx)}
                className={`px-4 py-2 rounded-lg font-medium ${
                  selectedPiece === idx 
                    ? 'bg-purple-500 text-white' 
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                形状 {idx + 1}
              </button>
            ))}
          </div>

          {/* Selected Piece Editor */}
          <div className="border rounded p-4 bg-gray-50">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-medium">形状 {selectedPiece + 1}</h3>
              <div className="flex gap-2">
                <button 
                  onClick={() => removePieceRow(selectedPiece)}
                  className="px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 text-sm"
                  disabled={pieces[selectedPiece].length <= 1}
                >
                  -行
                </button>
                <button 
                  onClick={() => addPieceRow(selectedPiece)}
                  className="px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200 text-sm"
                  disabled={pieces[selectedPiece].length >= 5}
                >
                  +行
                </button>
                <button 
                  onClick={() => removePieceCol(selectedPiece)}
                  className="px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 text-sm"
                  disabled={pieces[selectedPiece][0]?.length <= 1}
                >
                  -列
                </button>
                <button 
                  onClick={() => addPieceCol(selectedPiece)}
                  className="px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200 text-sm"
                  disabled={pieces[selectedPiece][0]?.length >= 5}
                >
                  +列
                </button>
              </div>
            </div>

            <div className="inline-block border-2 border-gray-800">
              {pieces[selectedPiece].map((row, r) => (
                <div key={r} className="flex">
                  {row.map((cell, c) => (
                    <button
                      key={c}
                      onClick={() => togglePieceCell(selectedPiece, r, c)}
                      className={`w-12 h-12 border border-gray-300 transition-colors ${
                        cell ? 'bg-purple-500 hover:bg-purple-600' : 'bg-white hover:bg-gray-100'
                      }`}
                      title={`Row ${r}, Col ${c}`}
                    />
                  ))}
                </div>
              ))}
            </div>
            <p className="text-sm text-gray-500 mt-2">
              点击格子切换填充/空白状态。紫色表示已填充。最大5x5。
            </p>
          </div>
        </div>
      )}

      {/* JSON Preview */}
      <div className="border rounded-lg p-4">
        <h2 className="text-lg font-semibold mb-2">JSON 预览</h2>
        <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-auto max-h-64 text-sm">
          {JSON.stringify({
            board,
            pieces,
            boardRect: initialState.boardRect,
            pieceRects: initialState.pieceRects,
          }, null, 2)}
        </pre>
      </div>

      {/* Save Button */}
      <button
        onClick={handleSave}
        className="px-6 py-3 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600 transition-colors"
      >
        保存当前状态为 JSON
      </button>
    </div>
  );
}
