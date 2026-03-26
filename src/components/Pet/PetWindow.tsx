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

  const ctrlHeldRef = useRef(false);
  const windowDraggingRef = useRef(false);
  const modelInteractingRef = useRef(false);

  const [interactionMode, setInteractionMode] = useState(false);

  const syncInteractionMode = useCallback(() => {
    const active =
      ctrlHeldRef.current || windowDraggingRef.current || modelInteractingRef.current;
    setInteractionMode(active);
  }, []);

  useClickThrough(containerRef, !interactionMode);

  useEffect(() => {
    const unlisten = listen<{ style: PetStyle }>("pet-style-changed", (event) => {
      setStyle(event.payload.style);
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [setStyle]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Control" || ctrlHeldRef.current) return;
      ctrlHeldRef.current = true;
      void invoke("pet_set_ignore_cursor", { ignore: false }).catch(() => {});
      if (renderWrapRef.current) {
        renderWrapRef.current.style.pointerEvents = "auto";
      }
      syncInteractionMode();
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key !== "Control") return;
      ctrlHeldRef.current = false;
      console.debug("[PetWindow] Ctrl up");
      void invoke("pet_set_ignore_cursor", { ignore: false }).catch(() => {});
      if (renderWrapRef.current) {
        renderWrapRef.current.style.pointerEvents = "none";
      }
      syncInteractionMode();
    };

    const clearWindowDragging = () => {
      if (windowDraggingRef.current) {
        console.debug("[PetWindow] window drag end");
        windowDraggingRef.current = false;
        syncInteractionMode();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("mouseup", clearWindowDragging);
    window.addEventListener("blur", clearWindowDragging);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("mouseup", clearWindowDragging);
      window.removeEventListener("blur", clearWindowDragging);
    };
  }, [syncInteractionMode]);

  const handleMouseDownCapture = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    if (ctrlHeldRef.current || modelInteractingRef.current) return;

    console.debug("[PetWindow] start window drag", {
      ctrl: ctrlHeldRef.current,
      modelInteracting: modelInteractingRef.current,
    });

    windowDraggingRef.current = true;
    syncInteractionMode();
    e.preventDefault();

    // 不等待，避免丢失原生拖动手势
    void invoke("pet_set_ignore_cursor", { ignore: false }).catch(() => {});
    void getCurrentWindow()
      .startDragging()
      .catch((err) => {
        console.debug("[PetWindow] startDragging failed", err);
        windowDraggingRef.current = false;
        syncInteractionMode();
      });
  }, [syncInteractionMode]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      onMouseDownCapture={handleMouseDownCapture}
      style={{
        cursor: ctrlHeldRef.current ? "move" : "grab",
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
            modelInteractingRef.current = interactive;
            if (interactive) {
              void invoke("pet_set_ignore_cursor", { ignore: false }).catch(() => {});
            }
            syncInteractionMode();
          }}
        />
      </div>
    </div>
  );
}
