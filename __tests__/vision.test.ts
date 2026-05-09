import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as jpeg from 'jpeg-js';
import { parseImageData } from '../src/lib/vision';

describe('Vision Module', () => {
  const screenshotsDir = path.join(__dirname, 'screenshots');
  const groundTruthDir = path.join(__dirname, 'ground-truth');
  const files = fs.readdirSync(screenshotsDir).filter(f => f.endsWith('.jpeg') || f.endsWith('.jpg'));

  for (const file of files) {
    it(`should parse board and pieces correctly for ${file}`, () => {
      const filePath = path.join(screenshotsDir, file);
      const jpegData = fs.readFileSync(filePath);
      const rawImageData = jpeg.decode(jpegData, { useTArray: true });
      
      const imgData = {
        data: rawImageData.data as Uint8ClampedArray,
        width: rawImageData.width,
        height: rawImageData.height,
      };

      const state = parseImageData(imgData);

      // Verify Board properties
      expect(state.board.length).toBe(8);
      expect(state.board[0].length).toBe(8);

      // Verify Pieces properties
      expect(state.pieces.length).toBe(3);
      state.pieces.forEach(piece => {
        expect(piece.length).toBeGreaterThan(0);
        expect(piece[0].length).toBeGreaterThan(0);
        expect(piece.length).toBeLessThanOrEqual(5);
        expect(piece[0].length).toBeLessThanOrEqual(5);
      });

      // Verify that board size is somewhat reasonable compared to the image width
      expect(state.boardRect.w).toBeGreaterThan(imgData.width * 0.7);
      expect(state.boardRect.w).toBeLessThan(imgData.width * 0.99);

      // If ground truth exists, compare with it
      const groundTruthPath = path.join(groundTruthDir, file.replace('.jpeg', '.json').replace('.jpg', '.json'));
      if (fs.existsSync(groundTruthPath)) {
        const groundTruth = JSON.parse(fs.readFileSync(groundTruthPath, 'utf-8'));
        
        // Compare board
        expect(state.board).toEqual(groundTruth.board);
        
        // Compare pieces
        expect(state.pieces).toEqual(groundTruth.pieces);
        
        console.log(`✓ ${file} matches ground truth`);
      } else {
        console.log(`⚠ ${file} - no ground truth found, skipping comparison`);
      }

      // Log some info for debugging if needed
      console.log(`${file}: boardRect=${JSON.stringify(state.boardRect)}`);
      console.log(`Piece Rects: ${JSON.stringify(state.pieceRects)}`);
      console.log(`Pieces sizes: ${state.pieces.map(p => `${p[0].length}x${p.length}`).join(', ')}`);
    });
  }
});
