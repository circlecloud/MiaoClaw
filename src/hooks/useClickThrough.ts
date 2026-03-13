import { useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";

/**
 * 让窗口透明区域点击穿透，只有宠物内容区域可交互。
 *
 * 原理：定时检测鼠标位置下方是否有实际内容元素，
 * - 有内容 → 关闭穿透（可拖拽/交互）
 * - 无内容（透明区域）→ 开启穿透（点击到下层窗口）
 *
 * 用 setInterval 而非 mousemove，因为 ignore 状态下收不到 mousemove。
 */
export function useClickThrough(containerRef: React.RefObject<HTMLElement | null>) {
  const ignoring = useRef(false);

  useEffect(() => {
    let lastX = 0;
    let lastY = 0;

    const onMouseMove = (e: MouseEvent) => {
      lastX = e.clientX;
      lastY = e.clientY;
    };

    const interval = setInterval(async () => {
      const el = document.elementFromPoint(lastX, lastY);
      const container = containerRef.current;

      const isOnContent = el !== null
        && el !== container
        && el !== document.body
        && el !== document.documentElement
        && el.id !== "root"
        && container?.contains(el) === true;

      if (isOnContent && ignoring.current) {
        ignoring.current = false;
        await invoke("pet_set_ignore_cursor", { ignore: false }).catch(() => {});
      } else if (!isOnContent && !ignoring.current) {
        ignoring.current = true;
        await invoke("pet_set_ignore_cursor", { ignore: true }).catch(() => {});
      }
    }, 50);

    document.addEventListener("mousemove", onMouseMove);

    return () => {
      clearInterval(interval);
      document.removeEventListener("mousemove", onMouseMove);
      invoke("pet_set_ignore_cursor", { ignore: false }).catch(() => {});
    };
  }, [containerRef]);
}
