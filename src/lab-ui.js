import { contourProfile, sunlightAt, TERRAIN_SITES } from './geo-model.js';
import { mountFlat } from './flat.js';
import { FLOW_NOTES, getFlowPaths } from './flow-model.js';

const defaultsByLab = {
  globe: {
    mode: 'coordinates', lat: 40, lon: 116, pointLat: 40, pointLon: 116,
    hour: 4, month: 6, viewYaw: 0, terrainFocus: 'himalayas', flow: 'currents',
    season: 'summer', currentId: 'kuroshio', flat: false,
  },
  contour: { section: 'ab', flat: false },
  terrain: { siteA: 'himalayas', siteB: 'alps', flat: false },
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

function clipSettings(kind, saved, params) {
  const initial = defaultsByLab[kind];
  const entryKey = params.toString();
  const isNewEntry = entryKey !== saved?.entryKey;
  const state = { ...initial, entryKey, flat: saved?.flat === true || navigator.connection?.saveData === true };
  if (kind === 'globe') {
    state.pointLat = numeric(saved?.pointLat ?? saved?.lat, initial.pointLat, -90, 90);
    state.pointLon = numeric(saved?.pointLon ?? saved?.lon, initial.pointLon, -180, 180);
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
      Object.assign(state, globeFocus(state), { viewYaw: 0 });
    }
  }
  if (kind === 'contour' && saved?.section === 'cd') state.section = 'cd';
  if (kind === 'terrain') {
    state.siteA = isNewEntry && siteIds.includes(params.get('site')) ? params.get('site') : siteIds.includes(saved?.siteA) ? saved.siteA : initial.siteA;
    state.siteB = siteIds.includes(saved?.siteB) ? saved.siteB : initial.siteB;
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

const controls = (kind, settings) => {
  if (kind === 'globe') return `
    <div class="control-pair" data-coordinate-controls>
      <div class="control-group"><label for="lab-lat">纬度 <output data-value="lat"></output></label><input id="lab-lat" type="range" min="-90" max="90" value="${settings.lat}" data-number="lat"></div>
      <div class="control-group"><label for="lab-lon">经度 <output data-value="lon"></output></label><input id="lab-lon" type="range" min="-180" max="180" value="${settings.lon}" data-number="lon"></div>
    </div>
    <div data-globe-daylight class="control-pair" hidden>
      <div class="control-group"><label for="lab-hour">世界时 <output data-value="hour"></output></label><input id="lab-hour" type="range" min="0" max="23" value="${settings.hour}" data-number="hour"></div>
      <div class="control-group"><label for="lab-month">月份 <output data-value="month"></output></label><input id="lab-month" type="range" min="1" max="12" value="${settings.month}" data-number="month"></div>
    </div>
    <div class="mini-actions" aria-label="经纬示例" data-globe-points>
      <button type="button" class="chip" data-point="40,116">北京附近</button>
      <button type="button" class="chip" data-point="0,0">赤道与 0° 经线</button>
      <button type="button" class="chip" data-point="-33,151">南半球示例</button>
    </div>
    <div class="control-pair" data-globe-terrain hidden>
      <div class="control-group"><label for="terrain-focus">找一处山地</label><select id="terrain-focus" data-terrain-focus>${sites.map(([id, site]) => `<option value="${id}">${site.name}</option>`).join('')}</select></div>
      <div class="dock-link"><a class="button" href="#/lab/terrain">并排比较山地 →</a></div>
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
    <div role="group" aria-label="选择剖切线" class="mini-actions">
      <button type="button" class="chip" data-section="ab">剖面 A–B</button>
      <button type="button" class="chip" data-section="cd">剖面 C–D</button>
    </div>`;
  return '<div class="control-pair">' + ['A', 'B'].map(channel => `
    <div class="control-group"><label for="site-${channel}">山地 ${channel}</label>
      <select id="site-${channel}" data-site="site${channel}">${sites.map(([id, site]) => `<option value="${id}" ${id === settings['site' + channel] ? 'selected' : ''}>${site.name}（${site.region}）</option>`).join('')}</select>
    </div>`).join('') + '</div><button class="button" type="button" data-swap>交换两处山地</button>';
};

const challenges = {
  globe: {
    title: '北京附近什么时候在照亮的一侧？',
    prompt: '选“昼夜和季节”，将位置设为北京附近。先停在世界时 04:00，再拨到 16:00。两个时刻中，哪一个时刻该地点在亮面？',
    options: ['04:00 在亮面，16:00 在暗面', '04:00 在暗面，16:00 在亮面'],
    feedback: ['你在用同一点落在亮面或暗面的证据判读。04:00 UTC 相当于北京 12:00，16:00 UTC 相当于北京次日 00:00。', '核对控制台的“该点日照”。先找亮面，再看地点标记。'],
  },
  contour: {
    title: '哪条剖面出现了更陡的一段？',
    prompt: '比较 A–B 和 C–D。同一水平距离内，哪条线的海拔变化曾经更大？',
    options: ['C–D 有更陡的一段', 'A–B 有更陡的一段'],
    feedback: ['C–D 的局部剖面更陡。同样的水平距离内，它的高程变化更大。', '先切换两条剖面，再看最高值附近曲线的斜率和下方的高程变化数据。'],
  },
  terrain: {
    title: '两处山地怎样比才公平？',
    prompt: '选两处山地。切换平面看剖面坐标轴和示意高程，比较时哪种做法能保留可比性？',
    options: ['维持相同纵轴和色阶，再看起伏与高程', '把两处模型都放大到一样高，再按屏幕高度比较'],
    feedback: ['同一测量尺度可以比较。这些剖面是教学示意，需要用官方地形图确认真实位置和分布。', '把两张图各自放到满高，会丢掉真实或模型中的高程比例。返回比较，确认两张图使用同一尺度。'],
  },
};

function challengeHtml(kind) {
  const task = challenges[kind];
  return `<section class="panel"><h2>${task.title}</h2><p>${task.prompt}</p>
    <div class="options" role="group" aria-label="实验结论">${task.options.map((option, i) => `<button type="button" class="option" data-lab-answer="${i}" aria-pressed="false">${option}</button>`).join('')}</div>
    <p class="feedback" data-lab-feedback role="status" hidden></p></section>`;
}

export function mountLabUI(host, lab, params, saved, onChange) {
  const kind = lab.id;
  let settings = clipSettings(kind, saved, params);
  if (Number.isInteger(saved?.answer) && saved.answer >= 0 && saved.answer < challenges[kind].options.length) settings.answer = saved.answer;
  let disposed = false;
  let loadVersion = 0;
  let activeMode = 'flat';
  let three;
  let flat;
  let touchEnabled = !matchMedia('(pointer: coarse)').matches;

  host.innerHTML = `
    <div class="lesson-shell lab-layout">
      <div class="lab-stage">
        <div class="stage-head">
          ${kind === 'globe' ? `<div role="group" aria-label="地球仪图层" class="mode-strip">
            <button type="button" class="chip" data-mode="coordinates">经纬</button>
            <button type="button" class="chip" data-mode="daylight">昼夜四季</button>
            <button type="button" class="chip" data-mode="terrain">地形</button>
            <button type="button" class="chip" data-mode="circulation">洋流季风</button>
          </div>` : ''}
          <div class="stage-bar">
            <span class="stage-state" role="status" data-stage-state>平面视图</span>
            <div class="mini-actions" aria-label="场景操作">
              <button class="button" type="button" data-rotate hidden>旋转场景</button>
              ${kind === 'globe' ? '<button class="button turn-button" type="button" data-turn aria-label="向东转动视角">转向</button>' : ''}
              <button class="button" type="button" data-toggle-view>开启 3D</button>
            </div>
          </div>
        </div>
          <div class="scene-host" hidden></div>
          <div class="flat-host"></div>
          <div class="lab-live"><p data-live></p><div data-flow-legend class="flow-legend" hidden></div></div>
      </div>
      <section class="lab-dock" aria-label="实验控制">
        <div class="lab-control">${controls(kind, settings)}</div>
      </section>
      <details class="panel lab-evidence">
        <summary>图例与读数说明</summary><p class="lab-reading" data-reading></p>
        ${kind === 'terrain' ? '<p data-terrain-links></p><a class="text-link" href="https://r1-ndr.ykt.cbern.com.cn/edu_product/esp/assets/7b63faa4-c6d8-4c9d-b18b-21394da1c56e.t/zh-CN/1787023052170/transcode/image/64.jpg" target="_blank" rel="noopener">查阅教材世界地形图 ↗</a>' : ''}
        ${kind === 'globe' ? '<p data-overlay-links></p>' : ''}
      </details>
    </div>
    <div class="lab-followup" data-challenge>${challengeHtml(kind)}</div>`;

  const stage = host.querySelector('[data-stage-state]');
  const sceneHost = host.querySelector('.scene-host');
  const flatHost = host.querySelector('.flat-host');
  const switcher = host.querySelector('[data-toggle-view]');
  const rotation = host.querySelector('[data-rotate]');
  const reading = host.querySelector('[data-reading]');
  const live = host.querySelector('[data-live]');
  const flowLegend = host.querySelector('[data-flow-legend]');
  const answerButtons = [...host.querySelectorAll('[data-lab-answer]')];
  const labFeedback = host.querySelector('[data-lab-feedback]');
  const rotatable = matchMedia('(pointer: coarse)').matches;

  function syncControls() {
    for (const input of host.querySelectorAll('[data-number]')) input.value = settings[input.dataset.number];
    for (const input of host.querySelectorAll('[data-site]')) input.value = settings[input.dataset.site];
    for (const button of host.querySelectorAll('[data-mode]')) button.setAttribute('aria-pressed', String(button.dataset.mode === settings.mode));
    for (const button of host.querySelectorAll('[data-section]')) button.setAttribute('aria-pressed', String(button.dataset.section === settings.section));
    if (kind === 'globe') {
      host.querySelector('[data-coordinate-controls]').hidden = settings.mode !== 'coordinates';
      host.querySelector('[data-globe-points]').hidden = !['coordinates', 'daylight'].includes(settings.mode);
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
          ? String(value).padStart(2, '0') + ':00'
          : value === 0 ? '0°' : Math.abs(value) + '° ' + (field === 'lat' ? value > 0 ? 'N' : 'S' : value > 0 ? 'E' : 'W');
      }
      const location = coordinates(settings.lat, settings.lon);
      const overlayLinks = host.querySelector('[data-overlay-links]');
      overlayLinks.replaceChildren();
      flowLegend.hidden = settings.mode !== 'circulation';
      if (settings.mode === 'terrain') {
        const site = TERRAIN_SITES[settings.terrainFocus];
        live.textContent = `${site.region} · ${site.name} · ${coordinates(site.lat, site.lon)}`;
        reading.textContent = '陆地和海底的明暗显示地形纹理，蓝绿色区分海洋。选一个山地，看标记附近的陆地起伏。查看定量高程范围时，请使用教材里的分层设色地形图。';
        const link = document.createElement('a');
        link.href = '#/concept/' + settings.terrainFocus + '?from=' + encodeURIComponent(window.location.hash);
        link.className = 'text-link';
        link.textContent = site.name + '知识卡 →';
        overlayLinks.append(link);
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
        overlayLinks.append(link);
      } else if (settings.mode === 'daylight') {
        const sun = sunlightAt(settings.lat, settings.lon, settings.hour, settings.month);
        live.textContent = `${location} · ${sun.lit ? '在亮面' : '在暗面'} · 直射约 ${Math.abs(sun.declination).toFixed(1)}° ${sun.declination >= 0 ? 'N' : 'S'}`;
        reading.textContent = '时刻使用 UTC，UTC 加 8 小时得到北京时间。模型以各月中旬近似当月的太阳照射情况。';
      } else {
        live.textContent = `当前坐标 ${location}`;
        reading.textContent = '纬度用来比较南北位置，经度用来比较东西位置。两条线的交点可以帮你找到这个点。';
      }
    } else if (kind === 'contour') {
      const samples = contourProfile(settings.section, 13);
      const elevations = samples.map(point => point.elevation);
      const maxJump = Math.round(Math.max(...elevations.slice(1).map((value, i) => Math.abs(value - elevations[i]))));
      live.textContent = `剖面 ${settings.section === 'ab' ? 'A–B' : 'C–D'} · 相邻采样最大高差约 ${maxJump} 米`;
      reading.textContent = `两条线全长均约 9.6 千米，采样间隔约 0.8 千米。当前线的最高采样点约 ${Math.max(...elevations)} 米。模型为虚构地貌。`;
    } else {
      const a = TERRAIN_SITES[settings.siteA];
      const b = TERRAIN_SITES[settings.siteB];
      live.textContent = `示意最高点 A 约 ${Math.max(...a.heights)} 米 · B 约 ${Math.max(...b.heights)} 米`;
      reading.textContent = `A 为${a.region}的${a.name}，B 为${b.region}的${b.name}。两条教学示意剖面使用同一高程尺度。实际位置和高程范围以教材地形图为准。`;
      const links = host.querySelector('[data-terrain-links]');
      links.replaceChildren(...[settings.siteA, settings.siteB].map(id => {
        const link = document.createElement('a');
        link.className = 'text-link';
        link.href = '#/concept/' + id + '?from=' + encodeURIComponent(location.hash);
        link.textContent = TERRAIN_SITES[id].name + '知识卡 →';
        link.style.marginRight = '12px';
        return link;
      }));
    }
    for (const [index, button] of answerButtons.entries()) {
      button.setAttribute('aria-pressed', String(settings.answer === index));
      button.classList.toggle('try-again', index > 0 && settings.answer === index);
    }
    labFeedback.hidden = !Number.isInteger(settings.answer);
    if (!labFeedback.hidden) {
      labFeedback.textContent = challenges[kind].feedback[settings.answer];
      labFeedback.classList.toggle('try-again', settings.answer !== 0);
    }
  }

  function notifySettings() {
    onChange(settings);
    syncControls();
    three?.update(sceneConfig());
    flat?.update(sceneConfig());
  }

  function sceneConfig() {
    return {
      ...settings,
      interactive: touchEnabled,
      onContextLost: () => {
        if (!disposed) useFlat('3D 已中断，已恢复为平面视图。');
      },
      onCoordinatePick: ({ lat, lon }) => changePoint(Math.round(lat), Math.round(lon)),
      onTerrainPick: ({ id }) => {
        if (siteIds.includes(id)) setGlobeFocus({ terrainFocus: id });
      },
    };
  }

  function useFlat(message = '平面视图') {
    loadVersion += 1;
    three?.dispose();
    three = null;
    activeMode = 'flat';
    sceneHost.hidden = true;
    flatHost.hidden = false;
    flat ||= mountFlat(flatHost, kind, sceneConfig());
    flat.update(sceneConfig());
    switcher.textContent = '开启 3D';
    rotation.hidden = true;
    stage.textContent = message;
  }

  async function useThree() {
    const version = ++loadVersion;
    stage.textContent = '正在加载 3D，可先操作平面视图。';
    switcher.textContent = '继续用平面';
    activeMode = 'loading';
    const timer = setTimeout(() => {
      if (!disposed && version === loadVersion) useFlat('3D 加载较慢，正在使用平面视图。');
    }, 7500);
    try {
      const { mountScene } = await import('./scenes.js');
      if (disposed || version !== loadVersion) return;
      sceneHost.hidden = false;
      three = mountScene(sceneHost, kind, sceneConfig());
      if (!three) throw new Error('3D graphics unavailable');
      flat?.dispose();
      flat = null;
      flatHost.hidden = true;
      activeMode = 'three';
      stage.textContent = 'Three.js 三维视图';
      switcher.textContent = '切换平面';
      rotation.hidden = !rotatable;
      rotation.setAttribute('aria-pressed', String(touchEnabled));
      rotation.textContent = touchEnabled ? '恢复页面滑动' : '旋转场景';
    } catch {
      if (!disposed && version === loadVersion) useFlat('此设备暂时无法显示 3D，平面任务可以继续。');
    } finally {
      clearTimeout(timer);
    }
  }

  function change(partial) {
    settings = { ...settings, ...partial };
    notifySettings();
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
    else change({ [key]: value });
  });
  for (const button of host.querySelectorAll('[data-mode]')) button.addEventListener('click', () => {
    setGlobeFocus({ mode: button.dataset.mode });
    const workspace = host.querySelector('.lab-layout');
    const dock = host.querySelector('.lab-dock');
    const clipped = dock.getBoundingClientRect().bottom - innerHeight + 8;
    const start = workspace.getBoundingClientRect().top;
    if (clipped > 0 && start > 0) scrollBy(0, Math.min(clipped, start));
  });
  for (const button of host.querySelectorAll('[data-point]')) button.addEventListener('click', () => {
    const [lat, lon] = button.dataset.point.split(',').map(Number);
    change({ lat, lon, pointLat: lat, pointLon: lon, viewYaw: 0 });
  });
  host.querySelector('[data-terrain-focus]')?.addEventListener('change', event => setGlobeFocus({ terrainFocus: event.target.value }));
  host.querySelector('[data-flow]')?.addEventListener('change', event => setGlobeFocus({ flow: event.target.value }));
  host.querySelector('[data-current]')?.addEventListener('change', event => setGlobeFocus({ currentId: event.target.value }));
  host.querySelector('[data-season]')?.addEventListener('change', event => setGlobeFocus({ season: event.target.value }));
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
    const flat = activeMode !== 'flat';
    change({ flat });
    if (flat) useFlat();
    else useThree();
  });
  rotation.addEventListener('click', () => {
    touchEnabled = !touchEnabled;
    rotation.textContent = touchEnabled ? '恢复页面滑动' : '旋转场景';
    rotation.setAttribute('aria-pressed', String(touchEnabled));
    three?.update(sceneConfig());
  });

  syncControls();
  onChange(settings);
  useFlat();
  if (!settings.flat) useThree();

  return () => {
    disposed = true;
    loadVersion += 1;
    three?.dispose();
    flat?.dispose();
  };
}
