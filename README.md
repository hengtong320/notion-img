# 四象归真 · Cocos Creator 3.8.8

这是《四象归真》箭头解谜游戏的 Cocos Creator 工程分支。

## 云端产物

GitHub Actions 会自动：

1. 解压 `bootstrap/project-source.zip`；
2. 生成音效并执行 72 根纹线无死关验证；
3. 发布完整工程到 `cocos-project/`；
4. 生成可直接下载的 `downloads/FourSymbols-CocosCreator-3.8.8.zip`；
5. 使用 Cocos Creator 3.8.8 构建 Web Mobile，并发布到 `web-build/`。

## 本地打开

1. 安装 Cocos Dashboard；
2. 安装 Cocos Creator 3.8.8；
3. 下载并解压 `downloads/FourSymbols-CocosCreator-3.8.8.zip`；
4. 在 Dashboard 中选择解压后的 `cocos-project` 目录；
5. 打开 `assets/scenes/Main.scene`，点击顶部预览按钮即可运行。

## 已实现

- 纯 Cocos `Graphics` 矢量绘制；
- 青龙、白虎、朱雀、玄武四象盘面；
- 72 根独立可操作纹线；
- 箭头方向、碰撞判定、飞出动画共用同一出口向量；
- 宽触控热区、按压预选、误触阈值、阻挡线高亮；
- 提示、撤回、重置、清除、生命、声音、震动与结算；
- 关卡拓扑验证脚本，确保完整可解且无死关。
