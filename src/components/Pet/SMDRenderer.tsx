import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { PetRendererProps, PetAnimation } from "../../types";
import { parsePQC } from "../../lib/pqcParser";
import { parseSMD, buildSkinnedMesh, buildAnimationClip } from "../../lib/smdParser";

const MODEL_BASE = "/pets/smd/lp8";

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
    camera.position.set(0, 3, 8);
    camera.lookAt(0, 2, 0);

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
    });

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
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [width, height]);

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
    default: return "idle";
  }
}

async function loadModel(
  state: {
    mixer?: THREE.AnimationMixer;
    clips: Map<string, THREE.AnimationClip>;
    currentAction?: THREE.AnimationAction;
  },
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
) {
  console.log("[SMD] 开始加载模型...");

  const pqcResp = await fetch(`${MODEL_BASE}/8.pqc`);
  if (!pqcResp.ok) {
    throw new Error(`PQC 加载失败: ${pqcResp.status}`);
  }
  const pqcText = await pqcResp.text();
  const config = parsePQC(pqcText);
  console.log("[SMD] PQC 配置:", config);

  const bodyResp = await fetch(`${MODEL_BASE}/${config.body}`);
  if (!bodyResp.ok) {
    throw new Error(`Body SMD 加载失败: ${bodyResp.status}`);
  }
  const bodyText = await bodyResp.text();
  const bodySMD = parseSMD(bodyText);
  console.log("[SMD] Body 解析完成:", bodySMD.triangles.length, "个三角形,", bodySMD.bones.length, "个骨骼");

  const texture = await new THREE.TextureLoader().loadAsync(
    `${MODEL_BASE}/cresselia-lp.png`,
  );
  texture.colorSpace = THREE.SRGBColorSpace;
  console.log("[SMD] 贴图加载完成");

  const { mesh } = buildSkinnedMesh(bodySMD, texture, config.scale);
  scene.add(mesh);

  // 自动适配相机：计算模型包围盒
  const box = new THREE.Box3().setFromObject(mesh);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);

  console.log("[SMD] 模型包围盒 center:", center, "size:", size, "maxDim:", maxDim);

  // 相机对准模型中心，距离根据模型大小调整
  const fov = camera.fov * (Math.PI / 180);
  const dist = maxDim / (2 * Math.tan(fov / 2)) * 1.2;
  camera.position.set(center.x, center.y, center.z + dist);
  camera.lookAt(center);
  camera.near = dist / 100;
  camera.far = dist * 100;
  camera.updateProjectionMatrix();

  console.log("[SMD] 相机位置:", camera.position, "距离:", dist);

  // 动画
  const mixer = new THREE.AnimationMixer(mesh);
  state.mixer = mixer;

  for (const [name, file] of Object.entries(config.anims)) {
    try {
      const resp = await fetch(`${MODEL_BASE}/${file}`);
      if (!resp.ok) continue;
      const text = await resp.text();
      const animSMD = parseSMD(text);
      const clip = buildAnimationClip(name, animSMD, bodySMD.bones, config.scale);
      state.clips.set(name, clip);
      console.log("[SMD] 动画加载:", name, clip.duration.toFixed(2) + "s");
    } catch (err) {
      console.warn("[SMD] 动画加载失败:", name, err);
    }
  }

  const idleClip = state.clips.get("idle");
  if (idleClip) {
    const action = mixer.clipAction(idleClip);
    action.play();
    state.currentAction = action;
    console.log("[SMD] 播放 idle 动画");
  }

  console.log("[SMD] 模型加载完成");
}
