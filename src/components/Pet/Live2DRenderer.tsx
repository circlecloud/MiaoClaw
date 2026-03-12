import { useEffect, useRef } from "react";
import type { PetRendererProps } from "../../types";

/**
 * Live2D 渲染器
 * 使用 pixi-live2d-display 渲染 Live2D 模型
 */
export function Live2DRenderer({ animation, width, height }: PetRendererProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // TODO: 初始化 Live2D
    // - 加载 .model3.json
    // - 使用 pixi-live2d-display 库
    // - 根据 animation 触发 Live2D motion
    // - 支持鼠标跟踪（眼球跟随）

    return () => {
      // cleanup
    };
  }, [animation, width, height]);

  return <canvas ref={canvasRef} width={width} height={height} />;
}
