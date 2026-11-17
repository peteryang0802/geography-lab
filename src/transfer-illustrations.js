const sceneWidth = 540;
const sceneHeight = 200;

const paper = '#f9f8ef';
const ink = '#243e38';
const muted = '#526b61';
const water = '#a9dbe8';
const blue = '#27627e';
const green = '#567d53';
const leaf = '#93ad76';
const sand = '#e0c59a';
const bark = '#74543b';
const warm = '#af482e';
const gold = '#e5af4f';

function box(ctx, x, y, width, height, fill) {
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, width, height);
}

function path(ctx, points, color, width = 3, fill) {
  ctx.beginPath();
  points.forEach(([x, y], index) => {
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  if (fill) {
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
  }
}

function circle(ctx, x, y, radius, fill, outline) {
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  if (outline) {
    ctx.strokeStyle = outline;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

function text(ctx, label, x, y, color = ink, size = 23) {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.font = `700 ${size}px system-ui, sans-serif`;
  ctx.fillText(label, x, y);
}

function arrow(ctx, start, end, color = blue, width = 4) {
  const [x, y] = end;
  const angle = Math.atan2(y - start[1], x - start[0]);
  path(ctx, [start, end], color, width);
  path(ctx, [
    [x - 13 * Math.cos(angle - 0.5), y - 13 * Math.sin(angle - 0.5)],
    end,
    [x - 13 * Math.cos(angle + 0.5), y - 13 * Math.sin(angle + 0.5)],
  ], color, width);
}

function dashed(ctx, points, color, width = 2) {
  ctx.setLineDash([7, 6]);
  path(ctx, points, color, width);
  ctx.setLineDash([]);
}

function split(ctx) {
  path(ctx, [[270, 24], [270, 176]], '#c9d5ca', 2);
}

function rain(ctx, x, y, drops = 4) {
  for (let index = 0; index < drops; index++) {
    const offset = index * 18;
    path(ctx, [[x + offset, y], [x + offset - 6, y + 12]], blue, 3);
  }
}

function sun(ctx, x, y, radius = 20) {
  circle(ctx, x, y, radius, gold, '#a06c29');
  for (let spoke = 0; spoke < 8; spoke++) {
    const angle = spoke * Math.PI / 4;
    const point = distance => [x + Math.cos(angle) * distance, y + Math.sin(angle) * distance];
    path(ctx, [point(radius + 5), point(radius + 12)], '#a06c29', 2);
  }
}

function cloud(ctx, x, y) {
  circle(ctx, x - 23, y, 16, '#6b8191');
  circle(ctx, x + 22, y, 16, '#6b8191');
  circle(ctx, x, y - 13, 22, '#6b8191');
  box(ctx, x - 23, y, 45, 15, '#6b8191');
}

function tree(ctx, x, y) {
  box(ctx, x - 6, y - 55, 12, 56, bark);
  circle(ctx, x - 18, y - 61, 23, leaf);
  circle(ctx, x + 17, y - 60, 23, green);
  circle(ctx, x, y - 78, 23, green);
}

function ship(ctx, x, y) {
  path(ctx, [[x - 26, y - 9], [x + 26, y - 9], [x + 15, y + 5], [x - 15, y + 5]], blue, 2, '#fffdf6');
  box(ctx, x - 9, y - 21, 18, 12, '#fffdf6');
  path(ctx, [[x + 2, y - 22], [x + 2, y - 32]], blue);
}

function submarine(ctx, x, y) {
  ctx.beginPath();
  ctx.ellipse(x, y, 32, 13, 0, 0, 2 * Math.PI);
  ctx.fillStyle = '#f5c46f';
  ctx.fill();
  ctx.strokeStyle = '#694c28';
  ctx.lineWidth = 2;
  ctx.stroke();
  path(ctx, [[x + 5, y - 13], [x + 5, y - 23], [x + 14, y - 23]], '#694c28');
  for (const offset of [-13, 5, 19]) circle(ctx, x + offset, y, 3, blue);
}

function thermometer(ctx, x, y, level) {
  box(ctx, x - 5, y - 68, 10, 68, '#ece9e0');
  path(ctx, [[x, y - 68], [x, y]], '#71827c', 3);
  path(ctx, [[x, y - level], [x, y]], warm, 5);
  circle(ctx, x, y, 10, warm);
  for (const offset of [14, 30, 46, 62]) path(ctx, [[x + 8, y - offset], [x + 15, y - offset]], '#71827c', 2);
}

function rock(ctx, x, y, fill) {
  path(ctx, [[x - 24, y + 17], [x - 31, y - 3], [x - 14, y - 24], [x + 14, y - 20], [x + 29, y + 1], [x + 22, y + 17]], '#5b5a51', 2, fill);
  path(ctx, [[x - 22, y + 2], [x - 7, y - 8], [x + 15, y - 1]], '#797267', 3);
}

function wetRoad(ctx, compared) {
  split(ctx);
  for (const x of [135, 405]) {
    const clogged = x > 270;
    box(ctx, x - 115, 87, 230, 74, '#b5bdb6');
    path(ctx, [[x - 115, 112], [x + 115, 112]], '#657770', 3);
    box(ctx, x + 55, 93, 38, 24, '#415951');
    for (const offset of [61, 69, 77, 85]) box(ctx, x + offset, 96, 3, 17, '#f1f0e7');
    if (clogged) {
      for (const [dx, dy] of [[60, 106], [73, 100], [84, 112], [88, 101]]) {
        path(ctx, [[x + dx - 6, dy + 4], [x + dx, dy - 6], [x + dx + 6, dy + 2]], '#7b502a', 2, gold);
      }
    }
    rain(ctx, x - 79, 54, 6);
    if (!compared || clogged) {
      path(ctx, [[x - 85, 140], [x - 57, 125], [x + 42, 123], [x + 63, 138], [x + 18, 150], [x - 64, 151]], blue, 2, water);
    } else {
      arrow(ctx, [x - 68, 141], [x + 48, 141]);
      arrow(ctx, [x + 48, 138], [x + 72, 116]);
    }
  }
}

function spaceAddress(ctx, compared) {
  const places = compared ? ['galaxy', 'solar', 'earth'] : ['earth', 'galaxy', 'solar'];
  places.forEach((place, index) => {
    const x = 90 + index * 180;
    circle(ctx, x, 100, 56, '#233d54');
    if (place === 'earth') {
      circle(ctx, x, 100, 38, '#72acc9');
      path(ctx, [[x - 35, 89], [x - 17, 72], [x + 10, 82], [x + 4, 96], [x - 8, 101], [x - 10, 113], [x - 25, 108]], null, 1, '#94b18b');
      path(ctx, [[x + 10, 120], [x + 28, 115], [x + 30, 124], [x + 15, 136]], null, 1, '#94b18b');
    } else if (place === 'solar') {
      const angles = [0, 2.2, 5.3];
      [44, 29, 14].forEach((orbit, i) => {
        circle(ctx, x, 100, orbit, '#233d54', '#90a5ac');
        circle(ctx, x + Math.cos(angles[i]) * orbit, 100 + Math.sin(angles[i]) * orbit, 5, [water, gold, sand][i]);
      });
      circle(ctx, x, 100, 8, gold);
    } else {
      for (let dot = 0; dot < 28; dot++) {
        const angle = dot * 0.38;
        const radius = 7 + dot * 1.52;
        for (const direction of [1, -1]) {
          circle(ctx, x + direction * Math.cos(angle) * radius, 100 + direction * Math.sin(angle) * radius * 0.65, dot % 3 === 0 ? 2.8 : 1.8, '#f8e3a1');
        }
      }
      circle(ctx, x, 100, 7, '#f8e3a1');
    }
    if (compared && index < places.length - 1) arrow(ctx, [x + 65, 100], [x + 115, 100]);
  });
}

function sample(ctx, compared) {
  split(ctx);
  box(ctx, 26, 42, 218, 121, '#d8d7cd');
  circle(ctx, 82, 115, 28, '#b9b7a9');
  circle(ctx, 180, 79, 18, '#b9b7a9');
  rock(ctx, 93, 110, '#a6a296');
  rock(ctx, 176, 113, '#a6a296');
  if (!compared) {
    text(ctx, '？', 405, 94, muted, 62);
    return;
  }
  rock(ctx, 327, 142, '#a6a296');
  rock(ctx, 469, 142, '#a6a296');
  box(ctx, 318, 44, 162, 61, '#dfebe6');
  path(ctx, [[327, 93], [345, 91], [351, 64], [359, 90], [376, 88], [385, 57], [394, 87], [423, 85], [433, 64], [440, 92], [470, 92]], blue, 3);
}

function coordinates(ctx, compared) {
  box(ctx, 27, 34, 486, 132, '#d5eaf0');
  for (const y of [50, 100, 150]) path(ctx, [[27, y], [513, y]], y === 100 ? blue : '#95b5ba');
  for (const x of [104, 187, 270, 353, 436]) {
    if (compared && [187, 353].includes(x)) {
      path(ctx, [[x, 34], [x, 165]], warm, 4);
    } else {
      dashed(ctx, [[x, 34], [x, 165]], '#668d99');
    }
  }
  ship(ctx, 187, 100);
  ship(ctx, 353, 100);
  text(ctx, '0°', 52, 121, blue, 21);
  if (compared) {
    text(ctx, '60°E', 187, 148, warm, 23);
    text(ctx, '80°E', 353, 148, warm, 23);
  }
}

function daylight(ctx, compared) {
  split(ctx);
  for (const x of [135, 405]) {
    const summer = x > 270;
    box(ctx, x - 111, 28, 222, 132, '#d9e9ed');
    box(ctx, x - 111, 135, 222, 25, '#9ab38a');
    path(ctx, [[x - 111, 135], [x + 111, 135]], green, 2);
    sun(ctx, x + 30, compared && summer ? 67 : 128, 23);
    if (compared && summer) {
      dashed(ctx, [[x + 39, 76], [x + 87, 130]], warm, 3);
      circle(ctx, x + 87, 134, 7, warm);
    }
    text(ctx, summer && !compared ? '19:30' : '17:00', x, 176);
  }
}

function iceEvidence(ctx, compared) {
  split(ctx);
  for (const x of [135, 405]) {
    box(ctx, x - 113, 128, 226, 30, '#b98a65');
    path(ctx, [[x - 114, 129], [x - 68, 113], [x - 22, 120], [x + 12, 105], [x + 74, 120], [x + 114, 128]], bark, 3, sand);
    if (x < 270) {
      path(ctx, [[x - 41, 116], [x - 32, 80], [x - 16, 94], [x + 5, 62], [x + 17, 90], [x + 39, 83], [x + 46, 117]], blue, 3, water);
      if (compared) path(ctx, [[x + 46, 78], [x + 58, 92], [x + 88, 57]], green, 5);
    } else {
      if (compared) {
        circle(ctx, x, 76, 26, '#f6f8ed', blue);
        path(ctx, [[x + 18, 94], [x + 39, 115]], blue, 5);
        text(ctx, '？', x, 76, muted, 30);
      } else {
        text(ctx, '？', x, 76, muted, 55);
      }
    }
  }
}

function distanceScale(ctx, compared) {
  const marks = [55, 198, 342, 485];
  const y = 93;
  path(ctx, [[marks[0], y], [marks[3], y]], muted, 6);
  marks.forEach((x, index) => {
    path(ctx, [[x, y - 14], [x, y + 14]], muted);
    text(ctx, index === 0 ? '0' : String(index), x, y - 27);
  });
  text(ctx, '厘米', 270, y + 27, muted, 21);
  if (compared) {
    for (const x of [126, 270, 414]) text(ctx, '20 米', x, 152, blue);
    marks.forEach(x => circle(ctx, x, y, 5, blue));
    arrow(ctx, [57, 176], [480, 176]);
  }
}

function slopes(ctx, compared) {
  split(ctx);
  for (const x of [135, 405]) {
    const rise = x > 270 ? 86 : 29;
    const x1 = x - 92;
    const x2 = x + 81;
    const y = 143;
    path(ctx, [[x1, y], [x2, y - rise], [x2, y]], '#58755b', 3, '#dee9d1');
    path(ctx, [[x1, y], [x2, y - rise]], green, 5);
    if (!compared) continue;
    dashed(ctx, [[x1, y], [x2, y]], blue);
    arrow(ctx, [x2 + 13, y], [x2 + 13, y - rise], warm, 3);
    text(ctx, '80 米', x - 3, 166, blue, 21);
  }
}

function bridgeRoute(ctx, compared) {
  box(ctx, 231, 13, 78, 173, '#b9e2eb');
  path(ctx, [[231, 17], [231, 185]], blue, 2);
  path(ctx, [[309, 17], [309, 185]], blue, 2);
  for (const y of [49, 135]) {
    box(ctx, 200, y - 8, 140, 16, sand);
    path(ctx, [[200, y - 8], [340, y - 8]], bark, 2);
    path(ctx, [[200, y + 8], [340, y + 8]], bark, 2);
  }
  path(ctx, [[256, 120], [284, 150]], warm, 5);
  path(ctx, [[256, 150], [284, 120]], warm, 5);
  text(ctx, '北桥开放', 269, 25, ink, 21);
  text(ctx, '近桥封闭', 270, 171, warm, 21);
  if (compared) {
    const corners = [[101, 137], [169, 137], [169, 49], [370, 49], [370, 137]];
    path(ctx, corners, green, 5);
    arrow(ctx, corners.at(-1), [444, 137], green, 5);
  }
  for (const [x, label] of [[75, '1'], [465, '2']]) {
    path(ctx, [[x, 150], [x, 110]], ink, 3);
    path(ctx, [[x, 107], [x + 30, 112], [x, 133]], blue, 2, water);
    text(ctx, label, x + 14, 118, ink, 17);
  }
  text(ctx, '↑ 北', 480, 35, muted);
}

function treeRoots(ctx, compared) {
  box(ctx, 22, 35, 496, 119, '#bce1e8');
  path(ctx, [[22, 35], [518, 35]], blue, 3);
  box(ctx, 22, 151, 496, 25, '#a87955');
  for (const x of [119, 267, 415]) {
    box(ctx, x - 11, 100, 22, 52, bark);
    path(ctx, [[x - 11, 101], [x + 11, 101]], '#c09768', 3);
    if (compared) {
      path(ctx, [[x, 146], [x - 24, 163], [x - 43, 168]], '#62432b', 4);
      path(ctx, [[x, 145], [x + 15, 160], [x + 42, 169]], '#62432b', 4);
    }
  }
  if (compared) box(ctx, 22, 178, 496, 3, '#755e47');
}

function diving(ctx, compared) {
  box(ctx, 22, 26, 496, 149, '#b5e0eb');
  path(ctx, [[22, 26], [518, 26]], blue, 3);
  path(ctx, [[22, 62], [77, 65], [206, 73], [286, 142], [397, 173], [473, 152], [518, 151], [518, 183], [22, 183]], '#8b6943', 3, sand);
  if (compared) {
    dashed(ctx, [[22, 95], [518, 95]], blue, 3);
    text(ctx, '300 米', 456, 111, blue, 21);
    submarine(ctx, 142, 54);
  }
  circle(ctx, 142, 72, 5, green);
  circle(ctx, 397, 171, 5, warm);
}

function forecast(ctx, compared) {
  split(ctx);
  cloud(ctx, 135, 89);
  path(ctx, [[141, 103], [124, 127], [139, 127], [129, 153], [153, 123], [137, 123]], '#805227', 2, gold);
  sun(ctx, 405, 103, 32);
  if (compared) {
    path(ctx, [[49, 124], [91, 160]], warm, 5);
    path(ctx, [[49, 160], [91, 124]], warm, 5);
    circle(ctx, 462, 136, 14, paper, blue);
    path(ctx, [[474, 149], [492, 164]], blue, 5);
  }
}

function barsAndTemperatures(ctx, compared) {
  const columns = [[157, 5, 18, 90], [385, 6, 24, 45]];
  path(ctx, [[45, 164], [493, 164]], muted, 3);
  for (const [x, month, , rainfall] of columns) {
    const bar = rainfall * 0.8;
    box(ctx, x - 37, 164 - bar, 74, bar, compared && rainfall === 90 ? blue : '#80b7ca');
    text(ctx, `${rainfall} 毫米`, x - 68, 153 - bar, blue, 21);
    text(ctx, `${month} 月`, x, 183);
  }
  path(ctx, [[157, 109], [385, 78]], warm, 4);
  for (const [x, , temperature] of columns) {
    circle(ctx, x, temperature === 18 ? 109 : 78, compared && temperature === 24 ? 10 : 7, warm);
    text(ctx, temperature + ' ℃', x + 41, (temperature === 18 ? 109 : 78) - 21, warm, 21);
  }
}

function mountainTemperatures(ctx, compared) {
  path(ctx, [[17, 163], [110, 149], [193, 156], [277, 111], [365, 33], [453, 105], [523, 140], [523, 175], [17, 175]], green, 3, '#ccdec6');
  path(ctx, [[317, 79], [365, 33], [409, 67], [378, 62], [365, 75], [346, 67]], '#9bb1a7', 2, '#fcfaf1');
  circle(ctx, 133, 153, 6, blue);
  circle(ctx, 365, 36, 6, blue);
  if (compared) {
    thermometer(ctx, 112, 129, 50);
    thermometer(ctx, 428, 102, 30);
    dashed(ctx, [[112, 138], [133, 153]], blue);
    dashed(ctx, [[428, 58], [365, 36]], blue);
  } else {
    dashed(ctx, [[82, 153], [235, 153]], blue);
    dashed(ctx, [[310, 35], [418, 35]], blue);
  }
}

function shadedStreet(ctx, compared) {
  split(ctx);
  for (const x of [135, 405]) {
    box(ctx, x - 113, 137, 226, 28, '#c3bbac');
    if (x < 270) {
      path(ctx, [[x - 99, 139], [x + 40, 125], [x + 105, 147], [x - 42, 168]], null, 1, '#7f8c81');
      tree(ctx, x - 52, 147);
    } else {
      sun(ctx, x + 65, 59, 22);
    }
    if (compared) thermometer(ctx, x + 17, 140, x < 270 ? 46 : 59);
  }
}

function nesting(ctx, compared) {
  split(ctx);
  box(ctx, 24, 126, 230, 40, water);
  box(ctx, 284, 126, 232, 40, '#c9d7a7');
  for (const x of [49, 71, 92, 127, 158, 192, 222]) {
    path(ctx, [[x, 139], [x + 5, 78 - x % 19]], green, 4);
    path(ctx, [[x + 2, 123], [x - 9, 102]], green, 3);
    circle(ctx, x + 5, 81 - x % 19, 5, bark);
  }
  if (compared) {
    path(ctx, [[116, 104], [144, 111], [163, 81], [173, 87], [190, 86], [175, 98], [175, 116], [150, 131], [120, 128]], ink, 2, '#f5d394');
    circle(ctx, 173, 92, 2.5, ink);
    arrow(ctx, [191, 88], [210, 131], blue);
  }
}

function district(ctx, compared) {
  split(ctx);
  box(ctx, 23, 95, 231, 68, '#dbe5c0');
  for (const y of [131, 143, 156]) path(ctx, [[33, y], [242, y]], green, 2);
  for (const x of [84, 164]) {
    box(ctx, x - 22, 91, 45, 31, '#dbb38a');
    path(ctx, [[x - 28, 91], [x, 67], [x + 29, 91]], bark, 2, '#a87555');
  }
  box(ctx, 287, 144, 230, 20, '#b8c0b9');
  for (const [x, y] of [[318, 51], [354, 72], [453, 62], [488, 39]]) {
    box(ctx, x - 15, y, 30, 140 - y, '#a0b9b4');
    for (let row = y + 11; row < 128; row += 15) {
      box(ctx, x - 8, row, 5, 6, '#ecf0de');
      box(ctx, x + 4, row, 5, 6, '#ecf0de');
    }
  }
  box(ctx, 375, 99, 65, 45, '#6d8f8a');
  box(ctx, 388, 112, 38, 19, '#e4ede7');
  for (const x of [391, 403, 415]) box(ctx, x, 116, 8, 6, blue);
  path(ctx, [[393, 131], [386, 143]], ink, 2);
  path(ctx, [[420, 131], [427, 143]], ink, 2);
  if (compared) {
    box(ctx, 374, 98, 67, 9, gold);
    arrow(ctx, [195, 53], [294, 53], blue);
  }
}

function floodNotice(ctx, compared) {
  path(ctx, [[22, 38], [104, 49], [176, 104], [257, 116], [328, 158], [513, 162]], water, 46);
  path(ctx, [[22, 38], [104, 49], [176, 104], [257, 116], [328, 158], [513, 162]], '#70b6cb', 2);
  path(ctx, [[39, 131], [123, 131], [123, 86], [144, 79], [144, 134]], '#799396', 3);
  box(ctx, 53, 102, 54, 28, '#bad8d9');
  arrow(ctx, [80, 120], [80, 84], warm);
  if (compared) {
    arrow(ctx, [149, 56], [375, 87], blue, 5);
    path(ctx, [[397, 135], [397, 103], [422, 88], [448, 103], [448, 135]], green, 3, '#dae7c9');
    path(ctx, [[429, 117], [439, 127], [454, 112]], green, 4);
  } else {
    text(ctx, '上游', 130, 28, ink, 21);
    text(ctx, '下游', 433, 130, ink, 21);
  }
}

function backpackTest(ctx, compared) {
  split(ctx);
  const x = 137;
  rain(ctx, 84, 42, 7);
  ctx.strokeStyle = blue;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(x, 97, 22, Math.PI, 0);
  ctx.stroke();
  path(ctx, [[x - 46, 151], [x - 43, 101], [x - 27, 87], [x + 25, 87], [x + 45, 106], [x + 47, 151]], blue, 3, '#7daeb8');
  box(ctx, x - 31, 119, 63, 22, '#b7d6d6');
  box(ctx, 363, 55, 91, 108, '#fcfcf2');
  path(ctx, [[363, 163], [363, 55], [432, 55], [453, 76], [453, 163], [363, 163]], muted, 2);
  for (const y of [86, 104, 122, 140]) path(ctx, [[377, y], [438, y]], '#a8b6aa', 2);
  if (compared) {
    path(ctx, [[188, 119], [203, 133], [234, 98]], green, 6);
    text(ctx, '？', 472, 108, muted, 38);
  }
}

const illustrations = {
  intro: wetRoad,
  'earth-space': spaceAddress,
  spaceflight: sample,
  'earth-model': coordinates,
  'earth-motion': daylight,
  'project-earth': iceEvidence,
  maps: distanceScale,
  contours: slopes,
  'project-orienteering': bridgeRoute,
  'land-change': treeRoots,
  'project-seafloor': diving,
  weather: forecast,
  'temp-rain': barsAndTemperatures,
  climate: mountainTemperatures,
  'climate-life': shadedStreet,
  'project-nest': nesting,
  people: district,
  cooperation: floodNotice,
  'project-made-in-china': backpackTest,
};

export function paintTransfer(context, lessonId, compared, width, height) {
  const illustrate = illustrations[lessonId];
  if (!context || !illustrate || width <= 0 || height <= 0) return;
  context.save();
  context.scale(width / sceneWidth, height / sceneHeight);
  context.lineJoin = 'round';
  context.lineCap = 'round';
  box(context, 0, 0, sceneWidth, sceneHeight, paper);
  illustrate(context, compared);
  context.restore();
}
