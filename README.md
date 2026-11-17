# 地理实验台

按中国地图出版社中图北京版《地理》七年级上册（钟作慈主编，ISBN 978-7-5204-4102-5）组织的自学网页。课程映射使用国家中小学智慧教育平台 2026 年 8 月 18 日更新的电子教材。

## 本地使用

在这个目录中运行 `python3 -m http.server 8765 --bind 127.0.0.1`，然后打开 `http://127.0.0.1:8765/`。Three.js 及控件已随源码提供，网页无需额外构建。

## 更新内容

- `src/content-first.js`、`src/content-later.js` 保存原有课次、知识点、互动题与探究活动。
- `src/catalog.js` 汇总目录、实验入口和知识关系。扩充新册时新增内容模块，保持旧知识 ID 和互动题 ID；用关系连接旧知识点，以便原有链接和本机记录继续使用。
- `src/geo-model.js` 提供二维和三维共享的教学示意数据。修改一组地形模型后，在两个视图核对比例与标签。
- 网站通过 GitHub Pages 从 `main` 根目录发布。可在 GitHub Desktop 使用 Add Local Repository 添加本目录，提交并推送更新。之后可在仓库的 Actions / Pages 中查看部署状态。

学习进度、收藏和探究笔记由浏览器本机保存。可通过复习页导出或导入自己的进度。

## 素材

- 首页塔拉河峡谷照片由 Alexkom000 拍摄，来自 [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:2025-07-13_Tara_River_Canyon_5.jpg)，许可为 [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)。站点使用缩放、压缩和裁切后的版本。
- 简化地球轮廓依据 [Natural Earth 1:110m Land](https://www.naturalearthdata.com/downloads/110m-physical-vectors/110m-land/)，公共领域，仅用于教学示意。
- Three.js 0.187.0 及 OrbitControls 使用 [MIT 许可](vendor/three/LICENSE)。
- 地形图层使用 [Natural Earth Gray Earth](https://www.naturalearthdata.com/downloads/50m-gray-earth/gray-earth-with-ocean-bottom/) 的陆地和海底阴影，缩小并着色。调整示意的洋流和季风路径时，可参考 `src/flow-model.js` 中的来源和限度。
