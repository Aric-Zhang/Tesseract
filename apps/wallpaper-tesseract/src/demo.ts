import * as THREE from "three";
import "./style.css";
import { Camera4D, CPUProjector4D, createTesseract4D } from "four-camera";
import { ThreeLineAdapter } from "four-camera-three";
import {
  identityTransform4D,
  multiplyTransform4D,
  rotateXU,
  rotateYZ,
  rotateZU
} from "four-rotation";

const app = document.querySelector<HTMLDivElement>("#app");

if (app) {
  const mount = app;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setClearColor(0x07090d, 1);
  mount.replaceChildren(renderer.domElement);

  const scene = new THREE.Scene();
  const camera3 = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera3.position.set(0, 0, 6);

  const geometry4 = createTesseract4D({ size: 2 });
  const camera4 = new Camera4D({
    position: [0, 0, 0, -5.5],
    focalScale: [1.45, 1.45, 1.45],
    near: 0.05,
    far: 20,
    viewBoxScale: [2.4, 2.4, 2.4]
  });
  const projector = new CPUProjector4D({ clipping: "near-far" });
  const lineResult = projector.createLineResult(geometry4);

  const material = new THREE.LineBasicMaterial({
    color: 0x9ee7ff,
    transparent: true,
    opacity: 0.95
  });
  const lineAdapter = new ThreeLineAdapter({
    maxSegmentCount: geometry4.edgeCount ?? 0,
    boundsMode: "none",
    material
  });
  scene.add(lineAdapter.object);

  const rXU = identityTransform4D();
  const rYZ = identityTransform4D();
  const rZU = identityTransform4D();
  const tmp = identityTransform4D();
  const model4 = identityTransform4D();

  let rafId: number | null = null;

  function resize() {
    const width = mount.clientWidth || window.innerWidth;
    const height = mount.clientHeight || window.innerHeight;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height, false);
    camera3.aspect = width / Math.max(1, height);
    camera3.updateProjectionMatrix();
  }

  function update(timeMs: number) {
    const t = timeMs * 0.001;
    rotateXU(t * 0.45, rXU);
    rotateYZ(t * 0.31, rYZ);
    rotateZU(t * 0.22, rZU);
    multiplyTransform4D(rYZ, rXU, tmp);
    multiplyTransform4D(rZU, tmp, model4);

    projector.projectLines({
      geometry: geometry4,
      model: model4,
      camera: camera4,
      out: lineResult
    });
    lineAdapter.update(lineResult);
    lineAdapter.object.rotation.y = Math.sin(t * 0.2) * 0.12;
    lineAdapter.object.rotation.x = Math.cos(t * 0.17) * 0.08;
    renderer.render(scene, camera3);
  }

  function animate(timeMs: number) {
    rafId = requestAnimationFrame(animate);
    update(timeMs);
  }

  function start() {
    if (rafId === null) {
      rafId = requestAnimationFrame(animate);
    }
  }

  function stop() {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  function dispose() {
    stop();
    window.removeEventListener("resize", resize);
    lineAdapter.dispose();
    renderer.dispose();
  }

  resize();
  start();
  window.addEventListener("resize", resize);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop();
    else start();
  });
  window.addEventListener("beforeunload", dispose);
}
