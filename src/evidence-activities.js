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

function spot(ctx, x, y, value, active) {
  circle(ctx, x, y, active ? 7 : 4, active ? teal : ink);
  label(ctx, value, x, y - 23, ink, 25, 'center');
}

function shell(ctx, x, y, active) {
  const points = Array.from({ length: 40 }, (_, index) => {
    const angle = index * 0.35;
    const radius = 0.9 * index;
    return [x + radius * Math.cos(angle), y + radius * Math.sin(angle)];
  });
  line(ctx, points, active ? '#764119' : ink, active ? 6 : 3);
}

const deliveryOptions = [
  ['sea', '海运', 32, 3],
  ['rail', '铁路', 15, 8],
  ['air', '航空', 4, 30],
];

const activities = {
  'land-change': {
    description: '左边画着海底岩层，右边画着露出海面的山中岩层。同一组岩层里发现了海洋动物的贝壳化石。',
    start: '先点「找化石」，看同一层岩石出现在什么地方。',
    options: [
      ['fossil', '找化石', '海洋动物的贝壳嵌在这组岩层里，提示岩石形成时可能处在海洋环境。'],
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
      shell(ctx, 168, 197, selected === 'fossil');
      shell(ctx, 527, 112, selected === 'fossil');
      label(ctx, '海底的岩层', 175, 255, ink, 29, 'center');
      label(ctx, '出现在山里的岩层', 530, 255, ink, 29, 'center');
      label(ctx, '岩层变化示意', 25, 33, muted, 26);
    },
  },
  'climate-life': {
    description: drained => '三种屋顶接受同样多的雨。平屋顶没有排水口，坡屋顶配檐沟。' + (drained ? '中间低的屋顶增加了排水口。' : '中间低的屋顶还未加排水口。'),
    start: '材料和雨量相同。挑一个屋顶，看看雨往哪儿走。',
    options: [
      ['flat', '平屋顶', '这张图里的平屋顶没有排水口，雨水容易积在屋面上。'],
      ['pitched', '坡屋顶', '水会沿斜面流到两侧，檐沟再把它引开。'],
      ['sunken', '中间低', '两边的水流向中间。这里没有排水口，低处容易积水。'],
    ],
    adjustment: {
      label: '给低处加排水口',
      focus: 'sunken',
      feedback: selected => selected === 'sunken' ? '两边的水仍流向中间。加上出口后，雨水能沿着管道离开屋顶。' : '',
    },
    draw(ctx, selected, drained) {
      const roofs = [
        { key: 'flat', x: 116, shape: [[-75, 126], [75, 126]], name: '平屋顶' },
        { key: 'pitched', x: 345, shape: [[-75, 151], [0, 95], [75, 151]], name: '坡屋顶' },
        { key: 'sunken', x: 574, shape: [[-75, 117], [0, 150], [75, 117]], name: '中间低' },
      ];
      for (const x of [229, 459]) line(ctx, [[x, 52], [x, 241]], '#d8cdb7', 2);
      roofs.forEach(({ key, x, shape, name }) => {
        box(ctx, x - 63, 151, 126, 70, '#dec9a9');
        line(ctx, shape.map(([offset, y]) => [x + offset, y]), ink, 10);
        [-52, 0, 52].forEach((offset) => line(ctx, [[x + offset, 52], [x + offset - 8, 67]], blue, 5));
        label(ctx, name, x, 245, selected === key ? teal : ink, 28, 'center');
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
        if (!drained) line(ctx, [[559, 141], [588, 141]], blue, 5);
      }
      if (drained) arrow(ctx, 574, 143, 574, 211);
    },
  },
  cooperation: {
    description: urgent => `模拟方案。海运 32 天、3 千元，铁路 15 天、8 千元，航空 4 天、30 千元。竖虚线标在 ${urgent ? '10' : '18'} 天。`,
    start: '先看哪些运输方式能在 18 天内送到，再比价格。',
    options: [
      ['sea', '海运', '3 千元最便宜。32 天才到，比期限晚了 14 天。'],
      ['rail', '铁路', '15 天可以送到。铁路和航空都能准时，铁路花的更少。'],
      ['air', '航空', '4 天可以送到。若只需要在 18 天内送到，还能找一个更省钱的。'],
    ],
    adjustment: {
      label: '期限改为 10 天',
      feedback: selected => ({
        sea: '海运最便宜，却需要 32 天。10 天的期限内来不及。',
        rail: '铁路要 15 天。原来能准时，改成 10 天就来不及了。',
        air: '飞机只要 4 天。这组报价里，只有航空能在 10 天内送到。',
      })[selected] ?? '期限线往左移了。看看还有哪根条来得及。',
    },
    draw(ctx, selected, urgent) {
      const deadline = urgent ? 10 : 18;
      const startX = 114;
      const dayWidth = 12;
      const deadlineX = startX + deadline * dayWidth;
      deliveryOptions.forEach(([key, name, days, cost], index) => {
        const y = 84 + index * 66;
        label(ctx, name, 20, y + 14);
        box(ctx, startX, y + 3, days * dayWidth, days <= deadline ? 23 : 18, selected === key ? teal : days <= deadline ? '#94bdb2' : '#ccc3ae');
        label(ctx, `${days}天 · ${cost}千元`, 515, y + 14, ink, 25);
      });
      ctx.setLineDash([7, 7]);
      line(ctx, [[deadlineX, 59], [deadlineX, 266]], orange, 3);
      ctx.setLineDash([]);
      label(ctx, `${deadline} 天期限`, deadlineX, 39, orange, 28, 'center');
    },
  },
  'project-earth': {
    description: '从左到右是三颗想象中的行星，甲、乙、丙。点行星或用按钮查观测记录。',
    start: '点一颗行星看记录，再比较能不能着陆、有没有可能存在液态水。',
    hotspots: { a: { x: 116, y: 121 }, b: { x: 345, y: 121 }, c: { x: 574, y: 121 } },
    revealOnVisit: true,
    options: [
      ['a', '看甲', '有岩石地表，有些地方可能有液态水。可以优先调查，下一步要实际找水。'],
      ['b', '看乙', '主要由气体组成，找不到可着陆的固体表面。这次想探索地表，可以看看别处。'],
      ['c', '看丙', '它有岩石地表，不过已知表面过热。再看看有没有更符合两条线索的地方。'],
    ],
    draw(ctx, selected, _alternate, visited) {
      box(ctx, 0, 0, width, height, '#edf1ed');
      const planets = [
        ['a', 116, 49, '#70a99f', '甲', '岩质 · 或有液态水'],
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
        if (visited.has(key)) label(ctx, clue, x, 246, ink, 24, 'center');
      });
    },
  },
  'project-seafloor': {
    description: '距海面深度。甲在近岸，深 90 米。乙在陡坡上，深 480 米。丙在远岸平底上，深 2500 米。剖面为示意，未按比例绘制。',
    start: '模拟潜水艇最多能下潜 500 米。先找海底突然变深的地方，再挑一个能到的站点。',
    options: [
      ['shelf', '查看甲站', '这里水浅，海底平缓，是大陆架。深 90 米，潜水艇能到。'],
      ['slope', '查看乙站', '水平往前一点，深度就变了很多，这是大陆坡。乙站深 480 米，潜水艇也能到。'],
      ['basin', '查看丙站', '这里深而宽，是洋盆。深 2,500 米，超过潜水艇的下潜上限。'],
    ],
    draw(ctx, selected) {
      box(ctx, 0, 77, width, 192, '#bcdde8');
      line(ctx, [[0, 59], [77, 59], [120, 99], [262, 123], [377, 216], [460, 229], [690, 228], [690, 290], [0, 290]], '#9b7753', 4, '#dec39e');
      line(ctx, [[96, 77], [665, 77]], blue, 3);
      if (selected === 'shelf') line(ctx, [[120, 99], [262, 123]], teal, 8);
      if (selected === 'slope') line(ctx, [[262, 123], [377, 216]], teal, 8);
      if (selected === 'basin') line(ctx, [[459, 229], [665, 228]], teal, 8);
      spot(ctx, 185, 111, '甲 90 米', selected === 'shelf');
      spot(ctx, 321, 171, '乙 480 米', selected === 'slope');
      spot(ctx, 570, 230, '丙 2,500 米', selected === 'basin');
      label(ctx, '陆地', 23, 30, muted, 24);
      label(ctx, '海面', 573, 53, blue, 26);
      label(ctx, '剖面示意 · 未按比例', 668, 268, ink, 22, 'right');
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
      spot(ctx, 102, 189, 'A', selected === 'a');
      spot(ctx, 370, 189, 'B', selected === 'b');
      spot(ctx, 574, 215, 'C', selected === 'c');
      label(ctx, '风口', 34, 47, blue, 28);
      label(ctx, '步道', 642, 83, ink, 28, 'center');
      if (selected === 'a') arrow(ctx, 33, 155, 95, 174, orange);
      if (selected === 'b') {
        arrow(ctx, 200, 107, 261, 108, blue);
        label(ctx, '有遮挡', 352, 225, ink, 25, 'center');
      }
      if (selected === 'c') arrow(ctx, 607, 185, 581, 204, orange);
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
      line(ctx, [[219, 49], [219, 249]], '#b6ab91', 3);
      label(ctx, '模拟测温记录', 263, 69, ink, 28);
      label(ctx, '室温 · 装满热水并盖紧', 263, 115, muted, 25);
      label(ctx, '6 小时后', 263, 173, ink, 31);
      label(ctx, '62 ℃', 448, 171, teal, 55);
      if (selected === 'tested') line(ctx, [[448, 205], [574, 205]], teal, 5);
      if (selected === 'best') label(ctx, '其他杯子的对照数据还缺', 263, 239, orange, 25);
      if (selected === 'always') label(ctx, '这里只有这一次记录', 263, 239, orange, 25);
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
  if (mismatch >= 0) {
    const wrongStop = path[mismatch];
    const crossedWater = mismatch < 2 ? ['flag2', 'finish'].includes(wrongStop) : wrongStop === 'flag1';
    return crossedWater ? '橙色虚线穿过了河。退一步，沿能走的路过桥。' : hints[mismatch];
  }
  if (path.length === routeAnswer.length) return '两面旗都找到了，也从桥上过了河。';
  return hints[path.length];
}

function activityFrame(host, description) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', description);
  const figure = document.createElement('figure');
  figure.className = 'evidence-diagram';
  figure.append(canvas);
  const controls = document.createElement('div');
  controls.className = 'actions evidence-controls';
  const feedback = document.createElement('p');
  feedback.setAttribute('role', 'status');
  feedback.className = 'evidence-feedback';
  const dock = document.createElement('div');
  dock.className = 'evidence-dock';
  dock.append(controls, feedback);
  const stage = document.createElement('div');
  stage.className = 'evidence-activity';
  stage.append(figure, dock);
  host.replaceChildren(stage);
  const ctx = canvas.getContext('2d');
  return {
    canvas,
    controls,
    feedback,
    paint(draw, value, alternate, accessibleDescription, visited) {
      if (accessibleDescription) canvas.setAttribute('aria-label', accessibleDescription);
      if (!ctx) return;
      box(ctx, 0, 0, width, height, '#f8f4e9');
      draw(ctx, value, alternate, visited);
    },
  };
}

function bindDiagramStops(canvas, points, select) {
  canvas.dataset.evidencePick = '';
  canvas.addEventListener('click', event => {
    const bounds = canvas.getBoundingClientRect();
    const hit = Object.entries(points).find(([, { x, y }]) => Math.hypot(
      bounds.left + x * bounds.width / width - event.clientX,
      bounds.top + y * bounds.height / height - event.clientY,
    ) <= 22);
    if (hit) select(hit[0]);
  });
}

function addButton(controls, title, onClick) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'button';
  button.textContent = title;
  button.addEventListener('click', onClick);
  controls.append(button);
  return button;
}

function mountRoute(host, saved, onChange) {
  const { canvas, controls, feedback, paint } = activityFrame(host, '上方为北。起点和1号旗在河西岸，2号旗和终点在东岸。唯一的桥在1号旗北面。');
  let path = Array.isArray(saved?.path) ? saved.path.filter((stop) => routeAnswer.includes(stop)).slice(0, 4) : [];
  function addStop(key) {
    if (path.length >= routeAnswer.length) return;
    path = [...path, key];
    update();
    onChange?.({ path });
  }
  const stops = routeAnswer.map(key => addButton(controls, routeStops[key].label, () => addStop(key)));
  bindDiagramStops(canvas, Object.fromEntries(routeAnswer.map(key => [key, routeStops[key]])), addStop);
  const undo = addButton(controls, '退一步', () => {
    path = path.slice(0, -1);
    update();
    onChange?.({ path });
  });
  function update() {
    undo.disabled = path.length === 0;
    stops.forEach((button, index) => {
      button.dataset.active = String(path.includes(routeAnswer[index]));
      button.disabled = path.length === routeAnswer.length;
    });
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
  const { description, start, options, adjustment, revealOnVisit, hotspots, draw } = activities[id];
  let alternate = saved?.alternate === true;
  const describe = () => typeof description === 'function' ? description(alternate) : description;
  const { canvas, controls, feedback, paint } = activityFrame(host, describe());
  let selected = saved?.selected;
  const visited = new Set();
  if (revealOnVisit) {
    const remembered = Array.isArray(saved?.visited) ? saved.visited : [selected];
    for (const [key] of options) if (remembered.includes(key)) visited.add(key);
  }
  function select(key) {
    selected = key;
    if (revealOnVisit) visited.add(key);
    save();
  }
  const buttons = options.map(([key, title]) => addButton(controls, title, () => select(key)));
  if (hotspots) bindDiagramStops(canvas, hotspots, select);
  const toggle = adjustment && addButton(controls, adjustment.label, () => {
    alternate = !alternate;
    selected = adjustment.focus ?? selected;
    save();
  });

  function save() {
    update();
    const settings = { selected };
    if (adjustment) settings.alternate = alternate;
    if (revealOnVisit) settings.visited = [...visited];
    onChange?.(settings);
  }

  function update() {
    buttons.forEach((button, index) => {
      const active = String(selected === options[index][0]);
      button.setAttribute('aria-pressed', active);
      button.dataset.active = active;
    });
    toggle?.setAttribute('aria-pressed', String(alternate));
    const explanation = alternate && adjustment?.feedback(selected);
    feedback.textContent = explanation || (options.find(([key]) => key === selected)?.[2] ?? start);
    paint(draw, selected, alternate, describe(), visited);
  }
  update();
}
