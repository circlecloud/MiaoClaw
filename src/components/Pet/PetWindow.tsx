import { useRef, useEffect } from "react";
import { PetRenderer } from "./PetRenderer";
import { usePetStore } from "../../stores/petStore";
import { useClickThrough } from "../../hooks/useClickThrough";
import { listen } from "@tauri-apps/api/event";
import type { PetStyle } from "../../types";

/**
 * 宠物窗口 - 只在 pet 路由渲染，包含点击穿透逻辑
 */
export function PetWindow() {
  const { currentStyle, currentAnimation, setStyle } = usePetStore();
  const containerRef = useRef<HTMLDivElement>(null);

  useClickThrough(containerRef);

  // 监听设置窗口发来的风格切换事件
  useEffect(() => {
    const unlisten = listen<{ style: PetStyle }>("pet-style-changed", (event) => {
      setStyle(event.payload.style);
    });
    return () => { unlisten.then((fn) => fn()); };
  }, [setStyle]);

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
