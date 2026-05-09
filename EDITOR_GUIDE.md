# 游戏状态编辑器使用指南

## 概述

游戏状态编辑器是一个独立的 HTML 工具，用于：
1. 加载游戏截图
2. 自动解析棋盘和形状（使用 vision.ts 算法）
3. 手动修正识别结果
4. 导出 JSON 文件作为测试的 ground truth

## 使用方法

### 1. 打开编辑器

直接在浏览器中打开 `editor.html` 文件：

```bash
# 使用 Python 简单 HTTP 服务器（推荐）
python3 -m http.server 8080

# 然后访问 http://localhost:8080/editor.html
```

或者直接用浏览器打开文件（部分功能可能受限）。

### 2. 加载截图

1. 点击"加载截图"按钮
2. 选择 `__tests__/screenshots/` 目录下的 JPEG 文件
3. 可以一次选择多个文件批量加载

### 3. 查看解析结果

- 左侧显示截图和识别覆盖层
  - 绿色框：棋盘区域
  - 蓝色框：形状区域
  - 红色填充：识别到的棋盘格子
  - 紫色填充：识别到的形状块
- 右侧显示解析出的棋盘和形状数据

### 4. 修正识别结果

#### 编辑棋盘：
- 点击"棋盘"标签
- 点击格子切换填充/空白状态
- 蓝色 = 已填充，白色 = 空白
- 使用"清空"和"填满"按钮快速设置

#### 编辑形状：
- 点击"形状"标签
- 选择要编辑的形状（1、2 或 3）
- 点击格子切换填充/空白状态
- 紫色 = 已填充
- 使用"+行"、"-行"、"+列"、"-列"调整形状大小
- 最大 5×5

### 5. 导出 JSON

#### 单个导出：
- 点击"下载"按钮下载当前截图的 JSON
- 或点击"复制"按钮复制 JSON 到剪贴板

#### 批量导出：
- 点击"导出全部"按钮下载所有截图的 JSON

### 6. 更新 Ground Truth

将导出的 JSON 文件放入 `__tests__/ground-truth/` 目录：

```
__tests__/
  screenshots/
    input1.jpeg
    input2.jpeg
    ...
  ground-truth/
    input1.json    # 对应的 ground truth
    input2.json
    ...
```

### 7. 运行测试

```bash
npm test
```

测试会自动比较 vision 解析结果和 ground truth。

## 工作流程

```
1. 加载截图 → 2. 自动解析 → 3. 手动修正 → 4. 导出 JSON → 5. 运行测试
```

## 注意事项

- 编辑器使用嵌入的 vision.ts 算法，与主应用一致
- 所有编辑都是实时的，会立即反映在 JSON 预览中
- 导出的 JSON 包含：board（8×8 布尔矩阵）、pieces（3 个形状）、boardRect（棋盘位置）、pieceRects（形状位置）
- 建议为所有 21 个测试截图创建 ground truth 以实现完整 TDD

## 文件结构

```
tetris-master/
  editor.html              # 编辑器（独立 HTML，无需构建）
  src/
    lib/
      vision.ts            # 视觉解析算法
  __tests__/
    screenshots/           # 测试截图（21 个 JPEG）
    ground-truth/          # Ground truth JSON（由编辑器生成）
    vision.test.ts         # 测试文件
```

## 快捷键

- 无特定快捷键，所有操作通过点击完成
- 支持批量加载和批量导出
