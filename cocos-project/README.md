# 四象归真 · Cocos Creator 3.8.8 产品级垂直切片

这是《四象归真》箭头解谜的 Cocos Creator 原生工程。项目不使用 AI 生成位图拼接游戏主体：背景、四象印、阵盘、按钮、72 根锁纹和箭头均由 Cocos `Graphics` 在运行时矢量绘制。

## 当前完成内容

- 竖屏 750 × 1334，适配手机安全区域
- 4 个象限：青龙、白虎、朱雀、玄武
- 每个象限 18 根独立锁纹，共 72 根
- 箭头、合法性判定和飞出动画只使用同一个 `exit` 向量
- 触控按“手指到整条折线的最近距离”命中，而不是要求点中细线
- 按下预选、移动阈值、防误触、阻挡线朱砂高亮、震动和音效
- 提示、撤回、清除、重置、象限聚焦、失败与通关结算
- 关卡依赖图和完整解序双重校验，无死关
- 全部运行素材由工程本身生成，无外部图片依赖

## 本机直接运行

1. 安装 **Cocos Creator 3.8.8**。
2. 在 Cocos Dashboard 中选择“导入项目”，选中本文件夹。
3. 打开 `assets/scenes/Main.scene`。
4. 点击编辑器顶部“预览”，即可在浏览器或模拟器中运行。

第一次导入时，Creator 会生成 `library/`、`temp/`、`local/` 等缓存目录，这是正常现象。

## 运行自动校验

```bash
node tools/verify-levels.mjs
```

应输出：

```text
✓ 四象归真关卡验证通过：72 根纹线，4 个象限，完整拓扑解，无死关。
```

## 云端构建

仓库附带 `.github/workflows/build-cocos.yml`。推送到 `sixiang-cocos-creator` 分支后，GitHub Actions 会：

1. 下载 Cocos Creator 3.8.8；
2. 运行关卡校验；
3. 构建 `web-mobile`；
4. 上传可下载的构建产物；
5. 将网页构建同步到 `web-build/`，供 GitHub 网页预览。

## 核心代码

- `assets/scripts/LoginController.ts`：游戏流程、触控、UI、动画、音效
- `assets/scripts/render/GoldLinePiece.ts`：原生多层鎏金矢量纹线
- `assets/scripts/core/LevelFactory.ts`：四象关卡与唯一方向数据
- `assets/scripts/core/Geometry.ts`：折线命中与几何工具
- `assets/scripts/ui/VectorUI.ts`：原生矢量 UI 与四象图腾
- `tools/verify-levels.mjs`：构建前无死关校验

## 说明

这是用于确认玩法、视觉和手感的高完成度单关垂直切片，而不是已经完成商业发行所需的全部关卡、广告、登录、数据分析和平台 SDK。
