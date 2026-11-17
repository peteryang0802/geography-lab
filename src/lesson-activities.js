const visual = kind => ({ kind });
const lab = (id, mode) => ({ kind: 'lab', id, mode });
const chart = id => ({ kind: 'chart', id });

export const lessonActivities = {
  intro: [visual('opening')],
  'earth-space': [visual('opening')],
  spaceflight: [visual('opening')],
  'earth-model': [lab('globe', 'coordinates')],
  'earth-motion': [lab('globe', 'daylight')],
  'project-earth': [visual('evidence')],
  maps: [visual('legend'), { kind: 'direction', title: '换张地图，方向还一样吗？' }],
  contours: [visual('rain'), { ...lab('contour'), title: '沿另一条山路看看高低' }],
  'project-orienteering': [visual('evidence')],
  'land-ocean': [visual('world'), { ...lab('globe', 'terrain'), title: '从地球仪上找山脉' }],
  'land-change': [visual('evidence')],
  'project-seafloor': [visual('evidence')],
  weather: [chart('weather')],
  'temp-rain': [chart('climate')],
  climate: [chart('climate')],
  'climate-life': [visual('evidence')],
  'project-nest': [visual('evidence')],
  people: [chart('population')],
  cooperation: [visual('evidence')],
  'project-made-in-china': [visual('evidence')],
};

export const activityKey = (lessonId, activity) => [lessonId, activity.kind, activity.id].filter(Boolean).join('-');
export const activityIds = Object.entries(lessonActivities).flatMap(([lessonId, list]) =>
  list.map(activity => activityKey(lessonId, activity)));

const visualLoaders = {
  opening: async () => (await import('./lesson-visuals.js')).mountOpeningVisual,
  evidence: async () => (await import('./evidence-activities.js')).mountEvidenceActivity,
  legend: async () => {
    const { mountLegendInquiry } = await import('./inquiry-visuals.js');
    return (host, _, saved, onChange) => mountLegendInquiry(host, saved, onChange);
  },
  rain: async () => {
    const { mountRainInquiry } = await import('./inquiry-visuals.js');
    return (host, _, saved, onChange, view) => mountRainInquiry(host, saved, onChange, { view: ({ recall: 'a', nearby: 'b', fieldwork: 'c' })[view] });
  },
  world: async () => (await import('./world-inquiry.js')).mountWorldInquiry,
  direction: async () => {
    const { mountMapDirection } = await import('./map-direction.js?v=2');
    return (host, _, saved, onChange) => mountMapDirection(host, saved, onChange);
  },
  chart: async () => (await import('./widgets.js?v=2')).mountWidget,
};

export async function mountLessonVisual(host, activity, lessonId, saved, onChange, view, isActive) {
  const mount = await visualLoaders[activity.kind]();
  if (isActive()) return mount(host, activity.id ?? lessonId, saved, onChange, view);
}
