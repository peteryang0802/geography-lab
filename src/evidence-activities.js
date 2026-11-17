const width = 690;
const height = 290;
const ink = '#214339';
const muted = '#486056';
const teal = '#187657';
const blue = '#326790';
const orange = '#a84322';

function line(ctx, points, color, weight = 4, fill) {
  ctx.beginPath();
  points.forEach(([x, y], index) => index === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y));
  if (fill) {
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = weight;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke();
}

function box(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

function circle(ctx, x, y, radius, color, border = color) {
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = border;
  ctx.lineWidth = 3;
  ctx.stroke();
}

function label(ctx, value, x, y, color = ink, size = 29, align = 'left') {
  ctx.fillStyle = color;
  ctx.font = `600 ${size}px system-ui, sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(value, x, y);
}

function arrow(ctx, x, y, endX, endY, color = blue) {
  const angle = Math.atan2(endY - y, endX - x);
  line(ctx, [[x, y], [endX, endY]], color, 4);
  line(ctx, [
    [endX - 11 * Math.cos(angle - Math.PI / 5), endY - 11 * Math.sin(angle - Math.PI / 5)],
    [endX, endY],
    [endX - 11 * Math.cos(angle + Math.PI / 5), endY - 11 * Math.sin(angle + Math.PI / 5)],
  ], color, 4);
}

function marker(ctx, x, y, value, active) {
  circle(ctx, x, y, 22, active ? teal : '#fffdf6', teal);
  label(ctx, value, x, y, active ? 'white' : ink, 27, 'center');
}

const activities = {
  'land-change': {
    description: '左边画着海底岩层，右边画着露出海面的山中岩层。两边的贝壳都是同一组岩层的化石线索。',
    start: '先点「找化石」，看同一层岩石出现在什么地方。',
    options: [
      ['fossil', '找化石', '贝壳化石嵌在岩层里，提示这层岩石形成时可能处在海洋环境。'],
      ['uplift', '看岩层抬升', '如果这片岩层后来上升，海里形成的岩石就可能露出水面，出现在高处。图中是一种解释。'],
    ],
    draw(ctx, selected) {
      box(ctx, 25, 111, 300, 106, '#b7dedf');
      box(ctx, 369, 195, 296, 37, '#b7dedf');
      line(ctx, [[25, 186], [325, 186], [325, 232], [25, 232]], '#9f7954', 3, '#e8c6a3');
      line(ctx, [[369, 232], [410, 172], [481, 131], [529, 80], [576, 138], [665, 232]], '#9f7954', 3, '#e8c6a3');
      line(ctx, [[25, 204], [325, 204]], '#ad8a63', 5);
      line(ctx, [[407, 214], [481, 165], [527, 119], [579, 164], [632, 212]], '#ad8a63', 5);
      if (selected === 'uplift') {
        arrow(ctx, 397, 183, 397, 119, orange);
        arrow(ctx, 624, 182, 624, 119, orange);
      }
      marker(ctx, 168, 204, '贝', selected === 'fossil');
      marker(ctx, 527, 119, '贝', selected === 'fossil');
      label(ctx, '海底的岩层', 175, 255, ink, 29, 'center');
      label(ctx, '出现在山里的岩层', 530, 255, ink, 29, 'center');
      label(ctx, '岩层变化示意', 25, 33, muted, 26);
    },
  },
  'climate-life': {
    description: '三种屋顶接受同样多的雨。平屋顶没有排水口，坡屋顶配檐沟，中间低的屋顶没有另外设置排水口。',
    start: '材料和雨量相同。挑一个屋顶，看看雨往哪儿走。',
    options: [
      ['flat', '平屋顶', '这张图里的平屋顶没有排水口，雨水容易积在屋面上。'],
      ['pitched', '坡屋顶', '水会沿斜面流到两侧，檐沟再把它引开。'],
      ['sunken', '中间低', '两边的水流向中间。这里没有排水口，低处容易积水。'],
    ],
    draw(ctx, selected) {
      const roofs = [
        { key: 'flat', x: 116, shape: [[-75, 126], [75, 126]], name: '平屋顶' },
        { key: 'pitched', x: 345, shape: [[-75, 151], [0, 95], [75, 151]], name: '坡屋顶' },
        { key: 'sunken', x: 574, shape: [[-75, 117], [0, 150], [75, 117]], name: '中间低' },
      ];
      roofs.forEach(({ key, x, shape, name }) => {
        box(ctx, x - 94, 23, 188, 246, selected === key ? '#d8eee1' : '#f4ebd9');
        box(ctx, x - 63, 151, 126, 70, '#dec9a9');
        line(ctx, shape.map(([offset, y]) => [x + offset, y]), ink, 10);
        [-52, 0, 52].forEach((offset) => line(ctx, [[x + offset, 52], [x + offset - 8, 67]], blue, 5));
        label(ctx, name, x, 245, ink, 28, 'center');
      });
      if (selected === 'flat') line(ctx, [[64, 117], [168, 117]], blue, 7);
      if (selected === 'pitched') {
        arrow(ctx, 328, 97, 272, 138);
        arrow(ctx, 362, 97, 418, 138);
        line(ctx, [[254, 148], [254, 165], [273, 165]], blue, 5);
        line(ctx, [[436, 148], [436, 165], [417, 165]], blue, 5);
      }
      if (selected === 'sunken') {
        arrow(ctx, 515, 116, 562, 136);
        arrow(ctx, 633, 116, 586, 136);
        line(ctx, [[559, 141], [588, 141]], blue, 5);
      }
    },
  },
  cooperation: {
    description: '模拟方案：海运32天、3千元，铁路15天、8千元，航空4天、30千元。竖虚线标在18天。',
    start: '先看哪些运输方式能在 18 天内送到，再比价格。',
    options: [
      ['sea', '海运', '3 千元最便宜。32 天才到，比期限晚了 14 天。'],
      ['rail', '铁路', '15 天可以送到。铁路和航空都能准时，铁路花的更少。'],
      ['air', '航空', '4 天可以送到。若只需要在 18 天内送到，还能找一个更省钱的。'],
    ],
    draw(ctx, selected) {
      const rows = [['sea', '海运', 32, 3], ['rail', '铁路', 15, 8], ['air', '航空', 4, 30]];
      const startX = 114;
      const dayWidth = 12;
      const deadlineX = startX + 18 * dayWidth;
      rows.forEach(([key, name, days, cost], index) => {
        const y = 84 + index * 66;
        label(ctx, name, 20, y + 14);
        box(ctx, startX, y, days * dayWidth, 28, selected === key ? teal : '#94bdb2');
        label(ctx, `${days}天 · ${cost}千元`, 515, y + 14, ink, 25);
      });
      ctx.setLineDash([7, 7]);
      line(ctx, [[deadlineX, 59], [deadlineX, 266]], orange, 3);
      ctx.setLineDash([]);
      label(ctx, '18 天期限', deadlineX, 39, orange, 28, 'center');
    },
  },
  'project-earth': {
    description: '三颗想象中的行星记录。甲是岩质，可能有液态水。乙是气态巨行星，没有可着陆的固体表面。丙是岩质，表面过热。',
    start: '要找到能看地表、又可能有液态水的地方。先点一颗看看。',
    options: [
      ['a', '看甲', '有岩石地表，有些地方可能有液态水。可以优先调查，下一步要实际找水。'],
      ['b', '看乙', '主要由气体组成，找不到可着陆的固体表面。这次想探索地表，可以看看别处。'],
      ['c', '看丙', '它有岩石地表，不过已知表面过热。再看看有没有更符合两条线索的地方。'],
    ],
    draw(ctx, selected) {
      box(ctx, 0, 0, width, height, '#edf1ed');
      const planets = [
        ['a', 116, 49, '#70a99f', '甲', '岩质 · 可能有水'],
        ['b', 345, 65, '#cfaa7d', '乙', '气态 · 无固体表面'],
        ['c', 574, 43, '#da9070', '丙', '岩质 · 表面过热'],
      ];
      planets.forEach(([key, x, size, color, name, clue]) => {
        if (key === selected) circle(ctx, x, 121, size + 11, '#eef5eb', teal);
        circle(ctx, x, 121, size, color);
        if (key === 'a') line(ctx, [[x - 30, 115], [x - 17, 109], [x - 5, 118], [x + 9, 109], [x + 24, 119]], '#d2efdf', 8);
        if (key === 'b') {
          box(ctx, x - 53, 105, 106, 12, '#e7cba8');
          box(ctx, x - 42, 140, 84, 10, '#e7cba8');
        }
        if (key === 'c') circle(ctx, x + 11, 115, 13, '#ad5f48');
        label(ctx, name, x, 209, ink, 31, 'center');
        label(ctx, clue, x, 246, ink, 24, 'center');
      });
    },
  },
  'project-seafloor': {
    description: '从左侧陆地出发，甲在近岸水浅且平缓处，乙在变深很快的坡上，丙在远岸又深又宽的地方。图未按比例绘制。',
    start: '从左到右点三处。哪一段突然变深？',
    options: [
      ['shelf', '甲 · 近岸', '岸边这段水浅，海底坡度也小。这一段叫大陆架。'],
      ['slope', '乙 · 中段', '水平往前一点，深度就变了很多。这一段叫大陆坡。'],
      ['basin', '丙 · 远海', '远处的海底深而宽。这张剖面里，它是洋盆。'],
    ],
    draw(ctx, selected) {
      box(ctx, 0, 77, width, 192, '#bcdde8');
      line(ctx, [[0, 59], [77, 59], [120, 99], [262, 123], [377, 216], [460, 229], [690, 228], [690, 290], [0, 290]], '#9b7753', 4, '#dec39e');
      line(ctx, [[96, 77], [665, 77]], blue, 3);
      if (selected === 'shelf') line(ctx, [[120, 99], [262, 123]], teal, 8);
      if (selected === 'slope') line(ctx, [[262, 123], [377, 216]], teal, 8);
      if (selected === 'basin') line(ctx, [[459, 229], [665, 228]], teal, 8);
      marker(ctx, 185, 110, '甲', selected === 'shelf');
      marker(ctx, 321, 168, '乙', selected === 'slope');
      marker(ctx, 570, 230, '丙', selected === 'basin');
      label(ctx, '陆地', 23, 30, muted, 24);
      label(ctx, '海面', 573, 53, blue, 26);
    },
  },
  'project-nest': {
    description: '模拟鸟种喜欢安静、有遮挡的地方。A是敞开的风口，B有树，C在有人来往的步道旁。',
    start: '风从左边吹来，步道上有人经过。给图上的鸟选个地方。',
    options: [
      ['a', 'A · 风口', '这里风能直接吹过，又没有遮挡。看看哪一处能躲风。'],
      ['b', 'B · 树旁', '这里有树挡着，离人走的地方也远。符合这种模拟鸟的两条线索。'],
      ['c', 'C · 步道边', '这里容易看到鸟巢，经过的人也多。这个模拟鸟种偏爱安静的地方。'],
    ],
    draw(ctx, selected) {
      box(ctx, 0, 147, width, 143, '#d6e6c5');
      line(ctx, [[492, 286], [528, 227], [636, 142]], '#d0b28a', 45);
      arrow(ctx, 37, 90, 179, 90);
      arrow(ctx, 58, 123, 149, 123);
      box(ctx, 327, 101, 23, 87, '#8b694b');
      circle(ctx, 306, 100, 40, '#7da271');
      circle(ctx, 344, 77, 45, '#698b5d');
      circle(ctx, 378, 101, 36, '#7da271');
      circle(ctx, 603, 125, 11, '#7e705b');
      line(ctx, [[603, 139], [603, 168], [588, 184]], '#7e705b', 6);
      line(ctx, [[603, 168], [619, 183]], '#7e705b', 6);
      marker(ctx, 102, 189, 'A', selected === 'a');
      marker(ctx, 370, 189, 'B', selected === 'b');
      marker(ctx, 574, 215, 'C', selected === 'c');
      label(ctx, '风口', 34, 47, blue, 28);
      label(ctx, '步道', 642, 83, ink, 28, 'center');
    },
  },
  'project-made-in-china': {
    description: '模拟测温。室温下装满热水并盖紧，6小时后水温为62摄氏度。记录只有这一次测试，未比较别的产品。',
    start: '这张记录能支持下面哪一句？',
    options: [
      ['tested', '这次测得 62 ℃', '这句话只说了这次量到的结果。介绍时还可以补上“装满热水并盖紧，6 小时后”。'],
      ['best', '它最保温', '这张记录里只有一个杯子的结果。要说谁最保温，需要一样的条件下测几种杯子。'],
      ['always', '每次都一样', '装进去的水温、室温和有没有盖紧都可能变。这条记录只说了这一次。'],
    ],
    draw(ctx, selected) {
      box(ctx, 53, 85, 117, 156, '#83aaa1');
      box(ctx, 65, 55, 93, 28, '#47756a');
      box(ctx, 71, 100, 13, 125, '#c3e1d6');
      box(ctx, 235, 37, 423, 213, selected === 'tested' ? '#deeee3' : '#f4ebd9');
      label(ctx, '模拟测温记录', 263, 69, ink, 28);
      label(ctx, '室温 · 装满热水并盖紧', 263, 115, muted, 25);
      label(ctx, '6 小时后', 263, 182, ink, 31);
      label(ctx, '62 ℃', 448, 181, teal, 55);
    },
  },
};

const routeStops = {
  start: { label: '起点', x: 79, y: 228 },
  flag1: { label: '1号旗', x: 202, y: 153 },
  bridge: { label: '过桥', x: 339, y: 83 },
  flag2: { label: '2号旗', x: 492, y: 153 },
  finish: { label: '终点', x: 607, y: 228 },
};
const routeAnswer = ['flag1', 'bridge', 'flag2', 'finish'];

function drawRoute(ctx, path) {
  box(ctx, 296, 0, 86, height, '#a6d4e6');
  box(ctx, 277, 69, 124, 28, '#b58d60');
  label(ctx, '↑ 北', 26, 31, muted, 28);
  label(ctx, '桥', 339, 48, ink, 27, 'center');
  label(ctx, '河', 339, 265, blue, 27, 'center');

  let previous = routeStops.start;
  let crossed = false;
  path.forEach((key) => {
    const next = routeStops[key];
    if (key === 'bridge') {
      const nearX = crossed ? 397 : 281;
      const farX = crossed ? 281 : 397;
      line(ctx, [[previous.x, previous.y], [nearX, 83], [farX, 83]], teal, 6);
      previous = { x: farX, y: 83 };
      crossed = !crossed;
      return;
    }
    const targetCrossed = next.x > 382;
    const crossesWater = crossed !== targetCrossed;
    ctx.setLineDash(crossesWater ? [10, 11] : []);
    line(ctx, [[previous.x, previous.y], [next.x, next.y]], crossesWater ? orange : teal, 6);
    ctx.setLineDash([]);
    crossed = targetCrossed;
    previous = next;
  });

  marker(ctx, 202, 153, '1', path.includes('flag1'));
  marker(ctx, 492, 153, '2', path.includes('flag2'));
  label(ctx, '起点', 79, 252, ink, 27, 'center');
  label(ctx, '终点', 607, 252, ink, 27, 'center');
}

function routeFeedback(path) {
  if (path.length === 0) return '从起点出发。先点你想去的地方。';
  const mismatch = path.findIndex((stop, index) => stop !== routeAnswer[index]);
  const hints = ['1 号旗和起点在同一边，可以先去找 1 号旗。', '两面旗中间隔着河。看看桥在 1 号旗的哪一边。', '过桥后先找东岸的 2 号旗。', '两面旗都找到了。再走到终点。'];
  if (mismatch >= 0) return hints[mismatch];
  if (path.length === routeAnswer.length) return '两面旗都找到了，也从桥上过了河。';
  return hints[path.length];
}

function activityFrame(host, description) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', description);
  canvas.style.cssText = 'display:block;width:100%;height:auto;max-height:215px;object-fit:contain;border-radius:12px;background:#f8f4e9';
  const controls = document.createElement('div');
  controls.className = 'actions';
  controls.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;margin:8px 0';
  const feedback = document.createElement('p');
  feedback.setAttribute('role', 'status');
  feedback.style.cssText = 'margin:4px 0 0;min-height:2.9em;line-height:1.45';
  host.replaceChildren(canvas, controls, feedback);
  const ctx = canvas.getContext('2d');
  return { controls, feedback, paint(draw, value) {
    if (!ctx) return;
    box(ctx, 0, 0, width, height, '#f8f4e9');
    draw(ctx, value);
  } };
}

function addButton(controls, title, onClick) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'chip';
  button.style.minHeight = '44px';
  button.textContent = title;
  button.addEventListener('click', onClick);
  controls.append(button);
  return button;
}

function mountRoute(host, saved, onChange) {
  const { controls, feedback, paint } = activityFrame(host, '上方为北。起点和1号旗在河西岸，2号旗和终点在东岸。唯一的桥在1号旗北面。');
  let path = Array.isArray(saved?.path) ? saved.path.filter((stop) => routeAnswer.includes(stop)).slice(0, 4) : [];
  const stops = routeAnswer.map((key) => addButton(controls, routeStops[key].label, () => {
    path = path.length === routeAnswer.length ? [key] : [...path, key];
    update();
    onChange?.({ path });
  }));
  const undo = addButton(controls, '退一步', () => {
    path = path.slice(0, -1);
    update();
    onChange?.({ path });
  });
  function update() {
    undo.disabled = path.length === 0;
    stops.forEach((button, index) => button.dataset.active = String(path.includes(routeAnswer[index])));
    const names = path.map((key) => routeStops[key].label);
    feedback.textContent = `${names.length ? `起点 → ${names.join(' → ')}。` : ''}${routeFeedback(path)}`;
    paint(drawRoute, path);
  }
  update();
}

export function hasEvidenceActivity(id) {
  return id === 'project-orienteering' || Object.hasOwn(activities, id);
}

export function mountEvidenceActivity(host, id, saved, onChange) {
  if (id === 'project-orienteering') {
    mountRoute(host, saved, onChange);
    return;
  }
  if (!hasEvidenceActivity(id)) return;
  const { description, start, options, draw } = activities[id];
  const { controls, feedback, paint } = activityFrame(host, description);
  let selected = saved?.selected;
  const buttons = options.map(([key, title]) => addButton(controls, title, () => {
    selected = key;
    update();
    onChange?.({ selected });
  }));
  function update() {
    buttons.forEach((button, index) => {
      const active = String(selected === options[index][0]);
      button.setAttribute('aria-pressed', active);
      button.dataset.active = active;
    });
    feedback.textContent = options.find(([key]) => key === selected)?.[2] ?? start;
    paint(draw, selected);
  }
  update();
}
