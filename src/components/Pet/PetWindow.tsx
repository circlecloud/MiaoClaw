import { useRef, useEffect, useCallback, useState } from "react";
import { PetRenderer } from "./PetRenderer";
import { usePetStore } from "../../stores/petStore";
import { useClickThrough } from "../../hooks/useClickThrough";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { PetStyle } from "../../types";

export function PetWindow() {
  const { currentStyle, currentAnimation, setStyle } = usePetStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const renderWrapRef = useRef<HTMLDivElement>(null);
  const ctrlHeld = useRef(false);
  const [interactionMode, setInteractionMode] = useState(false);

  useClickThrough(containerRef, !interactionMode);

  // 监听设置窗口发来的风格切换事件
  useEffect(() => {
    const unlisten = listen<{ style: PetStyle }>("pet-style-changed", (event) => {
      setStyle(event.payload.style);
    });
    return () => { unlisten.then((fn) => fn()); };
  }, [setStyle]);

  // Ctrl 键：进入 3D 交互模式，暂停 click-through
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Control" && !ctrlHeld.current) {
        ctrlHeld.current = true;
        setInteractionMode(true);
        invoke("pet_set_ignore_cursor", { ignore: false }).catch(() => {});
        if (renderWrapRef.current) {
          renderWrapRef.current.style.pointerEvents = "auto";
        }
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Control") {
        ctrlHeld.current = false;
        setInteractionMode(false);
        invoke("pet_set_ignore_cursor", { ignore: false }).catch(() => {});
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
    if (e.button === 0 && !interactionMode) {
      await getCurrentWindow().startDragging().catch(() => {});
    }
  }, [interactionMode]);

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
          onInteractionStateChange={(interactive) => {
            setInteractionMode(interactive || ctrlHeld.current);
          }}
        />
      </div>
    </div>
  );
}
