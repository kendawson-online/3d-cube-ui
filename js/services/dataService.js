export function createDataService(src = 'data/faces.json') {
  let cachedFaces = null;

  async function loadFaces() {
    if (cachedFaces) return cachedFaces;
    const response = await fetch(src, { cache: 'no-cache' });
    if (!response.ok) throw new Error(`Failed to load ${src}`);
    const data = await response.json();
    cachedFaces = data;
    return data;
  }

  return { loadFaces };
}
