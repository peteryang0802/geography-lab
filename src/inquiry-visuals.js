const width = 600;
const legendHeight = 302;
const rainHeight = 399;
const ink = '#143b39';
const paper = '#fffbed';
const green = '#2c6050';
const trace = '#9f552e';
const blue = '#4987a0';

const legendItems = {
  river: { label: '蓝线', feedback: '蓝色带表示小河。在这张图里，图例用同样的蓝色带解释了它的含义。' },
  path: { label: '棕虚线', feedback: '棕虚线表示步道。沿这种线走，能从入口走到观景台。' },
  bridge: { label: '桥的符号', point: [352, 134], feedback: '两道短横表示桥。看符号就知道这里可以过河，再看旁边的字，才知道桥叫什么。' },
  name: { label: '小石桥', point: [454, 176], feedback: '“小石桥”是注记，告诉你这座桥叫什么。“松溪公园地图”是整张图的图名。' },
  elevation: { label: '128 米', point: [209, 69], feedback: '“128 米”也是注记。它写的是观景台的海拔。注记可以是名称，也可以是数字。' },
};

const predictions = {
  high: 'A 坡上',
  low: 'B 低洼处',
  unsure: '我还不确定',
};

function surface(host, height, description, draw) {
  const canvas = host.querySelector('canvas');
  const ctx = canvas.getContext('2d');
  canvas.setAttribute('aria-label', description);
  canvas.width = width;
  canvas.height = height;
  Object.assign(canvas.style, { display: 'block', width: '100%', height: 'auto', aspectRatio: `${width} / ${height}` });

  function paint() {
    const boxWidth = canvas.getBoundingClientRect().width;
    if (!ctx || !boxWidth) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const pixelWidth = Math.round(boxWidth * ratio);
    const pixelHeight = Math.round(pixelWidth * height / width);
    if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
    if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
    ctx.setTransform(pixelWidth / width, 0, 0, pixelHeight / height, 0, 0);
    draw(ctx);
  }

  const observer = new ResizeObserver(paint);
  observer.observe(canvas);
  return { canvas, paint, dispose: () => observer.disconnect() };
}

function pointOf(event, canvas, height) {
  const bounds = canvas.getBoundingClientRect();
  return [(event.clientX - bounds.left) * width / bounds.width, (event.clientY - bounds.top) * height / bounds.height];
}

function nearLine(x, y, points, reach) {
  return points.slice(1).some(([endX, endY], index) => {
    const [startX, startY] = points[index];
    const dx = endX - startX;
    const dy = endY - startY;
    const fraction = Math.max(0, Math.min(1, ((x - startX) * dx + (y - startY) * dy) / (dx ** 2 + dy ** 2)));
    return Math.hypot(x - (startX + fraction * dx), y - (startY + fraction * dy)) <= reach;
  });
}

function stroke(ctx, points, color, size, dash = []) {
  ctx.beginPath();
  ctx.moveTo(...points[0]);
  for (const point of points.slice(1)) ctx.lineTo(...point);
  ctx.lineWidth = size;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = color;
  ctx.setLineDash(dash);
  ctx.stroke();
  ctx.setLineDash([]);
}

function fill(ctx, points, color) {
  ctx.beginPath();
  ctx.moveTo(...points[0]);
  for (const point of points.slice(1)) ctx.lineTo(...point);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function ellipse(ctx, x, y, radiusX, radiusY, color) {
  ctx.beginPath();
  ctx.ellipse(x, y, radiusX, radiusY, 0, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}

function label(ctx, value, x, y, { color = ink, size = 23, align = 'center' } = {}) {
  ctx.font = `700 ${size}px system-ui, sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(value, x, y);
}

function pill(ctx, value, x, y, { active = false, size = 23, color = ink } = {}) {
  ctx.font = `700 ${size}px system-ui, sans-serif`;
  const textWidth = ctx.measureText(value).width;
  ctx.beginPath();
  ctx.roundRect(x - (textWidth + 23) / 2, y - (size + 13) / 2, textWidth + 23, size + 13, 7);
  ctx.fillStyle = active ? '#f5cc80' : paper;
  ctx.fill();
  label(ctx, value, x, y + 1, { size, color });
}

function trees(ctx, positions) {
  for (const [x, y, scale = 1] of positions) {
    stroke(ctx, [[x, y], [x, y + 7 * scale]], '#51765e', 2);
    fill(ctx, [[x - 8 * scale, y + 2 * scale], [x, y - 15 * scale], [x + 8 * scale, y + 2 * scale]], '#72977c');
  }
}

function compass(ctx, x, y) {
  label(ctx, '北', x, y, { size: 22 });
  stroke(ctx, [[x, y + 47], [x, y + 16]], ink, 3);
  fill(ctx, [[x, y + 12], [x - 8, y + 27], [x + 8, y + 27]], ink);
}

const parkPath = [[62, 265], [104, 222], [129, 189], [112, 128], [163, 84], [205, 104], [250, 112], [297, 132], [367, 138], [441, 125], [494, 107]];
const parkRiver = [[317, -12], [321, 20], [336, 50], [353, 71], [366, 103], [355, 132], [333, 158], [325, 183], [334, 213], [346, 235], [360, 271], [367, 310]];

function drawLegend(ctx, selected) {
  ctx.fillStyle = '#e8edda';
  ctx.fillRect(0, 0, width, legendHeight);
  fill(ctx, [[0, 0], [247, 0], [276, 76], [218, 135], [146, 164], [39, 168], [0, 204]], '#cedfc1');
  fill(ctx, [[600, 198], [600, 302], [449, 302], [445, 261], [470, 228]], '#d6e4c7');
  trees(ctx, [[34, 41, 1.4], [59, 53, 1.1], [92, 28], [117, 53, 1.3], [32, 101], [52, 122, 1.25], [528, 228, 1.25], [559, 224], [546, 260, 1.4], [579, 270]]);
  stroke(ctx, [[-10, 286], [74, 263], [152, 278], [233, 313]], '#c6b89d', 18);
  stroke(ctx, parkRiver, selected === 'river' ? '#e6aa4c' : '#c3dce0', selected === 'river' ? 42 : 36);
  stroke(ctx, parkRiver, blue, selected === 'river' ? 29 : 25);
  stroke(ctx, parkRiver, '#a1ced4', 4);
  stroke(ctx, parkPath, paper, 12);
  if (selected === 'path') stroke(ctx, parkPath, '#f3bc64', 16);
  stroke(ctx, parkPath, trace, selected === 'path' ? 6 : 4, [12, 8]);
  stroke(ctx, [[326, 130], [379, 140]], selected === 'bridge' ? '#e7a84d' : '#e4dbc1', 21);
  stroke(ctx, [[327, 123], [380, 133]], ink, 3);
  stroke(ctx, [[325, 138], [378, 148]], ink, 3);
  stroke(ctx, [[376, 148], [397, 174]], green, 2);
  pill(ctx, '小石桥', 454, 176, { active: selected === 'name' });
  ellipse(ctx, 203, 103, 7, 7, ink);
  stroke(ctx, [[203, 100], [208, 81]], green, 2);
  pill(ctx, '观景台 128 米', 209, 69, { active: selected === 'elevation' });
  ellipse(ctx, 62, 265, 6, 6, ink);
  pill(ctx, '入口', 51, 234, { size: 22 });
  compass(ctx, 552, 34);
}

export function mountLegendInquiry(host, saved = {}, onChange = () => {}) {
  if (!host) return;
  let selected = Object.hasOwn(legendItems, saved?.selected) ? saved.selected : null;
  host.innerHTML = `
    <div class="inquiry-visual legend-inquiry">
      <figure class="inquiry-figure">
        <figcaption><strong>松溪公园地图</strong> <small>教学示意</small></figcaption>
        <canvas role="img"></canvas>
      </figure>
      <div class="inquiry-key" aria-label="地图图例">
        <strong>图例</strong>
        <span data-legend-key="river"><b aria-hidden="true" style="color:#4987a0">━</b> 小河</span>
        <span data-legend-key="path"><b aria-hidden="true" style="color:#9f552e">┄</b> 步道</span>
        <span data-legend-key="bridge"><b aria-hidden="true" style="color:#143b39">═</b> 桥</span>
      </div>
      <div class="inquiry-controls mini-actions" role="group" aria-label="选择图上的一处">
        ${Object.entries(legendItems).map(([id, item]) => `<button class="chip" type="button" data-legend-pick="${id}" aria-pressed="false">${item.label}</button>`).join('')}
      </div>
      <p class="inquiry-feedback" role="status"></p>
    </div>`;

  const controls = host.querySelector('.inquiry-controls');
  const feedback = host.querySelector('.inquiry-feedback');
  const drawing = surface(host, legendHeight, '松溪公园示意地图，棕色步道经过观景台，跨过小河上的小石桥。', ctx => drawLegend(ctx, selected));

  function refresh() {
    for (const button of controls.querySelectorAll('button')) {
      button.setAttribute('aria-pressed', String(button.dataset.legendPick === selected));
    }
    for (const key of host.querySelectorAll('[data-legend-key]')) {
      key.toggleAttribute('data-active', key.dataset.legendKey === selected);
    }
    feedback.textContent = legendItems[selected]?.feedback || '点一处图上的线、桥或文字，看看它告诉你什么。';
    drawing.paint();
  }

  function select(id) {
    selected = id;
    refresh();
    onChange({ selected });
  }

  function onControlClick(event) {
    const id = event.target.closest('button')?.dataset.legendPick;
    if (id) select(id);
  }

  function onMapClick(event) {
    const [x, y] = pointOf(event, drawing.canvas, legendHeight);
    const picked = Object.entries(legendItems).find(([, { point }]) => point && Math.hypot(point[0] - x, point[1] - y) < 43);
    if (picked) select(picked[0]);
    else if (nearLine(x, y, parkRiver, 24)) select('river');
    else if (nearLine(x, y, parkPath, 23)) select('path');
  }

  controls.addEventListener('click', onControlClick);
  drawing.canvas.addEventListener('click', onMapClick);
  refresh();
  return () => {
    drawing.dispose();
    controls.removeEventListener('click', onControlClick);
    drawing.canvas.removeEventListener('click', onMapClick);
  };
}

const rainSpots = { high: [157, 119], low: [401, 155] };
const slope = [[0, 305], [82, 263], [151, 252], [215, 267], [271, 293], [330, 320], [400, 337], [454, 324], [529, 288], [600, 281]];

function puddle(ctx, x, y, drained) {
  const radiusX = drained ? 24 : 58;
  const radiusY = drained ? 10 : 22;
  if (drained) {
    ctx.beginPath();
    ctx.ellipse(x, y, 58, 22, 0, 0, Math.PI * 2);
    ctx.strokeStyle = '#24658a';
    ctx.lineWidth = 3;
    ctx.setLineDash([6, 5]);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ellipse(ctx, x, y, radiusX + 2, radiusY + 2, '#164e77');
  ellipse(ctx, x, y, radiusX, radiusY, '#559bc1');
  stroke(ctx, [[x - 12, y - 2], [x + 10, y - 2]], '#d7f4f8', 3);
}

function drawRain(ctx, { prediction, showRain, showDrain }) {
  ctx.fillStyle = '#e4edda';
  ctx.fillRect(0, 0, width, 202);
  ellipse(ctx, 137, 100, 126, 65, '#d0e1c3');
  ellipse(ctx, 137, 100, 94, 46, '#b8d2ae');
  ellipse(ctx, 396, 155, 85, 34, '#cfdfc7');
  trees(ctx, [[28, 105], [53, 118], [96, 68], [124, 63], [481, 43], [509, 48], [531, 32], [522, 197]]);

  const lane = [[-8, 163], [62, 148], [157, 119], [230, 114], [311, 130], [401, 155], [493, 134], [533, 95], [607, 74]];
  stroke(ctx, lane, '#b9ad92', 19);
  stroke(ctx, lane, paper, 15);
  stroke(ctx, lane, '#a36648', 2.5, [9, 8]);

  if (showRain) {
    puddle(ctx, 401, 155, showDrain);
    stroke(ctx, [[244, 163], [300, 178], [347, 179]], '#3b758d', 3);
    stroke(ctx, [[334, 171], [347, 179], [335, 187]], '#3b758d', 3);
  }
  if (showRain && showDrain) {
    stroke(ctx, [[429, 157], [475, 177], [523, 177]], '#1c4c74', 5, [8, 6]);
    stroke(ctx, [[509, 169], [523, 177], [509, 184]], '#1c4c74', 4);
    pill(ctx, '排水口', 535, 145, { size: 20 });
    label(ctx, '原水迹', 398, 191, { color: '#18486b', size: 19 });
  }
  pill(ctx, '俯视图', 71, 30, { size: 23 });
  pill(ctx, showRain ? '雨停 10 分钟' : '同一条上学路', 326, 30, { size: 23 });
  if (showRain) pill(ctx, showDrain ? '排水口开' : '排水口关', 513, 43, { size: 23, color: '#154e74' });

  ctx.fillStyle = '#f2e9d3';
  ctx.fillRect(0, 202, width, rainHeight - 202);
  fill(ctx, [...slope, [600, rainHeight], [0, rainHeight]], '#b1956e');
  stroke(ctx, [[0, 341], [110, 320], [203, 330], [302, 363], [421, 368], [530, 351], [600, 333]], '#987a58', 2);
  stroke(ctx, [[0, 379], [103, 354], [211, 360], [345, 388], [471, 394], [582, 357], [600, 350]], '#9c7e58', 2);
  stroke(ctx, slope, green, 6);

  if (showRain) {
    fill(ctx, showDrain ? [[367, 326], [443, 326], [400, 337]]
      : [[313, 312], [480, 312], [454, 324], [400, 337], [330, 320]], '#397da7');
    if (showDrain) stroke(ctx, [[313, 312], [480, 312]], '#12456d', 4, [7, 6]);
  }
  if (showRain && showDrain) {
    stroke(ctx, [[406, 336], [419, 351], [528, 358]], '#3d6370', 5);
    stroke(ctx, [[507, 350], [528, 358], [512, 367]], '#3d6370', 3);
  }
  pill(ctx, '侧面图', 71, 227, { size: 23 });
  for (const [id, [x, y]] of Object.entries(rainSpots)) {
    const selected = prediction === id;
    if (id === 'low' && showRain) {
      stroke(ctx, [[x, y - 27], [x, y - 43]], ink, 2.5);
      pill(ctx, 'B 低洼处', x, y - 55, { active: selected });
    } else {
      ellipse(ctx, x, y, selected ? 12 : 8, selected ? 12 : 8, selected ? '#91481f' : ink);
      ellipse(ctx, x, y, 4, 4, paper);
      pill(ctx, id === 'high' ? 'A 坡上' : 'B 低洼处', x + 1, y - 33, { active: selected });
    }
    const baseY = id === 'high' ? 252 : 337;
    const sideLabel = id === 'high' ? 'A' : 'B';
    pill(ctx, sideLabel, x, baseY - 27, { active: selected, size: 22 });
    if (id === 'high' || !showRain) ellipse(ctx, x, baseY, 5, 5, ink);
  }
}

export function mountRainInquiry(host, saved = {}, onChange = () => {}, { view } = {}) {
  if (!host) return;
  const state = {
    prediction: Object.hasOwn(predictions, saved?.prediction) ? saved.prediction : null,
    showRain: saved?.showRain === true,
    showDrain: saved?.showRain === true && saved?.showDrain === true,
  };
  const safeView = /^[abc]$/i.test(view) ? String(view).toLowerCase() : '';
  host.innerHTML = `
    <div class="inquiry-visual rain-inquiry" data-inquiry-view="${safeView}">
      <figure class="inquiry-figure">
        <canvas role="img"></canvas>
        <figcaption>上学路模拟。两处下同一场雨，在同一时刻观察。</figcaption>
      </figure>
      <div class="inquiry-controls mini-actions" role="group" aria-label="预测积水的位置">
        ${Object.entries(predictions).map(([id, label]) => `<button class="chip" type="button" data-rain-predict="${id}" aria-pressed="false">${label}</button>`).join('')}
      </div>
      <div class="inquiry-observations mini-actions">
        <button class="button" type="button" data-rain-test aria-pressed="false">看雨后</button>
        <button class="button" type="button" data-rain-drain aria-pressed="false" hidden>打开排水口</button>
      </div>
      <p class="inquiry-feedback" role="status"></p>
    </div>`;

  const controls = host.querySelector('.inquiry-visual');
  const predictionButtons = controls.querySelectorAll('[data-rain-predict]');
  const rainButton = controls.querySelector('[data-rain-test]');
  const drainButton = controls.querySelector('[data-rain-drain]');
  const feedback = controls.querySelector('.inquiry-feedback');
  const drawing = surface(host, rainHeight, '同一条上学路的俯视图和侧面图。A 在坡上，B 在低洼处。', ctx => drawRain(ctx, state));

  function refresh() {
    for (const button of predictionButtons) {
      button.setAttribute('aria-pressed', String(button.dataset.rainPredict === state.prediction));
    }
    rainButton.setAttribute('aria-pressed', String(state.showRain));
    rainButton.textContent = state.showRain ? '回到雨前' : '看雨后';
    drainButton.hidden = !state.showRain;
    drainButton.setAttribute('aria-pressed', String(state.showDrain));
    drainButton.textContent = state.showDrain ? '关闭排水口' : '打开排水口';
    if (state.showDrain) {
      feedback.textContent = 'B 的水洼变小了。地势、雨量和观察时间都一样，这次只改变了排水口。';
    } else if (state.showRain) {
      feedback.textContent = '雨停 10 分钟，A 没有明显积水，B 留下了水洼。再打开 B 的排水口，看看会有什么变化。';
    } else if (state.prediction) {
      feedback.textContent = state.prediction === 'unsure' ? '可以先不猜。点“看雨后”，比较 A 和 B。'
        : `你选了 ${predictions[state.prediction]}。点“看雨后”，检查你看到的线索。`;
    } else {
      feedback.textContent = '雨刚停，A 和 B 哪处还会有水洼？可以先选一个，也可以直接看雨后。';
    }
    drawing.paint();
  }

  function change(partial) {
    Object.assign(state, partial);
    refresh();
    onChange({ ...state });
  }

  function onControlClick(event) {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.dataset.rainPredict) change({ prediction: button.dataset.rainPredict });
    if (button === rainButton) change({ showRain: !state.showRain, showDrain: false });
    if (button === drainButton && state.showRain) change({ showDrain: !state.showDrain });
  }

  function onMapClick(event) {
    const [x, y] = pointOf(event, drawing.canvas, rainHeight);
    const target = Object.entries(rainSpots).find(([, [px, py]]) => Math.hypot(px - x, py - y) < 45);
    if (target) change({ prediction: target[0] });
  }

  controls.addEventListener('click', onControlClick);
  drawing.canvas.addEventListener('click', onMapClick);
  refresh();
  return () => {
    drawing.dispose();
    controls.removeEventListener('click', onControlClick);
    drawing.canvas.removeEventListener('click', onMapClick);
  };
}
