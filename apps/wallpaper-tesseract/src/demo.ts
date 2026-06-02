import * as THREE from "three";
import "./style.css";
import "./camera-gizmo.css";
import { Camera4D, CPUProjector4D, createTesseract4D } from "four-camera";
import { ThreeLineAdapter } from "four-camera-three";
import {
  identityTransform4D,
  multiplyTransform4D,
  rotateXU,
  rotateYZ,
  rotateZU
} from "four-rotation";
import { Camera3Gizmo } from "./camera3-gizmo";
import { Camera3Rig } from "./camera3-rig";

const app = document.querySelector<HTMLDivElement>("#app");

if (app) {
  const mount = app;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setClearColor(0x07090d, 1);
  mount.replaceChildren(renderer.domElement);

  const scene = new THREE.Scene();
  const camera3 = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  const camera3Rig = new Camera3Rig({
    target: new THREE.Vector3(0, 0, 0),
    distance: 6
  });
  camera3Rig.updateCamera(camera3);
  const camera3Gizmo = new Camera3Gizmo({
    camera: camera3,
    rig: camera3Rig,
    parent: mount
  });

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
    camera3Rig.updateCamera(camera3);
    camera3Gizmo.update();
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
    camera3Gizmo.dispose();
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
