const legacyKey = 'geography-lab:learning:v1';
const versionKey = 'geography-lab:learning:v2';
const groups = ['answers', 'visits', 'labs', 'widgets', 'activities', 'notes', 'completed', 'positions', 'bookmarks'];
const viewLimit = 48;

function browserStorage(name) {
  try {
    return globalThis[name] ?? null;
  } catch {
    return null;
  }
}

function read(storage, key) {
  try {
    return JSON.parse(storage?.getItem(key) ?? 'null');
  } catch {
    return null;
  }
}

const isRecord = value => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const isTime = value => Number.isFinite(value) && value >= 0;
const isRoute = value => typeof value === 'string' && value.length < 480 && /^#\/[a-z\d/-]*(?:\?[^<>"']*)?$/i.test(value);

const viewStorageKey = namespace => 'geography-lab:views:v1' + (namespace ? ':' + namespace : '');

export function readSavedViews(namespace, storage = browserStorage('sessionStorage')) {
  const views = new Map();
  const savedViews = read(storage, viewStorageKey(namespace));
  if (Array.isArray(savedViews)) {
    for (const entry of savedViews.slice(-viewLimit)) {
      if (Array.isArray(entry) && isRoute(entry[0]) && isRecord(entry[1])) views.set(entry[0], entry[1]);
    }
  }
  return views;
}

export function createLearningStore({
  lessons,
  concepts,
  labs,
  activityIds = [],
  namespace = '',
  onStorageError = () => {},
  storage = browserStorage('localStorage'),
  session = browserStorage('sessionStorage'),
}) {
  const storagePrefix = namespace ? versionKey + ':' + namespace : versionKey;
  const resumeKey = storagePrefix + ':resume';
  const viewsKey = viewStorageKey(namespace);
  const lessonIds = new Set(lessons.map(item => item.id));
  const conceptIds = new Set(concepts.map(item => item.id));
  const labIds = new Set(labs.map(item => item.id));
  const optionCounts = new Map(lessons.flatMap(lesson => (lesson.tasks ?? []).map(task => [task.id, task.options.length])));
  const ids = {
    answers: optionCounts,
    visits: lessonIds,
    labs: new Set([...labIds, ...[...lessonIds].map(id => 'lesson-' + id)]),
    widgets: lessonIds,
    activities: new Set(activityIds),
    notes: lessonIds,
    completed: lessonIds,
    positions: lessonIds,
    bookmarks: conceptIds,
  };
  const state = Object.fromEntries(groups.filter(group => group !== 'bookmarks')
    .map(group => [group, Object.create(null)]));
  Object.assign(state, { saved: [], resume: null, lastLesson: null });
  const memoryOnly = new Set();
  const views = readSavedViews(namespace, session);

  function normalizeRecord(group, id, value) {
    if (!Object.hasOwn(ids, group) || !ids[group].has(id)) return undefined;
    if (group === 'answers') {
      if (!isRecord(value) || typeof value.solved !== 'boolean') return undefined;
      if (!Number.isInteger(value.option) || value.option < 0 || value.option >= optionCounts.get(id)) return undefined;
      return { option: value.option, solved: value.solved };
    }
    if (group === 'visits') return isTime(value) ? value : undefined;
    if (group === 'notes') return typeof value === 'string' ? value.slice(0, 2000) : undefined;
    if (group === 'completed' || group === 'bookmarks') return typeof value === 'boolean' ? value : undefined;
    return isRecord(value) ? value : undefined;
  }

  function normalizeResume(value) {
    if (!isRecord(value) || !lessonIds.has(value.lessonId)) return null;
    const lessonPath = '#/lesson/' + value.lessonId;
    const [path] = isRoute(value.route) ? value.route.split('?') : [];
    const knownLessonRoute = path === lessonPath;
    const knownLabRoute = path?.startsWith('#/lab/') && labIds.has(path.slice('#/lab/'.length));
    return {
      lessonId: value.lessonId,
      route: knownLessonRoute || knownLabRoute ? value.route : lessonPath,
      scrollY: isTime(value.scrollY) ? value.scrollY : 0,
      updatedAt: isTime(value.updatedAt) ? value.updatedAt : 0,
    };
  }

  function assignRecord(group, id, value) {
    if (group !== 'bookmarks') {
      state[group][id] = value;
    } else if (value && !state.saved.includes(id)) {
      state.saved = [...state.saved, id];
    } else if (!value && state.saved.includes(id)) {
      state.saved = state.saved.filter(item => item !== id);
    }
  }

  function assignResume(resume) {
    state.resume = resume;
    state.lastLesson = resume?.lessonId ?? null;
  }

  function persist(key, value) {
    try {
      if (!storage) throw new Error('storage unavailable');
      storage.setItem(key, JSON.stringify(value));
      memoryOnly.delete(key);
      return true;
    } catch (error) {
      memoryOnly.add(key);
      onStorageError(error);
      return false;
    }
  }

  // Separate keys keep two tabs from overwriting unrelated records.
  const recordKey = (group, id) => `${storagePrefix}:${group}:${id}`;

  function refreshRecord(group, id) {
    const key = recordKey(group, id);
    if (memoryOnly.has(key)) return;
    const value = normalizeRecord(group, id, read(storage, key));
    if (value !== undefined) assignRecord(group, id, value);
  }

  function refresh() {
    for (const group of groups) {
      for (const id of ids[group].keys()) refreshRecord(group, id);
    }
    if (!memoryOnly.has(resumeKey)) {
      const resume = normalizeResume(read(storage, resumeKey));
      if (resume) assignResume(resume);
    }
  }

  function setRecord(group, id, entry) {
    let value = normalizeRecord(group, id, entry);
    if (value === undefined) return false;
    refreshRecord(group, id);
    if (group === 'answers' && state.answers[id]?.solved) value = { ...value, solved: true };
    if (group === 'visits') value = Math.max(state.visits[id] ?? 0, value);
    assignRecord(group, id, value);
    return persist(recordKey(group, id), value);
  }

  function setResume(lessonId, context = {}) {
    const resume = normalizeResume({ ...context, lessonId, updatedAt: Date.now() });
    if (!resume) return false;
    assignResume(resume);
    persist(resumeKey, resume);
    return true;
  }

  function saveView(route, context) {
    if (!isRoute(route) || !isRecord(context)) return;
    const current = { ...views.get(route), ...context };
    views.delete(route);
    views.set(route, current);
    if (views.size > viewLimit) views.delete(views.keys().next().value);
    try {
      session?.setItem(viewsKey, JSON.stringify([...views]));
    } catch {
      // The current tab still retains its return positions in memory.
    }
  }

  function legacyResume(payload) {
    return normalizeResume({
      lessonId: payload.lastLesson,
      updatedAt: payload.visits?.[payload.lastLesson],
    });
  }

  function normalizePayload(payload, persistImported) {
    for (const group of groups) {
      if (group === 'bookmarks' || !isRecord(payload[group])) continue;
      for (const [id, entry] of Object.entries(payload[group])) {
        const value = normalizeRecord(group, id, entry);
        if (value === undefined) continue;
        if (persistImported) {
          const existing = state[group][id];
          if (group === 'answers' && existing?.solved && !value.solved) continue;
          if (group !== 'answers' && group !== 'visits' && Object.hasOwn(state[group], id)) continue;
          setRecord(group, id, value);
        } else assignRecord(group, id, value);
      }
    }
    if (Array.isArray(payload.saved)) {
      for (const id of new Set(payload.saved)) {
        if (!conceptIds.has(id)) continue;
        if (persistImported) setRecord('bookmarks', id, true);
        else assignRecord('bookmarks', id, true);
      }
    }
    const resume = normalizeResume(payload.resume) ?? legacyResume(payload);
    if (resume && (!state.resume || resume.updatedAt > state.resume.updatedAt)) {
      assignResume(resume);
      if (persistImported) persist(resumeKey, resume);
    }
  }

  // Keep the old progress intact and overlay changes saved by this version.
  const legacy = namespace ? null : read(storage, legacyKey);
  if (isRecord(legacy)) normalizePayload(legacy, false);
  refresh();

  globalThis.addEventListener?.('storage', event => {
    if (event.storageArea !== storage || typeof event.key !== 'string') return;
    if (event.key === resumeKey) {
      const resume = normalizeResume(read(storage, resumeKey));
      if (resume && !memoryOnly.has(resumeKey)) assignResume(resume);
    } else if (event.key.startsWith(storagePrefix + ':')) {
      const [group, id] = event.key.slice(storagePrefix.length + 1).split(':');
      if (Object.hasOwn(ids, group) && ids[group].has(id)) refreshRecord(group, id);
    }
  });

  return {
    state,
    refresh,
    setRecord,
    setResume,
    setBookmark: (id, saved) => setRecord('bookmarks', id, saved),
    recordVisit: id => setRecord('visits', id, Date.now()),
    markCompleted: id => setRecord('completed', id, true),
    saveView,
    getView: route => views.get(route),
    exportProgress() {
      refresh();
      return { ...state, kind: versionKey };
    },
    importProgress(payload) {
      if (!isRecord(payload) || (payload.kind !== legacyKey && payload.kind !== versionKey)) {
        throw new Error('format');
      }
      refresh();
      normalizePayload(payload, true);
    },
  };
}
