export const FLOW_SOURCES = [
  {
    id: 'kuroshio',
    title: '日本气象厅 · 黑潮',
    url: 'https://www.data.jma.go.jp/kaiyou/data/db/kaikyo/knowledge/kuroshio.html',
  },
  {
    id: 'california',
    title: '美国 NOAA 渔业局 · 加利福尼亚寒流',
    url: 'https://apps-afsc.fisheries.noaa.gov/ichthyo/history.php',
  },
  {
    id: 'gulf-stream',
    title: '美国 NOAA 国家海洋局 · 墨西哥湾暖流',
    url: 'https://oceanservice.noaa.gov/facts/gulfstreamspeed.html',
  },
  {
    id: 'labrador',
    title: '加拿大渔业和海洋部 · 纽芬兰和拉布拉多陆架',
    url: 'https://www.dfo-mpo.gc.ca/oceans/publications/msp-psm/newfoundland-labrador-shelves-plateformes-terre-neuve-labrador/index-eng.html',
  },
  {
    id: 'east-asian-monsoon',
    title: '中国科学院地理科学与资源研究所 · 中国的季风气候',
    url: 'https://igsnrr.cas.cn/cbkx/kpyd/zgdl/cnqh/202009/t20200910_5692398.html',
  },
];

export const FLOW_NOTES = {
  currents: '四条表层洋流的教学示意。箭头指向海水流去的方向，线条用于比较大致路径。实际洋流有宽度，路径和强弱会变化。',
  summer: '东亚夏季低层风的代表方向。暖湿气流可从西北太平洋吹向东亚大陆东部。箭头指向风吹去的方向，风向名称按风吹来的方向命名。',
  winter: '东亚冬季低层风的代表方向。冷空气常由亚欧大陆内陆吹向东亚东部和附近海域。不同地区、不同时段的风向会有差异。',
};

const surfaceCurrents = [
  {
    id: 'kuroshio',
    name: '黑潮暖流',
    kind: 'warm',
    direction: '先向北，再向东北和东',
    description: '在西北太平洋，从台湾岛以东经过东海，沿日本南侧海域逐渐转向东。',
    sourceId: 'kuroshio',
    points: [[20.5, 122.7], [24, 123.3], [27.4, 125.5], [29.5, 128.2], [30.3, 131], [32.4, 135], [34.3, 139.5], [35.3, 145.3]],
  },
  {
    id: 'california',
    name: '加利福尼亚寒流',
    kind: 'cold',
    direction: '大体向南',
    description: '在东北太平洋，从北美洲西岸外海流向加利福尼亚和更南一带。',
    sourceId: 'california',
    points: [[48.8, -128.9], [43.4, -127.9], [38.2, -125.8], [33.1, -122.2], [28.7, -118.8], [23.6, -115.2]],
  },
  {
    id: 'gulf-stream',
    name: '墨西哥湾暖流',
    kind: 'warm',
    direction: '先向北，再向东北',
    description: '在北大西洋西部，经佛罗里达海峡向北，离开北美洲东岸后进入北大西洋。',
    sourceId: 'gulf-stream',
    points: [[24.1, -81.2], [25.8, -79.8], [29.3, -78.5], [34.7, -74.5], [37.7, -68.8], [40.3, -60], [42.1, -50.2]],
  },
  {
    id: 'labrador',
    name: '拉布拉多寒流',
    kind: 'cold',
    direction: '大体向南',
    description: '从较高纬度沿拉布拉多海西侧南下，经过纽芬兰岛外海。',
    sourceId: 'labrador',
    points: [[61.5, -60.7], [58.3, -59.4], [55.2, -56.8], [52.2, -53.5], [48.3, -49.7], [45.1, -50.2]],
  },
];

const monsoonPaths = {
  summer: [
    {
      id: 'east-asian-summer',
      name: '东亚夏季风',
      kind: 'summer',
      direction: '示例从东南吹向西北',
      description: '图上选取一支海洋来的暖湿气流，帮助理解东亚东部夏季的水汽来源。',
      sourceId: 'east-asian-monsoon',
      points: [[21, 132], [24.6, 128.5], [28.1, 124.8], [32, 121.5], [36, 118.8], [39.6, 116.7]],
    },
  ],
  winter: [
    {
      id: 'east-asian-winter',
      name: '东亚冬季风',
      kind: 'winter',
      direction: '示例从西北吹向东南',
      description: '图上选取一支大陆来的较冷气流，帮助理解东亚东部冬季常见的偏北风。',
      sourceId: 'east-asian-monsoon',
      points: [[53.4, 98], [49, 105.6], [44.3, 112.6], [39.7, 117.4], [34.9, 122.1], [29.8, 125.8]],
    },
  ],
};

// Geographic points are [latitude, longitude] in flow direction.
export function getFlowPaths(flow, season = 'summer') {
  if (flow === 'currents') return surfaceCurrents;
  if (flow === 'monsoon') return season === 'winter' ? monsoonPaths.winter : monsoonPaths.summer;
  return [];
}
