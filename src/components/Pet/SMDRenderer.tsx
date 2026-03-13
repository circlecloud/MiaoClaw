import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { PetRendererProps, PetAnimation } from "../../types";
import { parsePQC } from "../../lib/pqcParser";
import { parseSMD, buildSkinnedMesh, buildAnimationClip } from "../../lib/smdParser";

const MODEL_BASE = "/pets/smd/lp8";

/**
 * SMD 模型渲染器
 * 使用 Three.js 渲染 Source Engine SMD 格式模型
 */
export function SMDRenderer({ animation, width, height }: PetRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<{
    renderer?: THREE.WebGLRenderer;
    scene?: THREE.Scene;
    camera?: THREE.PerspectiveCamera;
    mixer?: THREE.AnimationMixer;
    clips: Map<string, THREE.AnimationClip>;
    currentAction?: THREE.AnimationAction;
    frameId?: number;
  }>({ clips: new Map() });

  // 初始化场景
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, width / height, 0.1, 1000);
    camera.position.set(0, 3, 8);
    camera.lookAt(0, 2, 0);

    // 光照
    scene.add(new THREE.AmbientLight(0xffffff, 1.5));

    const state = stateRef.current;
    state.renderer = renderer;
    state.scene = scene;
    state.camera = camera;

    // 加载模型
    loadModel(state, scene).catch(console.error);

    // 渲染循环
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
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
  }, [width, height]);

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

  return <div ref={containerRef} style={{ width, height }} />;
}

function mapAnimation(anim: PetAnimation): string {
  switch (anim) {
    case "walk": return "walk";
    case "idle":
    default: return "idle";
  }
}

async function loadModel(
  state: NonNullable<typeof SMDRenderer extends (...args: unknown[]) => unknown ? never : {
    renderer?: THREE.WebGLRenderer;
    scene?: THREE.Scene;
    camera?: THREE.PerspectiveCamera;
    mixer?: THREE.AnimationMixer;
    clips: Map<string, THREE.AnimationClip>;
    currentAction?: THREE.AnimationAction;
    frameId?: number;
  }>,
  scene: THREE.Scene,
) {
  // 加载 PQC 配置
  const pqcResp = await fetch(`${MODEL_BASE}/8.pqc`);
  const pqcText = await pqcResp.text();
  const config = parsePQC(pqcText);

  // 加载参考模型 (body)
  const bodyResp = await fetch(`${MODEL_BASE}/${config.body}`);
  const bodyText = await bodyResp.text();
  const bodySMD = parseSMD(bodyText);

  // 加载贴图
  const texture = await new THREE.TextureLoader().loadAsync(
    `${MODEL_BASE}/cresselia-lp.png`,
  );
  texture.colorSpace = THREE.SRGBColorSpace;

  // 构建 SkinnedMesh
  const { mesh } = buildSkinnedMesh(bodySMD, texture, config.scale);
  scene.add(mesh);

  // 动画混合器
  const mixer = new THREE.AnimationMixer(mesh);
  state.mixer = mixer;

  // 加载动画
  for (const [name, file] of Object.entries(config.anims)) {
    const resp = await fetch(`${MODEL_BASE}/${file}`);
    const text = await resp.text();
    const animSMD = parseSMD(text);
    const clip = buildAnimationClip(name, animSMD, bodySMD.bones, config.scale);
    state.clips.set(name, clip);
  }

  // 播放 idle
  const idleClip = state.clips.get("idle");
  if (idleClip) {
    const action = mixer.clipAction(idleClip);
    action.play();
    state.currentAction = action;
  }
}
