import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import type { PetRendererProps, PetAnimation } from "../../types";
import { parsePQC } from "../../lib/pqcParser";
import { parseSMD, buildSkinnedMesh, buildAnimationClip } from "../../lib/smdParser";
import { CSSRenderer } from "./CSSRenderer";

const MODEL_BASE = "/pets/smd/lp8";

export function SMDRenderer(props: PetRendererProps) {
  const { animation, width, height, onInteractionStateChange } = props;
  const containerRef = useRef<HTMLDivElement>(null);
  const [loadError, setLoadError] = useState(false);
  const stateRef = useRef<{
    renderer?: THREE.WebGLRenderer;
    scene?: THREE.Scene;
    camera?: THREE.PerspectiveCamera;
    mixer?: THREE.AnimationMixer;
    clips: Map<string, THREE.AnimationClip>;
    currentAction?: THREE.AnimationAction;
    frameId?: number;
    pivot?: THREE.Group;
    // 视角控制
    rotY: number;
    rotX: number;
    dragging: boolean;
    lastMouse: { x: number; y: number };
  }>({ clips: new Map(), rotY: 0, rotX: 0, dragging: false, lastMouse: { x: 0, y: 0 } });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      preserveDrawingBuffer: true,
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, width / height, 0.1, 10000);

    scene.add(new THREE.AmbientLight(0xffffff, 2.0));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.5);
    dirLight.position.set(5, 10, 5);
    scene.add(dirLight);

    const state = stateRef.current;
    state.renderer = renderer;
    state.scene = scene;
    state.camera = camera;

    loadModel(state, scene, camera).catch((err) => {
      console.error("SMD 模型加载失败:", err);
      setLoadError(true);
    });

    // Ctrl+拖拽旋转视角
    const canvas = renderer.domElement;
    const onMouseDown = (e: MouseEvent) => {
      if (e.ctrlKey) {
        state.dragging = true;
        state.lastMouse = { x: e.clientX, y: e.clientY };
        onInteractionStateChange?.(true);
      }
    };
    const onMouseMove = (e: MouseEvent) => {
      if (!state.dragging || !state.pivot) return;
      const dx = e.clientX - state.lastMouse.x;
      const dy = e.clientY - state.lastMouse.y;
      state.rotY += dx * 0.01;
      state.rotX += dy * 0.01;
      state.rotX = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, state.rotX));
      state.pivot.rotation.y = state.rotY;
      state.pivot.rotation.x = state.rotX;
      state.lastMouse = { x: e.clientX, y: e.clientY };
    };
    const onMouseUp = () => { state.dragging = false; };

    canvas.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);

    const clock = new THREE.Clock();
    const animate = () => {
      state.frameId = requestAnimationFrame(animate);
      const delta = clock.getDelta();
      state.mixer?.update(delta);
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      if (state.frameId) cancelAnimationFrame(state.frameId);
      canvas.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      onInteractionStateChange?.(false);
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [width, height, onInteractionStateChange]);

  // 切换动画
  useEffect(() => {
    const state = stateRef.current;
    if (!state.mixer) return;

    const animName = mapAnimation(animation);
    const clip = state.clips.get(animName) || state.clips.get("idle");
    if (!clip) return;

    if (state.currentAction) {
      const newAction = state.mixer.clipAction(clip);
      newAction.reset();
      newAction.play();
      state.currentAction.crossFadeTo(newAction, 0.3, false);
      state.currentAction = newAction;
    }
  }, [animation]);

  if (loadError) {
    return <CSSRenderer {...props} />;
  }

  return <div ref={containerRef} style={{ width, height }} />;
}

function mapAnimation(anim: PetAnimation): string {
  switch (anim) {
    case "walk": return "walk";
    default: return "idle";
  }
}

async function loadModel(
  state: {
    mixer?: THREE.AnimationMixer;
    clips: Map<string, THREE.AnimationClip>;
    currentAction?: THREE.AnimationAction;
    pivot?: THREE.Group;
    rotY: number;
  },
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
) {
  const pqcResp = await fetch(`${MODEL_BASE}/8.pqc`);
  if (!pqcResp.ok) throw new Error(`PQC 加载失败: ${pqcResp.status}`);
  const config = parsePQC(await pqcResp.text());

  const bodyResp = await fetch(`${MODEL_BASE}/${config.body}`);
  if (!bodyResp.ok) throw new Error(`Body SMD 加载失败: ${bodyResp.status}`);
  const bodySMD = parseSMD(await bodyResp.text());

  const texture = await new THREE.TextureLoader().loadAsync(`${MODEL_BASE}/cresselia-lp.png`);
  texture.colorSpace = THREE.SRGBColorSpace;

  const { mesh } = buildSkinnedMesh(bodySMD, texture, config.scale);

  // 用 pivot group 包裹模型，方便旋转
  const pivot = new THREE.Group();
  pivot.add(mesh);
  scene.add(pivot);
  state.pivot = pivot;

  // 计算包围盒，自动适配相机
  const box = new THREE.Box3().setFromObject(mesh);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);

  // 把 pivot 原点移到模型中心
  pivot.position.set(-center.x, -center.y, -center.z);

  // 旋转模型到正面（SMD 模型默认朝向可能不对）
  // 先旋转 180 度让模型面向相机
  state.rotY = Math.PI;
  pivot.rotation.y = state.rotY;

  const fov = camera.fov * (Math.PI / 180);
  const dist = maxDim / (2 * Math.tan(fov / 2)) * 1.3;
  camera.position.set(0, 0, dist);
  camera.lookAt(0, 0, 0);
  camera.near = dist / 100;
  camera.far = dist * 100;
  camera.updateProjectionMatrix();

  // 动画
  const mixer = new THREE.AnimationMixer(mesh);
  state.mixer = mixer;

  for (const [name, file] of Object.entries(config.anims)) {
    try {
      const resp = await fetch(`${MODEL_BASE}/${file}`);
      if (!resp.ok) continue;
      const animSMD = parseSMD(await resp.text());
      const clip = buildAnimationClip(name, animSMD, bodySMD.bones, config.scale);
      state.clips.set(name, clip);
    } catch (err) {
      console.warn("[SMD] 动画加载失败:", name, err);
    }
  }

  const idleClip = state.clips.get("idle");
  if (idleClip) {
    const action = mixer.clipAction(idleClip);
    action.play();
    state.currentAction = action;
  }
}
