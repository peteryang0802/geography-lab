let sharedRelief;

export function loadReliefImage() {
  if (!sharedRelief) {
    sharedRelief = new Promise((resolve) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => resolve(null);
      image.src = new URL('../assets/relief-world-1024.webp', import.meta.url).href;
    });
  }
  return sharedRelief;
}
