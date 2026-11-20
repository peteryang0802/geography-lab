const hills = {
  pine: { title: '松岭北坡', middle: 267, y: 110, left: [36, 110, 176, 230],
    right: [403, 384, 362, 325], depth: [81, 62, 43, 25], first: 200, interval: 50, scale: 200 },
  tea: { title: '茶山步道', middle: 162, y: 118, left: [29, 45, 69, 104],
    right: [396, 325, 265, 212], depth: [85, 65, 47, 26], first: 120, interval: 40, scale: 300 },
  oak: { title: '橡岭观景台', middle: 151, y: 119, left: [25, 49, 76, 108],
    right: [412, 337, 279, 224], depth: [92, 68, 44, 22], first: 160, interval: 60, scale: 200 },
  birch: { title: '桦谷巡护图', middle: 270, y: 112, left: [27, 92, 168, 223],
    right: [412, 395, 368, 330], depth: [82, 61, 40, 21], first: 85, interval: 35, scale: 250 },
};

function mapFrame(title, description, body, scale, interval) {
  return `<figure class="contour-challenge-map">
    <svg viewBox="0 0 440 235" role="img" aria-labelledby="challenge-map-title challenge-map-description">
      <title id="challenge-map-title">${title}，教学示意图</title><desc id="challenge-map-description">${description}</desc>
      <rect x="1" y="1" width="438" height="233" rx="10" class="map-paper"/>
      ${body}
      <g class="map-scale">
        <path d="M24 212v8 M24 216h80 M104 212v8"/>
        <text x="24" y="230">0</text><text x="104" y="230">${scale} 米</text>
        <path d="M411 46V25l-4 7m4-7 4 7"/><text x="411" y="19">北</text>
      </g>
    </svg>
    <figcaption><span>${title} · 自编示意图</span><span>等高距 ${interval} 米</span></figcaption>
  </figure>`;
}

function marker(x, y, name, offsetX = 0, offsetY = -12) {
  return `<circle class="map-marker" cx="${x}" cy="${y}" r="4.6"/>
    <text class="map-label map-place" x="${x + offsetX}" y="${y + offsetY}">${name}</text>`;
}

function drawHill({ site, kind }) {
  const { title, middle, y, left, right, depth, first, interval, scale } = hills[site];
  const levels = left.map((west, index) => {
    const east = right[index];
    const rise = depth[index];
    const path = `M${middle} ${y - rise} A${east - middle} ${rise} 0 0 1 ${middle} ${y + rise}
      A${middle - west} ${rise} 0 0 1 ${middle} ${y - rise}Z`;
    return `<path class="map-line map-band-${index}" d="${path}"/>
      <text class="map-label" x="${middle}" y="${y - rise + 4}">${first + index * interval}</text>`;
  }).join('');
  let marks = '';
  let description;
  if (kind === 'route') {
    marks = `<path class="map-route map-route-west" d="M${left[0]} ${y}H${middle}"/>
      <path class="map-route map-route-east" d="M${middle} ${y}H${right[0]}"/>
      ${marker(left[0], y, '西起点', 7, -14)}${marker(right[0], y, '东起点', -4, -14)}
      ${marker(middle, y, '观景台', 0, 20)}
      <text class="map-label map-west-text" x="${(middle + left[0]) / 2}" y="${y + 20}">西线</text>
      <text class="map-label map-east-text" x="${(middle + right[0]) / 2}" y="${y + 21}">东线</text>`;
    const crossings = index => left.map((west, i) => Math.round(Math.abs((index ? right[i] - right[0] : west - left[0]) * scale / 80))).join('、');
    description = `西、东起点均在 ${first} 米线，西侧是虚线，东侧是点线，都通向观景台。` +
      `从各自起点量起，西线依次经过距起点约 ${crossings(false)} 米的各等高线；东线依次经过约 ${crossings(true)} 米的各等高线。`;
  } else if (kind === 'range') {
    marks = marker((left[1] + left[2]) / 2, y, 'P');
    description = `P 点落在 ${first + interval} 米和 ${first + 2 * interval} 米两条等高线之间。`;
  } else if (kind === 'summit') {
    marks = marker(middle, y + 2, '▲', 0, 18);
    description = `从外到内有四条闭合等高线，海拔分别为 ${left.map((_, i) => first + i * interval).join('、')} 米，山顶未标具体海拔。`;
  } else {
    marks = marker(left[0], y, 'A', 6) + marker(left[2], y, 'B');
    description = `A 在 ${first} 米等高线上，B 在 ${first + 2 * interval} 米等高线上。`;
  }
  return mapFrame(title, `${description}上北下南。比例尺一格为 ${scale} 米。海拔单位米。`, levels + marks, scale, interval);
}

function drawBend({ site }) {
  const ridge = site === 'ridge';
  const first = ridge ? 180 : 210;
  const interval = ridge ? 30 : 25;
  const bends = [170, 120, 70].map((y, index) => {
    const tip = y + (ridge ? 27 : -27);
    return `<path class="map-line" fill="none" d="M22 ${y}H142 Q177 ${y} 215 ${tip} Q253 ${y} 288 ${y}H390"/>
      <text class="map-label" x="61" y="${y + 4}">${first + index * interval}</text>`;
  }).join('');
  return mapFrame(ridge ? '石岩的弯折等高线' : '云溪的弯折等高线',
    `图上从下到上的等高线海拔升高，三条线在 P 所在的中轴附近均向${ridge ? '下方低处' : '上方高处'}凸出。`,
    bends + marker(215, 120 + (ridge ? 27 : -27), 'P', 12, ridge ? 16 : -12), 200, interval);
}

function drawSaddle({ site }) {
  const granite = site === 'granite';
  const first = granite ? 380 : 120;
  const interval = granite ? 40 : 30;
  const xLeft = granite ? 118 : 128;
  const xRight = granite ? 287 : 299;
  const lowY = granite ? 138 : 121;
  const highY = granite ? 85 : 93;
  const middleX = (xRight + xLeft) / 2;
  const middleY = (lowY + highY) / 2;
  const rings = [
    [xLeft, lowY, first + interval, 65, 53],
    [xRight, highY, first + interval, 63, 46],
    [xLeft, lowY, first + interval * 2, 33, 25],
    [xRight, highY, first + interval * 2, 28, 22],
  ].map(([x, y, value, rx, ry]) => `<ellipse class="map-line" cx="${x}" cy="${y}" rx="${rx}" ry="${ry}"/>
    <text class="map-label" x="${x - 5}" y="${y - ry + 4}">${value}</text>`).join('');
  const base = `<ellipse class="map-line map-band-0" cx="211" cy="112" rx="190" ry="100"/>
    <text class="map-label" x="211" y="16">${first}</text>`;
  return mapFrame(granite ? '花岗双峰' : '石门双峰',
    `一条外圈 ${first} 米等高线圈住两组各自闭合、向内升高的等高线。左峰标 A，右峰标 C，B 位于两峰之间的下凹处。`,
    base + rings + marker(xLeft, lowY, 'A') + marker(middleX, middleY, 'B') + marker(xRight, highY, 'C'), 300, interval);
}

function drawScale({ site }) {
  const fen = site === 'fen';
  const scale = fen ? 300 : 200;
  const distance = fen ? 240 : 160;
  const y = fen ? 123 : 104;
  const first = fen ? 320 : 100;
  const interval = fen ? 40 : 25;
  const topographic = [39, 71, 163, 193].map((lineY, index) =>
    `<path class="map-line" fill="none" d="M17 ${lineY}Q196 ${lineY - 14} 423 ${lineY}"/>
    <text class="map-label" x="62" y="${lineY + 1}">${first + (3 - index) * interval}</text>`).join('');
  const route = `<path class="map-distance" d="M88 ${y}H${88 + distance}"/>
    ${marker(88, y, '甲')}${marker(88 + distance, y, '乙')}
    <text class="map-label" x="${88 + distance / 2}" y="${y + 23}">直线距离</text>`;
  return mapFrame(fen ? '汾溪巡护图' : '槐树林巡护图',
    `甲乙连线长约为图上比例尺整段的 ${distance / 80} 倍。比例尺整段代表 ${scale} 米。`,
    topographic + route, scale, interval);
}

export function renderContourMap(diagram) {
  if (diagram.kind === 'bend') return drawBend(diagram);
  if (diagram.kind === 'saddle') return drawSaddle(diagram);
  if (diagram.kind === 'scale') return drawScale(diagram);
  return drawHill(diagram);
}
