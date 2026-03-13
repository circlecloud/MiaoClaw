import { useRef } from "react";
import { PetRenderer } from "./PetRenderer";
import { usePetStore } from "../../stores/petStore";
import { useClickThrough } from "../../hooks/useClickThrough";

/**
 * 宠物窗口 - 只在 pet 路由渲染，包含点击穿透逻辑
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
      <PetRenderer
        style={currentStyle}
        animation={currentAnimation}
        width={256}
        height={256}
      />
    </div>
  );
}
