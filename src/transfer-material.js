import { COAST_RINGS } from './geo-model.js';
import { transferMaterials } from './transfer-material-data.js?v=2';
import { renderContourMap } from './contour-challenge-map.js?v=2';

const escape = value => String(value).replace(/[&<>"']/g, character =>
  ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'})[character]);

const maps = {
  'land-ocean': {
    frame: [-12, 166, 15, -47],
    route: [[40, -17], [43, -22], [43, -27], [56, -29], [84, -28], [105, -27], [114, -25]],
    labels: [['非洲', 23, 1], ['澳大利亚', 133, -31], ['大西洋', 5, -31], ['印度洋', 80, -36], ['太平洋', 155, -16]],
  },
  '7b-africa': {
    frame: [-9, 57, 29, -35],
    labels: [['P · 沙地', 22, 22], ['R · 草原', 24, 11], ['Q · 雨林', 24, -1], ['S · 草原', 27, -12], ['T · 荒漠', 26, -23]],
    equator: true,
  },
  '8a-position': {
    frame: [-65, 33, 68, 22],
    route: [[-5, 48], [-15, 48], [-23, 48]],
    labels: [['欧洲', 11, 52], ['大西洋', -33, 43]],
  },
};

export function renderTransferMaterial(id) {
  if (id === 'contours-map') return renderContourMap({ site: 'willow', kind: 'route' }, { transferId: id });
  if (id === '8b-south-layered') return renderSouthTransport();
  const material = transferMaterials[id];
  if (!material) return '';
  const map = maps[id];
  let content;
  if (map) {
    content = `<canvas class="geo-transfer-map" data-transfer-map="${id}" role="img" aria-label="${escape(material.caption)}"></canvas>
    <ul class="geo-transfer-map-keys">${map.labels.map(([label]) => `<li>${escape(label)}</li>`).join('')}</ul>`;
  } else if (material.type === 'table') {
    content = `<table><thead><tr>${material.headers.map(cell => `<th scope="col">${escape(cell)}</th>`).join('')}</tr></thead>
      <tbody>${material.rows.map(row => `<tr>${row.map((cell, index) => index === 0
        ? `<th scope="row">${escape(cell)}</th>` : `<td>${escape(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  } else if (material.type === 'bars') {
    const maximum = Math.max(material.threshold || 0, ...material.values.map(([,value]) => value));
    content = `<div class="geo-transfer-bars" style="--bar-columns:${material.values.length}">
      ${material.values.map(([name, value]) => `<div class="geo-transfer-bar"><strong>${value} ${escape(material.unit)}</strong>
        <span aria-hidden="true" style="--bar-height:${Math.max(3, value * 100 / maximum)}%"></span><span>${escape(name)}</span></div>`).join('')}
      ${material.threshold ? `<div class="geo-transfer-limit" style="--bar-limit:${material.threshold / maximum}" aria-hidden="true"></div>` : ''}</div>`;
  } else if (material.type === 'nested') {
    content = `<div class="geo-transfer-boundaries" aria-label="图例：外框为省界，内框为县界。">
      <div class="geo-transfer-province"><span>${escape(material.outer)}</span><span class="geo-transfer-county">${escape(material.inner)}</span></div>
      <span class="geo-transfer-neighbor">${escape(material.neighbor)}</span>
    </div>`;
  } else {
    content = `<div class="geo-transfer-grid" role="group" aria-label="示意图">${material.cells.map(row => `<div class="geo-transfer-row" style="--diagram-columns:${row.length}">
      ${row.map(([label, tone]) => `<span class="geo-transfer-cell ${escape(tone)}">${escape(label)}</span>`).join('')}
    </div>`).join('')}</div>`;
  }
  return `<figure class="geo-transfer-material" data-transfer-material="${id}">${content}
    <figcaption>${escape(material.caption)}</figcaption></figure>`;
}

function renderSouthTransport() {
  return `<figure class="geo-transfer-material geo-transfer-layered" data-transfer-material="8b-south-layered">
    <svg viewBox="0 0 470 244" role="img" aria-label="分层设色教学图。西侧为低平平原，中央和东侧山岭之间有河谷。显示线路后可对照西侧南北干线和中东部沿河谷的支线。">
      <rect width="470" height="244" rx="10" fill="#d8edf4"/>
      <path d="M85 11 332 11 362 39 394 70 431 114 410 161 450 207 416 233H58L66 207 48 162 64 111 42 68 68 52Z" fill="#e0ecd2"/>
      <path d="M207 11 332 11 362 39 394 70 431 114 410 161 450 207 416 233H205L230 200 182 158 197 111 184 83Z" fill="#e4cb9e"/>
      <path d="m244 11 65 0 35 43-32 30-56-20-28-18zm92 77 41-12 37 43-19 36-56-21zm-80 72 50 15 23 58h-80l12-23-27-37zm123-3 30 21 20 41-24 13h-51l-6-35z" fill="#bd9467"/>
      <path d="M456 188 405 165 360 147 319 155 263 129 210 117 166 134 112 133 58 158" fill="none" stroke="#5b9dad" stroke-width="8"/>
      <g class="geo-transfer-map-text"><text x="99" y="106">西部平原</text><text x="247" y="52">中部山岭</text><text x="359" y="60">东部山岭</text><text x="302" y="137">河谷</text></g>
      <g data-south-transport>
        <path d="M114 31 131 93 121 151 145 211 M125 149q30-24 53-17l35-11 49 14 56 27 40-7 50 24" stroke="#883723" fill="none" stroke-width="4" stroke-linecap="round"/>
        <path d="M92 31 108 94 98 151 122 211" stroke="#194d63" fill="none" stroke-width="5" stroke-dasharray="7 4"/>
        <g stroke="#894b36" stroke-width="2" fill="#fff8eb"><circle cx="121" cy="151" r="5"/><circle cx="213" cy="121" r="5"/><circle cx="318" cy="162" r="5"/><circle cx="408" cy="179" r="5"/></g>
      </g>
    </svg>
    <figcaption>教学示意。绿色为平原，浅褐到深褐表示山地海拔升高。水蓝为河流。</figcaption>
    <div class="geo-transfer-layer-legend"><button class="button" type="button" aria-pressed="true" data-south-toggle>交通线路已显示</button><span><i></i>铁路</span><span><i></i>公路</span></div>
  </figure>`;
}

export function mountTransferMaps(root) {
  const observers = [];
  for (const canvas of root.querySelectorAll('[data-transfer-map]')) {
    const map = maps[canvas.dataset.transferMap];
    const observer = new ResizeObserver(() => drawTransferMap(canvas, map));
    observer.observe(canvas);
    observers.push(observer);
  }
  for (const button of root.querySelectorAll('[data-south-toggle]')) {
    const routes = button.closest('figure').querySelector('[data-south-transport]');
    button.addEventListener('click', () => {
      const next = button.getAttribute('aria-pressed') === 'false';
      button.setAttribute('aria-pressed', String(next));
      routes.style.display = next ? '' : 'none';
      button.textContent = next ? '交通线路已显示' : '显示铁路和公路';
    });
  }
  return () => observers.forEach(observer => observer.disconnect());
}

function drawTransferMap(canvas, map) {
  const {width, height} = canvas.getBoundingClientRect();
  if (!width || !height) return;
  const ratio = Math.min(devicePixelRatio || 1, 2);
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  const context = canvas.getContext('2d');
  if (!context) return;
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  const [west, east, north, south] = map.frame;
  const inset = 12;
  const point = (longitude, latitude) => [inset + (longitude - west) * (width - 2 * inset) / (east - west),
    inset + (north - latitude) * (height - 2 * inset) / (north - south)];
  const line = (points) => points.forEach(([lon, lat], index) => {
    const position = point(lon, lat);
    if (index === 0) context.moveTo(...position);
    else context.lineTo(...position);
  });
  context.fillStyle = '#c8e2ed';
  context.fillRect(0, 0, width, height);
  context.fillStyle = '#e9dcb6';
  context.strokeStyle = '#819171';
  context.lineWidth = 1;
  context.beginPath();
  for (const coast of COAST_RINGS) {
    const shape = Array.from({length: coast.length / 2}, (_, index) => [coast[2 * index], coast[2 * index + 1]]);
    line(shape);
    context.closePath();
  }
  context.fill();
  context.stroke();
  const route = map.route || (map.equator ? [[west,0], [east,0]] : []);
  context.setLineDash([6, 4]);
  context.strokeStyle = map.route ? '#872e18' : '#21627a';
  context.lineWidth = 2.5;
  context.beginPath();
  line(route);
  context.stroke();
  context.setLineDash([]);
  if (map.route) {
    context.fillStyle = '#872e18';
    for (const endpoint of [route[0], route.at(-1)]) {
      context.beginPath();
      context.arc(...point(...endpoint), 4, 0, Math.PI * 2);
      context.fill();
    }
  }
  context.textAlign = 'center';
  context.font = '600 12px system-ui, sans-serif';
  const labels = map.equator ? [...map.labels, ['赤道', east - 5, -2]] : map.labels;
  for (const [label, lon, lat] of labels) {
    const [x, y] = point(lon, lat);
    context.lineWidth = 3;
    context.strokeStyle = '#fffdf7';
    context.strokeText(label, x, y);
    context.fillStyle = '#183c37';
    context.fillText(label, x, y);
  }
}
