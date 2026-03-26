import { useRef, useEffect, useCallback, useState } from "react";
import { PetRenderer } from "./PetRenderer";
import { usePetStore } from "../../stores/petStore";
import { useClickThrough } from "../../hooks/useClickThrough";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import type { PetStyle } from "../../types";

export function PetWindow() {
  const { currentStyle, currentAnimation, setStyle } = usePetStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const renderWrapRef = useRef<HTMLDivElement>(null);

  const ctrlHeldRef = useRef(false);
  const modelInteractingRef = useRef(false);
  const interactionModeRef = useRef(false);

  const [interactionMode, setInteractionMode] = useState(false);
  const [ctrlActive, setCtrlActive] = useState(false);

  const syncInteractionMode = useCallback(() => {
    const active = ctrlHeldRef.current || modelInteractingRef.current;
    interactionModeRef.current = active;
    setInteractionMode(active);
  }, []);

  useClickThrough(containerRef, interactionModeRef);

  useEffect(() => {
    const unlisten = listen<{ style: PetStyle }>("pet-style-changed", (event) => {
      setStyle(event.payload.style);
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [setStyle]);

  useEffect(() => {
    const setCtrlMode = (active: boolean) => {
      ctrlHeldRef.current = active;
      setCtrlActive(active);
      void invoke("pet_set_ignore_cursor", { ignore: false }).catch(() => {});
      if (renderWrapRef.current) {
        renderWrapRef.current.style.pointerEvents = active ? "auto" : "none";
      }
      syncInteractionMode();
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Control" || ctrlHeldRef.current) return;
      console.debug("[PetWindow] Ctrl down");
      setCtrlMode(true);
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key !== "Control") return;
      console.debug("[PetWindow] Ctrl up");
      setCtrlMode(false);
    };

    // Windows 上如果先按 Ctrl 再把鼠标移到宠物上，窗口可能收不到 keydown
    // 用 mousemove 补一次 e.ctrlKey 检测
    const onMouseMove = (e: MouseEvent) => {
      if (e.ctrlKey && !ctrlHeldRef.current) {
        setCtrlMode(true);
      } else if (!e.ctrlKey && ctrlHeldRef.current && !modelInteractingRef.current) {
        setCtrlMode(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("mousemove", onMouseMove);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("mousemove", onMouseMove);
    };
  }, [syncInteractionMode]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      data-tauri-drag-region={!interactionMode ? true : undefined}
      style={{
        // @ts-expect-error webkit vendor prefix
        WebkitAppRegion: interactionMode ? "no-drag" : "drag",
        cursor: ctrlActive ? "move" : "grab",
        backgroundColor: "transparent",
      }}
    >
      <div
        ref={renderWrapRef}
        style={{
          pointerEvents: interactionMode ? "auto" : "none",
          // @ts-expect-error webkit vendor prefix
          WebkitAppRegion: "no-drag",
        }}
      >
        <PetRenderer
          style={currentStyle}
          animation={currentAnimation}
          width={256}
          height={256}
          onInteractionStateChange={(interactive) => {
            modelInteractingRef.current = interactive;
            if (interactive) {
              interactionModeRef.current = true;
              void invoke("pet_set_ignore_cursor", { ignore: false }).catch(() => {});
            }
            syncInteractionMode();
          }}
        />
      </div>
    </div>
  );
}
