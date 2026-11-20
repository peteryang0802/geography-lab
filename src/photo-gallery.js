import { galleryAssetForViewport, galleryPhoto, photoSourceUrl } from './responsive-photo.js?v=7';

const PHOTO_TIMEOUT_MS = 8000;

function link(text, href) {
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.textContent = text;
  anchor.target = '_blank';
  anchor.rel = 'noopener';
  return anchor;
}

export function mountPhotoGallery(host, photos, initialIndex, onChange, { embedded = false, heading = '滑着看图片' } = {}) {
  if (photos.length === 0) return () => {};
  host.innerHTML = `
    ${embedded ? '' : '<h2></h2>'}
    <div class="gallery-track" tabindex="0" role="region" aria-label="图片，左右滑动或用方向键"></div>
    <div class="gallery-controls">
      <button type="button" class="button" data-prev aria-label="上一张图片">← 上一张</button>
      <span role="status" aria-live="polite" data-count></span>
      <button type="button" class="button" data-next aria-label="下一张图片">下一张 →</button>
    </div>
    <p class="gallery-right-caption" data-active-caption></p>
    <details class="gallery-sources"><summary>图片来源</summary><ul></ul></details>`;
  const track = host.querySelector('.gallery-track');
  const sources = host.querySelector('ul');
  const prev = host.querySelector('[data-prev]');
  const next = host.querySelector('[data-next]');
  const count = host.querySelector('[data-count]');
  const activeCaption = host.querySelector('[data-active-caption]');
  if (!embedded) host.querySelector('h2').textContent = heading;
  const bound = value => Math.max(0, Math.min(photos.length - 1, value));
  let index = bound(Number.isInteger(initialIndex) ? initialIndex : 0);
  let requestedIndex = null;
  let direction = 1;
  let frame;
  let prefetchTimer;
  let backgroundIndex = null;
  let disposed = false;

  const slides = photos.map((photo, photoIndex) => {
    const figure = document.createElement('figure');
    figure.className = 'gallery-slide';
    const frame = document.createElement('div');
    frame.className = 'gallery-frame';
    const image = document.createElement('img');
    image.alt = photo.alt;
    image.decoding = 'async';
    if (photo.width && photo.height) {
      image.width = photo.width;
      image.height = photo.height;
    }
    const status = document.createElement('div');
    status.className = 'gallery-image-status';
    const message = document.createElement('p');
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.className = 'button gallery-retry';
    retry.textContent = '重试';
    retry.setAttribute('aria-label', '重试加载：' + photo.title);
    status.append(message, retry);
    frame.append(image, status);
    const caption = document.createElement('figcaption');
    const title = document.createElement('strong');
    title.textContent = photo.title;
    const cue = document.createElement('p');
    cue.textContent = photo.cue;
    caption.append(title, cue);
    figure.append(frame, caption);
    const credit = document.createElement('li');
    credit.append(link(photo.title, photo.source), ' · ' + photo.author + ' · ', link(...photo.license), ' · 图片已缩放或转换格式');
    sources.append(credit);
    track.append(figure);
    const slide = { photo, figure, image, status, message, retry, failedAttempts: 0, request: 0 };
    setImageState(slide, 'idle');
    image.addEventListener('load', async () => {
      const request = slide.request;
      const source = image.currentSrc;
      try {
        await image.decode();
      } catch {
        // Another candidate may have been selected while an image was decoding.
      }
      if (request === slide.request && source === image.currentSrc && image.complete && image.naturalWidth) {
        finishPhoto(slide, photoIndex, 'loaded');
      }
    });
    image.addEventListener('error', () => finishPhoto(slide, photoIndex, 'error'));
    retry.addEventListener('click', () => requestPhoto(photoIndex, 'high', true));
    return slide;
  });

  function setImageState(slide, state) {
    const loaded = state === 'loaded';
    const error = state === 'error';
    slide.state = state;
    slide.figure.dataset.imageState = state;
    slide.image.style.visibility = loaded ? '' : 'hidden';
    slide.status.hidden = loaded;
    slide.retry.hidden = !error;
    slide.message.textContent = loaded ? '' : error ? '这张照片暂时没载入。' : '照片加载中…';
  }

  function requestPhoto(target, priority, retry = false) {
    const slide = slides[target];
    if (disposed || !slide) return;
    if (priority === 'high' && constrainedConnection()) cancelUnviewedRequests(target);
    if (slide.state === 'loaded' || slide.state === 'error' && !retry) return;
    const { image, photo } = slide;
    image.loading = 'eager';
    image.fetchPriority = priority;
    if (slide.state === 'loading') return;
    if (retry && document.activeElement === slide.retry) track.focus({ preventScroll: true });
    setImageState(slide, 'loading');
    const request = ++slide.request;
    const useThumbnail = retry && (slide.timedOut || slide.failedAttempts >= 2);
    slide.timedOut = false;
    slide.timeout = setTimeout(() => {
      if (request !== slide.request || slide.state !== 'loading') return;
      slide.timedOut = true;
      finishPhoto(slide, target, 'error');
      image.removeAttribute('src');
    }, PHOTO_TIMEOUT_MS);
    const suffix = retry ? '?retry=' + Date.now() : '';
    const file = useThumbnail ? galleryPhoto(photo, { thumbnail: true }).file : galleryAssetForViewport(photo);
    image.src = photoSourceUrl(file) + suffix;
  }

  function cancelUnviewedRequests(target) {
    for (const [position, slide] of slides.entries()) {
      if (position === target || slide.state !== 'loading') continue;
      slide.request++;
      clearTimeout(slide.timeout);
      if (backgroundIndex === position) backgroundIndex = null;
      setImageState(slide, 'idle');
      slide.image.removeAttribute('src');
    }
  }

  function finishPhoto(slide, photoIndex, state) {
    if (disposed || slide.state !== 'loading') return;
    clearTimeout(slide.timeout);
    if (backgroundIndex === photoIndex) backgroundIndex = null;
    if (state === 'error') slide.failedAttempts++;
    setImageState(slide, state);
    updateCaption();
    schedulePrefetch();
  }

  function updateCaption() {
    const slide = slides[index];
    activeCaption.textContent = slide.photo.title + ' · ' + slide.photo.cue;
  }

  function constrainedConnection() {
    const connection = navigator.connection;
    return connection?.saveData || ['slow-2g', '2g', '3g'].includes(connection?.effectiveType)
      || !connection?.effectiveType && matchMedia('(pointer: coarse)').matches;
  }

  function schedulePrefetch() {
    clearTimeout(prefetchTimer);
    if (requestedIndex !== null || backgroundIndex !== null || document.hidden || constrainedConnection() || slides[index].state !== 'loaded') return;
    const neighbor = bound(index + direction) === index ? index - direction : index + direction;
    if (slides[neighbor]?.state !== 'idle') return;
    prefetchTimer = setTimeout(() => {
      backgroundIndex = neighbor;
      requestPhoto(neighbor, 'low');
    }, 150);
  }

  function scrollTarget(slide) {
    const left = slides[slide].figure.offsetLeft - slides[0].figure.offsetLeft;
    return Math.min(left, Math.max(0, track.scrollWidth - track.clientWidth));
  }

  function update() {
    if (!track.clientWidth) return;
    const previousIndex = index;
    const distance = slides.map((_, i) => Math.abs(track.scrollLeft - scrollTarget(i)));
    index = distance.indexOf(Math.min(...distance));
    updateCaption();
    for (const [position, slide] of slides.entries()) {
      slide.message.setAttribute('aria-live', position === index ? 'polite' : 'off');
      slide.retry.tabIndex = position === index ? 0 : -1;
    }
    if (requestedIndex === index) requestedIndex = null;
    if (requestedIndex === null) requestPhoto(index, 'high');
    prev.disabled = index === 0;
    next.disabled = index === slides.length - 1;
    const label = `${index + 1} / ${slides.length}`;
    if (count.textContent !== label) count.textContent = label;
    if (index !== previousIndex) {
      direction = Math.sign(index - previousIndex);
      onChange?.(index);
    }
    schedulePrefetch();
  }

  function goTo(slide, instant = false) {
    if (!track.clientWidth) return;
    const target = bound(slide);
    clearTimeout(prefetchTimer);
    requestedIndex = target === index ? null : target;
    requestPhoto(target, 'high');
    track.scrollTo({
      left: scrollTarget(target),
      behavior: instant || matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
    });
  }

  track.addEventListener('scroll', () => {
    clearTimeout(prefetchTimer);
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(update);
  }, { passive: true });
  function startManualScroll() {
    clearTimeout(prefetchTimer);
    requestedIndex = null;
  }
  track.addEventListener('pointerdown', startManualScroll, { passive: true });
  track.addEventListener('wheel', startManualScroll, { passive: true });
  prev.addEventListener('click', () => goTo((requestedIndex ?? index) - 1));
  next.addEventListener('click', () => goTo((requestedIndex ?? index) + 1));
  track.addEventListener('keydown', event => {
    if (event.target !== track) return;
    const focus = requestedIndex ?? index;
    const target = { ArrowLeft: focus - 1, ArrowRight: focus + 1, Home: 0, End: slides.length - 1 }[event.key];
    if (target === undefined) return;
    event.preventDefault();
    goTo(target);
  });

  const observer = new ResizeObserver(() => {
    goTo(requestedIndex ?? index, true);
    update();
  });
  observer.observe(track);
  goTo(index, true);
  update();
  return () => {
    disposed = true;
    observer.disconnect();
    cancelAnimationFrame(frame);
    clearTimeout(prefetchTimer);
    cancelUnviewedRequests(-1);
  };
}
