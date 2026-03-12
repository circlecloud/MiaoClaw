import { useEffect, useRef } from "react";
import type { PetRendererProps } from "../../types";

/**
 * SMD (StudioMdl Data) 模型渲染器
 * 使用 Three.js 渲染 Source Engine 的 SMD 格式模型
 *
 * SMD 格式:
 * - 参考骨骼: nodes section
 * - 骨骼动画: skeleton section (每帧的骨骼变换)
 * - 网格: triangles section (顶点、法线、UV、骨骼权重)
 *
 * 资源目录结构:
 * assets/pets/smd/
 *   ├── reference.smd    (参考姿势 + 网格)
 *   ├── texture.png
 *   └── animations/
 *       ├── idle.smd
 *       ├── walk.smd
 *       └── ...
 */
export function SMDRenderer({ animation, width, height }: PetRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // TODO: Three.js 初始化
    // 1. 解析 reference.smd:
    //    - nodes → Bone hierarchy (Three.js Skeleton)
    //    - skeleton → 参考姿势 (bind pose)
    //    - triangles → SkinnedMesh (顶点、法线、UV、skinWeights/skinIndices)
    // 2. 加载贴图 → MeshBasicMaterial
    // 3. 解析动画 .smd:
    //    - skeleton section → AnimationClip
    //    - 每个 time block → keyframe
    //    - 骨骼 position/rotation → KeyframeTrack
    // 4. AnimationMixer 播放对应 animation 状态
    // 5. 渲染循环

    return () => {
      // cleanup Three.js
    };
  }, [animation, width, height]);

  return (
    <div ref={containerRef} style={{ width, height }}>
      <div className="flex items-center justify-center h-full text-sm text-gray-400">
        🎮 SMD: {animation}
      </div>
    </div>
  );
}
