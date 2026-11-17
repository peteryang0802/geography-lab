import { photoForViewport } from './photo-sizes.js?v=7';
export { evidencePhoto, galleryAssetForViewport, galleryPhoto, landscapePhoto, photoForViewport } from './photo-sizes.js?v=7';

export const photoSourceUrl = file => new URL('../assets/' + file, import.meta.url).href;
const PHOTO_TIMEOUT_MS = 8000;
const escaped = value => String(value).replace(/[&"<>]/g, symbol => ({ '&': '&amp;', '"': '&quot;', '<': '&lt;', '>': '&gt;' })[symbol]);

export function responsivePhoto(photo, {
  alt = photo.alt ?? '',
  sizes = '(max-width: 700px) 92vw, 760px',
  loading = 'deferred',
  priority = loading === 'eager' ? 'high' : 'low',
  className = '',
} = {}) {
  photo = photoForViewport(photo);
  const source = photoSourceUrl(photo.file);
  const sources = photo.variants?.map(([file, width]) => `${photoSourceUrl(file)} ${width}w`).join(', ');
  const prefix = loading === 'deferred' ? 'data-photo-' : '';
  const candidates = sources ? `${prefix}sizes="${escaped(sizes)}" ${prefix}srcset="${escaped(sources)}"` : '';
  const loadingAttribute = prefix ? '' : ` loading="${escaped(loading)}"`;
  return `<img data-site-photo width="${photo.width}" height="${photo.height}" alt="${escaped(alt)}" decoding="async" fetchpriority="${priority}"${loadingAttribute}${className ? ` class="${escaped(className)}"` : ''} ${candidates} ${prefix}src="${escaped(source)}">`;
}

export function mountDeferredPhotos(root) {
  const pending = new Set();
  const loading = new Map();
  const fallbacks = new WeakMap();
  const selector = 'img[data-site-photo]';

  function stopWatching(image) {
    clearTimeout(loading.get(image));
    loading.delete(image);
  }

  function showMissing(image) {
    stopWatching(image);
    if (!root.contains(image) || fallbacks.has(image)) return;
    image.hidden = true;
    const fallback = document.createElement('span');
    fallback.className = 'photo-fallback';
    fallback.textContent = image.alt ? `照片暂时打不开。图中是${image.alt}。` : '照片暂时打不开';
    fallbacks.set(image, fallback);
    image.after(fallback);
  }

  function onImageError(event) {
    if (event.target.matches?.(selector)) showMissing(event.target);
  }

  function onImageLoad(event) {
    const image = event.target;
    if (!image.matches?.(selector)) return;
    stopWatching(image);
    const fallback = fallbacks.get(image);
    if (!fallback) return;
    fallback.remove();
    fallbacks.delete(image);
    image.hidden = false;
  }

  function watchLoading(image) {
    if (loading.has(image) || image.complete || image.loading === 'lazy') return;
    loading.set(image, setTimeout(() => {
      if (!image.complete) showMissing(image);
      else stopWatching(image);
    }, PHOTO_TIMEOUT_MS));
  }

  function show(image) {
    visibility?.unobserve(image);
    pending.delete(image);
    if (!root.contains(image) || !image.hasAttribute('data-photo-src')) return;
    const { photoSrc, photoSizes, photoSrcset } = image.dataset;
    if (photoSrcset) {
      image.sizes = photoSizes;
      image.srcset = photoSrcset;
    }
    image.src = photoSrc;
    delete image.dataset.photoSrc;
    delete image.dataset.photoSizes;
    delete image.dataset.photoSrcset;
    watchLoading(image);
  }

  const visibility = typeof IntersectionObserver === 'function'
    ? new IntersectionObserver(entries => {
      for (const entry of entries) if (entry.isIntersecting) show(entry.target);
    }, { rootMargin: '128px 0px' })
    : null;

  function watch(image) {
    if (!image.hasAttribute('data-photo-src')) return watchLoading(image);
    if (pending.has(image)) return;
    if (!visibility) return show(image);
    pending.add(image);
    visibility.observe(image);
  }

  const added = new MutationObserver(records => {
    for (const image of pending) {
      if (root.contains(image)) continue;
      pending.delete(image);
      visibility.unobserve(image);
    }
    for (const image of loading.keys()) if (!root.contains(image)) stopWatching(image);
    for (const { addedNodes } of records) {
      for (const node of addedNodes) {
        if (node.nodeType !== Node.ELEMENT_NODE || !root.contains(node)) continue;
        if (node.matches(selector)) watch(node);
        node.querySelectorAll(selector).forEach(watch);
      }
    }
  });
  added.observe(root, { childList: true, subtree: true });
  root.addEventListener('error', onImageError, true);
  root.addEventListener('load', onImageLoad, true);
  root.querySelectorAll(selector).forEach(watch);
  return () => {
    visibility?.disconnect();
    added.disconnect();
    root.removeEventListener('error', onImageError, true);
    root.removeEventListener('load', onImageLoad, true);
    for (const image of loading.keys()) stopWatching(image);
  };
}
