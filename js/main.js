import { createDataService } from './services/dataService.js';
import { createHistoryManager } from './services/historyManager.js';
import { createResponsiveController } from './services/responsiveController.js';
import { createFaceRenderer } from './ui/faceRenderer.js';
import { createLoader } from './ui/loader.js';
import { createNotifier } from './ui/notifications.js';
import { createMenuController } from './ui/menuController.js';
import { createCubeController } from './ui/cubeController.js';
import { createMobileController } from './ui/mobileController.js';
import { getState, setFaces, setState, watchState } from './state/store.js';

const dataService = createDataService('data/faces.json');
const faceRenderer = createFaceRenderer();
const loader = createLoader();
const notifier = createNotifier();
const historyManager = createHistoryManager({ debug: false });

async function bootstrap() {
  loader.captureDimensions();
  if (loader.hasSeen()) loader.hide(true);
  else loader.show();

  let faces = [];
  try {
    faces = await dataService.loadFaces();
    setFaces(faces);
  } catch (err) {
    console.error(err);
    notifier.error('Unable to load cube faces.');
    loader.hide(true);
    return;
  }

  const facesById = faces.reduce((acc, face) => {
    acc[face.id] = face;
    return acc;
  }, {});

  function getFaceFromView(view) {
    if (!view) return null;
    if (facesById[view]) return facesById[view].id;
    const match = faces.find((face) => face.link === view);
    return match ? match.id : null;
  }

  function getFaceLink(faceId) {
    const face = facesById[faceId];
    return face ? (face.link || face.id) : faceId;
  }

  const urlFace = getFaceFromView(historyManager.getView());
  const storedFace = getState().currentFace;
  const initialFace = urlFace || storedFace || faces[0].id;
  setState({ currentFace: initialFace });

  const menuController = createMenuController({
    faces,
    onSelectFace: (faceId, payload = {}) => navigate(faceId, { ...payload, userInitiated: true })
  });

  const cubeController = createCubeController({
    onNavigate: ({ faceId }) => navigate(faceId, { userInitiated: true, source: 'cube' })
  });

  const mobileController = createMobileController({
    faces,
    mountFaceContent: faceRenderer.mountFaceContent,
    prefetchNeighbors: faceRenderer.prefetchNeighbors,
    onNavigate: ({ faceId }) => navigate(faceId, { userInitiated: true, source: 'mobile' })
  });

  faces.forEach((face) => {
    const container = document.getElementById(`face-${face.id}-content`);
    if (container && face.type === 'html') {
      faceRenderer.mountFaceContent(face, container);
    }
  });

  function ensureFaceLoaded(faceId) {
    const face = facesById[faceId];
    const container = document.getElementById(`face-${face.id}-content`);
    if (face && container) {
      faceRenderer.mountFaceContent(face, container);
    }
  }

  function navigate(faceId, { userInitiated = false, source = 'app' } = {}) {
    if (!facesById[faceId]) faceId = faces[0].id;
    const snapshot = getState();
    if (snapshot.currentFace !== faceId) {
      setState({ currentFace: faceId });
    }
    const mode = snapshot.mode;
    cubeController.goToFace(faceId, { userInitiated });
    if (mode === 'mobile') mobileController.slideTo(faceId);
    ensureFaceLoaded(faceId);
    if (source !== 'history') {
      historyManager.push(getFaceLink(faceId), { userInitiated });
    }
  }

  historyManager.init(getFaceLink(initialFace));
  historyManager.onNavigate(({ view }) => {
    const faceId = getFaceFromView(view) || faces[0].id;
    navigate(faceId, { source: 'history' });
  });

  const responsive = createResponsiveController();
  watchState('menuCollapsed', () => responsive.refresh());
  // Toggle 'menu-floating' class on the main menu depending on desktop mode
  responsive.on('modechange', ({ mode }) => {
    const menu = document.querySelector('.menu');
    if (!menu) return;
    if (mode === 'desktop-large') menu.classList.add('menu-floating');
    else menu.classList.remove('menu-floating');
  });
  responsive.on('modechange', ({ mode }) => {
    if (mode === 'mobile') {
      mobileController.mount(getState().currentFace);
    } else {
      mobileController.destroy();
      cubeController.setFaceImmediate(getState().currentFace);
    }
  });
  // Ensure controllers respect initial mode
  const currentMode = getState().mode;
  if (currentMode === 'mobile') {
    mobileController.mount(initialFace);
  } else {
    cubeController.setFaceImmediate(initialFace);
  }
  navigate(initialFace, { source: 'init' });

  loader.hide();
  menuController.syncActive(initialFace);
}

document.addEventListener('DOMContentLoaded', bootstrap);
