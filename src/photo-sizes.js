const PHONE_MAX_WIDTH = 700;

export const landscapePhoto = {
  file: 'landscape-small.webp', width: 640, height: 426,
  phone: { file: 'landscape-mobile.webp', width: 520, height: 165 },
};

const evidencePhotos = {
  cloud: [760, 507],
  earth: [610, 610, 460],
  'fishing-vessel': [640, 427, 307],
  fossil: [212, 220],
  puddle: [760, 572, 347],
};

export function evidencePhoto(id) {
  const [width, height, phoneHeight] = evidencePhotos[id];
  return {
    file: `evidence/${id}.webp`, width, height,
    phone: phoneHeight && { file: `evidence/${id}-460.webp`, width: 460, height: phoneHeight },
  };
}

export function photoForViewport(photo, viewportWidth = document.documentElement.clientWidth) {
  return viewportWidth <= PHONE_MAX_WIDTH && photo.phone
    ? { ...photo, ...photo.phone, variants: undefined }
    : photo;
}

function galleryVariant(photo, width) {
  return 'gallery/' + photo.file.replace(/\.webp$/, `-${width}.webp`);
}

export function galleryAssetForViewport(
  photo,
  viewportWidth = document.documentElement.clientWidth,
  pixelRatio = window.devicePixelRatio || 1,
) {
  if (!photo.mobileFile) return 'gallery/' + photo.file;
  if (viewportWidth <= PHONE_MAX_WIDTH) return galleryVariant(photo, 480);
  if (viewportWidth <= 1040 || pixelRatio < 1.5) return 'gallery/' + photo.mobileFile;
  return 'gallery/' + photo.file;
}

export function galleryPhoto(photo, { thumbnail = false } = {}) {
  const file = 'gallery/' + photo.file;
  if (thumbnail) {
    return {
      file: galleryVariant(photo, 320),
      width: 320, height: Math.round(photo.height * 320 / photo.width), alt: photo.alt,
    };
  }
  const mobile = photo.mobileFile && 'gallery/' + photo.mobileFile;
  return {
    file: mobile || file, width: photo.width, height: photo.height, alt: photo.alt,
    phone: mobile && { file: galleryVariant(photo, 480), width: 480, height: Math.round(photo.height * 480 / photo.width) },
    variants: mobile && photo.width > 640 ? [[mobile, 640], [file, photo.width]] : undefined,
  };
}
