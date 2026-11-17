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

## 新话题制作规范

1. **首屏先给看得见的东西。** 一张相关实景、地图或示意图，加一个孩子能立刻做的小动作。可用 `src/topic-views.js` 加 2–4 张有不同观察目的的图。每张图只配一句提示，手机能横滑，同时能用按钮和键盘翻图。图的来源与许可收在可展开区域。
2. **用大白话开始。** 先问“哪一段走起来像陡坡？”，孩子操作后再引出“地形剖面图”。提示、数字、成因以及更难的挑战按需展开。观察时允许只玩、先猜或说暂时不知道。
3. **让动作产生可核对的变化。** 换路线、标一个位置或拨一个量，控件、图和即时读数保持同屏，再请孩子用看到的东西说理由。实景照片与示意模型分别标记。
4. **只在默认视图给两条相关知识。** 一条帮助迁移或比较，一条补当前方法。其余放在“更多联系”。去比较时传递已选地点，返回时恢复原图或原实验状态。
5. **每次发版用手机视口验收。** 建议检查 360 × 640 和 390 × 844 竖屏，以及 667 × 335 或 844 × 390 横屏。记录孩子第一次找到动作需要多久，以及面对一张新图能否用自己的话说明看到的规律。
