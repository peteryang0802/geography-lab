import { COAST_RINGS } from './geo-model.js';

const tones = { water: '#347c95', route: '#a34d27', land: '#7e965a' };
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function worldFrame(activity, width, height) {
  const xs = activity.points.map(point => point.x);
  const ys = activity.points.map(point => point.y);
  const spread = Math.max(...xs) - Math.min(...xs);
  const neededHeight = Math.max(18, Math.max(...ys) - Math.min(...ys) + 13);
  const spanX = Math.min(100, Math.max(19, spread + 12, neededHeight * width / (2 * height)));
  const spanY = Math.min(100, Math.max(neededHeight, spanX * 2 * height / width));
  const left = clamp((Math.min(...xs) + Math.max(...xs) - spanX) / 2, 0, 100 - spanX);
  const top = clamp((Math.min(...ys) + Math.max(...ys) - spanY) / 2, 0, 100 - spanY);
  return (x, y) => [(x - left) * width / spanX, (y - top) * height / spanY];
}

function trace(ctx, points) {
  ctx.beginPath();
  points.forEach(([x, y], index) => index ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
}

function paintWorld(ctx, width, height, project) {
  ctx.fillStyle = '#c0e0ea';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#ded2a5';
  ctx.strokeStyle = '#83936e';
  ctx.lineWidth = .7;
  ctx.beginPath();
  for (const ring of COAST_RINGS) {
    for (let i = 0; i < ring.length; i += 2) {
      const [x, y] = project((ring[i] + 180) / 3.6, (90 - ring[i + 1]) / 1.8);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }
  ctx.fill();
  ctx.stroke();
  ctx.setLineDash([3, 4]);
  ctx.strokeStyle = '#4f7b85aa';
  trace(ctx, [project(0, 50), project(100, 50)]);
  ctx.stroke();
  ctx.setLineDash([]);
  const [, equatorY] = project(0, 50);
  if (equatorY > 10 && equatorY < height - 12) {
    ctx.font = '10px system-ui';
    ctx.fillStyle = '#214e5d';
    ctx.fillText('赤道', width - 32, equatorY - 4);
  }
}

function paintMap(ctx, activity, width, height) {
  const realCoast = activity.area === 'world';
  const project = realCoast ? worldFrame(activity, width, height) :
    (x, y) => [14 + x * (width - 28) / 100, 12 + y * (height - 24) / 100];
  if (realCoast) paintWorld(ctx, width, height, project);
  else {
    ctx.fillStyle = '#e6ecdc';
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = '#83946b38';
    ctx.lineWidth = 1;
    for (let x = 10; x < 100; x += 10) {
      trace(ctx, [project(x, 0), project(x, 100)]);
      ctx.stroke();
      trace(ctx, [project(0, x), project(100, x)]);
      ctx.stroke();
    }
  }
  for (const path of activity.paths || []) {
    const points = path.coords.map(([x, y]) => project(x, y));
    trace(ctx, points);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = tones[path.tone] || '#667e61';
    ctx.lineWidth = path.tone === 'water' ? 3 : 2;
    const closed = path.coords.length > 3 && path.coords[0].every((value, i) => value === path.coords.at(-1)[i]);
    if (closed && (path.tone === 'water' || path.tone === 'land')) {
      ctx.closePath();
      ctx.fillStyle = path.tone === 'water' ? '#a9d8e5' : '#c4ce9c';
      ctx.fill();
    }
    ctx.setLineDash(path.tone === 'route' ? [5, 4] : []);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  if (activity.northArrow !== false) {
    ctx.fillStyle = '#214239';
    ctx.font = '700 12px system-ui';
    ctx.fillText('北', width - 26, 14);
    trace(ctx, [[width - 23, 27], [width - 23, 17], [width - 27, 22], [width - 23, 17], [width - 19, 22]]);
    ctx.strokeStyle = '#214239';
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }
  return activity.points.map(point => project(point.x, point.y));
}

function paintProfile(ctx, activity, width, height, revealed) {
  const left = 34, top = 16, base = height - 25, right = width - 16;
  const values = activity.values.map(point => point.value);
  const minimum = Math.min(0, ...values);
  const maximum = Math.max(minimum + 1, ...values);
  const positions = values.map((value, index) => [
    left + (right - left) * index / Math.max(1, values.length - 1),
    base - (base - top) * (value - minimum) / (maximum - minimum),
  ]);
  ctx.fillStyle = '#eaf0e6';
  ctx.fillRect(0, 0, width, height);
  ctx.font = '10px system-ui';
  ctx.fillStyle = '#345043';
  ctx.fillText(activity.unit || '', 2, 10);
  for (let i = 0; i <= 2; i++) {
    const y = base - i * (base - top) / 2;
    trace(ctx, [[left, y], [right, y]]);
    ctx.strokeStyle = '#a9bcae';
    ctx.lineWidth = .75;
    ctx.stroke();
    ctx.fillText(String(Math.round(minimum + (maximum - minimum) * i / 2)), 2, y + 4);
  }
  trace(ctx, [[left, base], ...positions, [right, base]]);
  ctx.closePath();
  ctx.fillStyle = '#b6bf83';
  ctx.fill();
  trace(ctx, positions);
  ctx.strokeStyle = '#3d6b52';
  ctx.lineWidth = 2.35;
  ctx.stroke();
  if (revealed) for (const [from, to] of activity.flows || []) {
    const [x1, y1] = positions[from], [x2, y2] = positions[to];
    const startX = x1 + (x2 - x1) * .24, startY = y1 + (y2 - y1) * .24 - 8;
    const endX = x1 + (x2 - x1) * .76, endY = y1 + (y2 - y1) * .76 - 8;
    const angle = Math.atan2(endY - startY, endX - startX);
    trace(ctx, [[startX, startY], [endX, endY]]);
    ctx.strokeStyle = '#2d7390';
    ctx.lineWidth = 2.3;
    ctx.stroke();
    trace(ctx, [[endX - 8 * Math.cos(angle - .52), endY - 8 * Math.sin(angle - .52)],
      [endX, endY], [endX - 8 * Math.cos(angle + .52), endY - 8 * Math.sin(angle + .52)]]);
    ctx.stroke();
  }
  return positions;
}

export function mountTermDiagram(figure, activity, onPick) {
  const stage = figure.querySelector('.term-plot');
  const canvas = stage?.querySelector('canvas');
  if (!canvas) return () => {};
  const points = [...stage.querySelectorAll('[data-plot-point]')];
  let selected = [];
  let revealed = false;
  function draw() {
    const { width, height } = stage.getBoundingClientRect();
    if (!width || !height) return;
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    const positions = activity.kind === 'map' ? paintMap(ctx, activity, width, height) :
      paintProfile(ctx, activity, width, height, revealed);
    for (const [index, button] of points.entries()) {
      const [x, y] = positions[index];
      const handleX = clamp(x, 14, width - 14), handleY = clamp(y, 14, height - 16);
      button.style.left = handleX + 'px';
      button.style.top = handleY + 'px';
      button.hidden = false;
      button.classList.toggle('mark-selected', selected.includes(index));
      if (x !== handleX || y !== handleY) {
        trace(ctx, [[x, y], [handleX, handleY]]);
        ctx.strokeStyle = '#365e4e';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
  }
  const resize = 'ResizeObserver' in window ? new ResizeObserver(draw) : null;
  if (resize) resize.observe(stage);
  else window.addEventListener('resize', draw);
  points.forEach((button, index) => button.addEventListener('click', () => onPick(index, button)));
  draw();
  return {
    select(values, showEvidence) {
      selected = values;
      if (activity.flows && revealed !== showEvidence) {
        revealed = showEvidence;
        draw();
      }
      points.forEach((button, index) => button.classList.toggle('mark-selected', selected.includes(index)));
    },
    dispose() {
      resize?.disconnect();
      if (!resize) window.removeEventListener('resize', draw);
    },
  };
}
