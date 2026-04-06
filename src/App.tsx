import React, { useState, useRef, useEffect, useCallback } from 'react';
import { UploadCloud, CheckCircle2, AlertCircle } from 'lucide-react';
import { parseImageData } from './lib/vision';
import { solve } from './lib/solver';
import type { GameState, Solution } from './lib/types';

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [, setGameState] = useState<GameState | null>(null);
  const [solution, setSolution] = useState<Solution | null>(null);
  const [status, setStatus] = useState<string>('Waiting for image paste or upload...');
  const [isProcessing, setIsProcessing] = useState(false);

  const drawOverlay = useCallback((img: HTMLImageElement, state: GameState, sol: Solution | null) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    
    // Redraw image
    ctx.drawImage(img, 0, 0);
    
    // Draw board debug
    ctx.strokeStyle = 'rgba(0, 255, 0, 0.5)';
    ctx.lineWidth = 2;
    ctx.strokeRect(state.boardRect.x, state.boardRect.y, state.boardRect.w, state.boardRect.h);
    
    const cellSize = state.boardRect.w / 8;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (state.board[r][c]) {
          ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
          ctx.fillRect(state.boardRect.x + c * cellSize, state.boardRect.y + r * cellSize, cellSize, cellSize);
        }
      }
    }
    
    state.pieces.forEach((piece, i) => {
      const rect = state.pieceRects[i];
      ctx.strokeStyle = 'rgba(0, 0, 255, 0.5)';
      ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
      
      const rows = piece.length;
      const cols = piece[0]?.length || 1;
      const bsX = rect.w / cols;
      const bsY = rect.h / rows;
      
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (piece[r][c]) {
            ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
            ctx.fillRect(rect.x + c * bsX, rect.y + r * bsY, bsX, bsY);
            ctx.strokeRect(rect.x + c * bsX, rect.y + r * bsY, bsX, bsY);
          }
        }
      }
    });

    // Draw Solution
    if (sol) {
      sol.placements.forEach((placement, i) => {
        const piece = state.pieces[placement.pieceIndex];
        const color = i === 0 ? 'rgba(0, 255, 0, 0.6)' : i === 1 ? 'rgba(255, 255, 0, 0.6)' : 'rgba(0, 255, 255, 0.6)';
        const textCol = i === 0 ? '#0f0' : i === 1 ? '#ff0' : '#0ff';
        
        ctx.fillStyle = color;
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        
        // Calculate center for number label
        let totalX = 0, totalY = 0, count = 0;
        
        for (let r = 0; r < piece.length; r++) {
          for (let c = 0; c < piece[r].length; c++) {
            if (piece[r][c]) {
              const bx = state.boardRect.x + (placement.x + c) * cellSize;
              const by = state.boardRect.y + (placement.y + r) * cellSize;
              ctx.fillRect(bx, by, cellSize, cellSize);
              ctx.strokeRect(bx, by, cellSize, cellSize);
              
              totalX += bx + cellSize / 2;
              totalY += by + cellSize / 2;
              count++;
            }
          }
        }
        
        // Draw step number
        if (count > 0) {
          ctx.fillStyle = textCol;
          ctx.font = 'bold 48px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.shadowColor = '#000';
          ctx.shadowBlur = 4;
          ctx.fillText((i + 1).toString(), totalX / count, totalY / count);
          ctx.shadowBlur = 0;
        }
      });
    }
  }, []);

const processImage = useCallback(async (img: HTMLImageElement) => {
    setIsProcessing(true);
    setStatus('Analyzing image...');
    
    // Slight delay to allow UI to update
    await new Promise((r) => setTimeout(r, 50));
    
    try {
      let imgData;
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d')!;
        canvasRef.current.width = img.width;
        canvasRef.current.height = img.height;
        ctx.drawImage(img, 0, 0);
        imgData = ctx.getImageData(0, 0, img.width, img.height);
      } else {
        throw new Error('Canvas not initialized');
      }

      const state = parseImageData(imgData);
      setGameState(state);
      setStatus('Solving...');

      await new Promise((r) => setTimeout(r, 50));
      
      const start = performance.now();
      const sol = solve(state.board, state.pieces);
      const end = performance.now();
      
      if (sol) {
        setSolution(sol);
        setStatus(`Solved in ${Math.round(end - start)}ms! Score: ${sol.score}`);
        drawOverlay(img, state, sol);
      } else {
        setSolution(null);
        setStatus('No valid placements found. Game Over?');
        drawOverlay(img, state, null);
      }
    } catch (e: unknown) {
      console.error(e);
      const err = e as Error;
      setStatus('Error processing image: ' + (err.message || 'Unknown error'));
    } finally {
      setIsProcessing(false);
    }
  }, [drawOverlay]);

  
  const handlePaste = useCallback((e: ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const blob = items[i].getAsFile();
        if (blob) {
          const url = URL.createObjectURL(blob);
          const img = new Image();
          img.onload = () => processImage(img);
          img.src = url;
        }
      }
    }
  }, [processImage]);

  useEffect(() => {
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [handlePaste]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const url = URL.createObjectURL(e.target.files[0]);
      const img = new Image();
      img.onload = () => processImage(img);
      img.src = url;
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8 flex flex-col items-center">
      <div className="max-w-4xl w-full space-y-6">
        <header className="text-center space-y-2">
          <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-emerald-400">
            Tetris Variant Solver
          </h1>
          <p className="text-gray-400">Paste an image (Ctrl+V) or upload a screenshot to get the best moves.</p>
        </header>

        <div className="bg-gray-800 rounded-xl p-6 shadow-xl border border-gray-700">
          <div className="flex flex-col items-center justify-center border-2 border-dashed border-gray-600 rounded-lg p-12 hover:border-blue-500 transition-colors cursor-pointer relative">
            <input 
              type="file" 
              accept="image/*" 
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              onChange={handleFileChange}
            />
            <UploadCloud className="w-12 h-12 text-gray-400 mb-4" />
            <p className="text-lg font-medium">Click to upload or drag & drop</p>
            <p className="text-sm text-gray-500 mt-1">or simply paste (Ctrl+V) anywhere</p>
          </div>
        </div>

        <div className="bg-gray-800 rounded-xl p-4 flex items-center justify-between border border-gray-700">
          <div className="flex items-center space-x-3">
            {isProcessing ? (
              <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            ) : solution ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            ) : (
              <AlertCircle className="w-5 h-5 text-blue-400" />
            )}
            <span className="font-medium text-gray-300">{status}</span>
          </div>
        </div>

        <div className="flex justify-center bg-gray-800 rounded-xl p-4 border border-gray-700 overflow-hidden">
          <canvas 
            ref={canvasRef}
            className="max-w-full h-auto rounded-lg shadow-2xl"
            style={{ maxHeight: '70vh' }}
          />
        </div>
      </div>
    </div>
  );
}

export default App;
