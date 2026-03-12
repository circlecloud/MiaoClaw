import { useEffect, useRef } from "react";
import type { PetRendererProps } from "../../types";

/**
 * PixiJS 像素风渲染器
 * 使用 Spritesheet 帧动画，经典像素宠物风格
 */
export function PixiRenderer({ animation, width, height, onAnimationEnd }: PetRendererProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // TODO: 初始化 PixiJS Application
    // - 加载 spritesheet (JSON + PNG)
    // - 创建 AnimatedSprite
    // - 根据 animation 状态切换帧序列
    // - 支持自定义 spritesheet 资源包

    return () => {
      // cleanup PixiJS
    };
  }, [animation, width, height]);

  useEffect(() => {
    // 动画状态切换时的处理
    // TODO: 切换 AnimatedSprite 的帧序列
    onAnimationEnd;
  }, [animation, onAnimationEnd]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{ imageRendering: "pixelated" }}
    />
  );
}
