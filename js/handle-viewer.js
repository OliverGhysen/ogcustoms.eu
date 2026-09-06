// Interactive 3D handle lineup on the homepage. All three Draco-compressed GLBs
// (Mini / Tall / Trap Phone) sit side by side on a full-bleed sticky stage.
// Scroll first rotates Mini in place until it faces the camera, then pans
// across the lineup; Trap Phone holds centre while the leftover scroll rotates it away.
// Caption cards are projected beside each mesh.
// Three.js is only initialised once the viewer scrolls into view. The Draco
// decoder (wasm) is self-hosted under /draco/. Three.js itself is vendored under
// /js/vendor/three/ and resolved via the page's <script type="importmap">.

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

const MODELS = [
  { id: "mini", file: "mini" },
  { id: "tall", file: "tall" },
  { id: "trap_phone", file: "trap_phone" },
];

/** World-space gap between handle centres after the shared (largest-radius = 1) scale. */
const SPACING = 1.82;
/** Extra Y-rotation (radians) per handle-index away from the focused one. */
const PHASE = 1.15;
/** Extra scroll at each end, in world units. Converted to index and used for
 *  rotation-only so the first/last handle stay centred until they face the camera. */
const OVERSHOOT = 1.0;

export function initHandleViewer() {
  const viewer = document.getElementById("handle-viewer");
  const stage = document.getElementById("handle-stage");
  const pin = viewer?.closest(".viewer__pin");
  if (!viewer || !stage || !pin) return;

  const captions = MODELS.map((m) =>
    viewer.querySelector(`.viewer__caption[data-model="${m.id}"]`)
  );

  let handle = null;

  const start = () => {
    if (handle) return;
    try {
      handle = new HandleViewer(stage, pin, viewer, captions);
      void handle.loadAll();
    } catch {
      const note = document.createElement("div");
      note.className = "viewer__msg";
      note.style.display = "flex";
      note.textContent = "3D preview isn't supported on this device.";
      stage.appendChild(note);
    }
  };

  const io = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        io.disconnect();
        start();
      }
    },
    { threshold: 0.15 }
  );
  io.observe(stage);
}

class HandleViewer {
  loader = makeGltfLoader();
  models = [];
  ndc = new THREE.Vector3();
  reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  narrow = false;
  onScreen = true;
  dist = 3;
  scrollProgress = 0;
  progress = 0;

  constructor(container, pin, viewer, captions) {
    this.container = container;
    this.pin = pin;
    this.viewer = viewer;
    this.captions = captions;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0xfafafa, 1);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    const canvas = this.renderer.domElement;
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.display = "block";
    this.container.insertBefore(canvas, this.container.firstChild);

    this.msg = document.createElement("div");
    this.msg.className = "viewer__msg";
    this.container.appendChild(this.msg);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xfafafa);
    this.camera = new THREE.PerspectiveCamera(36, 1, 0.1, 1000);
    this.camera.position.set(0, 0.12, 3);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8a96, 0.45));
    const key = new THREE.DirectionalLight(0xffffff, 0.35);
    key.position.set(2, 3.5, 2);
    this.scene.add(key);

    this.resize();
    new ResizeObserver(() => this.resize()).observe(this.container);
    new IntersectionObserver(
      (entries) => {
        this.onScreen = entries[0]?.isIntersecting ?? true;
      },
      { threshold: 0 }
    ).observe(this.container);

    this.loop();
  }

  async loadAll() {
    this.setMsg("Loading…");
    try {
      const loaded = await Promise.all(MODELS.map((m) => this.loadOne(m.file)));
      this.disposeModels();
      const radii = loaded
        .map((g) => g?.userData.radius)
        .filter((r) => r != null);
      const maxRadius = Math.max(...radii, 1e-6);
      const scale = 1 / maxRadius;
      const bodyMat = new THREE.MeshStandardMaterial({
        color: 0xc4c7cc,
        metalness: 1,
        roughness: 0.2,
        envMapIntensity: 1.2,
        flatShading: true,
      });
      const padMat = new THREE.MeshStandardMaterial({
        color: 0x111111,
        metalness: 0,
        roughness: 0.9,
        envMapIntensity: 0.35,
        flatShading: true,
      });
      for (let i = 0; i < loaded.length; i++) {
        const group = loaded[i];
        if (!group) continue;
        group.scale.setScalar(scale);
        group.position.x = i * SPACING;
        group.userData.radius = group.userData.radius * scale;
        group.traverse((obj) => {
          if (!(obj instanceof THREE.Mesh)) return;
          const name = `${obj.name} ${obj.userData.role ?? ""}`.toLowerCase();
          obj.material = name.includes("pad") ? padMat : bodyMat;
        });
        this.scene.add(group);
        this.models.push(group);
      }
      if (this.models.length === 0) {
        this.setMsg("Couldn't load the 3D preview.");
        return;
      }
      this.frameToFit();
      this.readScroll();
      this.progress = this.scrollProgress;
      this.applyScroll(true);
      this.setMsg(null);
    } catch {
      this.setMsg("Couldn't load the 3D preview.");
    }
  }

  async loadOne(file) {
    const gltf = await this.loader.loadAsync(`/models/${file}.glb`);
    gltf.scene.updateMatrixWorld(true);
    const group = new THREE.Group();
    gltf.scene.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return;
      const geometry = obj.geometry.clone();
      geometry.applyMatrix4(obj.matrixWorld);
      // CAD parts come in Z-up; rotate to Y-up. Centring happens on the group
      // so Mini / Tall / Trap Phone keep true relative size.
      geometry.rotateX(-Math.PI / 2);
      const mesh = new THREE.Mesh(geometry);
      mesh.name = obj.name || (obj.parent?.name ?? "");
      group.add(mesh);
    });
    if (group.children.length === 0) return null;

    const kids = group.children.filter((c) => c instanceof THREE.Mesh);
    if (!kids.some((m) => m.name.toLowerCase().includes("pad")) && kids.length >= 2) {
      kids.sort(
        (a, b) =>
          (a.geometry.getAttribute("position")?.count ?? 0) -
          (b.geometry.getAttribute("position")?.count ?? 0)
      );
      kids[0].name = "pad";
    }

    const box = new THREE.Box3().setFromObject(group);
    const center = box.getCenter(new THREE.Vector3());
    for (const child of kids) {
      child.geometry.translate(-center.x, -center.y, -center.z);
      child.geometry.computeBoundingSphere();
    }
    const sphere = new THREE.Sphere();
    new THREE.Box3().setFromObject(group).getBoundingSphere(sphere);
    group.userData.radius = sphere.radius;
    return group;
  }

  stickyTop() {
    const top = parseFloat(getComputedStyle(this.viewer).top);
    return Number.isFinite(top) ? top : 0;
  }

  scrollRange() {
    const stickyTop = this.stickyTop();
    // Use the sticky viewer's own (vh-based) height rather than
    // window.innerHeight. On mobile the address bar show/hide changes
    // window.innerHeight and reflows the page as you enter/leave the section,
    // which would otherwise jitter scrollProgress and flicker the models.
    const viewportH = this.viewer.clientHeight + stickyTop;
    const total = this.pin.offsetHeight - viewportH + stickyTop;
    return { total, stickyTop };
  }

  readScroll() {
    const { total, stickyTop } = this.scrollRange();
    if (total <= 0) {
      this.scrollProgress = 0;
      return;
    }
    let actual = clamp((stickyTop - this.pin.getBoundingClientRect().top) / (total * 0.85), 0, 1);
    // Deadzone at both ends so residual jitter holds the models perfectly still
    // when the section is only partially on screen (top/bottom half).
    if (actual < 0.01) actual = 0;
    else if (actual > 0.99) actual = 1;
    this.scrollProgress = actual;
  }

  applyScroll(immediate = false) {
    if (this.models.length === 0) return;
    const target = this.scrollProgress;
    this.progress = immediate || this.reduceMotion ? target : this.progress + (target - this.progress) * 0.2;

    const maxI = MODELS.length - 1;
    const lead = OVERSHOOT / SPACING;
    const focusIndex = THREE.MathUtils.lerp(-lead, maxI + lead, this.progress);
    const focusX = clamp(focusIndex, 0, maxI) * SPACING;

    this.camera.position.set(focusX, 0.12, this.dist);
    this.camera.lookAt(focusX, 0, 0);

    for (let i = 0; i < this.models.length; i++) {
      this.models[i].rotation.y = (focusIndex - i) * PHASE;
    }

    this.updateCaptions(focusIndex);
  }

  updateCaptions(focusIndex) {
    const w = this.container.clientWidth || 1;
    const h = this.container.clientHeight || 1;
    for (let i = 0; i < this.models.length; i++) {
      const el = this.captions[i];
      const group = this.models[i];
      if (!el || !group) continue;
      const r = group.userData.radius ?? 1;
      if (this.narrow) {
        // Mobile: center the caption directly above the model.
        this.ndc.set(group.position.x, r * 0.85, 0);
        this.ndc.project(this.camera);
        const x = (this.ndc.x * 0.5 + 0.5) * w;
        const y = (-this.ndc.y * 0.5 + 0.5) * h;
        el.style.transform = `translate(${x}px, ${y}px) translate(-50%, calc(-100% - 6px))`;
      } else {
        // Desktop: track each model horizontally but keep a shared top line.
        this.ndc.set(group.position.x + r * 0.72, 0, 0);
        this.ndc.project(this.camera);
        const x = (this.ndc.x * 0.5 + 0.5) * w;
        const y = Math.round(h * 0.1);
        el.style.transform = `translate(${x}px, ${y}px) translate(10px, 0)`;
      }
      const d = Math.abs(focusIndex - i);
      el.style.opacity = String(clamp(1 - d * 0.55, 0, 1));
    }
  }

  resize() {
    this.narrow = window.matchMedia("(max-width: 768px)").matches;
    const w = this.container.clientWidth || 1;
    const h = this.container.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (this.models.length > 0) this.frameToFit();
  }

  loop = () => {
    requestAnimationFrame(this.loop);
    if (!this.onScreen) return;
    this.readScroll();
    this.applyScroll();
    this.renderer.render(this.scene, this.camera);
  };

  // Frame the largest (radius-1) handle; tighter than a full fit so the models
  // read large on the stage while neighbours still peek. Fit whichever axis is
  // tighter: landscape -> vertical binds (desktop unchanged); portrait -> the
  // horizontal FOV binds, so we pull the camera back to show the whole handle.
  frameToFit() {
    const R = 0.82;
    const halfFovY = (this.camera.fov * Math.PI) / 180 / 2;
    const halfFovX = Math.atan(Math.tan(halfFovY) * this.camera.aspect);
    this.dist = Math.max(R / Math.sin(halfFovY), R / Math.sin(halfFovX));
  }

  setMsg(text) {
    this.msg.textContent = text ?? "";
    this.msg.style.display = text ? "flex" : "none";
  }

  disposeModels() {
    for (const group of this.models) {
      this.scene.remove(group);
      group.traverse((obj) => {
        if (!(obj instanceof THREE.Mesh)) return;
        obj.geometry.dispose();
      });
    }
    this.models.length = 0;
  }
}

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

function makeGltfLoader() {
  const draco = new DRACOLoader();
  draco.setDecoderPath("/draco/");
  const loader = new GLTFLoader();
  loader.setDRACOLoader(draco);
  return loader;
}
