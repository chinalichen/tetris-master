import React, { useState, useEffect, useCallback } from 'react';
import GameStateEditor from '../components/GameStateEditor';
import type { GameState } from '../lib/types';

// Import all screenshots
const screenshotFiles = import.meta.glob('/__tests__/screenshots/*.jpeg', { eager: true });

interface ScreenshotData {
  filename: string;
  url: string;
  state: GameState | null;
}

export default function BatchEditor() {
  const [screenshots, setScreenshots] = useState<ScreenshotData[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [savedFiles, setSavedFiles] = useState<Set<string>>(new Set());

  useEffect(() => {
    const loadScreenshots = async () => {
      const loaded: ScreenshotData[] = [];
      
      for (const [path, module] of Object.entries(screenshotFiles)) {
        const filename = path.split('/').pop() || '';
        const url = (module as { default: string }).default;
        
        // Try to load existing ground truth
        let state: GameState | null = null;
        try {
          const response = await fetch(`/__tests__/ground-truth/${filename.replace('.jpeg', '.json')}`);
          if (response.ok) {
            state = await response.json();
          }
        } catch {
          // No existing ground truth
        }
        
        loaded.push({ filename, url, state });
      }
      
      loaded.sort((a, b) => a.filename.localeCompare(b.filename));
      setScreenshots(loaded);
      setLoading(false);
    };
    
    loadScreenshots();
  }, []);

  const handleSave = useCallback((state: GameState) => {
    const screenshot = screenshots[currentIndex];
    if (!screenshot) return;
    
    // Download JSON file
    const jsonStr = JSON.stringify(state, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = screenshot.filename.replace('.jpeg', '.json');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    // Mark as saved
    setSavedFiles(prev => new Set(prev).add(screenshot.filename));
    
    // Update state
    setScreenshots(prev => {
      const next = [...prev];
      next[currentIndex] = { ...next[currentIndex], state };
      return next;
    });
  }, [screenshots, currentIndex]);

  const handleNext = useCallback(() => {
    if (currentIndex < screenshots.length - 1) {
      setCurrentIndex(prev => prev + 1);
    }
  }, [currentIndex, screenshots.length]);

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  }, [currentIndex]);

  if (loading) {
    return <div className="p-8 text-center">加载截图中...</div>;
  }

  const current = screenshots[currentIndex];
  if (!current) {
    return <div className="p-8 text-center">没有截图文件</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white shadow-sm border-b p-4">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold">游戏状态批量编辑器</h1>
            <p className="text-sm text-gray-500">
              {currentIndex + 1} / {screenshots.length} - {current.filename}
              {savedFiles.has(current.filename) && (
                <span className="text-green-600 ml-2">✓ 已保存</span>
              )}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handlePrev}
              disabled={currentIndex === 0}
              className="px-4 py-2 bg-gray-200 rounded-lg disabled:opacity-50 hover:bg-gray-300"
            >
              ← 上一个
            </button>
            <button
              onClick={handleNext}
              disabled={currentIndex === screenshots.length - 1}
              className="px-4 py-2 bg-gray-200 rounded-lg disabled:opacity-50 hover:bg-gray-300"
            >
              下一个 →
            </button>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="max-w-6xl mx-auto px-4 py-2">
        <div className="flex gap-1 flex-wrap">
          {screenshots.map((s, i) => (
            <button
              key={s.filename}
              onClick={() => setCurrentIndex(i)}
              className={`w-8 h-8 text-xs rounded ${
                i === currentIndex 
                  ? 'bg-blue-500 text-white' 
                  : savedFiles.has(s.filename)
                    ? 'bg-green-500 text-white'
                    : s.state
                      ? 'bg-yellow-400 text-black'
                      : 'bg-gray-300'
              }`}
              title={s.filename}
            >
              {i + 1}
            </button>
          ))}
        </div>
        <div className="text-xs text-gray-500 mt-1">
          图例: <span className="inline-block w-3 h-3 bg-blue-500 rounded mx-1"></span>当前 
          <span className="inline-block w-3 h-3 bg-green-500 rounded mx-1"></span>已保存 
          <span className="inline-block w-3 h-3 bg-yellow-400 rounded mx-1"></span>有数据 
          <span className="inline-block w-3 h-3 bg-gray-300 rounded mx-1"></span>未编辑
        </div>
      </div>

      {/* Editor */}
      <div className="max-w-6xl mx-auto px-4 pb-8">
        {current.state ? (
          <GameStateEditor
            imageUrl={current.url}
            initialState={current.state}
            onSave={handleSave}
          />
        ) : (
          <div className="p-8 text-center bg-white rounded-lg shadow">
            <p className="text-gray-500 mb-4">需要先运行 vision 解析生成初始状态</p>
            <button
              onClick={async () => {
                // Load and parse image
                const img = new Image();
                img.src = current.url;
                await new Promise(resolve => { img.onload = resolve; });
                
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d')!;
                ctx.drawImage(img, 0, 0);
                
                const imageData = ctx.getImageData(0, 0, img.width, img.height);
                const { parseImageData } = await import('../lib/vision');
                const state = parseImageData(imageData);
                
                setScreenshots(prev => {
                  const next = [...prev];
                  next[currentIndex] = { ...next[currentIndex], state };
                  return next;
                });
              }}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            >
              解析当前截图
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
