import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {selectionPosition, type UniverseLayout3, type UniverseSelection} from '@/lib/live-universe';
import {createNebula} from './nebula';
import {createConnections, createStarfield, createThoughts, disposeObject} from './particles';

type Callbacks = {
  select: (selection: UniverseSelection) => void;
  project: (id: string, x: number, y: number, visible: boolean) => void;
  fail: () => void;
};
export type UniverseEngine = ReturnType<typeof createUniverse>;

export function createUniverse(host: HTMLDivElement, callbacks: Callbacks) {
  const renderer = new THREE.WebGLRenderer({antialias: false, powerPreference: 'high-performance'});
  const compact = host.clientWidth < 700;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, compact ? 1.25 : 1.6));
  renderer.setClearColor(0x05080e);
  renderer.autoClear = false;
  const canvas = renderer.domElement;
  canvas.setAttribute('aria-hidden', 'true');
  host.appendChild(canvas);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(compact ? 58 : 49, 1, .1, 1500);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = .055;
  controls.rotateSpeed = .32;
  controls.zoomSpeed = .8;
  controls.minDistance = 23;
  controls.maxDistance = 300;
  controls.enablePan = false;
  controls.minPolarAngle = Math.PI * .2;
  controls.maxPolarAngle = Math.PI * .8;
  controls.autoRotateSpeed = .055;
  const nebula = createNebula(renderer, camera);
  const background = createStarfield(renderer.getPixelRatio(), compact);
  scene.add(background);
  let layout: UniverseLayout3 = {clusters: [], stars: [], links: []};
  let thoughts: ReturnType<typeof createThoughts> | null = null;
  let connections: THREE.Group | null = null;
  let selection: UniverseSelection = null;
  let paused = false, reduced = false, dirty = true, disposed = false, failed = false, dragging = false;
  let frame = 0, last = 0, elapsed = 0;
  let flight: {start: number; from: THREE.Vector3; to: THREE.Vector3; fromTarget: THREE.Vector3; toTarget: THREE.Vector3} | null = null;
  let qualitySamples = 0, qualityTotal = 0, lowQuality = false;
  const home = new THREE.Vector3();
  const homeTarget = new THREE.Vector3(0, -1, 0);
  const invalidate = () => { dirty = true; };
  const resize = () => {
    const width = Math.max(1, host.clientWidth), height = Math.max(1, host.clientHeight);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    const distance = Math.max(98, 113 / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect));
    home.set(0, 7, Math.min(270, distance));
    if (!selection) {camera.position.copy(home); controls.target.copy(homeTarget);}
    renderer.setSize(width, height);
    nebula.resize(lowQuality ? width * .65 : width, lowQuality ? height * .65 : height);
    controls.update(); invalidate();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  resize();
  controls.addEventListener('change', invalidate);

  const projection = new THREE.Vector3();
  function render(now: number) {
    if (disposed || failed) return;
    frame = requestAnimationFrame(render);
    if (document.hidden || now - last < 32) return;
    const dt = Math.min((now - last) / 1000, .1);
    last = now;
    const moving = !paused && !reduced;
    controls.autoRotate = moving && !selection && !flight && !dragging;
    controls.enableDamping = !reduced;
    if (moving) elapsed += dt;
    if (flight) {
      const t = Math.min(1, (now - flight.start) / 1550), ease = t * t * (3 - 2 * t);
      camera.position.lerpVectors(flight.from, flight.to, ease);
      controls.target.lerpVectors(flight.fromTarget, flight.toTarget, ease);
      if (t === 1) flight = null;
      dirty = true;
    }
    const changed = controls.update(dt);
    if (!dirty && !moving && !changed) return;
    dirty = false;
    camera.updateMatrixWorld();
    background.material.uniforms.uTime.value = elapsed;
    if (thoughts) thoughts.material.uniforms.uTime.value = elapsed;
    const start = performance.now();
    renderer.clear(); nebula.render(elapsed); renderer.render(scene, camera);
    // Lower only the expensive gas pass if sustained rendering is slow.
    if (!lowQuality && ++qualitySamples <= 50) {
      qualityTotal += performance.now() - start;
      if (qualitySamples === 50 && qualityTotal / qualitySamples > 24) {lowQuality = true; resize();}
    }
    for (const cluster of layout.clusters) {
      projection.set(...cluster.position).project(camera);
      const visible = projection.z > -1 && projection.z < 1 && Math.abs(projection.x) < .9 && Math.abs(projection.y) < .78;
      callbacks.project(cluster.id, (projection.x * .5 + .5) * host.clientWidth, (-projection.y * .5 + .5) * host.clientHeight + 18, visible);
    }
  }
  frame = requestAnimationFrame(render);

  function focus(next: UniverseSelection) {
    selection = next;
    const position = selectionPosition(layout, next);
    const target = position ? new THREE.Vector3(...position) : homeTarget.clone();
    const direction = camera.position.clone().sub(controls.target).normalize();
    const destination = position ? target.clone().add(direction.multiplyScalar(compact ? 76 : 48)) : home.clone();
    if (reduced) {camera.position.copy(destination); controls.target.copy(target); flight = null; controls.update();}
    else flight = {start: performance.now(), from: camera.position.clone(), to: destination, fromTarget: controls.target.clone(), toTarget: target};
    invalidate();
  }

  const raycaster = new THREE.Raycaster();
  raycaster.params.Points.threshold = 1.1;
  let down: {x: number; y: number; id: number} | null = null;
  const pointers = new Set<number>();
  let gesture = false;
  function pointerDown(event: PointerEvent) {
    pointers.add(event.pointerId);
    if (pointers.size > 1) gesture = true;
    if (event.button === 0 && pointers.size === 1) {down = {x: event.clientX, y: event.clientY, id: event.pointerId}; gesture = false;}
  }
  function pointerMove(event: PointerEvent) {
    if (down && Math.hypot(event.clientX - down.x, event.clientY - down.y) > 6) gesture = true;
  }
  function pointerUp(event: PointerEvent) {
    pointers.delete(event.pointerId);
    if (event.type === 'pointercancel' || gesture || !down || down.id !== event.pointerId || !thoughts) {down = null; return;}
    down = null;
    const rect = canvas.getBoundingClientRect();
    const pointer = new THREE.Vector2((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObject(thoughts)[0];
    if (hit?.index !== undefined) {
      const star = layout.stars[hit.index];
      const cluster = layout.clusters[hit.index - layout.stars.length];
      if (star) callbacks.select({kind: 'thought', id: star.id});
      else if (cluster) callbacks.select({kind: 'planet', id: cluster.id});
    }
  }
  const startDrag = () => {dragging = true; flight = null;};
  const endDrag = () => {dragging = false;};
  const lost = (event: Event) => {event.preventDefault(); failed = true; callbacks.fail();};
  controls.addEventListener('start', startDrag);controls.addEventListener('end', endDrag);
  canvas.addEventListener('pointerdown', pointerDown);canvas.addEventListener('pointermove', pointerMove);
  canvas.addEventListener('pointerup', pointerUp);canvas.addEventListener('pointercancel', pointerUp);
  canvas.addEventListener('webglcontextlost', lost);
  document.addEventListener('visibilitychange', invalidate);

  return {
    update(next: UniverseLayout3, fresh: Set<string>, selected: UniverseSelection, showLinks: boolean) {
      layout = next;
      if (thoughts) {scene.remove(thoughts); disposeObject(thoughts);}
      thoughts = createThoughts(layout, fresh, renderer.getPixelRatio());scene.add(thoughts);
      if (connections) {scene.remove(connections); disposeObject(connections);}
      connections = createConnections(layout, selected, showLinks);scene.add(connections);
      if (selection?.id !== selected?.id || selection?.kind !== selected?.kind) focus(selected);
      invalidate();
    },
    motion(isPaused: boolean, isReduced: boolean) {
      paused = isPaused; reduced = isReduced;
      if (reduced && flight) {camera.position.copy(flight.to); controls.target.copy(flight.toTarget); flight = null;}
      invalidate();
    },
    zoom(scale: number) {
      flight = null;
      const offset = camera.position.clone().sub(controls.target);
      offset.setLength(THREE.MathUtils.clamp(offset.length() * scale, controls.minDistance, controls.maxDistance));
      camera.position.copy(controls.target).add(offset);invalidate();
    },
    reset() {focus(null);},
    rotate(horizontal: number, vertical: number) {
      flight = null;controls.rotateLeft(horizontal);controls.rotateUp(vertical);invalidate();
    },
    dispose() {
      disposed = true;cancelAnimationFrame(frame);observer.disconnect();
      controls.removeEventListener('change', invalidate);controls.removeEventListener('start', startDrag);controls.removeEventListener('end', endDrag);
      controls.dispose();document.removeEventListener('visibilitychange', invalidate);
      canvas.removeEventListener('pointerdown', pointerDown);canvas.removeEventListener('pointermove', pointerMove);
      canvas.removeEventListener('pointerup', pointerUp);canvas.removeEventListener('pointercancel', pointerUp);
      canvas.removeEventListener('webglcontextlost', lost);
      disposeObject(scene);nebula.dispose();renderer.dispose();renderer.forceContextLoss();canvas.remove();
    },
  };
}
