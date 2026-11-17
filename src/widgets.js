const INK = '#283c32';
const GRID = '#d7e2d7';
const TEMP = '#a13d20';
const RAIN = '#287096';
const FONT = 'system-ui, sans-serif';

const MONTHS = Array.from({ length: 12 }, (_, month) => [String(month + 1), `${month + 1} 月`]);

const CLIMATES = {
  north: {
    name: '北方内陆',
    temperature: [-5, -1, 6, 14, 21, 25, 27, 26, 21, 13, 5, -2],
    rain: [5, 7, 12, 22, 39, 81, 166, 137, 51, 25, 13, 6],
  },
  equator: {
    name: '赤道附近',
    temperature: [26, 26, 27, 27, 27, 26, 26, 26, 27, 27, 26, 26],
    rain: [205, 180, 250, 279, 238, 193, 165, 149, 174, 234, 253, 228],
  },
  west: {
    name: '中纬度大陆西岸',
    temperature: [9, 10, 12, 15, 19, 23, 26, 26, 23, 18, 13, 10],
    rain: [90, 83, 67, 47, 32, 14, 5, 7, 28, 58, 92, 99],
  },
  south: {
    name: '南半球中纬沿海',
    temperature: [21, 21, 19, 16, 13, 11, 10, 11, 13, 15, 18, 20],
    rain: [59, 57, 64, 74, 86, 91, 98, 93, 83, 75, 68, 62],
  },
};

const PERIODS = [
  ['morning', '09:00–11:00'],
  ['noon', '12:00–14:00'],
  ['afternoon', '15:00–17:00'],
];

const DAYS = {
  a: {
    name: '甲日',
    hours: [
      { sky: '多云', temperature: 19, warning: '本时段无预警', thunder: false },
      { sky: '雷阵雨', temperature: 23, warning: '有雷电预警', thunder: true },
      { sky: '小雨', temperature: 20, warning: '本时段无雷电预警', thunder: false },
    ],
  },
  b: {
    name: '乙日',
    hours: [
      { sky: '小雨', temperature: 16, warning: '本时段无雷电预警', thunder: false },
      { sky: '多云', temperature: 19, warning: '本时段无预警', thunder: false },
      { sky: '晴', temperature: 22, warning: '本时段无预警', thunder: false },
    ],
  },
};

const REGIONS = {
  a: { name: '甲 · 河谷镇', population: 60000, area: 60 },
  b: { name: '乙 · 平原街区', population: 40000, area: 20 },
  c: { name: '丙 · 山前村镇', population: 18000, area: 90 },
  d: { name: '丁 · 交通枢纽区', population: 72000, area: 24 },
};

let controlCount = 0;

function node(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function field(label, choices, selected, onInput) {
  const group = node('div', 'control-group');
  const select = node('select');
  const caption = node('label', '', label);
  select.id = `activity-control-${++controlCount}`;
  caption.htmlFor = select.id;
  for (const [value, title] of choices) {
    const option = node('option', '', title);
    option.value = value;
    select.append(option);
  }
  select.value = selected;
  select.addEventListener('change', () => onInput(select.value));
  group.append(caption, select);
  return group;
}

function entries(choices) {
  return Object.entries(choices).map(([id, value]) => [id, value.name]);
}

function validChoice(choices, value, fallback) {
  return Object.hasOwn(choices, value) ? value : fallback;
}

function tableView(headings) {
  const details = node('details', 'chart-matrix');
  details.dataset.remember = 'widget-data';
  const table = node('table', 'data-table');
  const header = node('thead');
  const headerRow = node('tr');
  for (const heading of headings) {
    const cell = node('th', '', heading);
    cell.scope = 'col';
    headerRow.append(cell);
  }
  header.append(headerRow);
  const body = node('tbody');
  table.append(header, body);
  details.append(node('summary', '', '查看示例数据'), table);
  return {
    details,
    setRows(rows) {
      body.replaceChildren(...rows.map(([label, ...values]) => {
        const row = node('tr');
        const caption = node('th', '', label);
        caption.scope = 'row';
        row.append(caption, ...values.map(value => node('td', '', value)));
        return row;
      }));
    },
  };
}

function chartView(draw) {
  const canvas = node('canvas', 'chart');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.marginBlockStart = '9px';
  const context = canvas.getContext('2d');
  const paint = () => {
    if (!context) return;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (!width || !height) return;
    const ratio = Math.min(globalThis.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    draw(context, width, height);
  };
  const observer = new ResizeObserver(paint);
  observer.observe(canvas);
  return { canvas, paint, cleanup: () => observer.disconnect() };
}

function line(context, fromX, fromY, toX, toY, color, width = 1) {
  context.beginPath();
  context.strokeStyle = color;
  context.lineWidth = width;
  context.moveTo(fromX, fromY);
  context.lineTo(toX, toY);
  context.stroke();
}

function text(context, value, x, y, color = INK, size = 12, align = 'left') {
  context.fillStyle = color;
  context.font = `${size}px ${FONT}`;
  context.textAlign = align;
  context.textBaseline = 'middle';
  context.fillText(value, x, y);
}

function dot(context, x, y, radius, fill) {
  context.beginPath();
  context.arc(x, y, radius, 0, 2 * Math.PI);
  context.fillStyle = fill;
  context.fill();
}

function liveReading() {
  const reading = node('p', 'callout lab-reading');
  reading.setAttribute('aria-live', 'polite');
  reading.setAttribute('aria-atomic', 'true');
  return reading;
}

function drawClimate(context, width, height, profile, month) {
  const left = 36;
  const right = width - 40;
  const top = 31;
  const bottom = height - 32;
  const slot = (right - left) / 12;
  const monthX = index => left + slot * (index + 0.5);
  const tempY = value => bottom - (value + 10) / 40 * (bottom - top);
  const rainY = value => bottom - value / 300 * (bottom - top);

  context.fillStyle = '#edf1e8';
  context.fillRect(left + slot * month, top, slot, bottom - top);
  text(context, '℃', left - 9, 14, TEMP, 12, 'right');
  text(context, '毫米', right + 8, 14, RAIN);
  for (let tick = 0; tick <= 4; tick += 1) {
    const y = bottom - (bottom - top) * tick / 4;
    line(context, left, y, right, y, GRID);
    text(context, String(tick * 10 - 10), left - 5, y, TEMP, 11, 'right');
    text(context, String(tick * 75), right + 5, y, RAIN, 11);
  }

  profile.rain.forEach((value, index) => {
    const x = monthX(index);
    const y = rainY(value);
    const barWidth = slot * 0.64;
    context.fillStyle = index === month ? '#286b8b' : '#7baac0';
    context.fillRect(x - barWidth / 2, y, barWidth, bottom - y);
    if (slot >= 21 || index % 2 === 0 || index === 11) {
      text(context, String(index + 1), x, bottom + 15, INK, 11, 'center');
    }
  });

  for (let index = 1; index < 12; index += 1) {
    line(
      context, monthX(index - 1), tempY(profile.temperature[index - 1]),
      monthX(index), tempY(profile.temperature[index]), TEMP, 2,
    );
  }
  profile.temperature.forEach((value, index) => {
    dot(context, monthX(index), tempY(value), index === month ? 4.3 : 2.1, TEMP);
  });
}

function climateWidget(host, initial, onChange) {
  const state = {
    profile: validChoice(CLIMATES, initial?.profile, 'north'),
    month: Number.isInteger(initial?.month) && initial.month >= 1 && initial.month <= 12 ? initial.month : 7,
  };
  const update = (key, value) => {
    state[key] = value;
    render();
    onChange({ ...state });
  };
  const controls = node('div', 'grid');
  controls.append(
    field('地点样例', entries(CLIMATES), state.profile, value => update('profile', value)),
    field('查看月份', MONTHS, String(state.month), value => update('month', Number(value))),
  );
  const reading = liveReading();
  const table = tableView(['月份', '平均气温 ℃', '降水 毫米']);
  const chart = chartView((context, width, height) => {
    drawClimate(context, width, height, CLIMATES[state.profile], state.month - 1);
  });
  host.append(chart.canvas, controls, reading, table.details);

  function render() {
    const { name, temperature, rain } = CLIMATES[state.profile];
    const index = state.month - 1;
    const range = Math.max(...temperature) - Math.min(...temperature);
    const total = rain.reduce((sum, month) => sum + month, 0);
    reading.textContent = `${name} ${state.month} 月，平均气温 ${temperature[index]} ℃，降水 ${rain[index]} 毫米。气温年较差 ${range} ℃，全年降水 ${total.toLocaleString('zh-CN')} 毫米。`;
    table.setRows(MONTHS.map(([, label], i) => [label, temperature[i], rain[i]]));
    chart.paint();
  }

  render();
  return chart.cleanup;
}

function drawWeather(context, width, height, day, selected) {
  const slot = (width - 16) / 3;
  const alignY = height / 2;
  for (const [index, forecast] of day.hours.entries()) {
    const left = 8 + index * slot;
    const x = left + slot / 2;
    const active = index === selected;
    if (active) {
      context.fillStyle = '#e8f1e8';
      context.fillRect(left + 3, 12, slot - 6, height - 24);
    }
    if (index > 0) line(context, left, 22, left, height - 22, GRID);
    text(context, PERIODS[index][1], x, alignY - 57, INK, 11, 'center');

    if (forecast.sky === '晴') {
      dot(context, x, alignY - 15, 14, '#c18722');
    } else {
      const cloud = forecast.sky === '多云' ? '#7d9788' : '#47676b';
      dot(context, x - 10, alignY - 13, 10, cloud);
      dot(context, x + 8, alignY - 12, 11, cloud);
      dot(context, x, alignY - 21, 12, cloud);
      if (forecast.sky !== '多云') {
        for (let drop = -1; drop <= 1; drop += 1) {
          line(context, x + drop * 8, alignY + 3, x + drop * 8 - 3, alignY + 9, RAIN, 2);
        }
      }
    }

    text(context, `${forecast.sky} ${forecast.temperature}℃`, x, alignY + 30, INK, 13, 'center');
    if (forecast.thunder) text(context, '雷电预警', x, alignY + 55, TEMP, 12, 'center');
  }
}

function weatherWidget(host, initial, onChange) {
  const state = {
    day: validChoice(DAYS, initial?.day, 'a'),
    period: PERIODS.some(([id]) => id === initial?.period) ? initial.period : 'morning',
  };
  const update = (key, value) => {
    state[key] = value;
    render();
    onChange({ ...state });
  };
  const controls = node('div', 'grid');
  controls.append(
    field('日期样例', entries(DAYS), state.day, value => update('day', value)),
    field('查看时段', PERIODS, state.period, value => update('period', value)),
  );
  const reading = liveReading();
  const table = tableView(['时段', '天气', '气温', '预警']);
  const index = () => PERIODS.findIndex(([period]) => period === state.period);
  const chart = chartView((context, width, height) => {
    drawWeather(context, width, height, DAYS[state.day], index());
  });
  host.append(chart.canvas, controls, reading, table.details);

  function render() {
    const day = DAYS[state.day];
    const selected = index();
    const forecast = day.hours[selected];
    reading.textContent = `${day.name} ${PERIODS[selected][1]}，${forecast.sky}，${forecast.temperature} ℃。${forecast.warning}。`;
    table.setRows(day.hours.map(({ sky, temperature, warning }, i) => [
      PERIODS[i][1], sky, `${temperature} ℃`, warning,
    ]));
    chart.paint();
  }

  render();
  return chart.cleanup;
}

function density(region) {
  return region.population / region.area;
}

const formatNumber = value => value.toLocaleString('zh-CN');

function drawPopulation(context, width, height, regions) {
  const start = 14;
  const end = width - 15;
  const top = 27;
  const bottom = height - 36;
  const totalWidth = end - start;
  text(context, '人口密度（人/平方千米）', start, top);
  for (const tick of [0, 1000, 2000, 3000]) {
    const x = start + totalWidth * tick / 3000;
    line(context, x, top + 19, x, bottom, GRID);
    text(context, formatNumber(tick), x, bottom + 15, INK, 11, tick === 0 ? 'left' : tick === 3000 ? 'right' : 'center');
  }
  for (const [index, region] of regions.entries()) {
    const y = top + 40 + index * (bottom - top) / 2.15;
    const value = density(region);
    const label = index === 0 ? '对照 A' : '对照 B';
    text(context, `${label}  ${region.name}  ${formatNumber(value)}`, start + 4, y - 7, INK, 12);
    context.fillStyle = index === 0 ? '#327856' : '#936632';
    context.fillRect(start, y + 7, totalWidth * value / 3000, 16);
  }
}

function populationWidget(host, initial, onChange) {
  const state = {
    first: validChoice(REGIONS, initial?.first, 'a'),
    second: validChoice(REGIONS, initial?.second, 'b'),
  };
  const update = (key, value) => {
    state[key] = value;
    render();
    onChange({ ...state });
  };
  const controls = node('div', 'grid');
  controls.append(
    field('对照 A', entries(REGIONS), state.first, value => update('first', value)),
    field('对照 B', entries(REGIONS), state.second, value => update('second', value)),
  );
  const selected = () => [REGIONS[state.first], REGIONS[state.second]];
  const reading = liveReading();
  const table = tableView(['地区', '人口', '面积 km²', '密度']);
  const chart = chartView((context, width, height) => {
    drawPopulation(context, width, height, selected());
  });
  host.append(chart.canvas, controls, reading, table.details);

  function render() {
    const [first, second] = selected();
    const valueA = density(first);
    const valueB = density(second);
    let result = '两地密度相同。';
    if (valueA > valueB) result = '对照 A 的密度更大。';
    if (valueA < valueB) result = '对照 B 的密度更大。';
    reading.textContent = `A 为 ${formatNumber(valueA)} 人/平方千米，B 为 ${formatNumber(valueB)} 人/平方千米。${result}`;
    table.setRows([first, second].map(({ name, population, area }, i) => [
      `${i === 0 ? 'A' : 'B'}  ${name}`, formatNumber(population), area, formatNumber(population / area),
    ]));
    chart.paint();
  }

  render();
  return chart.cleanup;
}

const WIDGETS = {
  climate: climateWidget,
  weather: weatherWidget,
  population: populationWidget,
};

export function mountWidget(host, kind, initial, onChange = () => {}) {
  if (!Object.hasOwn(WIDGETS, kind)) return undefined;
  return WIDGETS[kind](host, initial, onChange);
}
