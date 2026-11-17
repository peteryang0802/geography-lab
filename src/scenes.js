import * as THREE from 'three';
import { OrbitControls } from '../vendor/three/examples/jsm/controls/OrbitControls.js';

import {
  COAST_RINGS,
  CONTOUR_LEVELS,
  FLOW_COLORS,
  SECTION_HALF_LENGTH,
  SECTION_POSITIONS,
  TERRAIN_SITES,
  TO_RADIANS,
  contourAltitude,
  contourProfile,
  geographicDirection,
  sunlightAt,
} from './geo-model.js';
import { getFlowPaths } from './flow-model.js';
import { loadReliefImage } from './relief-image.js?v=5';

export { TERRAIN_SITES, contourProfile, sunlightAt } from './geo-model.js';

const SURFACE_NORMAL = new THREE.Vector3(0, 0, 1);
const ARROW_UP = new THREE.Vector3(0, 1, 0);
const MOUNTAIN_COLOR = [
  [0, '#639d79'],
  [700, '#83aa71'],
  [1600, '#b4b47a'],
  [3000, '#a58770'],
  [4900, '#877d73'],
  [6500, '#c7c4bb'],
  [8200, '#f7f5e9'],
].map(([altitude, shade]) => [altitude, new THREE.Color(shade)]);

const CONTOUR_RATIO = 195;
const WORLD_ALTITUDE_RATIO = 3000;
const coastCanvases = new Map();

function coordinateVector(lat, lon, magnitude = 1) {
  const { x, y, z } = geographicDirection(lat, lon, magnitude);
  return new THREE.Vector3(x, y, z);
}

function colorAt(altitude, stops) {
  const index = stops.findIndex(([limit]) => altitude < limit);
  if (index < 0) return stops.at(-1)[1].clone();
  if (index === 0) return stops[0][1].clone();
  const [low, lowColor] = stops[index - 1];
  const [high, highColor] = stops[index];
  return lowColor.clone().lerp(highColor, (altitude - low) / (high - low));
}

function makeCoastTexture(showGrid) {
  if (!coastCanvases.has(showGrid)) coastCanvases.set(showGrid, paintCoast(showGrid));
  const texture = new THREE.CanvasTexture(coastCanvases.get(showGrid));
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function paintCoast(showGrid) {
  const image = document.createElement('canvas');
  image.width = 1024;
  image.height = 512;
  const ctx = image.getContext('2d');
  const tileX = (lon) => (lon + 180) * image.width / 360;
  const tileY = (lat) => (90 - lat) * image.height / 180;

  const ocean = ctx.createLinearGradient(0, 0, 0, 512);
  ocean.addColorStop(0, '#73d1df');
  ocean.addColorStop(0.45, '#4098c1');
  ocean.addColorStop(0.72, '#2a89b2');
  ocean.addColorStop(1, '#66c3d4');
  ctx.fillStyle = ocean;
  ctx.fillRect(0, 0, image.width, image.height);

  const land = ctx.createLinearGradient(0, 0, 0, 512);
  land.addColorStop(0, '#c0d2bc');
  land.addColorStop(0.16, '#b6c99a');
  land.addColorStop(0.31, '#a9b06e');
  land.addColorStop(0.46, '#7eb07a');
  land.addColorStop(0.64, '#8eb780');
  land.addColorStop(0.82, '#b4c7a1');
  land.addColorStop(1, '#e0eee0');
  ctx.fillStyle = land;
  ctx.strokeStyle = '#d1e8c3';
  ctx.lineWidth = 0.75;

  for (const ring of COAST_RINGS) {
    ctx.beginPath();
    ctx.moveTo(tileX(ring[0]), tileY(ring[1]));
    for (let i = 2; i < ring.length; i += 2) ctx.lineTo(tileX(ring[i]), tileY(ring[i + 1]));
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  if (showGrid) {
    const gridLine = (x1, y1, x2, y2, reference) => {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.strokeStyle = '#264755b8';
      ctx.lineWidth = reference ? 4.6 : 1.5;
      ctx.stroke();
      if (reference) {
        ctx.strokeStyle = '#fff1b8';
        ctx.lineWidth = 2.65;
        ctx.stroke();
      }
    };
    for (let lat = -75; lat <= 75; lat += 15) {
      gridLine(0, tileY(lat), image.width, tileY(lat), lat === 0);
    }
    for (let lon = -180; lon < 180; lon += 15) {
      gridLine(tileX(lon), 0, tileX(lon), image.height, lon === 0);
    }
  }
  return image;
}

function makeLine(points, color, opacity = 1) {
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({ color, opacity, transparent: opacity < 1 });
  return new THREE.Line(geometry, material);
}

function makeGlobeCameraView(camera, controls, lat, lon, extraYaw) {
  const distance = camera.position.distanceTo(controls.target);
  const limitedLatitude = THREE.MathUtils.clamp(lat + 8, -74, 74);
  camera.position.copy(coordinateVector(limitedLatitude, lon + extraYaw, distance));
  controls.update();
}

function makeGlobeSites() {
  const sites = new THREE.Group();
  for (const [index, site] of Object.values(TERRAIN_SITES).entries()) {
    const marker = endpoint(String(index + 1), 0, 0, 0);
    marker.material.depthTest = true;
    marker.scale.set(0.16, 0.16, 1);
    marker.position.copy(coordinateVector(site.lat, site.lon, 1.032));
    sites.add(marker);
  }
  return sites;
}

function makeGlobeFlow(flow, season) {
  const layer = new THREE.Group();
  for (const path of getFlowPaths(flow, season)) {
    const waypoints = path.points.map(([lat, lon]) => coordinateVector(lat, lon, 1.021));
    const route = new THREE.CatmullRomCurve3(waypoints);
    const raised = route.getPoints(36).map((point) => point.normalize().multiplyScalar(1.022));
    const raisedRoute = new THREE.CatmullRomCurve3(raised);
    const shade = FLOW_COLORS[path.kind];
    const material = new THREE.MeshBasicMaterial({ color: shade, toneMapped: false });
    const border = new THREE.MeshBasicMaterial({ color: '#1d3e49', toneMapped: false });
    const stroke = new THREE.TubeGeometry(raisedRoute, 42, 0.008, 5, false);
    const outline = new THREE.TubeGeometry(raisedRoute, 42, 0.012, 5, false);
    const backdrop = new THREE.Mesh(outline, border);
    backdrop.scale.multiplyScalar(0.994);
    layer.add(backdrop, new THREE.Mesh(stroke, material));

    for (const progress of [0.51, 0.87]) {
      const head = new THREE.Mesh(new THREE.ConeGeometry(0.028, 0.072, 8), material);
      head.position.copy(raisedRoute.getPointAt(progress)).multiplyScalar(1.018);
      head.quaternion.setFromUnitVectors(ARROW_UP, raisedRoute.getTangentAt(progress).normalize());
      layer.add(head);
    }
  }
  return layer;
}

function installGlobe(scene, camera, controls, canvas, schedule) {
  const globe = new THREE.Mesh(
    new THREE.SphereGeometry(1, 78, 48),
    new THREE.MeshPhongMaterial({ shininess: 13, specular: '#1e3d51' }),
  );
  scene.add(globe);

  const polarAxis = makeLine(
    [new THREE.Vector3(0, -1.18, 0), new THREE.Vector3(0, 1.18, 0)],
    '#9cdedc',
    0.9,
  );
  const equatorRing = makeLine(
    Array.from({ length: 97 }, (_, i) => coordinateVector(0, -180 + (i * 360) / 96, 1.008)),
    '#ffeb8c',
    0.9,
  );
  scene.add(polarAxis, equatorRing);

  const marker = new THREE.Group();
  const point = new THREE.Mesh(
    new THREE.SphereGeometry(0.027, 16, 10),
    new THREE.MeshBasicMaterial({ color: '#ffda78' }),
  );
  const halo = new THREE.Mesh(
    new THREE.RingGeometry(0.042, 0.059, 24),
    new THREE.MeshBasicMaterial({ color: '#fff4b9', side: THREE.DoubleSide, opacity: 0.92, transparent: true }),
  );
  marker.add(point, halo);
  const pairedMarker = marker.clone();
  scene.add(marker, pairedMarker);
  const fill = new THREE.HemisphereLight('#effbff', '#c6e5db', 1.85);
  const sun = new THREE.DirectionalLight('#ffedc6', 0.75);
  const sunSpot = new THREE.Mesh(
    new THREE.SphereGeometry(0.043, 18, 12),
    new THREE.MeshBasicMaterial({ color: '#ffc463' }),
  );
  scene.add(fill, sun, sunSpot);
  const raycaster = new THREE.Raycaster();
  let activeConfig = {};
  let pointerDown;
  let previousAim;
  let previousFlow;
  let flowLayer;
  let siteMarkers;
  let dayTexture;
  let gridTexture;
  let relief;
  let requestedRelief = false;
  let active = true;

  function enableRelief() {
    if (requestedRelief) return;
    requestedRelief = true;
    loadReliefImage().then((image) => {
      if (!active || !image) return;
      relief = new THREE.Texture(image);
      relief.colorSpace = THREE.SRGBColorSpace;
      relief.anisotropy = 4;
      relief.needsUpdate = true;
      if (activeConfig.mode === 'terrain') {
        globe.material.map = relief;
        schedule();
      }
    });
  }

  function onPointerDown(event) {
    if (event.button !== 0) return;
    pointerDown = { x: event.clientX, y: event.clientY, id: event.pointerId };
  }

  function onPointerUp(event) {
    if (!pointerDown || pointerDown.id !== event.pointerId) return;
    const { x, y } = pointerDown;
    pointerDown = null;
    const mode = activeConfig.mode ?? 'coordinates';
    if (mode !== 'coordinates' && mode !== 'daylight' && mode !== 'terrain') return;
    if (Math.hypot(x - event.clientX, y - event.clientY) > 7) return;
    const rect = canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(2 * (event.clientX - rect.left) / rect.width - 1, 1 - 2 * (event.clientY - rect.top) / rect.height);
    raycaster.setFromCamera(ndc, camera);
    const hit = raycaster.intersectObject(globe)[0];
    if (!hit) return;
    const point = hit.point.clone().normalize();
    if (mode === 'terrain') {
      let selected;
      let minimumDistance = Math.cos(13 * TO_RADIANS);
      for (const [id, site] of Object.entries(TERRAIN_SITES)) {
        const distance = coordinateVector(site.lat, site.lon).dot(point);
        if (distance > minimumDistance) {
          minimumDistance = distance;
          selected = { id, ...site };
        }
      }
      if (selected) activeConfig.onTerrainPick?.(selected);
      return;
    }
    const latitude = Math.asin(point.y) / TO_RADIANS;
    const longitude = Math.atan2(-point.z, point.x) / TO_RADIANS;
    activeConfig.onCoordinatePick?.({ lat: Math.round(latitude), lon: Math.round(longitude) });
  }

  function onPointerCancel() {
    pointerDown = null;
  }

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerCancel);

  return {
    update(config) {
      activeConfig = config;
      const { lat = 40, lon = 116, hour = 6, month = 6, viewYaw = 0, mode } = config;
      const daylight = mode === 'daylight';
      const terrain = mode === 'terrain';
      const aimLat = daylight && config.dayPair ? 0 : lat;
      const aim = [mode, aimLat, lon, viewYaw].join(':');
      if (aim !== previousAim) {
        makeGlobeCameraView(camera, controls, aimLat, lon, viewYaw);
        previousAim = aim;
      }
      const direction = coordinateVector(lat, lon);
      marker.position.copy(direction).multiplyScalar(1.029);
      marker.quaternion.setFromUnitVectors(SURFACE_NORMAL, direction);
      pairedMarker.visible = daylight && config.dayPair && lat !== 0;
      if (pairedMarker.visible) {
        const opposite = coordinateVector(-lat, lon);
        pairedMarker.position.copy(opposite).multiplyScalar(1.029);
        pairedMarker.quaternion.setFromUnitVectors(SURFACE_NORMAL, opposite);
      }

      const circulation = mode === 'circulation';
      const coordinates = !mode || mode === 'coordinates';
      if (terrain) {
        enableRelief();
        if (!siteMarkers) {
          siteMarkers = makeGlobeSites();
          scene.add(siteMarkers);
        }
      }
      globe.material.map = coordinates ? (gridTexture ??= makeCoastTexture(true))
        : terrain && relief ? relief : (dayTexture ??= makeCoastTexture(false));
      fill.intensity = daylight ? 0.26 : terrain ? 1.65 : 2.04;
      sun.intensity = daylight ? 2.98 : terrain ? 0.53 : 0.62;
      const localSun = daylight ? sunlightAt(lat, lon, hour, month).direction : coordinateVector(48, lon - 35);
      sun.position.copy(localSun).multiplyScalar(4);
      sunSpot.position.copy(localSun).multiplyScalar(1.031);
      sunSpot.visible = daylight;
      marker.visible = daylight || coordinates;
      if (siteMarkers) siteMarkers.visible = terrain;
      if (terrain) {
        Object.keys(TERRAIN_SITES).forEach((id, index) => {
          const size = id === config.terrainFocus ? 0.235 : 0.15;
          siteMarkers.children[index].scale.set(size, size, 1);
        });
      }
      equatorRing.visible = daylight || coordinates;
      polarAxis.visible = daylight || coordinates;
      if (circulation) {
        const flow = config.flow ?? 'currents';
        const season = config.season ?? 'summer';
        const key = flow + ':' + (flow === 'monsoon' ? season : 'all');
        if (key !== previousFlow) {
          if (flowLayer) {
            scene.remove(flowLayer);
            disposeObject(flowLayer);
          }
          flowLayer = makeGlobeFlow(flow, season);
          scene.add(flowLayer);
          previousFlow = key;
        }
      }
      if (flowLayer) flowLayer.visible = circulation;
      schedule();
    },
    dispose() {
      active = false;
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerCancel);
      dayTexture?.dispose();
      gridTexture?.dispose();
      relief?.dispose();
    },
  };
}

const CONTOUR_SHADES = [
  [100, '#548f76'],
  [180, '#8fb289'],
  [280, '#bdc194'],
  [385, '#c6ab7c'],
  [480, '#a68566'],
  [535, '#9c795f'],
].map(([elevation, shade]) => [elevation, new THREE.Color(shade)]);

function heightField(width, depth, columns, rows, heightAt, ratio, stops) {
  const geometry = new THREE.PlaneGeometry(width, depth, columns, rows);
  geometry.rotateX(-Math.PI / 2);
  const positions = geometry.getAttribute('position');
  const colors = new Float32Array(positions.count * 3);
  for (let index = 0; index < positions.count; index++) {
    const elevation = heightAt(positions.getX(index), positions.getZ(index));
    positions.setY(index, elevation / ratio);
    const shade = colorAt(elevation, stops);
    colors.set([shade.r, shade.g, shade.b], index * 3);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.93, side: THREE.DoubleSide }));
}

function makeContours(altitudeAt, width, depth, nx, nz, levels, ratio, color) {
  const sideX = width / nx;
  const sideZ = depth / nz;
  const xAt = (i) => sideX * i - width / 2;
  const zAt = (j) => sideZ * j - depth / 2;
  const heights = Array.from({ length: nz + 1 }, (_, j) => (
    Array.from({ length: nx + 1 }, (_, i) => altitudeAt(xAt(i), zAt(j)))
  ));
  const linePositions = [];
  for (const level of levels) {
    for (let j = 0; j < nz; j++) {
      for (let i = 0; i < nx; i++) {
        const topLeft = heights[j][i];
        const topRight = heights[j][i + 1];
        const bottomRight = heights[j + 1][i + 1];
        const bottomLeft = heights[j + 1][i];
        if (level <= Math.min(topLeft, topRight, bottomRight, bottomLeft) ||
            level > Math.max(topLeft, topRight, bottomRight, bottomLeft)) continue;
        const corners = [
          [xAt(i), zAt(j), topLeft],
          [xAt(i + 1), zAt(j), topRight],
          [xAt(i + 1), zAt(j + 1), bottomRight],
          [xAt(i), zAt(j + 1), bottomLeft],
        ];
        const crossings = [];
        for (let edge = 0; edge < 4; edge++) {
          const [x1, z1, h1] = corners[edge];
          const [x2, z2, h2] = corners[(edge + 1) % 4];
          if ((h1 >= level) === (h2 >= level)) continue;
          const ratio = (level - h1) / (h2 - h1);
          crossings.push(x1 + ratio * (x2 - x1), z1 + ratio * (z2 - z1));
        }
        for (let crossing = 0; crossing < crossings.length; crossing += 2) {
          linePositions.push(crossings[crossing], level / ratio + 0.022, crossings[crossing + 1]);
        }
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3));
  return new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.64 }));
}

function addLandscapeLights(scene) {
  scene.add(new THREE.HemisphereLight('#f0faff', '#a7c4a1', 2.15));
  const sun = new THREE.DirectionalLight('#fff1cd', 2.18);
  sun.position.set(-4.4, 8, 5);
  scene.add(sun);
}

function makeGround(width, depth) {
  const slab = new THREE.Mesh(
    new THREE.BoxGeometry(width, 0.19, depth),
    new THREE.MeshStandardMaterial({ color: '#174e54', roughness: 0.92 }),
  );
  slab.position.y = -0.09;
  return slab;
}

function makeSkirt(width, depth, altitudeAt, ratio, tint) {
  const y = 0;
  const polygons = [];
  const edges = [
    [[-width / 2, -depth / 2], [width / 2, -depth / 2]],
    [[width / 2, -depth / 2], [width / 2, depth / 2]],
    [[width / 2, depth / 2], [-width / 2, depth / 2]],
    [[-width / 2, depth / 2], [-width / 2, -depth / 2]],
  ];
  for (const [[x0, z0], [x1, z1]] of edges) {
    for (let step = 0; step < 60; step++) {
      const x = THREE.MathUtils.lerp(x0, x1, step / 60);
      const z = THREE.MathUtils.lerp(z0, z1, step / 60);
      const nextX = THREE.MathUtils.lerp(x0, x1, (step + 1) / 60);
      const nextZ = THREE.MathUtils.lerp(z0, z1, (step + 1) / 60);
      const top = altitudeAt(x, z) / ratio;
      const nextTop = altitudeAt(nextX, nextZ) / ratio;
      polygons.push(x, y, z, x, top, z, nextX, nextTop, nextZ, x, y, z, nextX, nextTop, nextZ, nextX, y, nextZ);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(polygons, 3));
  geometry.computeVertexNormals();
  return new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: tint, side: THREE.DoubleSide, roughness: 0.96 }));
}

function endpoint(character, x, y, z) {
  const labelCanvas = document.createElement('canvas');
  labelCanvas.width = labelCanvas.height = 80;
  const ctx = labelCanvas.getContext('2d');
  ctx.beginPath();
  ctx.arc(40, 40, 36, 0, Math.PI * 2);
  ctx.fillStyle = '#23464c';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#ffecc3';
  ctx.stroke();
  ctx.fillStyle = '#fff8df';
  ctx.font = '600 39px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(character, 40, 42);
  const texture = new THREE.CanvasTexture(labelCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false }));
  sprite.position.set(x, y, z);
  sprite.scale.set(0.62, 0.62, 1);
  return sprite;
}

function makeSectionTrace(section) {
  const trace = new THREE.Group();
  const z = SECTION_POSITIONS[section];
  const points = contourProfile(section, 97).map(({ distance, elevation }) => new THREE.Vector3(
    distance - SECTION_HALF_LENGTH,
    elevation / CONTOUR_RATIO + 0.037,
    z,
  ));
  const guide = new THREE.CatmullRomCurve3(points, false, 'centripetal');
  const line = new THREE.Mesh(
    new THREE.TubeGeometry(guide, 96, 0.035, 5, false),
    new THREE.MeshBasicMaterial({ color: '#fff3bb' }),
  );
  trace.add(line);
  const [start, end] = [points[0], points.at(-1)];
  for (const [character, point] of [[section[0], start], [section[1], end]]) {
    trace.add(endpoint(character.toUpperCase(), point.x, point.y + 0.45, point.z));
  }
  const positions = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    positions.push(a.x, 0, a.z, a.x, a.y, a.z, b.x, b.y, b.z, a.x, 0, a.z, b.x, b.y, b.z, b.x, 0, b.z);
  }
  const curtainGeometry = new THREE.BufferGeometry();
  curtainGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  trace.add(new THREE.Mesh(
    curtainGeometry,
    new THREE.MeshBasicMaterial({ color: '#ffd47b', transparent: true, opacity: 0.19, side: THREE.DoubleSide, depthWrite: false }),
  ));
  return trace;
}

function installContour(scene) {
  const width = 10;
  const depth = 7;
  scene.add(
    heightField(width, depth, 60, 42, contourAltitude, CONTOUR_RATIO, CONTOUR_SHADES),
    makeSkirt(width, depth, contourAltitude, CONTOUR_RATIO, '#35705f'),
    makeGround(width + 0.08, depth + 0.08),
    makeContours(contourAltitude, width, depth, 60, 42, CONTOUR_LEVELS, CONTOUR_RATIO, '#42554b'),
  );
  const traces = new Map();
  const profiles = new Map();
  let currentSection;
  const walker = new THREE.Mesh(
    new THREE.SphereGeometry(0.13, 16, 10),
    new THREE.MeshBasicMaterial({ color: '#ffb347', toneMapped: false }),
  );
  scene.add(walker);
  addLandscapeLights(scene);
  return {
    update(config) {
      const section = config.section === 'cd' ? 'cd' : 'ab';
      const step = THREE.MathUtils.clamp(Math.round(config.walkStep ?? 0), 0, 12);
      if (section !== currentSection) {
        if (currentSection) traces.get(currentSection).visible = false;
        if (!traces.has(section)) {
          const trace = makeSectionTrace(section);
          traces.set(section, trace);
          scene.add(trace);
          profiles.set(section, contourProfile(section, 13));
        }
        traces.get(section).visible = true;
        currentSection = section;
      }
      const { distance, elevation } = profiles.get(section)[step];
      walker.position.set(distance - SECTION_HALF_LENGTH, elevation / CONTOUR_RATIO + 0.14, SECTION_POSITIONS[section]);
    },
  };
}

function terrainAltitude(heights, x, z) {
  const unit = THREE.MathUtils.clamp((x + 2.1) / 4.2, 0, 1);
  const i = unit * (heights.length - 1);
  const start = Math.floor(i);
  const elevation = THREE.MathUtils.lerp(heights[start], heights[Math.min(start + 1, heights.length - 1)], i - start);
  const spurs = (Math.sin(x * 8.15 - z * 1.7) + 0.6 * Math.sin(x * 15 + z * 3.6)) * 260;
  const ridge = Math.exp(-((z / (1.13 + 0.15 * Math.sin(x * 2.6))) ** 2));
  return Math.max(0, elevation * (0.48 + 0.52 * ridge) + spurs * Math.min(1, elevation / 2000) * Math.abs(z) * 0.45);
}

function altitudeRuler() {
  const ruler = new THREE.Group();
  ruler.position.set(-2.11, 0, 1.53);
  const ends = [new THREE.Vector3(), new THREE.Vector3(0, 9000 / WORLD_ALTITUDE_RATIO, 0)];
  ruler.add(makeLine(ends, '#426868'));
  for (let elevation = 0; elevation <= 9000; elevation += 3000) {
    const height = elevation / WORLD_ALTITUDE_RATIO;
    ruler.add(makeLine([new THREE.Vector3(-0.1, height, 0), new THREE.Vector3(0.16, height, 0)], '#d0a15c'));
  }
  return ruler;
}

function makeMountain(site) {
  const width = 4.2;
  const depth = 2.95;
  const altitudeAt = (x, z) => terrainAltitude(site.heights, x, z);
  const group = new THREE.Group();
  group.add(
    heightField(width, depth, 58, 36, altitudeAt, WORLD_ALTITUDE_RATIO, MOUNTAIN_COLOR),
    makeSkirt(width, depth, altitudeAt, WORLD_ALTITUDE_RATIO, '#55796a'),
    makeGround(width + 0.08, depth + 0.09),
    altitudeRuler(),
  );
  const ridgePoints = Array.from({ length: 49 }, (_, index) => {
    const x = THREE.MathUtils.lerp(-2.1, 2.1, index / 48);
    return new THREE.Vector3(x, altitudeAt(x, 0) / WORLD_ALTITUDE_RATIO + 0.025, 0);
  });
  group.add(makeLine(ridgePoints, '#ffebb4', 0.9));
  return group;
}

function installTerrain(scene) {
  addLandscapeLights(scene);
  const left = new THREE.Group();
  const right = new THREE.Group();
  left.position.x = -2.46;
  right.position.x = 2.46;
  scene.add(left, right);
  scene.add(endpoint('A', -2.46, -0.06, 1.9), endpoint('B', 2.46, -0.06, 1.9));
  let previousA;
  let previousB;
  function switchSite(side, key, fallback) {
    for (const child of [...side.children]) {
      side.remove(child);
      disposeObject(child);
    }
    side.add(makeMountain(TERRAIN_SITES[key] ?? TERRAIN_SITES[fallback]));
  }
  return {
    update(config) {
      const siteA = config.siteA ?? 'himalayas';
      const siteB = config.siteB ?? 'alps';
      if (siteA !== previousA) switchSite(left, siteA, 'himalayas');
      if (siteB !== previousB) switchSite(right, siteB, 'alps');
      previousA = siteA;
      previousB = siteB;
    },
  };
}

function disposeObject(root) {
  const textures = new Set();
  const materials = new Set();
  const geometries = new Set();
  root.traverse(({ geometry, material }) => {
    if (geometry) geometries.add(geometry);
    const materialList = Array.isArray(material) ? material : [material];
    for (const item of materialList) {
      if (!item) continue;
      materials.add(item);
      if (item.map) textures.add(item.map);
    }
  });
  textures.forEach((texture) => texture.dispose());
  materials.forEach((material) => material.dispose());
  geometries.forEach((geometry) => geometry.dispose());
}

const SCENE_SETUP = {
  globe: { radius: 1.17, direction: [1, 0.36, 0.25], focusHeight: 0 },
  contour: { radius: 5.6, direction: [0.36, 0.66, 1], focusHeight: 1.03 },
  terrain: { radius: 4.9, direction: [0.01, 0.54, 1], focusHeight: 1.34 },
};

export function mountScene(host, kind, config, { canvas, context, onFirstFrame, onRenderError }) {
  const setup = SCENE_SETUP[kind];
  if (!setup) throw new Error(`Unknown scene kind: ${kind}`);
  canvas.className = 'three-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.display = 'block';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  const renderer = new THREE.WebGLRenderer({ canvas, context });
  renderer.setClearColor(0x000000, 0);
  const pixelRatioLimit = matchMedia('(pointer: coarse)').matches ? 1.25 : 1.5;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, pixelRatioLimit));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.02;
  if (onRenderError) renderer.debug.onShaderError = () => { throw new Error('3D shader compilation failed'); };

  const scene = new THREE.Scene();
  const camera = kind === 'terrain'
    ? new THREE.OrthographicCamera(-1, 1, 1, -1, 0.035, 110)
    : new THREE.PerspectiveCamera(38, 1, 0.035, 110);
  const controls = new OrbitControls(camera, canvas);
  controls.enablePan = false;
  controls.enableDamping = false;
  controls.rotateSpeed = 0.66;
  controls.zoomSpeed = 0.72;
  controls.minZoom = 0.75;
  controls.maxZoom = 1.85;
  controls.minPolarAngle = kind === 'globe' ? 0.2 : 0.18;
  controls.maxPolarAngle = kind === 'globe' ? Math.PI - 0.2 : Math.PI * 0.49;
  controls.target.set(0, setup.focusHeight, 0);
  camera.position.copy(new THREE.Vector3(...setup.direction).normalize().multiplyScalar(setup.radius * 3));
  camera.position.add(controls.target);
  controls.update();

  let active = { ...config };
  let disposed = false;
  let pendingFrame = 0;
  let fitDistance = 0;
  let startingPose;
  let firstFrame = true;
  let renderWidth = 0;
  let renderHeight = 0;

  function schedule() {
    if (disposed || pendingFrame) return;
    pendingFrame = requestAnimationFrame(() => {
      pendingFrame = 0;
      if (disposed || context.isContextLost() || !host.clientWidth || !host.clientHeight) return;
      try {
        renderer.render(scene, camera);
      } catch (error) {
        if (!onRenderError) throw error;
        onRenderError(error);
        return;
      }
      if (firstFrame) {
        firstFrame = false;
        onFirstFrame?.();
      }
    });
  }

  function resize() {
    const width = host.clientWidth;
    const height = host.clientHeight;
    if (!width || !height || (width === renderWidth && height === renderHeight)) return;
    renderWidth = width;
    renderHeight = height;
    const aspect = width / height;
    renderer.setSize(width, height, false);
    if (camera.isOrthographicCamera) {
      const height = setup.radius / Math.min(aspect, 1.48);
      camera.top = height;
      camera.bottom = -height;
      camera.left = -height * aspect;
      camera.right = height * aspect;
      camera.updateProjectionMatrix();
      schedule();
      return;
    }
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    const vertical = camera.fov * TO_RADIANS / 2;
    const horizontal = Math.atan(Math.tan(vertical) * camera.aspect);
    const nextFit = setup.radius / Math.sin(Math.min(vertical, horizontal));
    const offset = camera.position.clone().sub(controls.target);
    const zoom = fitDistance ? offset.length() / fitDistance : 1;
    controls.minDistance = nextFit * 0.64;
    controls.maxDistance = nextFit * 1.85;
    camera.position.copy(offset.normalize().multiplyScalar(nextFit * zoom)).add(controls.target);
    fitDistance = nextFit;
    controls.update();
    schedule();
  }

  const sceneController = kind === 'globe'
    ? installGlobe(scene, camera, controls, canvas, schedule)
    : kind === 'contour' ? installContour(scene) : installTerrain(scene);

  function onContextLost(event) {
    event.preventDefault();
    active.onContextLost?.(event);
  }

  function onContextRestored() {
    schedule();
  }

  function update(delta) {
    if (disposed) return;
    active = { ...active, ...delta };
    controls.enabled = active.interactive ?? true;
    canvas.style.touchAction = controls.enabled ? 'none' : 'pan-y';
    canvas.style.cursor = controls.enabled ? 'grab' : 'default';
    sceneController.update(active);
    schedule();
  }

  function captureCamera() {
    const offset = camera.position.clone().sub(controls.target);
    const zoom = camera.isOrthographicCamera ? camera.zoom : offset.length() / (fitDistance || setup.radius * 3);
    return { direction: offset.normalize().toArray(), zoom };
  }

  function restoreCamera({ direction, zoom }) {
    const orthographic = camera.isOrthographicCamera;
    const distance = orthographic ? camera.position.distanceTo(controls.target)
      : (fitDistance || setup.radius * 3) * THREE.MathUtils.clamp(zoom, 0.64, 1.85);
    if (orthographic) {
      camera.zoom = THREE.MathUtils.clamp(zoom, controls.minZoom, controls.maxZoom);
      camera.updateProjectionMatrix();
    }
    camera.position.set(...direction).normalize().multiplyScalar(distance).add(controls.target);
    controls.update();
  }

  function beginCameraInteraction() {
    startingPose = captureCamera();
  }

  function endCameraInteraction() {
    if (!startingPose) return;
    const pose = captureCamera();
    if (Math.abs(pose.zoom - startingPose.zoom) > 0.001 ||
        pose.direction.some((value, index) => Math.abs(value - startingPose.direction[index]) > 0.001)) {
      active.onCameraChange?.(pose);
    }
    startingPose = null;
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(pendingFrame);
    observer.disconnect();
    canvas.removeEventListener('webglcontextlost', onContextLost);
    canvas.removeEventListener('webglcontextrestored', onContextRestored);
    controls.removeEventListener('change', schedule);
    controls.removeEventListener('start', beginCameraInteraction);
    controls.removeEventListener('end', endCameraInteraction);
    controls.dispose();
    sceneController.dispose?.();
    disposeObject(scene);
    renderer.dispose();
    renderer.forceContextLoss();
    canvas.remove();
  }

  controls.addEventListener('change', schedule);
  controls.addEventListener('start', beginCameraInteraction);
  controls.addEventListener('end', endCameraInteraction);
  canvas.addEventListener('webglcontextlost', onContextLost);
  canvas.addEventListener('webglcontextrestored', onContextRestored);
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  host.append(canvas);
  try {
    resize();
    update(config);
    if (config.cameraPose) restoreCamera(config.cameraPose);
  } catch (error) {
    dispose();
    throw error;
  }
  return { update, dispose, captureCamera, restoreCamera };
}
