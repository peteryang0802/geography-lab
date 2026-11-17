function link(text, href) {
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.textContent = text;
  anchor.target = '_blank';
  anchor.rel = 'noopener';
  return anchor;
}

export function mountPhotoGallery(host, photos, initialIndex, onChange) {
  host.innerHTML = `
    <h2>滑着看图片</h2>
    <div class="gallery-track" tabindex="0" role="region" aria-label="图片，左右滑动或用方向键"></div>
    <div class="gallery-controls">
      <button type="button" class="button" data-prev aria-label="上一张图片">← 上一张</button>
      <span role="status" aria-live="polite" data-count></span>
      <button type="button" class="button" data-next aria-label="下一张图片">下一张 →</button>
    </div>
    <details class="gallery-sources"><summary>图片来源</summary><ul></ul></details>`;
  const track = host.querySelector('.gallery-track');
  const sources = host.querySelector('ul');
  const prev = host.querySelector('[data-prev]');
  const next = host.querySelector('[data-next]');
  const count = host.querySelector('[data-count]');
  const slides = photos.map((photo, index) => {
    const figure = document.createElement('figure');
    figure.className = 'gallery-slide';
    const image = document.createElement('img');
    image.src = './assets/gallery/' + photo.file;
    image.alt = photo.alt;
    image.loading = index === 0 ? 'eager' : 'lazy';
    image.decoding = 'async';
    const caption = document.createElement('figcaption');
    const title = document.createElement('strong');
    title.textContent = photo.title;
    const cue = document.createElement('p');
    cue.textContent = photo.cue;
    caption.append(title, cue);
    figure.append(image, caption);
    const credit = document.createElement('li');
    credit.append(link(photo.title, photo.source), ' · ' + photo.author + ' · ', link(...photo.license), ' · 图片已缩放或转换格式');
    sources.append(credit);
    track.append(figure);
    return figure;
  });
  let index = Math.min(initialIndex ?? 0, slides.length - 1);
  let frame;

  function scrollTarget(slide) {
    const left = slides[slide].offsetLeft - slides[0].offsetLeft;
    return Math.min(left, track.scrollWidth - track.clientWidth);
  }

  function update() {
    const previousIndex = index;
    const distance = slides.map((_, i) => Math.abs(track.scrollLeft - scrollTarget(i)));
    index = distance.indexOf(Math.min(...distance));
    prev.disabled = index === 0;
    next.disabled = index === slides.length - 1;
    const label = `${index + 1} / ${slides.length}`;
    if (count.textContent !== label) count.textContent = label;
    if (index !== previousIndex) onChange(index);
  }

  function goTo(slide, instant = false) {
    const target = Math.max(0, Math.min(slides.length - 1, slide));
    track.scrollTo({
      left: scrollTarget(target),
      behavior: instant || matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
    });
  }

  track.addEventListener('scroll', () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(update);
  }, { passive: true });
  prev.addEventListener('click', () => goTo(index - 1));
  next.addEventListener('click', () => goTo(index + 1));
  track.addEventListener('keydown', event => {
    if (event.target !== track) return;
    const target = { ArrowLeft: index - 1, ArrowRight: index + 1, Home: 0, End: slides.length - 1 }[event.key];
    if (target === undefined) return;
    event.preventDefault();
    goTo(target);
  });

  const observer = new ResizeObserver(() => goTo(index, true));
  observer.observe(track);
  goTo(index, true);
  update();
  return () => {
    observer.disconnect();
    cancelAnimationFrame(frame);
  };
}
