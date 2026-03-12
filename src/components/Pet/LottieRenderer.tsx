import type { PetRendererProps } from "../../types";

/**
 * Lottie 矢量动画渲染器
 * 使用 AE 导出的 Lottie JSON，流畅矢量风格
 */
export function LottieRenderer({ animation, width, height }: PetRendererProps) {
  // TODO: 根据 animation 状态加载对应的 .lottie / .json 文件
  // - idle.json, walk.json, talk.json, sleep.json 等
  // - 使用 lottie-react 的 useLottie hook
  // - 支持自定义 Lottie 资源包

  return (
    <div
      style={{ width, height }}
      className="flex items-center justify-center"
    >
      <div className="text-2xl">🐱</div>
      <span className="text-xs text-gray-400">Lottie: {animation}</span>
    </div>
  );
}
