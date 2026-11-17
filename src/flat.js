import {
  COAST_RINGS,
  CONTOUR_LEVELS,
  FLOW_COLORS,
  SECTION_POSITIONS,
  TERRAIN_SITES,
  contourAltitude,
  contourProfile,
  geographicDirection,
  sunlightAt,
} from './geo-model.js';
import { getFlowPaths } from './flow-model.js';
import { loadReliefImage } from './relief-image.js';

const INK = '#173a3d';
const MUTED = '#476267';
const MOUNTAIN_A = '#087d76';
const MOUNTAIN_B = '#ad4f2c';
const FONT = 'system-ui, sans-serif';

function font(ctx, size, weight = 500) {
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.textBaseline = 'middle';
}

function strokeLine(ctx, x1, y1, x2, y2, paint, width = 1) {
  ctx.beginPath();
  ctx.strokeStyle = paint;
  ctx.lineWidth = width;
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function dot(ctx, x, y, radius, fill, line) {
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = line;
  ctx.stroke();
}

function mapBounds(width, height) {
  const left = 38;
  const right = 16;
  const availableWidth = width - left - right;
  const mapWidth = Math.min(availableWidth, (height - 52) * 2);
  const mapHeight = mapWidth / 2;
  return { x: left + (availableWidth - mapWidth) / 2, y: (height - mapHeight) / 2 - 4, width: mapWidth, height: mapHeight };
}

function lonX(bounds, lon) {
  return bounds.x + (lon + 180) / 360 * bounds.width;
}

function latY(bounds, lat) {
  return bounds.y + (90 - lat) / 180 * bounds.height;
}

function makeDaylightMask() {
  const canvas = document.createElement('canvas');
  canvas.width = 180;
  canvas.height = 90;
  const context = canvas.getContext('2d');
  const directions = [];
  let lastKey;
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      directions.push(geographicDirection(90 - (y + 0.5) * 2, -180 + (x + 0.5) * 2));
    }
  }
  return (sun, key) => {
    if (key === lastKey || !context) return canvas;
    lastKey = key;
    const image = context.createImageData(canvas.width, canvas.height);
    for (let index = 0; index < directions.length; index++) {
      const { x, y, z } = directions[index];
      const dotProduct = x * sun.x + y * sun.y + z * sun.z;
      const darkness = Math.min(1, Math.max(0, (0.05 - dotProduct) / 0.09));
      const offset = index * 4;
      image.data[offset] = 14;
      image.data[offset + 1] = 31;
      image.data[offset + 2] = 54;
      image.data[offset + 3] = Math.round(175 * darkness);
    }
    context.putImageData(image, 0, 0);
    return canvas;
  };
}

function formatNumber(degrees, negative, positive) {
  return degrees === 0 ? '0°' : `${Math.abs(degrees)}°${degrees < 0 ? negative : positive}`;
}

function drawMapFlow(ctx, bounds, config) {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const path of getFlowPaths(config.flow ?? 'currents', config.season ?? 'summer')) {
    const points = path.points.map(([lat, lon]) => ({ x: lonX(bounds, lon), y: latY(bounds, lat) }));
    const first = points[0];
    const end = points.at(-1);
    const tail = points.at(-2);
    const shade = FLOW_COLORS[path.kind];
    ctx.beginPath();
    ctx.moveTo(first.x, first.y);
    for (let i = 1; i < points.length - 1; i++) {
      const point = points[i];
      const next = points[i + 1];
      ctx.quadraticCurveTo(point.x, point.y, (point.x + next.x) / 2, (point.y + next.y) / 2);
    }
    ctx.lineTo(end.x, end.y);
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#173e50';
    ctx.stroke();
    ctx.lineWidth = 2.7;
    ctx.strokeStyle = shade;
    ctx.stroke();

    const angle = Math.atan2(end.y - tail.y, end.x - tail.x);
    ctx.beginPath();
    ctx.moveTo(end.x + 2.5 * Math.cos(angle), end.y + 2.5 * Math.sin(angle));
    ctx.lineTo(end.x + 9 * Math.cos(angle + 2.55), end.y + 9 * Math.sin(angle + 2.55));
    ctx.lineTo(end.x + 9 * Math.cos(angle - 2.55), end.y + 9 * Math.sin(angle - 2.55));
    ctx.closePath();
    ctx.fillStyle = shade;
    ctx.fill();
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = '#173e50';
    ctx.stroke();
  }
}

function drawMapSites(ctx, bounds, focus) {
  font(ctx, 10, 750);
  ctx.textAlign = 'center';
  for (const [index, [id, site]] of Object.entries(TERRAIN_SITES).entries()) {
    const x = lonX(bounds, site.lon);
    const y = latY(bounds, site.lat);
    const selected = id === focus;
    dot(ctx, x, y, selected ? 8.8 : 7.6, selected ? '#ffd071' : '#23464c', selected ? '#572a12' : '#fff1b9');
    ctx.fillStyle = selected ? '#572a12' : '#fff5d3';
    ctx.fillText(String(index + 1), x, y + 0.4);
  }
}

function makeGlobePainter(schedule) {
  const renderMask = makeDaylightMask();
  let relief;
  let requestedRelief = false;
  return (ctx, width, height, config) => {
    const bounds = mapBounds(width, height);
    const { x, y, width: w, height: h } = bounds;
    if (w < 1 || h < 1) return;
    const { mode = 'coordinates', lat = 40, lon = 116, hour = 6, month = 6 } = config;
    if (mode === 'terrain' && !requestedRelief) {
      requestedRelief = true;
      loadReliefImage().then((image) => {
        relief = image;
        schedule();
      });
    }
    ctx.fillStyle = '#a1d5dd';
    ctx.fillRect(x, y, w, h);
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();

    ctx.fillStyle = '#7ca88c';
    ctx.strokeStyle = '#487968';
    ctx.lineWidth = 0.65;
    for (const ring of COAST_RINGS) {
      ctx.beginPath();
      ctx.moveTo(lonX(bounds, ring[0]), latY(bounds, ring[1]));
      for (let index = 2; index < ring.length; index += 2) {
        ctx.lineTo(lonX(bounds, ring[index]), latY(bounds, ring[index + 1]));
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    if (mode === 'coordinates' || mode === 'daylight') {
      for (let latitude = -60; latitude <= 60; latitude += 30) {
        const row = latY(bounds, latitude);
        strokeLine(ctx, x, row, x + w, row, latitude === 0 ? '#fff4c7' : '#effaf3b5', latitude === 0 ? 1.5 : 0.75);
      }
      for (let longitude = -120; longitude <= 120; longitude += 60) {
        const col = lonX(bounds, longitude);
        strokeLine(ctx, col, y, col, y + h, longitude === 0 ? '#fff4c7' : '#effaf3a5', longitude === 0 ? 1.5 : 0.75);
      }
    }

    if (mode === 'daylight') {
      const { direction, declination, subsolarLongitude } = sunlightAt(lat, lon, hour, month);
      ctx.drawImage(renderMask(direction, `${hour}:${month}`), x, y, w, h);
      dot(ctx, lonX(bounds, subsolarLongitude), latY(bounds, declination), 4, '#ffcb57', '#623727');
    }
    if (mode === 'coordinates' || mode === 'daylight') {
      const observationX = lonX(bounds, lon);
      const observationY = latY(bounds, lat);
      dot(ctx, observationX, observationY, 5.3, '#fff4cf', '#17464b');
      dot(ctx, observationX, observationY, 1.8, '#17464b', '#17464b');
      if (mode === 'daylight' && config.dayPair && lat !== 0) {
        const oppositeY = latY(bounds, -lat);
        dot(ctx, observationX, oppositeY, 5.3, '#fff4cf', '#17464b');
        dot(ctx, observationX, oppositeY, 1.8, '#17464b', '#17464b');
      }
    }
    if (mode === 'terrain') {
      if (relief) ctx.drawImage(relief, x, y, w, h);
      drawMapSites(ctx, bounds, config.terrainFocus);
    }
    if (mode === 'circulation') drawMapFlow(ctx, bounds, config);
    ctx.restore();

    ctx.lineWidth = 1;
    ctx.strokeStyle = '#477779';
    ctx.strokeRect(x, y, w, h);
    const labelSize = width < 350 ? 10 : 11;
    font(ctx, labelSize);
    ctx.fillStyle = MUTED;
    ctx.textAlign = 'center';
    for (let longitude = -120; longitude <= 120; longitude += 60) {
      ctx.fillText(formatNumber(longitude, 'W', 'E'), lonX(bounds, longitude), y + h + 12);
    }
    ctx.textAlign = 'right';
    for (let latitude = -60; latitude <= 60; latitude += 30) {
      ctx.fillText(formatNumber(latitude, 'S', 'N'), x - 5, latY(bounds, latitude));
    }
  };
}

function drawChart(ctx, box, { lines, maximum, step, unitX, unitY, walk }) {
  const labelSize = box.width < 260 ? 10 : 11;
  const plot = {
    x: box.x + (maximum >= 1000 ? 50 : 42),
    y: box.y + 20,
    width: box.width - (maximum >= 1000 ? 77 : 70),
    height: box.height - 51,
  };
  if (plot.width < 25 || plot.height < 15) return;
  const projectX = (distance) => plot.x + plot.width * distance;
  const projectY = (elevation) => plot.y + plot.height * (1 - elevation / maximum);
  font(ctx, labelSize, 600);
  ctx.textAlign = 'left';
  ctx.fillStyle = INK;
  ctx.fillText(unitY, box.x + 9, box.y + 7);
  font(ctx, labelSize);
  ctx.textAlign = 'right';
  const elevationTicks = plot.height < 52
    ? [0, maximum / 2, maximum]
    : Array.from({ length: Math.floor(maximum / step) + 1 }, (_, index) => index * step);
  for (const elevation of elevationTicks) {
    const row = projectY(elevation);
    strokeLine(ctx, plot.x, row, plot.x + plot.width, row, '#315d5830');
    ctx.fillStyle = MUTED;
    ctx.fillText(String(elevation), plot.x - 7, row);
  }
  strokeLine(ctx, plot.x, plot.y, plot.x, plot.y + plot.height, '#315d58');
  strokeLine(ctx, plot.x, plot.y + plot.height, plot.x + plot.width, plot.y + plot.height, '#315d58');

  for (const line of lines) {
    ctx.beginPath();
    for (let index = 0; index < line.points.length; index++) {
      const [distance, elevation] = line.points[index];
      if (index === 0) ctx.moveTo(projectX(distance), projectY(elevation));
      else ctx.lineTo(projectX(distance), projectY(elevation));
    }
    if (line.fill) {
      ctx.lineTo(plot.x + plot.width, plot.y + plot.height);
      ctx.lineTo(plot.x, plot.y + plot.height);
      ctx.closePath();
      ctx.fillStyle = line.fill;
      ctx.fill();
      ctx.beginPath();
      line.points.forEach(([distance, elevation], index) => {
        if (index === 0) ctx.moveTo(projectX(distance), projectY(elevation));
        else ctx.lineTo(projectX(distance), projectY(elevation));
      });
    }
    ctx.strokeStyle = line.color;
    ctx.lineWidth = 2.4;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    if (line.dashed) ctx.setLineDash([5, 3]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  if (walk) {
    const x = projectX(walk.fraction);
    const y = projectY(walk.elevation);
    strokeLine(ctx, x, plot.y, x, plot.y + plot.height, '#82512d', 1.2);
    dot(ctx, x, y, 4.8, '#ffc46d', '#592e18');
  }
  ctx.fillStyle = MUTED;
  ctx.textAlign = 'center';
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  ticks.forEach((fraction) => {
    ctx.fillText(unitX(fraction), projectX(fraction), plot.y + plot.height + 14);
  });
}

function makeContourPlan() {
  const image = document.createElement('canvas');
  image.width = 200;
  image.height = 140;
  const ctx = image.getContext('2d');
  if (!ctx) return image;
  const pixels = ctx.createImageData(image.width, image.height);
  const scale = image.width / 10;
  const colorStops = [
    [116, 163, 131], [136, 173, 133], [170, 185, 139],
    [193, 189, 144], [197, 178, 132], [175, 144, 105], [151, 120, 89],
  ];
  function band(x, y) {
    const height = contourAltitude(x / scale - 5, y / scale - 3.5);
    const index = CONTOUR_LEVELS.findIndex((level) => height < level);
    return index < 0 ? CONTOUR_LEVELS.length : index;
  }
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      const current = band(x + 0.5, y + 0.5);
      const edge = current !== band(x + 1.5, y + 0.5) || current !== band(x + 0.5, y + 1.5);
      const color = edge ? [68, 105, 79] : colorStops[current];
      pixels.data.set([...color, 255], (y * image.width + x) * 4);
    }
  }
  ctx.putImageData(pixels, 0, 0);
  return image;
}

function makeContourPainter() {
  const plan = makeContourPlan();
  return (ctx, width, height, config) => {
    const section = config.section === 'cd' ? 'cd' : 'ab';
    const [start, end] = [...section.toUpperCase()];
    const wide = width > 510;
    const planRoom = wide ? width * 0.41 : width;
    const planHeight = wide ? height - 15 : height * 0.47;
    const planWidth = Math.min(planRoom - 30, (planHeight - 24) / 0.7);
    const planX = (planRoom - planWidth) / 2;
    const planY = wide ? Math.max(20, (height - 0.7 * planWidth) / 2) : 19;
    if (planWidth < 40) return;
    ctx.drawImage(plan, planX, planY, planWidth, planWidth * 0.7);
    font(ctx, 11, 600);
    ctx.fillStyle = INK;
    ctx.textAlign = 'left';
    ctx.fillText('从上看', planX, planY - 8);

    const lineY = planY + (SECTION_POSITIONS[section] + 3.5) * planWidth / 10;
    const startX = planX + planWidth * 0.024;
    const endX = planX + planWidth * 0.976;
    strokeLine(ctx, startX, lineY, endX, lineY, '#fff3bf', 2.8);
    for (const [label, x] of [[start, startX], [end, endX]]) {
      dot(ctx, x, lineY, 7, '#17474a', '#fff3bf');
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fff3bf';
      ctx.fillText(label, x, lineY + 0.3);
    }

    const chart = wide
      ? { x: planRoom, y: 17, width: width - planRoom - 6, height: height - 22 }
      : { x: 3, y: planHeight + 3, width: width - 7, height: height - planHeight - 2 };
    const profile = contourProfile(section);
    const distance = profile.at(-1).distance;
    const steps = contourProfile(section, 13);
    const walkIndex = Math.max(0, Math.min(12, Math.round(config.walkStep ?? 0)));
    const sample = steps[walkIndex];
    const fraction = sample.distance / distance;
    dot(ctx, startX + (endX - startX) * fraction, lineY, 4.8, '#ffc46d', '#592e18');
    const lines = [{ color: MOUNTAIN_A, fill: '#087d7622', points: profile.map(({ distance: km, elevation }) => [km / distance, elevation]) }];
    drawChart(ctx, chart, {
      lines, maximum: 600, step: 150, walk: { fraction, elevation: sample.elevation },
      unitY: `从侧面看 · 海拔（米）`,
      unitX: (fraction) => fraction === 0 ? '0' : `${(fraction * distance).toFixed(1)} km`,
    });
  };
}

function drawTerrain(ctx, width, height, config) {
  const siteA = Object.hasOwn(TERRAIN_SITES, config.siteA) ? TERRAIN_SITES[config.siteA] : TERRAIN_SITES.himalayas;
  const siteB = Object.hasOwn(TERRAIN_SITES, config.siteB) ? TERRAIN_SITES[config.siteB] : TERRAIN_SITES.alps;
  const toSeries = ({ heights }, color, fill, dashed) => ({
    color, fill, dashed,
    points: heights.map((elevation, index) => [index / (heights.length - 1), elevation]),
  });
  const lines = [
    toSeries(siteA, MOUNTAIN_A, '#087d761f', false),
    toSeries(siteB, MOUNTAIN_B, '#ad4f2c1b', true),
  ];
  drawChart(ctx, { x: 2, y: 24, width: width - 5, height: height - 34 }, {
    lines, maximum: 9000, step: 3000,
    unitY: '海拔（米，示意）',
    unitX: (fraction) => fraction === 0 ? '起点' : fraction === 1 ? '终点' : `${fraction * 100}%`,
  });
  font(ctx, 12, 650);
  strokeLine(ctx, 12, 9, 27, 9, MOUNTAIN_A, 2.5);
  ctx.fillStyle = INK;
  ctx.textAlign = 'left';
  ctx.fillText('A', 32, 9);
  ctx.setLineDash([4, 2]);
  strokeLine(ctx, 53, 9, 68, 9, MOUNTAIN_B, 2.5);
  ctx.setLineDash([]);
  ctx.fillText('B', 73, 9);
}

export function mountFlat(host, kind, config = {}) {
  const paint = kind === 'globe' ? makeGlobePainter(schedule)
    : kind === 'contour' ? makeContourPainter()
      : kind === 'terrain' ? drawTerrain : null;
  if (!paint) throw new Error(`Unknown scene kind: ${kind}`);

  const canvas = document.createElement('canvas');
  canvas.className = 'flat-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.display = 'block';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.touchAction = 'pan-y';
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D is unavailable');
  host.append(canvas);

  let active = { ...config };
  let disposed = false;
  let pending = 0;
  function render() {
    pending = 0;
    const width = host.clientWidth;
    const height = host.clientHeight;
    if (disposed || !width || !height) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    paint(ctx, width, height, active);
  }
  function schedule() {
    if (!pending && !disposed) pending = requestAnimationFrame(render);
  }
  function pick(event) {
    if (kind !== 'globe') return;
    const canvasBounds = canvas.getBoundingClientRect();
    const bounds = mapBounds(host.clientWidth, host.clientHeight);
    const x = event.clientX - canvasBounds.left;
    const y = event.clientY - canvasBounds.top;
    if (active.mode === 'terrain') {
      let selected;
      let minimumDistance = 15;
      for (const [id, site] of Object.entries(TERRAIN_SITES)) {
        const distance = Math.hypot(x - lonX(bounds, site.lon), y - latY(bounds, site.lat));
        if (distance < minimumDistance) {
          minimumDistance = distance;
          selected = { id, ...site };
        }
      }
      if (selected) active.onTerrainPick?.(selected);
      return;
    }
    if (active.mode && active.mode !== 'coordinates' && active.mode !== 'daylight') return;
    const lon = (x - bounds.x) * 360 / bounds.width - 180;
    const lat = 90 - (y - bounds.y) * 180 / bounds.height;
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
    if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return;
    active.onCoordinatePick?.({ lat: Math.round(lat), lon: Math.round(lon) });
  }
  canvas.addEventListener('click', pick);
  const observer = new ResizeObserver(schedule);
  observer.observe(host);

  function update(delta) {
    if (disposed) return;
    active = { ...active, ...delta };
    const pickingCoordinates = (!active.mode || active.mode === 'coordinates' || active.mode === 'daylight') && active.onCoordinatePick;
    const pickingSite = active.mode === 'terrain' && active.onTerrainPick;
    canvas.style.cursor = kind === 'globe' && (pickingCoordinates || pickingSite) ? 'crosshair' : 'default';
    schedule();
  }

  update(config);
  return {
    update,
    dispose() {
      if (disposed) return;
      disposed = true;
      observer.disconnect();
      cancelAnimationFrame(pending);
      canvas.removeEventListener('click', pick);
      canvas.remove();
    },
  };
}
