import { contourProfile, sunlightAt, TERRAIN_SITES, TO_RADIANS } from './geo-model.js';
import { mountFlat } from './flat.js?v=7';
import { fitActivityStage } from './activity-stage.js';
import { FLOW_NOTES, getFlowPaths } from './flow-model.js';

const THREE_LOAD_TIMEOUT = 7000;
const threeRuntimeUrl = new URL('./three-runtime.js?v=2', import.meta.url);
let threeRuntime;
let pendingRuntime;
let retryRuntime = false;
let runtimeHint;

function isFastConnection() {
  const connection = navigator.connection;
  return connection?.saveData === false && connection.effectiveType === '4g' &&
    connection.downlink >= 2 && connection.rtt <= 200;
}

function canRestoreThree() {
  const connection = navigator.connection;
  return !connection?.saveData && !['slow-2g', '2g', '3g'].includes(connection?.effectiveType);
}

function preloadThreeRuntime() {
  if (threeRuntime || pendingRuntime || retryRuntime || runtimeHint ||
      !isFastConnection() || !('WebGL2RenderingContext' in window)) return;
  const link = document.createElement('link');
  if (!link.relList.supports('modulepreload')) return;
  link.rel = 'modulepreload';
  link.href = threeRuntimeUrl.href;
  link.fetchPriority = 'low';
  link.addEventListener('error', () => { retryRuntime = true; }, { once: true });
  runtimeHint = link;
  document.head.append(link);
}

function resetRuntimeRequest(request) {
  if (pendingRuntime !== request) return;
  pendingRuntime = undefined;
  retryRuntime = true;
}

function loadThreeRuntime() {
  if (threeRuntime) return Promise.resolve(threeRuntime);
  if (!pendingRuntime) {
    const url = new URL(threeRuntimeUrl);
    if (retryRuntime) url.searchParams.set('retry', Date.now());
    const request = import(url.href).then(runtime => {
      if (pendingRuntime === request) pendingRuntime = undefined;
      threeRuntime = runtime;
      return runtime;
    }, error => {
      resetRuntimeRequest(request);
      throw error;
    });
    pendingRuntime = request;
  }
  return pendingRuntime;
}

const defaultsByLab = {
  globe: {
    mode: 'coordinates', lat: 40, lon: 116, pointLat: 40, pointLon: 116,
    hour: 4, month: 6, viewYaw: 0, terrainFocus: 'himalayas', flow: 'currents',
    season: 'summer', currentId: 'kuroshio',
  },
  contour: { section: 'ab', walkStep: 0, exerciseVersion: 2 },
  terrain: { siteA: 'himalayas', siteB: 'alps' },
};
const globeModes = ['coordinates', 'daylight', 'terrain', 'circulation'];
const siteIds = Object.keys(TERRAIN_SITES);
const currents = getFlowPaths('currents');
const sites = Object.entries(TERRAIN_SITES);

function numeric(value, fallback, min, max) {
  return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

function coordinates(lat, lon) {
  const label = (value, positive, negative, zero = '0°') => value === 0
    ? zero : `${Math.abs(Math.round(value))}° ${value > 0 ? positive : negative}`;
  return `${label(lat, 'N', 'S')}，${label(lon, 'E', 'W')}`;
}

function daylightHours(lat, declination) {
  const cosHourAngle = -Math.tan(lat * TO_RADIANS) * Math.tan(declination * TO_RADIANS);
  return Math.round(24 * Math.acos(Math.max(-1, Math.min(1, cosHourAngle))) / Math.PI);
}

function clipSettings(kind, saved, params) {
  const initial = defaultsByLab[kind];
  const entryKey = ['mode', 'flow', 'season', 'site', 'siteB']
    .map(key => params.has(key) ? key + '=' + params.get(key) : '').filter(Boolean).join('&');
  const previous = new URLSearchParams(saved?.entryKey);
  const isNewEntry = !saved || ['mode', 'flow', 'season', 'site', 'siteB'].some(key => params.get(key) !== previous.get(key));
  const state = {
    ...initial,
    entryKey,
    preferThree: saved?.preferThree === true,
    evidenceOpen: saved?.evidenceOpen === true,
  };
  const cameraPose = saved?.cameraPose;
  if (!isNewEntry && Array.isArray(cameraPose?.direction) && cameraPose.direction.length === 3 &&
      cameraPose.direction.every(Number.isFinite) && cameraPose.direction.some(Boolean) && Number.isFinite(cameraPose.zoom)) {
    state.cameraPose = cameraPose;
  }
  if (kind === 'globe') {
    state.pointLat = numeric(saved?.pointLat ?? saved?.lat, initial.pointLat, -90, 90);
    state.pointLon = numeric(saved?.pointLon ?? saved?.lon, initial.pointLon, -180, 180);
    state.dayPair = saved?.dayPair === true;
    state.lat = numeric(saved?.lat, state.pointLat, -90, 90);
    state.lon = numeric(saved?.lon, state.pointLon, -180, 180);
    state.hour = numeric(saved?.hour, initial.hour, 0, 23);
    state.month = numeric(saved?.month, initial.month, 1, 12);
    state.viewYaw = numeric(saved?.viewYaw, 0, -360, 360);
    state.flow = saved?.flow === 'monsoon' ? 'monsoon' : 'currents';
    state.season = saved?.season === 'winter' ? 'winter' : 'summer';
    state.terrainFocus = siteIds.includes(saved?.terrainFocus) ? saved.terrainFocus : initial.terrainFocus;
    state.currentId = currents.find(item => item.id === saved?.currentId)?.id ?? initial.currentId;
    state.mode = globeModes.includes(saved?.mode) ? saved.mode : 'coordinates';
    if (isNewEntry && globeModes.includes(params.get('mode'))) {
      state.mode = params.get('mode');
      const flow = params.get('flow');
      const season = params.get('season');
      if (flow === 'monsoon' || flow === 'currents') state.flow = flow;
      if (season === 'winter' || season === 'summer') state.season = season;
      Object.assign(state, globeFocus(state), { viewYaw: 0 });
    }
  }
  if (kind === 'contour') {
    if (saved?.section === 'cd') state.section = 'cd';
    state.walkStep = Math.round(numeric(saved?.walkStep, initial.walkStep, 0, 12));
    if (saved?.exerciseVersion !== initial.exerciseVersion) state.preferThree = false;
  }
  if (kind === 'terrain') {
    state.siteA = isNewEntry && siteIds.includes(params.get('site')) ? params.get('site') : siteIds.includes(saved?.siteA) ? saved.siteA : initial.siteA;
    state.siteB = isNewEntry && siteIds.includes(params.get('siteB')) ? params.get('siteB')
      : siteIds.includes(saved?.siteB) ? saved.siteB : initial.siteB;
    if (state.siteA === state.siteB) state.siteB = siteIds.find(id => id !== state.siteA);
  }
  return state;
}

function globeFocus(settings) {
  if (settings.mode === 'terrain') {
    const { lat, lon } = TERRAIN_SITES[settings.terrainFocus];
    return { lat, lon };
  }
  if (settings.mode === 'circulation' && settings.flow === 'monsoon') return { lat: 32, lon: 112 };
  if (settings.mode === 'circulation') {
    const current = currents.find(item => item.id === settings.currentId) ?? currents[0];
    const [lat, lon] = current.points[Math.floor(current.points.length / 2)];
    return { lat, lon };
  }
  return { lat: settings.pointLat, lon: settings.pointLon };
}

const controls = (kind, settings, inline) => {
  if (kind === 'globe') return `
    <div class="control-pair" data-coordinate-controls>
      <div class="control-group"><label for="lab-lat">纬度 <output data-value="lat"></output></label><input id="lab-lat" type="range" min="-90" max="90" value="${settings.lat}" data-number="lat"></div>
      <div class="control-group"><label for="lab-lon">经度 <output data-value="lon"></output></label><input id="lab-lon" type="range" min="-180" max="180" value="${settings.lon}" data-number="lon"></div>
    </div>
    <div data-globe-daylight class="control-pair" hidden>
      <div class="control-group" data-day-clock><label for="lab-hour">北京时间 <output data-value="hour"></output></label><input id="lab-hour" type="range" min="0" max="23" value="${(settings.hour + 8) % 24}" data-number="hour"></div>
      <div class="control-group"><label for="lab-month">月份 <output data-value="month"></output></label><input id="lab-month" type="range" min="1" max="12" value="${settings.month}" data-number="month"></div>
    </div>
    <div class="mini-actions" aria-label="经纬示例" data-globe-points>
      <button type="button" class="chip" data-point="40,116">北京附近</button>
      <button type="button" class="chip" data-point="0,0">赤道与 0° 经线</button>
      <button type="button" class="chip" data-point="-33,151">南半球示例</button>
    </div>
    <div class="mini-actions" aria-label="昼夜实验选项" data-day-points hidden>
      <button type="button" class="chip" data-point="40,116">北京附近</button>
      <button type="button" class="chip" data-day-pair aria-pressed="false">比南北昼长</button>
    </div>
    <div class="control-pair" data-globe-terrain hidden>
      <div class="control-group"><label for="terrain-focus">点图上圆点，或选山地</label><select id="terrain-focus" data-terrain-focus>${sites.map(([id, site]) => `<option value="${id}">${site.name}</option>`).join('')}</select></div>
      <div class="dock-link">${inline ? '<button type="button" class="button" data-terrain-knowledge>看这座山的照片</button>' : '<a class="button" data-terrain-knowledge>山地照片 →</a>'}</div>
    </div>
    <div data-globe-flows hidden>
      <div class="control-pair">
        <div class="control-group"><label for="flow-kind">观察什么</label>
          <select id="flow-kind" data-flow><option value="currents">表层洋流</option><option value="monsoon">东亚季风</option></select></div>
        <div class="control-group" data-current-controls><label for="current-focus">选一条洋流</label><select id="current-focus" data-current>${currents.map(item => `<option value="${item.id}">${item.name}</option>`).join('')}</select></div>
        <div class="control-group" data-season-controls hidden><label for="monsoon-season">切换季节</label><select id="monsoon-season" data-season><option value="summer">东亚夏季风</option><option value="winter">东亚冬季风</option></select></div>
      </div>
    </div>`;
  if (kind === 'contour') return `
    <div role="group" aria-label="选择山路" class="mini-actions">
      <button type="button" class="chip" data-section="ab">走 A 到 B</button>
      <button type="button" class="chip" data-section="cd">走 C 到 D</button>
    </div>
    <div class="control-group walk-control" data-walk>
      <label for="lab-walk">沿路走一走 <output data-walk-distance></output></label>
      <input id="lab-walk" type="range" min="0" max="12" step="1" value="${settings.walkStep}" data-number="walkStep">
    </div>`;
  return '<div class="control-pair">' + ['A', 'B'].map(channel => `
    <div class="control-group"><label for="site-${channel}">山地 ${channel}</label>
      <select id="site-${channel}" data-site="site${channel}">${sites.map(([id, site]) => `<option value="${id}" ${id === settings['site' + channel] ? 'selected' : ''}>${site.name}（${site.region}）</option>`).join('')}</select>
    </div>`).join('') + '</div><button class="button" type="button" data-swap>交换两处山地</button>';
};

const challenges = {
  globe: {
    title: '北京附近什么时候在照亮的一侧？',
    prompt: '选「昼夜四季」，把地点设在北京附近。把北京时间拨到中午 12:00，再拨到半夜 00:00，哪个时刻的标记在亮面？',
    options: ['中午在亮面，半夜在暗面', '中午在暗面，半夜在亮面'],
    feedback: ['北京附近同一个点，正午转到朝向太阳的一侧，半夜转到背向太阳的一侧。', '先找亮面，再看北京附近的标记落在哪一边。'],
  },
  contour: {
    title: '哪条山路有一小段更陡？',
    prompt: '先沿 A 到 B 走走，再换 C 到 D。侧面图上，哪条路有一小段升高或降低得更快？',
    options: ['A 到 B', 'C 到 D'],
    answer: 1,
    feedback: ['切回侧面图，找两条线上斜得最快的那一小段，比较同样远的距离。', 'C 到 D 有一段更陡。走同样远，脚下升高或降低得更多。从侧面看沿线的起伏，这张图就叫地形剖面图。'],
  },
  terrain: {
    title: '两处山地怎样比才公平？',
    prompt: '选两处山地。切换平面看剖面坐标轴和示意高程，比较时哪种做法能保留可比性？',
    options: ['维持相同纵轴和色阶，再看起伏与高程', '把两处模型都放大到一样高，再按屏幕高度比较'],
    feedback: ['同一测量尺度可以比较。这些剖面是教学示意，需要用官方地形图确认真实位置和分布。', '把两张图各自放到满高，会丢掉真实或模型中的高程比例。返回比较，确认两张图使用同一尺度。'],
  },
};

function challengeHtml(kind, inline) {
  const task = challenges[kind];
  const answers = `<p>${task.prompt}</p>
    <div class="options" role="group" aria-label="实验结论">${task.options.map((option, i) => `<button type="button" class="option" data-lab-answer="${i}" aria-pressed="false">${option}</button>`).join('')}</div>
    <p class="feedback" data-lab-feedback role="status" hidden></p>`;
  return inline ? `<details class="panel"><summary>${task.title}</summary>${answers}</details>`
    : `<section class="panel"><h2>${task.title}</h2>${answers}</section>`;
}

export function mountLabUI(host, lab, params, saved, onChange, { inline = false, fixedMode, origin = location.hash, onTopic } = {}) {
  const kind = lab.id;
  let settings = clipSettings(kind, saved, params);
  if (fixedMode && settings.mode !== fixedMode) {
    settings.mode = fixedMode;
    Object.assign(settings, globeFocus(settings), { viewYaw: 0, cameraPose: undefined });
  }
  const challenge = challenges[kind];
  const correctAnswer = challenge.answer ?? 0;
  const sameExercise = kind !== 'contour' || saved?.exerciseVersion === settings.exerciseVersion;
  if (sameExercise && Number.isInteger(saved?.answer) && saved.answer >= 0 && saved.answer < challenge.options.length) settings.answer = saved.answer;
  host.dataset.labKind = kind;
  if (inline) host.dataset.labInline = '';
  let disposed = false;
  let loadVersion = 0;
  let loadTimer;
  let activeMode = 'flat';
  let three;
  let flat;
  let openingContext;
  let preloadTimer;
  let stageObserver;
  let touchEnabled = !matchMedia('(pointer: coarse)').matches;

  host.innerHTML = `
    <div class="lesson-shell lab-layout" data-lab-kind="${kind}">
      <div class="lab-stage">
        <div class="stage-head">
          ${kind === 'globe' && !fixedMode ? `<div role="group" aria-label="地球仪图层" class="mode-strip">
            <button type="button" class="chip" data-mode="coordinates">经纬</button>
            <button type="button" class="chip" data-mode="daylight">昼夜四季</button>
            <button type="button" class="chip" data-mode="terrain">地形</button>
            <button type="button" class="chip" data-mode="circulation">洋流季风</button>
          </div>` : ''}
          <div class="stage-bar">
            <span class="stage-state" role="status" data-stage-state>平面视图</span>
            <div class="mini-actions" aria-label="场景操作">
              <button class="button" type="button" data-rotate hidden>旋转场景</button>
              ${kind === 'globe' ? '<button class="button turn-button" type="button" data-turn aria-label="向东转动视角 45 度">东转 45°</button>' : ''}
              <button class="button" type="button" data-toggle-view>开启 3D</button>
            </div>
          </div>
        </div>
          <div class="lab-view" style="position:relative">
            <div class="scene-host" hidden></div>
            <div class="flat-host"></div>
          </div>
          <div class="lab-live"><p data-live></p><div data-flow-legend class="flow-legend" hidden></div></div>
      </div>
      <section class="lab-dock" aria-label="实验控制">
        <div class="lab-control">${controls(kind, settings, inline)}</div>
      </section>
      <details class="panel lab-evidence">
        <summary>图例与读数说明</summary><p class="lab-reading" data-reading></p>
        ${kind === 'terrain' ? '<p data-terrain-links></p>' : ''}
        ${kind === 'globe' ? '<p data-overlay-links></p>' : ''}
      </details>
    </div>
    <div class="lab-followup" data-challenge>${inline ? '' : challengeHtml(kind, false)}</div>`;

  const stage = host.querySelector('[data-stage-state]');
  const sceneHost = host.querySelector('.scene-host');
  const flatHost = host.querySelector('.flat-host');
  const switcher = host.querySelector('[data-toggle-view]');
  const rotation = host.querySelector('[data-rotate]');
  const turn = host.querySelector('[data-turn]');
  const evidence = host.querySelector('.lab-evidence');
  evidence.open = settings.evidenceOpen;
  const reading = host.querySelector('[data-reading]');
  const live = host.querySelector('[data-live]');
  const flowLegend = host.querySelector('[data-flow-legend]');
  const answerButtons = [...host.querySelectorAll('[data-lab-answer]')];
  const labFeedback = host.querySelector('[data-lab-feedback]');
  const rotatable = matchMedia('(pointer: coarse)').matches;

  function syncControls() {
    for (const input of host.querySelectorAll('[data-number]')) {
      input.value = input.dataset.number === 'hour' ? (settings.hour + 8) % 24 : settings[input.dataset.number];
    }
    for (const input of host.querySelectorAll('[data-site]')) input.value = settings[input.dataset.site];
    for (const button of host.querySelectorAll('[data-mode]')) button.setAttribute('aria-pressed', String(button.dataset.mode === settings.mode));
    for (const button of host.querySelectorAll('[data-section]')) button.setAttribute('aria-pressed', String(button.dataset.section === settings.section));
    if (kind === 'globe') {
      host.querySelector('[data-coordinate-controls]').hidden = settings.mode !== 'coordinates';
      host.querySelector('[data-globe-points]').hidden = settings.mode !== 'coordinates';
      host.querySelector('[data-day-points]').hidden = settings.mode !== 'daylight';
      host.querySelector('[data-day-pair]').setAttribute('aria-pressed', String(settings.dayPair));
      host.querySelector('[data-day-clock]').hidden = settings.dayPair;
      host.querySelector('[data-globe-daylight]').hidden = settings.mode !== 'daylight';
      host.querySelector('[data-globe-terrain]').hidden = settings.mode !== 'terrain';
      host.querySelector('[data-globe-flows]').hidden = settings.mode !== 'circulation';
      host.querySelector('[data-current-controls]').hidden = settings.flow !== 'currents';
      host.querySelector('[data-season-controls]').hidden = settings.flow !== 'monsoon';
      host.querySelector('[data-terrain-focus]').value = settings.terrainFocus;
      host.querySelector('[data-flow]').value = settings.flow;
      host.querySelector('[data-current]').value = settings.currentId;
      host.querySelector('[data-season]').value = settings.season;
      host.querySelector('[data-challenge]').hidden = settings.mode !== 'daylight';
      for (const field of ['lat', 'lon', 'hour', 'month']) {
        const value = Math.round(settings[field]);
        host.querySelector('[data-value="' + field + '"]').textContent = field === 'month' ? value + ' 月' : field === 'hour'
          ? String((value + 8) % 24).padStart(2, '0') + ':00'
          : value === 0 ? '0°' : Math.abs(value) + '° ' + (field === 'lat' ? value > 0 ? 'N' : 'S' : value > 0 ? 'E' : 'W');
      }
      const location = coordinates(settings.lat, settings.lon);
      const overlayLinks = host.querySelector('[data-overlay-links]');
      overlayLinks.replaceChildren();
      flowLegend.hidden = settings.mode !== 'circulation';
      if (settings.mode === 'terrain') {
        const site = TERRAIN_SITES[settings.terrainFocus];
        live.textContent = `${site.region} · ${site.name} · ${coordinates(site.lat, site.lon)}`;
        reading.textContent = '选一处山地，看看标记附近的陆地哪里起伏最明显。图上的明暗让起伏更容易看见。读具体海拔时，可以翻教材的分层设色地形图。';
        const knowledge = host.querySelector('[data-terrain-knowledge]');
        if (!inline) knowledge.href = '#/concept/' + settings.terrainFocus + '?' + new URLSearchParams({ from: origin });
        const link = document.createElement('a');
        link.href = '#/lab/terrain?' + new URLSearchParams({ site: settings.terrainFocus, fromGlobe: 'terrain', returnTo: origin });
        link.className = 'text-link';
        link.textContent = '并排比较两处山地 →';
        if (!inline) overlayLinks.append(link);
      } else if (settings.mode === 'circulation') {
        const path = settings.flow === 'monsoon' ? getFlowPaths('monsoon', settings.season)[0] : currents.find(item => item.id === settings.currentId);
        const type = path.kind === 'warm' ? '暖流' : path.kind === 'cold' ? '寒流' : '低层风';
        const monsoon = settings.flow === 'monsoon';
        const legend = monsoon ? '箭头表示风吹去的方向，金色表示夏季风，淡紫色表示冬季风。' : '橙色表示暖流，浅蓝色表示寒流，箭头指向水流去的方向。';
        flowLegend.innerHTML = monsoon
          ? '<span data-flow-key="' + settings.season + '">风吹去的方向</span>'
          : '<span data-flow-key="warm">暖流</span><span data-flow-key="cold">寒流</span>';
        live.textContent = `${path.name}（${type}）· ${path.direction}`;
        reading.textContent = legend + path.description + ' ' + (FLOW_NOTES[settings.flow === 'monsoon' ? settings.season : 'currents'] ?? '');
        const link = document.createElement('a');
        link.href = '#/lesson/climate';
        link.className = 'text-link';
        link.textContent = '联系七上 世界主要气候类型 →';
        if (!inline) overlayLinks.append(link);
      } else if (settings.mode === 'daylight') {
        const sun = sunlightAt(settings.lat, settings.lon, settings.hour, settings.month);
        if (settings.dayPair && settings.lat !== 0) {
          const latitude = Math.abs(settings.lat);
          const north = daylightHours(latitude, sun.declination);
          const south = daylightHours(-latitude, sun.declination);
          live.textContent = `北纬 ${latitude}° 约 ${north} 小时白天 · 南纬 ${latitude}° 约 ${south} 小时白天`;
        } else {
          live.textContent = `${location} · ${sun.lit ? '在亮面' : '在暗面'} · 直射约 ${Math.abs(sun.declination).toFixed(1)}° ${sun.declination >= 0 ? 'N' : 'S'}`;
        }
        reading.textContent = settings.dayPair
          ? '两个点经度相同，分别在赤道南北。把月份从 6 月拨到 12 月，看看哪里白天更长。数字按各月中旬的日照取整。'
          : '拨动北京时间，看所选地点什么时候转到亮面。';
      } else {
        live.textContent = `当前坐标 ${location}`;
        reading.textContent = '纬度用来比较南北位置，经度用来比较东西位置。两条线的交点可以帮你找到这个点。';
      }
    } else if (kind === 'contour') {
      const samples = contourProfile(settings.section, 13);
      const elevations = samples.map(point => point.elevation);
      const maxJump = Math.round(Math.max(...elevations.slice(1).map((value, i) => Math.abs(value - elevations[i]))));
      const route = settings.section === 'ab' ? 'A 到 B' : 'C 到 D';
      const point = samples[settings.walkStep];
      const previous = samples[Math.max(0, settings.walkStep - 1)];
      const gain = point.elevation - previous.elevation;
      const slope = settings.walkStep === 0 ? '起点' : gain > 0 ? `前一段升高 ${gain} 米` : gain < 0 ? `前一段降低 ${-gain} 米` : '前一段差不多是平路';
      host.querySelector('[data-walk-distance]').textContent = '· ' + point.distance.toFixed(1) + ' 千米';
      live.textContent = `${route} · ${slope} · 脚下约 ${point.elevation} 米`;
      reading.textContent = `侧面图的线表示沿路的高低，这就是地形剖面图。两条路在模型中都长约 9.6 千米。在当前路线，同样走约 0.8 千米，最大高差约 ${maxJump} 米。`;
    } else {
      const a = TERRAIN_SITES[settings.siteA];
      const b = TERRAIN_SITES[settings.siteB];
      live.textContent = `示意最高点 A 约 ${Math.max(...a.heights)} 米 · B 约 ${Math.max(...b.heights)} 米`;
      reading.textContent = `A 为${a.region}的${a.name}，B 为${b.region}的${b.name}。两条教学示意剖面使用同一高程尺度。实际位置和高程范围以教材地形图为准。`;
      const links = host.querySelector('[data-terrain-links]');
      links.replaceChildren(...[settings.siteA, settings.siteB].map(id => {
        const link = document.createElement('a');
        link.className = 'text-link';
        link.href = '#/concept/' + id + '?' + new URLSearchParams({ from: origin });
        link.textContent = TERRAIN_SITES[id].name + '知识卡 →';
        link.style.marginRight = '12px';
        return link;
      }));
    }
    for (const [index, button] of answerButtons.entries()) {
      button.setAttribute('aria-pressed', String(settings.answer === index));
      button.classList.toggle('try-again', index !== correctAnswer && settings.answer === index);
    }
    if (!labFeedback) return;
    labFeedback.hidden = !Number.isInteger(settings.answer);
    if (!labFeedback.hidden) {
      labFeedback.textContent = challenges[kind].feedback[settings.answer];
      labFeedback.classList.toggle('try-again', settings.answer !== correctAnswer);
    }
  }

  function notifySettings() {
    onChange(settings);
    syncControls();
    three?.update(sceneConfig());
    flat?.update(sceneConfig());
  }

  function saveCamera(cameraPose) {
    if (disposed || !cameraPose) return;
    settings = { ...settings, cameraPose };
    onChange(settings);
  }

  function sceneConfig() {
    return {
      ...settings,
      interactive: touchEnabled,
      onContextLost: () => {
        if (!disposed) failThree('3D 已中断，可以继续用平面图。');
      },
      onCoordinatePick: ({ lat, lon }) => changePoint(Math.round(lat), Math.round(lon)),
      onCameraChange: saveCamera,
      onTerrainPick: ({ id }) => {
        if (siteIds.includes(id)) setGlobeFocus({ terrainFocus: id });
      },
    };
  }

  function setMode(mode) {
    activeMode = mode;
    host.dataset.threeState = mode;
  }

  function rememberThree(preferThree) {
    if (settings.preferThree === preferThree) return;
    settings = { ...settings, preferThree };
    onChange(settings);
  }

  function releaseOpeningContext() {
    if (openingContext && !openingContext.isContextLost()) {
      openingContext.getExtension('WEBGL_lose_context')?.loseContext();
    }
    openingContext = undefined;
  }

  function stopObservingStage() {
    clearTimeout(preloadTimer);
    stageObserver?.disconnect();
  }

  function useFlat(message, failed = false) {
    loadVersion += 1;
    clearTimeout(loadTimer);
    if (activeMode === 'three') saveCamera(three?.captureCamera());
    releaseOpeningContext();
    three?.dispose();
    three = null;
    setMode(failed ? 'failed' : 'flat');
    sceneHost.hidden = true;
    sceneHost.removeAttribute('style');
    flatHost.hidden = false;
    flat ||= mountFlat(flatHost, kind, sceneConfig());
    flat.update(sceneConfig());
    switcher.textContent = failed ? '重试 3D' : kind === 'contour' ? '看 3D 山坡' : '开启 3D';
    rotation.hidden = true;
    if (turn) turn.hidden = true;
    stage.textContent = message ?? (kind === 'contour' ? '从上看 · 从侧面看' : '平面视图');
    syncControls();
  }

  function failThree(message) {
    rememberThree(false);
    useFlat(message, true);
  }

  async function useThree(focusControls = true) {
    const version = ++loadVersion;
    const isCurrent = () => !disposed && version === loadVersion;
    stopObservingStage();
    stage.textContent = '正在打开 3D，平面图可以继续用。';
    switcher.textContent = '取消 3D';
    setMode('loading');
    const canvas = document.createElement('canvas');
    const antialias = !navigator.deviceMemory || navigator.deviceMemory >= 4;
    try {
      openingContext = canvas.getContext('webgl2', { antialias, alpha: true });
    } catch {
      openingContext = undefined;
    }
    if (!openingContext) {
      failThree('这台设备暂时用不了 3D，可以继续用平面图。');
      return;
    }
    const context = openingContext;
    const request = loadThreeRuntime();
    loadTimer = setTimeout(() => {
      if (!isCurrent()) return;
      if (!threeRuntime) resetRuntimeRequest(request);
      failThree('3D 打开超时，平面图可以继续用。');
    }, THREE_LOAD_TIMEOUT);
    try {
      const { mountScene } = await request;
      if (!isCurrent()) return;
      if (context.isContextLost()) throw new Error('WebGL context was lost while loading');
      // Give the canvas a size while the interactive flat view stays visible.
      Object.assign(sceneHost.style, { position: 'absolute', inset: '0 auto auto 0', visibility: 'hidden' });
      sceneHost.hidden = false;
      three = mountScene(sceneHost, kind, sceneConfig(), {
        canvas,
        context,
        onFirstFrame() {
          if (!isCurrent()) return;
          clearTimeout(loadTimer);
          sceneHost.removeAttribute('style');
          flat?.dispose();
          flat = null;
          flatHost.hidden = true;
          setMode('three');
          rememberThree(true);
          stage.textContent = '三维视图';
          switcher.textContent = kind === 'contour' ? '看侧面' : '切换平面';
          rotation.hidden = !rotatable;
          if (turn) turn.hidden = false;
          rotation.setAttribute('aria-pressed', String(touchEnabled));
          rotation.textContent = touchEnabled ? '恢复页面滑动' : kind === 'globe' ? '拖动地球' : '拖动模型';
          syncControls();
          const { top, bottom } = switcher.getBoundingClientRect();
          if (focusControls && bottom > 0 && top < window.innerHeight) fitActivityStage(host);
        },
        onRenderError() {
          if (isCurrent()) failThree('设备暂时打不开 3D，可以继续用平面图。');
        },
      });
      openingContext = undefined;
    } catch {
      if (!isCurrent()) return;
      failThree(threeRuntime
        ? '设备暂时打不开 3D，可以继续用平面图。'
        : '3D 没下载完成，可以继续用平面图。');
    }
  }

  function change(partial, keepView = false) {
    if (['lat', 'lon', 'mode', 'viewYaw', 'dayPair'].some(key => Object.hasOwn(partial, key) && partial[key] !== settings[key])) {
      partial = { ...partial, cameraPose: keepView ? three?.captureCamera() ?? settings.cameraPose : undefined };
    }
    settings = { ...settings, ...partial };
    notifySettings();
    if (keepView && settings.cameraPose) three?.restoreCamera(settings.cameraPose);
  }

  function setGlobeFocus(partial) {
    const destination = { ...settings, ...partial };
    change({ ...partial, ...globeFocus(destination), viewYaw: 0 });
  }

  function changePoint(lat, lon) {
    change({ lat, lon, pointLat: lat, pointLon: lon });
  }

  for (const input of host.querySelectorAll('[data-number]')) input.addEventListener('input', () => {
    const key = input.dataset.number;
    const value = Number(input.value);
    if (key === 'lat') changePoint(value, settings.lon);
    else if (key === 'lon') changePoint(settings.lat, value);
    else change({ [key]: key === 'hour' ? (value + 16) % 24 : value });
  });
  for (const button of host.querySelectorAll('[data-mode]')) button.addEventListener('click', () => {
    change({ mode: button.dataset.mode }, true);
    fitActivityStage(host);
  });
  for (const button of host.querySelectorAll('[data-point]')) button.addEventListener('click', () => {
    const [lat, lon] = button.dataset.point.split(',').map(Number);
    change({ lat, lon, pointLat: lat, pointLon: lon, viewYaw: 0 });
  });
  host.querySelector('[data-day-pair]')?.addEventListener('click', () => {
    const dayPair = !settings.dayPair;
    if (dayPair && settings.lat === 0) change({ dayPair, lat: 40, pointLat: 40 });
    else change({ dayPair });
    fitActivityStage(host);
  });
  host.querySelector('[data-terrain-focus]')?.addEventListener('change', event => setGlobeFocus({ terrainFocus: event.target.value }));
  if (inline) host.querySelector('[data-terrain-knowledge]')?.addEventListener('click', () => onTopic?.(settings.terrainFocus));
  host.querySelector('[data-flow]')?.addEventListener('change', event => setGlobeFocus({ flow: event.target.value }));
  host.querySelector('[data-current]')?.addEventListener('change', event => setGlobeFocus({ currentId: event.target.value }));
  host.querySelector('[data-season]')?.addEventListener('change', event => change({ season: event.target.value }));
  for (const button of host.querySelectorAll('[data-section]')) button.addEventListener('click', () => change({ section: button.dataset.section }));
  for (const input of host.querySelectorAll('[data-site]')) input.addEventListener('change', () => {
    const key = input.dataset.site;
    const other = key === 'siteA' ? 'siteB' : 'siteA';
    change({ [key]: input.value, [other]: input.value === settings[other] ? settings[key] : settings[other] });
  });
  host.querySelector('[data-turn]')?.addEventListener('click', () => change({ viewYaw: (settings.viewYaw + 45) % 360 }));
  host.querySelector('[data-swap]')?.addEventListener('click', () => change({ siteA: settings.siteB, siteB: settings.siteA }));
  for (const button of answerButtons) button.addEventListener('click', () => change({ answer: Number(button.dataset.labAnswer) }));
  switcher.addEventListener('click', () => {
    if (activeMode === 'loading' || activeMode === 'three') {
      rememberThree(false);
      useFlat();
    } else useThree();
  });
  rotation.addEventListener('click', () => {
    touchEnabled = !touchEnabled;
    rotation.textContent = touchEnabled ? '恢复页面滑动' : kind === 'globe' ? '拖动地球' : '拖动模型';
    rotation.setAttribute('aria-pressed', String(touchEnabled));
    three?.update(sceneConfig());
  });

  evidence.addEventListener('toggle', () => {
    if (settings.evidenceOpen !== evidence.open) change({ evidenceOpen: evidence.open });
  });
  syncControls();
  onChange(settings);
  useFlat();
  if (settings.preferThree && canRestoreThree()) {
    // Let the flat canvas paint before restoring a previously working 3D view.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (!disposed && activeMode === 'flat' && settings.preferThree) useThree(false);
    }));
  } else if (isFastConnection() && 'IntersectionObserver' in window) {
    // Read the flat view first. Start one low-priority request only if the
    // visitor stays at a visible lab and the connection can spare it.
    stageObserver = new IntersectionObserver(([entry]) => {
      clearTimeout(preloadTimer);
      if (entry.intersectionRatio < 0.45) return;
      preloadTimer = setTimeout(() => {
        if (!disposed && activeMode === 'flat' && document.visibilityState === 'visible') preloadThreeRuntime();
        stopObservingStage();
      }, 1250);
    }, { threshold: 0.45 });
    stageObserver.observe(flatHost);
  }

  return () => {
    disposed = true;
    loadVersion += 1;
    clearTimeout(loadTimer);
    stopObservingStage();
    releaseOpeningContext();
    three?.dispose();
    flat?.dispose();
  };
}
