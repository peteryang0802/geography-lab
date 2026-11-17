import { firstLessons } from './content-first.js';
import { laterLessons, legendItems, projects } from './content-later.js';

const OFFICIAL_BOOK = 'https://r1-ndr.ykt.cbern.com.cn/edu_product/esp/assets/7b63faa4-c6d8-4c9d-b18b-21394da1c56e.t/zh-CN/1787023052170/transcode/image/';

export const chapters = [
  { id: 0, prefix: '绪论', title: '我们共同学地理' },
  { id: 1, prefix: '第一章', title: '认识地球' },
  { id: 2, prefix: '第二章', title: '学用地图' },
  { id: 3, prefix: '第三章', title: '认识海洋和陆地' },
  { id: 4, prefix: '第四章', title: '认识天气与气候' },
  { id: 5, prefix: '第五章', title: '认识人文环境' },
];

export const lessons = [...firstLessons, ...laterLessons];
export { projects, legendItems };

const mountainNodes = [
  {
    id: 'himalayas',
    title: '喜马拉雅山脉',
    text: '位于亚洲，沿青藏高原南缘延伸。用分层设色图看山脉南侧低地与北侧高原，比较两侧的海拔和起伏。',
  },
  {
    id: 'alps',
    title: '阿尔卑斯山脉',
    text: '位于欧洲，从欧洲中部向东南欧一带延伸。观察山地与附近较低地带的海拔差，并留意山地高处可能比周边低地更冷。',
  },
  {
    id: 'cordillera',
    title: '北美科迪勒拉山系',
    text: '位于北美洲西部，由多条山脉和其间高原、盆地等地形组成。比较时可以只取其中一段，再观察这段山地与周边地形的相对位置。',
  },
  {
    id: 'andes',
    title: '安第斯山脉',
    text: '沿南美洲西部延伸，属于美洲西部科迪勒拉山系的一部分。在同一高程尺度下，观察高山、附近低地与太平洋海岸的位置关系。',
  },
];

export const concepts = [
  ...lessons.flatMap(lesson =>
    lesson.concepts.map(concept => ({ ...concept, lessonId: lesson.id, chapter: lesson.chapter }))),
  ...mountainNodes.map(concept => ({ ...concept, lessonId: 'land-ocean', chapter: 3 })),
];

const compare = '同类比较';
const method = '读图方法';
const location = '空间位置';
const evidence = '影响与证据';
const distinction = '易混辨析';

// Each teaching relationship appears from both endpoints.
const relationships = [
  ['himalayas', 'alps', compare, '从亚洲跳到欧洲，用同一套高程色阶比较山地和附近低地。'],
  ['himalayas', 'cordillera', compare, '在亚洲和北美洲各选一段剖面，比较高地与周边的落差。'],
  ['himalayas', 'andes', compare, '在亚洲和南美洲各找一列高山，比较山脉与低地、海岸的相对位置。'],
  ['alps', 'cordillera', compare, '到欧洲和北美洲各读一段地形剖面，找两处山地结构的不同。'],
  ['cordillera', 'andes', location, '沿美洲西部追踪科迪勒拉山系，安第斯山脉是其中南美洲的部分。'],
  ['alps', 'andes', compare, '把欧洲和南美洲的山地放到同一尺度下，先看图例再描述起伏。'],
  ['himalayas', 'continents', location, '在世界地形图上找到亚洲，再找青藏高原南缘。'],
  ['alps', 'continents', location, '先在地球仪上找欧洲，再看阿尔卑斯山脉的大致位置。'],
  ['cordillera', 'continents', location, '沿北美洲西侧找山地，读图时可先用太平洋一侧作为参照。'],
  ['andes', 'continents', location, '先找南美洲，再沿太平洋一侧追踪安第斯山脉。'],
  ['himalayas', 'relief-colors', method, '用图例读出山区的高程，再观察南侧低地与北侧高原。'],
  ['alps', 'relief-colors', method, '用高程图例检查山地颜色对应的范围，并同周边低地对比。'],
  ['cordillera', 'relief-colors', method, '通过图例区分北美洲西部的高山区和附近较低地带。'],
  ['andes', 'relief-colors', method, '同一色阶可以显示安第斯山区和附近低地的高度差。'],
  ['himalayas', 'contour', method, '切换到等高线实验，复习怎样在相同比例尺和等高距下比较坡陡。'],
  ['alps', 'contour', method, '地形颜色能指示高程，判断某一段坡度可改用等高线间距。'],
  ['cordillera', 'contour', method, '用等高线表示山脉和盆地时，比一比线条在两种地形上的形状。'],
  ['andes', 'contour', method, '先在剖面观察起伏，再复习怎样用等高线推断坡面变化。'],
  ['himalayas', 'plates', evidence, '印度洋板块与亚欧板块碰撞挤压是解释这处高大山地形成的线索。'],
  ['andes', 'plates', evidence, '安第斯山脉靠近太平洋一侧的板块交界，可用来研究板块活动。'],
  ['himalayas', 'world-mountain-systems', location, '把喜马拉雅山脉放回世界地形图，再沿其他大洲寻找可比较的山地。'],
  ['alps', 'world-mountain-systems', location, '从世界山脉定位任务切入，再回到欧洲实看山地和附近低地。'],
  ['cordillera', 'world-mountain-systems', location, '把北美洲的这一段放回世界图，观察美洲西部山系的整体走向。'],
  ['andes', 'world-mountain-systems', location, '从世界图定位美洲西部山系，沿南美洲西岸找到安第斯山脉。'],
  ['geographic-observation', 'human-environment', evidence, '把下雨、地势、积水和行走路线记录到同一张示意图，再提出解释。'],
  ['geographic-observation', 'map-purpose', method, '先明确问题，再决定使用照片、路线图还是地形图。'],
  ['geographic-observation', 'land-change-evidence', method, '把观察到的材料和据此提出的解释分别写下来。'],
  ['human-environment', 'settlement', evidence, '比较交通、水源和地势怎样影响居住地点，再想想居民如何改变周围环境。'],
  ['human-environment', 'human-climate-impact', evidence, '区分树荫对附近体感的影响与温室气体对全球气候的影响。'],
  ['solar-system', 'earth-shape', evidence, '从太空理解地球所处的范围，也能从新的角度观察地球的外形。'],
  ['solar-system', 'mars-exploration', location, '先在太阳系中找火星，再判断为什么要使用不同探测工具。'],
  ['earth-shape', 'earth-size', compare, '形状和大小回答两个问题，分别找能证明形状的观测和能量化大小的数值。'],
  ['earth-size', 'scale', method, '地球仪把真实地球按比例缩小。拿模型图距和真实距离练习尺度换算。'],
  ['remote-sensing', 'forecast', evidence, '天气卫星的云图是一种遥感观察，可和地面观测一起供预报使用。'],
  ['remote-sensing', 'earth-shape', evidence, '从太空拍摄和测量可以提供有关地球外形的观测证据。'],
  ['remote-sensing', 'geographic-observation', method, '用同一区域灾前和灾后的可比图像，练习控制比较条件。'],
  ['space-station', 'lunar-sample', compare, '比较空间站实验与样品返回，看看它们分别在哪里做测量。'],
  ['space-station', 'mars-exploration', compare, '比较近地轨道内的实验与行星现场的探测任务。'],
  ['lunar-sample', 'mars-exploration', compare, '先区分原地测量和实物采样带回，再解释两种观测的用途。'],
  ['geo-latitude', 'geo-longitude', distinction, '先用纬度判断南北，再用经度定位东西。两条线相交才得到一个普通地点。'],
  ['geo-latitude', 'heat-zones', location, '回归线和极圈附近的纬度是认识地球五带的关键。'],
  ['geo-latitude', 'temperature-distribution', evidence, '拿不同纬度的气温资料检查从低纬到高纬的一般趋势，再找例外。'],
  ['geo-longitude', 'map-direction', method, '有经纬网的地图可以沿经线判南北，沿纬线判东西。'],
  ['geo-longitude', 'day-night', evidence, '同一时刻不同经度可能处于昼夜的不同阶段。转动球体看看两个地点。'],
  ['earth-axis', 'day-night', evidence, '保持地轴位置，转动地球模型，追踪地点怎么进出亮面。'],
  ['earth-axis', 'seasons', evidence, '改变月份，观察倾斜地轴与太阳照射方向的关系。'],
  ['globe-reference-lines', 'geo-latitude', location, '把赤道、回归线和极圈的纬度标在同一个地球仪上。'],
  ['globe-reference-lines', 'heat-zones', location, '用回归线和极圈给地球五带找边界。'],
  ['day-night', 'seasons', distinction, '分别只改变时刻和只改变月份，区分一天的昼夜交替和一年中昼长变化。'],
  ['seasons', 'climate-chart', evidence, '读两地的曲线，观察不同半球的冷暖月份是否有规律。'],
  ['heat-zones', 'climate-types', distinction, '用五带定位纬度范围，再用具体温度和降水资料判断气候类型。'],
  ['map-direction', 'legend', method, '读图先看北箭头和图例，再解释路线和符号的位置。'],
  ['scale', 'contour', method, '比较等高线疏密时要核对等高距以及图距对应的实地距离。'],
  ['scale', 'terrain-profile', method, '检查剖面的横轴与纵轴分别怎样缩放，再用它比较坡度。'],
  ['legend', 'map-purpose', method, '拿一张专题图练习判断其中的符号能回答什么问题。'],
  ['legend', 'relief-colors', method, '读分层设色图时，先对照图例，把颜色转成海拔范围。'],
  ['elevation', 'relative-height', distinction, '同一张剖面同时标出山顶海拔和山脚到山顶的高差。'],
  ['elevation', 'climate-factors', evidence, '在纬度相近的地点比较不同海拔，再看气温或降水可能怎样变化。'],
  ['relative-height', 'terrain-profile', method, '从剖面纵轴读两个地点的海拔，再用两数相减算高差。'],
  ['contour', 'terrain-profile', method, '在等高线图定位一条截线，沿线读取海拔并对照剖面。'],
  ['contour', 'air-temperature', compare, '等高线连接同海拔点，等温线连接同气温点。两种图都从图例和数值读起。'],
  ['terrain-profile', 'ocean-floor', method, '同样用剖面读起伏，看看陆地低谷和海底海沟怎样显示。'],
  ['relief-colors', 'landforms', method, '用分层设色图找高低差，再结合剖面判断是高原、山地还是盆地。'],
  ['landforms', 'world-mountain-systems', compare, '把地形类型用到具体山脉和山系，描述它们与周围不同在哪里。'],
  ['landforms', 'settlement', evidence, '比较平坦地带和起伏显著地带，找交通与建设条件的线索。'],
  ['continents', 'ocean-floor', location, '在世界图上从一个大洲的岸线向大洋深处读一条海底剖面。'],
  ['ocean-floor', 'plates', evidence, '把海沟、大洋中脊等地形放在板块边界附近观察，找分布关系。'],
  ['ocean-and-life', 'precipitation', evidence, '找一条水汽从海面到陆地的路径，再看什么地方容易形成降水。'],
  ['ocean-and-life', 'trade', evidence, '从港口和航线出发，比较海运适用的货物和地点。'],
  ['land-change-evidence', 'continental-drift', method, '比较化石、岩层和大陆轮廓，想想不同证据分别支持怎样的解释。'],
  ['continental-drift', 'plates', evidence, '从大陆位置的变化证据进一步追问，地球表层的运动怎样发生。'],
  ['weather', 'climate', distinction, '比较某天的观测和许多年的统计，两种资料用来回答不同问题。'],
  ['weather', 'hazardous-weather', evidence, '按地点和时段核对天气要素，再决定活动如何调整。'],
  ['forecast', 'hazardous-weather', evidence, '把预报里的雨、风和雷电时段对应到户外活动安排。'],
  ['hazardous-weather', 'climate-production', compare, '分别用一次风雨过程和多年气候统计，解释当天活动和长期农业安排。'],
  ['air-temperature', 'temperature-distribution', method, '用带图例的等温线图描述气温从低纬到高纬的变化。'],
  ['air-temperature', 'climate-chart', method, '从月均温曲线读最暖月和最冷月，再求年较差。'],
  ['temperature-distribution', 'climate-factors', evidence, '同纬度出现温度差异时，继续查海陆位置和海拔。'],
  ['precipitation', 'climate-chart', method, '从柱状图读取各月降水，比较季节并计算全年总量。'],
  ['precipitation', 'climate-housing', evidence, '用降水的季节和总量，检验某种建筑排水设计是否合适。'],
  ['climate-chart', 'climate-types', method, '同时读取冷暖、雨量和雨季，把数据对应到可能的气候类型。'],
  ['climate', 'climate-types', method, '用多年气温和降水数据识别一地的气候类型。'],
  ['climate-types', 'climate-factors', evidence, '先描述某地的气候，再查纬度、海陆和地形有哪些能解释它。'],
  ['climate-factors', 'coast-and-interior', evidence, '比较相近纬度的沿海与内陆地点，辨别海陆位置的影响。'],
  ['coast-and-interior', 'climate-chart', method, '用同一纵轴比较两地气温年较差，再观察降水季节。'],
  ['climate-production', 'precipitation', evidence, '把作物需水期和月降水量对照，再考虑灌溉条件。'],
  ['climate-production', 'climate-housing', compare, '用同一处地方的气候证据分别解释农事与建筑选择。'],
  ['climate-housing', 'cultural-diversity', evidence, '家屋样式也受材料和历史影响，比较同一气候区内的不同做法。'],
  ['human-climate-impact', 'climate', evidence, '讨论全球气候变化时，使用多年的数据观察较长时间的趋势。'],
  ['human-climate-impact', 'international-cooperation', evidence, '看环境治理为什么需要多地协作，以及哪些问题能从学校周边寻找证据。'],
  ['population-growth', 'population-density', distinction, '一个指标关注人数怎样随时间变化，另一个关注单位面积住着多少人。'],
  ['population-growth', 'cultural-diversity', evidence, '了解人口迁移怎样改变人口数量，并带来语言和饮食等文化交流。'],
  ['population-density', 'settlement', evidence, '看人口密度图的时候，尝试用居民点和交通位置解释分布。'],
  ['population-density', 'development-indicators', distinction, '人数、密度和人均发展指标的分母不同，先看单位再比较。'],
  ['settlement', 'trade', evidence, '沿铁路、港口和市场找聚落，检验交通是否影响地点选择。'],
  ['cultural-diversity', 'international-cooperation', evidence, '讨论合作案例时，调查当地规则和居民需求，避免从单一现象猜测整个地区。'],
  ['development-indicators', 'international-cooperation', evidence, '把合作目标和可量化的发展指标对应起来。'],
  ['trade', 'international-cooperation', evidence, '跨国货物流动涉及交通选择和共同规则，试着找出路径与参与方。'],
];

const relationIndex = new Map(concepts.map(concept => [concept.id, []]));
for (const [first, second, type, reason] of relationships) {
  relationIndex.get(first).push({ id: second, type, reason });
  relationIndex.get(second).push({ id: first, type, reason });
}

export function getRelations(conceptId) {
  return relationIndex.get(conceptId) ?? [];
}

export const labs = [
  {
    id: 'globe',
    title: '转动地球仪',
    icon: '◎',
    description: '用经纬网找地点，拨动时刻与月份，看它在亮面还是暗面。',
    lessonId: 'earth-motion',
    links: ['geo-latitude', 'geo-longitude', 'day-night', 'seasons'],
    caption: '转动地球仪找经纬度，比较同一地点一日内的昼夜变化。',
  },
  {
    id: 'contour',
    title: '给山坡切一刀',
    icon: '⌁',
    description: '换条剖切线，比较两段坡道的高低和陡缓。',
    lessonId: 'contours',
    links: ['contour', 'terrain-profile', 'elevation', 'relative-height'],
    caption: '同一个虚构地貌可以显示为三维地表、等高线和剖面。',
  },
  {
    id: 'terrain',
    title: '跨洲比较山地',
    icon: '▲',
    description: '把喜马拉雅和另一处山地摆在一起，用同一标尺比较。',
    lessonId: 'land-ocean',
    links: ['himalayas', 'alps', 'cordillera', 'andes', 'relief-colors'],
    caption: '各地形模型均为教学示意，用相同高程色阶比较地势。',
  },
];

export function bookPageUrl(printedPage) {
  return `${OFFICIAL_BOOK}${printedPage + 4}.jpg`;
}
