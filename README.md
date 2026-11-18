# 地理实验台

按北京教育科学研究院编著、中国地图出版社出版、钟作慈主编的中图版（北京版）初中《地理》四册制作。首页选学期，课内按教材顺序做读图、观察和复习，共 68 项。新增 48 项中含 12 项主题探究。

## 教材

- 七上 ISBN 978-7-5204-4102-5，采用国家智慧教育平台 2026 年 8 月 18 日更新的电子教材。[出版社电子书](https://www.ditu.cn/pub/html/dtjxw/book/dili/978-7-5204-4102-5/41025.html)
- 七下 ISBN 978-7-5204-4112-4，2024 年 12 月第 1 版。[出版社电子书](https://www.ditu.cn/pub/html/dtjxw/book/dili/978-7-5204-4112-4/41124.html) · [国家平台](https://basic.smartedu.cn/tchMaterial/detail?catalogType=tchMaterial&contentId=67970690-c47b-49e2-9246-c137bacd82fe&contentType=assets_document&subCatalog=tchMaterial)
- 八上 ISBN 978-7-5204-4111-7，2025 年 6 月第 1 版。[出版社电子书](https://www.ditu.cn/pub/html/dtjxw/book/dili/978-7-5204-4111-7/41117.html) · [国家平台](https://basic.smartedu.cn/tchMaterial/detail?catalogType=tchMaterial&contentId=0f612d26-b797-4ac4-8de3-0f9eaf8ef27e&contentType=assets_document&subCatalog=tchMaterial)
- 八下 ISBN 978-7-5204-4110-0，2025 年 12 月第 1 版。[国家平台目录](https://r3-ndr.ykt.cbern.com.cn/edu_product/esp/assets/96effd81-fc72-4521-888f-07ea6866a4c9.t/zh-CN/1772437420586/transcode/image/6.jpg)

## 七上原有体验

- 首页选七年级上册，或打开 `?view=recall#/term/7a`，从原有目录按课回顾。
- `?view=nearby` 从一个身边现象开始。
- `?view=fieldwork` 用两条线索核对自己的判断，可以留一句观察。

它们共享 20 个条目、教材页码、实验和知识网。原课次、知识卡、实验网址继续可用。默认版延续旧学习记录，对照版各自保存进度。复习页可以导入或导出记录。

## 本地预览和检查

在仓库运行 `python3 -m http.server 8773 --bind 127.0.0.1`，打开 `http://127.0.0.1:8773/`。仓库含发布文件，GitHub Pages 从 `main` 根目录提供静态页面。修改入口、入口依赖或图片规格后，运行 `sh scripts/build-app.sh` 刷新 `src/app-runtime.js`、入口版本与首图请求提示。

使用 Node 和 Playwright 运行 `GEOLAB_ROUND=1 node tests/inquiry-browser.cjs`，分别把轮次设为 1、2、3，检查 360×640、390×844、667×335。每轮遍历三版全册，实操每课的主图与课末对照，检查画面变化、同屏反馈、原页路径、进度恢复和教材顺序。另测 Three.js、相册、旧知识卡、复习和弱网重试。通过 `GEOLAB_URL` 指定预览。设置 `GEOLAB_SCREENSHOTS` 保存固定视口截图，配合 `GEOLAB_CAPTURE_ONLY=1` 可以单独截取画面。

用 `node tests/performance-browser.cjs` 检查冷缓存弱网的图片、平面图、3D 首帧和超时重试。测线上压缩传输时将 `GEOLAB_URL` 指向 GitHub Pages。

用 `node tests/volume-browser.cjs` 遍历新增三册，检查目录页码、图上读数、核对、换材料复习、主题探究草稿，以及手机竖屏、横屏与桌面的显示。

## 维护课程

- 新三册使用 `src/term-7b.js`、`src/term-8a.js` 和 `src/term-8b.js`。构建时提取目录索引，进入课程时才加载该册材料。图和交互在 `src/term-diagram.js`、`src/term-lesson.js`。
- 七上教材顺序和稳定 ID 来自 `src/textbook.js`，教材条目、已有知识点和练习来自 `src/content-first.js` 与 `src/content-later.js`。
- `src/inquiries.js` 为每课维护现实问题、图后说明、第二个情境和课外观察。`src/transfer-illustrations.js` 为第二个情境绘制前后两幅教学示意，说明数字和事实仍保留在可读文字中。
- `src/lesson-activities.js` 维护课内活动与初始实验模式。二维、Three.js 共用 `src/geo-model.js` 中的地理模型。
- 修改 `src/scenes.js` 或升级 Three.js 后，运行 `sh scripts/build-three.sh` 更新随站发布的 `src/three-runtime.js`。平面图默认可操作，Three.js 在打开 3D 时加载。
- 每课用能观察的现象开始，在原页看图、动手和解释。跨课浏览与额外练习集中在复习区。新增内容先核对教材页段，再用同一张原图验证读数、尺度和标签。
- 手机优先请求正在看的照片，成功后最多预取一张。实景与教学示意标清，操作、画面和反馈保持同屏。

## 素材记录

- 塔拉河峡谷由 Alexkom000 拍摄，按 [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) 缩放和裁切。[原图](https://commons.wikimedia.org/wiki/File:2025-07-13_Tara_River_Canyon_5.jpg)
- 雨后道路由 Paul The Writer 拍摄，CC0。[原图](https://commons.wikimedia.org/wiki/File:Waterlogged_Residential_Access_Road.jpg)
- 地球照片 [NASA Apollo 17](https://science.nasa.gov/earth/earth-observatory/history-of-the-blue-marble/)，积雨云 [NASA ISS060-E-71360](https://eol.jsc.nasa.gov/SearchPhotos/photo.pl?frame=71360&mission=ISS060&roll=E)，菊石 [Annie Scott / USGS](https://www.usgs.gov/media/images/fossil-ammonite)。
- 地球轮廓与地形图层采用 Natural Earth [陆地轮廓](https://www.naturalearthdata.com/downloads/110m-physical-vectors/110m-land/) 与 [Gray Earth](https://www.naturalearthdata.com/downloads/50m-gray-earth/gray-earth-with-ocean-bottom/) 的缩小和着色版本。Three.js 及控件按 [MIT 许可](vendor/three/LICENSE) 随站提供。
- 山地实景的署名见各相册。洋流和季风路径依据及教学示意的限度见 `src/flow-model.js`。
- 《海洋和陆地的分布》的港湾照片为 [Kalei Shotwell / NOAA Fisheries](https://www.fisheries.noaa.gov/feature-story/celebrate-national-seafood-month)；喜马拉雅的实拍另见 [NASA Earth Observatory](https://science.nasa.gov/earth/earth-observatory/himalayas-near-and-far-147980/)。
