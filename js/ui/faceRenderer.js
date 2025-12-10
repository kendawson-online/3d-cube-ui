const fetchCache = new Map();

async function fetchText(path) {
  if (fetchCache.has(path)) return fetchCache.get(path);
  const promise = fetch(path, { cache: 'no-cache' })
    .then((response) => {
      if (!response.ok) throw new Error(`Failed to load ${path}`);
      return response.text();
    })
    .catch((err) => {
      fetchCache.delete(path);
      throw err;
    });
  fetchCache.set(path, promise);
  return promise;
}

function extractFragment(htmlText) {
  try {
    const doc = new DOMParser().parseFromString(htmlText, 'text/html');
    if (doc && doc.body) return doc.body.innerHTML;
  } catch (e) {}
  return htmlText;
}

function createIframe(container, src, title) {
  if (!container || container.querySelector('iframe')) return;
  const iframe = document.createElement('iframe');
  iframe.src = src;
  iframe.loading = 'lazy';
  iframe.title = title || '';
  iframe.setAttribute('frameborder', '0');
  iframe.style.width = '100%';
  iframe.style.height = '100%';
  container.appendChild(iframe);
}

export function createFaceRenderer({ basePath = 'data/' } = {}) {
  const loadedFaces = new Set();

  async function mountFaceContent(face, container) {
    if (!face || !container) return;
    if (loadedFaces.has(face.id) && container.dataset.loaded === 'true') return;
    const srcPath = face.src.startsWith(basePath) ? face.src : `${basePath}${face.src}`;
    if (face.type === 'iframe') {
      createIframe(container, srcPath, face.title);
      container.dataset.loaded = 'true';
      loadedFaces.add(face.id);
      return;
    }
    try {
      const html = await fetchText(srcPath);
      container.innerHTML = extractFragment(html);
      container.dataset.loaded = 'true';
      loadedFaces.add(face.id);
    } catch (err) {
      console.error('mountFaceContent error', face.id, err);
      container.innerHTML = '<p>Error loading content.</p>';
    }
  }

  function preload(face) {
    if (!face || face.type !== 'html') return;
    const srcPath = face.src.startsWith(basePath) ? face.src : `${basePath}${face.src}`;
    fetchText(srcPath).catch(() => {});
  }

  function prefetchNeighbors(faces, idx) {
    if (!Array.isArray(faces) || !faces.length) return;
    const len = faces.length;
    const targets = [((idx - 1 + len) % len), ((idx + 1) % len)];
    targets.forEach((i) => preload(faces[i]));
  }

  return { mountFaceContent, prefetchNeighbors, preload };
}
