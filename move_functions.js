const fs = require('fs');
const code = fs.readFileSync('src/App.tsx', 'utf8');
const lines = code.split('\n');

const drawStart = lines.findIndex(l => l.includes('const drawOverlay = useCallback'));
const drawEnd = lines.findIndex((l, i) => i > drawStart && l.trim() === '}, []);');

const procStart = lines.findIndex(l => l.includes('const processImage = useCallback'));
const procEnd = lines.findIndex((l, i) => i > procStart && l.trim() === '}, [drawOverlay]);');

if (drawStart > procStart) {
  const drawCode = lines.slice(drawStart, drawEnd + 1).join('\n');
  const procCode = lines.slice(procStart, procEnd + 1).join('\n');
  
  const withoutBoth = lines.slice();
  withoutBoth.splice(drawStart, drawEnd - drawStart + 1);
  withoutBoth.splice(procStart, procEnd - procStart + 1);
  
  // Insert drawCode then procCode
  const insertIndex = procStart;
  withoutBoth.splice(insertIndex, 0, drawCode, procCode);
  fs.writeFileSync('src/App.tsx', withoutBoth.join('\n'));
}
