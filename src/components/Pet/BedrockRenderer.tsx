import { useEffect, useRef } from "react";
import type { PetRendererProps } from "../../types";

/**
 * Minecraft 基岩版模型渲染器
 * 使用 Three.js 渲染 .geo.json (基岩版几何格式) + 贴图
 *
 * 基岩版模型格式:
 * - 几何: .geo.json (Bedrock Entity Geometry)
 * - 贴图: .png
 * - 动画: .animation.json (Bedrock Animation)
 *
 * 资源目录结构:
 * assets/pets/bedrock/
 *   ├── model.geo.json
 *   ├── texture.png
 *   └── animations/
 *       ├── idle.animation.json
 *       ├── walk.animation.json
 *       └── ...
 */
export function BedrockRenderer({ animation, width, height }: PetRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // TODO: Three.js 初始化
    // 1. 创建 Scene, Camera (PerspectiveCamera), Renderer (WebGLRenderer, alpha: true)
    // 2. 解析 .geo.json → Three.js BufferGeometry
    //    - 基岩版格式: format_version, geometry[].bones[].cubes[]
    //    - 每个 cube → BoxGeometry, 应用 UV 映射
    // 3. 加载贴图 → MeshBasicMaterial
    // 4. 解析 .animation.json → AnimationClip
    //    - 基岩版动画: bones[].rotation/position/scale keyframes
    //    - 转换为 Three.js KeyframeTrack
    // 5. AnimationMixer 播放对应 animation 状态的动画
    // 6. 渲染循环

    return () => {
      // cleanup Three.js
    };
  }, [animation, width, height]);

  return (
    <div ref={containerRef} style={{ width, height }}>
      <div className="flex items-center justify-center h-full text-sm text-gray-400">
        ⛏️ Bedrock: {animation}
      </div>
    </div>
  );
}
