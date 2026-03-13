import { useRef } from "react";
import { PetRenderer } from "./PetRenderer";
import { usePetStore } from "../../stores/petStore";
import { useClickThrough } from "../../hooks/useClickThrough";

/**
 * 宠物窗口 - 只在 pet 路由渲染，包含点击穿透逻辑
 * 
 * 关键：渲染层 pointer-events: none，让拖拽事件穿透到外层容器。
 * useClickThrough 通过读取 canvas 像素 alpha 判断是否穿透到桌面。
 */
export function PetWindow() {
  const { currentStyle, currentAnimation } = usePetStore();
  const containerRef = useRef<HTMLDivElement>(null);

  useClickThrough(containerRef);

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      data-tauri-drag-region
      style={{
        // @ts-expect-error webkit vendor prefix
        WebkitAppRegion: "drag",
        cursor: "grab",
        backgroundColor: "transparent",
      }}
    >
      <div style={{ pointerEvents: "none" }}>
        <PetRenderer
          style={currentStyle}
          animation={currentAnimation}
          width={256}
          height={256}
        />
      </div>
    </div>
  );
}
