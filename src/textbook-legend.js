const labels = {
  'china-capital': '中国首都',
  'foreign-capital': '外国首都、首府',
  'province-center': '中国省级行政中心',
  settlement: '其他居民点',
  'continent-boundary': '洲界',
  'national-boundary': '国界',
  'unsettled-boundary': '未定国界',
  'region-boundary': '地区界',
  'military-line': '军事分界线',
  'province-boundary': '中国省、自治区、直辖市界',
  'sar-boundary': '中国特别行政区界',
  railway: '铁路',
  'high-speed-rail': '高速铁路',
  motorway: '高速公路',
  road: '公路',
  coast: '海岸线',
  'river-reservoir': '河流和水库',
  'seasonal-river': '时令河',
  canal: '运河',
  lake: '湖泊',
  marsh: '沼泽、盐沼',
  peak: '山峰及海拔（米）',
  'lake-elevation': '湖面海拔（米）',
  volcano: '火山',
  desert: '沙漠',
  reef: '珊瑚礁',
  'great-wall': '长城',
  airport: '机场',
  port: '港口',
};
const symbolHints = {
  settlement: '专题图居民点',
  'region-boundary': '浅色虚线',
  'military-line': '一排十字',
  'province-boundary': '密集细点',
};
const boundaries = ['china-capital', 'foreign-capital', 'province-center', 'settlement',
  'continent-boundary', 'national-boundary', 'unsettled-boundary', 'region-boundary',
  'military-line', 'province-boundary', 'sar-boundary'];
const water = ['coast', 'river-reservoir', 'seasonal-river', 'canal', 'lake'];
const features = ['peak', 'lake-elevation', 'volcano', 'desert', 'reef', 'great-wall'];
const landmarks = ['airport', 'port'];

// Each atlas is cropped from this volume's printed appendix. Its rows follow
// the two printed columns, left column first, with a 35 CSS pixel tile height.
const rows = {
  '7a': [...boundaries, 'railway', 'motorway', 'road', ...water, ...features, ...landmarks],
  '7b': [...boundaries, 'railway', 'motorway', 'road', ...water, ...features],
  '8a': [...boundaries, 'railway', 'motorway', 'road', ...water, ...features, ...landmarks],
  '8b': [...boundaries, 'railway', 'high-speed-rail', 'road', 'motorway', ...water, 'marsh',
    'peak', 'volcano', 'desert', 'reef', 'great-wall', ...landmarks],
};

const groups = [
  ['居民点与界线', boundaries],
  ['交通', ['railway', 'high-speed-rail', 'road', 'motorway', ...landmarks]],
  ['水域', [...water, 'marsh', 'lake-elevation']],
  ['地貌与其他地物', ['peak', 'volcano', 'desert', 'reef', 'great-wall']],
];

export function renderTextbookLegend(term) {
  const indexes = new Map(rows[term].map((symbol, index) => [symbol, index]));
  const atlas = new URL(`../assets/legend-${term}.webp`, import.meta.url);
  return `<div class="book-legend" style="--legend-atlas: url('${atlas}')">
    ${groups.map(([title, symbols]) => `<section class="book-legend-group">
      <h3>${title}</h3>
      <ul>${symbols.filter(symbol => indexes.has(symbol)).map(symbol => `<li data-legend-symbol="${symbol}">
        <span class="book-legend-symbol" aria-hidden="true" style="--legend-y: ${-35 * indexes.get(symbol)}px"></span>
        <span>${labels[symbol]}${symbolHints[symbol] ? `<small>（${symbolHints[symbol]}）</small>` : ''}</span>
      </li>`).join('')}</ul>
    </section>`).join('')}
  </div>`;
}
