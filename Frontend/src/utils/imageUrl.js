export function optimizedImageUrl(source, width = 900) {
  if (!source) return '';

  try {
    const url = new URL(source, window.location.origin);
    if (url.hostname === 'images.unsplash.com') {
      url.searchParams.set('auto', 'format');
      url.searchParams.set('fit', 'crop');
      url.searchParams.set('w', String(width));
      url.searchParams.set('q', '72');
    }
    return url.toString();
  } catch {
    return source;
  }
}
