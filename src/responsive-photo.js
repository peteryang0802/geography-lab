export const photoSourceUrl = file => new URL('../assets/' + file, import.meta.url).href;

export const landscapePhoto = {
  file: 'landscape-small.webp', width: 640, height: 426,
  variants: [['landscape-420.webp', 420], ['landscape-small.webp', 640]],
};

const evidencePhotos = {
  cloud: [760, 507],
  earth: [610, 610],
  'fishing-vessel': [640, 427],
  fossil: [212, 220],
  puddle: [760, 572],
};

export function evidencePhoto(id) {
  const [width, height] = evidencePhotos[id];
  return { file: 'evidence/' + id + '.webp', width, height };
}

export function galleryPhoto(photo, { thumbnail = false } = {}) {
  const file = 'gallery/' + photo.file;
  if (thumbnail) {
    return {
      file: 'gallery/' + photo.file.replace(/\.webp$/, '-320.webp'),
      width: 320, height: Math.round(photo.height * 320 / photo.width), alt: photo.alt,
    };
  }
  const mobile = photo.mobileFile && 'gallery/' + photo.mobileFile;
  return {
    file: mobile || file, width: photo.width, height: photo.height, alt: photo.alt,
    variants: mobile && photo.width > 640 ? [[mobile, 640], [file, photo.width]] : undefined,
  };
}

const escaped = value => String(value).replace(/[&"<>]/g, symbol => ({ '&': '&amp;', '"': '&quot;', '<': '&lt;', '>': '&gt;' })[symbol]);

export function responsivePhoto(photo, {
  alt = photo.alt ?? '',
  sizes = '(max-width: 700px) 92vw, 760px',
  loading = 'deferred',
  priority = loading === 'eager' ? 'high' : 'low',
  className = '',
} = {}) {
  const source = photoSourceUrl(photo.file);
  const sources = photo.variants?.map(([file, width]) => `${photoSourceUrl(file)} ${width}w`).join(', ');
  const prefix = loading === 'deferred' ? 'data-photo-' : '';
  const candidates = sources ? `${prefix}sizes="${escaped(sizes)}" ${prefix}srcset="${escaped(sources)}"` : '';
  const loadingAttribute = prefix ? '' : ` loading="${escaped(loading)}"`;
  return `<img data-site-photo width="${photo.width}" height="${photo.height}" alt="${escaped(alt)}" decoding="async" fetchpriority="${priority}"${loadingAttribute}${className ? ` class="${escaped(className)}"` : ''} ${candidates} ${prefix}src="${escaped(source)}">`;
}

export function mountDeferredPhotos(root) {
  const pending = new Set();
  const selector = 'img[data-photo-src]';

  function showMissing(event) {
    const image = event.target;
    if (!image.matches?.('img[data-site-photo]')) return;
    image.hidden = true;
    const fallback = document.createElement('span');
    fallback.className = 'photo-fallback';
    fallback.textContent = image.alt ? `照片暂时打不开。图中是${image.alt}。` : '照片暂时打不开';
    image.after(fallback);
  }

  function show(image) {
    visibility?.unobserve(image);
    pending.delete(image);
    if (!root.contains(image) || !image.matches(selector)) return;
    const { photoSrc, photoSizes, photoSrcset } = image.dataset;
    if (photoSrcset) {
      image.sizes = photoSizes;
      image.srcset = photoSrcset;
    }
    image.src = photoSrc;
    delete image.dataset.photoSrc;
    delete image.dataset.photoSizes;
    delete image.dataset.photoSrcset;
  }

  const visibility = typeof IntersectionObserver === 'function'
    ? new IntersectionObserver(entries => {
      for (const entry of entries) if (entry.isIntersecting) show(entry.target);
    }, { rootMargin: '128px 0px' })
    : null;

  function watch(image) {
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
    for (const { addedNodes } of records) {
      for (const node of addedNodes) {
        if (node.nodeType !== Node.ELEMENT_NODE || !root.contains(node)) continue;
        if (node.matches(selector)) watch(node);
        node.querySelectorAll(selector).forEach(watch);
      }
    }
  });
  added.observe(root, { childList: true, subtree: true });
  root.addEventListener('error', showMissing, true);
  root.querySelectorAll(selector).forEach(watch);
  return () => {
    visibility?.disconnect();
    added.disconnect();
    root.removeEventListener('error', showMissing, true);
  };
}
