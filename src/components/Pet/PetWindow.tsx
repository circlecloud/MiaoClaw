import { useRef, useEffect, useCallback } from "react";
import { PetRenderer } from "./PetRenderer";
import { usePetStore } from "../../stores/petStore";
import { useClickThrough } from "../../hooks/useClickThrough";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { PetStyle } from "../../types";

export function PetWindow() {
  const { currentStyle, currentAnimation, setStyle } = usePetStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const renderWrapRef = useRef<HTMLDivElement>(null);
  const ctrlHeld = useRef(false);

  useClickThrough(containerRef);

  // 监听设置窗口发来的风格切换事件
  useEffect(() => {
    const unlisten = listen<{ style: PetStyle }>("pet-style-changed", (event) => {
      setStyle(event.payload.style);
    });
    return () => { unlisten.then((fn) => fn()); };
  }, [setStyle]);

  // Ctrl 键：切换渲染层 pointer-events，允许 canvas 交互（旋转视角）
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Control" && !ctrlHeld.current) {
        ctrlHeld.current = true;
        if (renderWrapRef.current) {
          renderWrapRef.current.style.pointerEvents = "auto";
        }
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Control") {
        ctrlHeld.current = false;
        if (renderWrapRef.current) {
          renderWrapRef.current.style.pointerEvents = "none";
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  // 拖拽：用 startDragging API，兼容所有平台
  const handleMouseDown = useCallback(async (e: React.MouseEvent) => {
    if (e.button === 0 && !ctrlHeld.current) {
      await getCurrentWindow().startDragging().catch(() => {});
    }
  }, []);

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      onMouseDown={handleMouseDown}
      style={{
        cursor: "grab",
        backgroundColor: "transparent",
      }}
    >
      <div ref={renderWrapRef} style={{ pointerEvents: "none" }}>
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
