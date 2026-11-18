import { LAB_UI_MODULE } from './lab-module.js';
import { readSavedViews } from './learning-state.js';
import { galleryAssetForViewport, landscapePhoto, photoForViewport } from './photo-sizes.js';

function preload(resource, rel, as) {
  const link = document.createElement('link');
  link.rel = rel;
  if (as) link.as = as;
  link.href = resource;
  link.fetchPriority = 'high';
  document.head.append(link);
}

const [route] = location.hash.split('?');
const view = new URLSearchParams(location.search).get('view');
const namespace = view === 'nearby' || view === 'fieldwork' ? view : '';
const topic = route.match(/^#\/concept\/([a-z-]+)$/)?.[1];
const photos = Object.hasOwn(EARLY_GALLERY_PHOTOS, topic) ? EARLY_GALLERY_PHOTOS[topic] : undefined;

if (photos?.length) {
  const savedIndex = readSavedViews(namespace).get(route)?.galleryIndex;
  const index = Number.isInteger(savedIndex) ? Math.max(0, Math.min(photos.length - 1, savedIndex)) : 0;
  preload('./assets/' + galleryAssetForViewport(photos[index]), 'preload', 'image');
} else if (route === '#/term/7a' || namespace && (!route.startsWith('#/') || route === '#/')) {
  preload('./assets/' + photoForViewport(landscapePhoto).file, 'preload', 'image');
} else if (route.startsWith('#/lab/') || route === '#/lesson/earth-model' || route === '#/lesson/earth-motion') {
  preload('./src/' + LAB_UI_MODULE.slice(2), 'modulepreload');
  for (const dependency of EARLY_LAB_DEPENDENCIES) preload('./' + dependency, 'modulepreload');
}
