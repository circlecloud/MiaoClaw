import { useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";

/**
 * 让窗口透明像素区域点击穿透。
 *
 * 原理：每 50ms 检测鼠标位置下方的像素是否透明。
 * - 找到容器内的 canvas/img 元素，读取该坐标的像素 alpha
 * - alpha > 0 → 关闭穿透（可拖拽）
 * - alpha = 0 → 开启穿透（点击到桌面）
 */
export function useClickThrough(
  containerRef: React.RefObject<HTMLElement | null>,
  enabled: boolean,
) {
  const ignoring = useRef(false);
  const lastPos = useRef({ x: -1, y: -1 });

  useEffect(() => {
    if (!enabled) {
      if (ignoring.current) {
        ignoring.current = false;
        invoke("pet_set_ignore_cursor", { ignore: false }).catch(() => {});
      }
      return;
    }

    const onMouseMove = (e: MouseEvent) => {
      lastPos.current = { x: e.clientX, y: e.clientY };
    };

    const interval = setInterval(async () => {
      const { x, y } = lastPos.current;
      if (x < 0 || y < 0) return;

      const container = containerRef.current;
      if (!container) return;

      const alpha = getAlphaAtPoint(container, x, y);
      const isTransparent = alpha === 0;

      if (isTransparent && !ignoring.current) {
        ignoring.current = true;
        await invoke("pet_set_ignore_cursor", { ignore: true }).catch(() => {});
      } else if (!isTransparent && ignoring.current) {
        ignoring.current = false;
        await invoke("pet_set_ignore_cursor", { ignore: false }).catch(() => {});
      }
    }, 50);

    document.addEventListener("mousemove", onMouseMove);

    return () => {
      clearInterval(interval);
      document.removeEventListener("mousemove", onMouseMove);
      invoke("pet_set_ignore_cursor", { ignore: false }).catch(() => {});
    };
  }, [containerRef, enabled]);
}

/**
 * 获取容器内指定坐标的像素 alpha 值
 */
function getAlphaAtPoint(container: HTMLElement, x: number, y: number): number {
  // 1. 尝试从 canvas 读取（Three.js / PixiJS 渲染器）
  const canvas = container.querySelector("canvas");
  if (canvas) {
    return getCanvasAlpha(canvas, x, y);
  }

  // 2. 尝试从 img 读取
  const img = container.querySelector("img");
  if (img) {
    return getImageAlpha(img, x, y);
  }

  // 3. 回退：检查 elementFromPoint
  const el = document.elementFromPoint(x, y);
  if (!el || el === container || el === document.body || el === document.documentElement) {
    return 0;
  }

  // 有文字内容
  for (const child of el.childNodes) {
    if (child.nodeType === Node.TEXT_NODE && child.textContent?.trim()) {
      return 255;
    }
  }

  const style = window.getComputedStyle(el);
  if (style.backgroundColor && style.backgroundColor !== "transparent" && style.backgroundColor !== "rgba(0, 0, 0, 0)") {
    return 255;
  }

  return 0;
}

function getCanvasAlpha(canvas: HTMLCanvasElement, x: number, y: number): number {
  try {
    const rect = canvas.getBoundingClientRect();
    const localX = x - rect.left;
    const localY = y - rect.top;

    if (localX < 0 || localY < 0 || localX >= rect.width || localY >= rect.height) {
      return 0;
    }

    // Three.js 用 WebGL context
    const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
    if (gl) {
      const pixelX = Math.floor(localX * (canvas.width / rect.width));
      const pixelY = canvas.height - Math.floor(localY * (canvas.height / rect.height)) - 1; // WebGL Y 翻转
      const pixel = new Uint8Array(4);
      gl.readPixels(pixelX, pixelY, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
      return pixel[3];
    }

    // 2D context fallback
    const ctx = canvas.getContext("2d");
    if (ctx) {
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const pixel = ctx.getImageData(
        Math.floor(localX * scaleX),
        Math.floor(localY * scaleY),
        1, 1
      ).data;
      return pixel[3];
    }

    return 255;
  } catch {
    return 255;
  }
}

function getImageAlpha(img: HTMLImageElement, x: number, y: number): number {
  try {
    const rect = img.getBoundingClientRect();
    const localX = x - rect.left;
    const localY = y - rect.top;

    if (localX < 0 || localY < 0 || localX >= rect.width || localY >= rect.height) {
      return 0;
    }

    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth || rect.width;
    canvas.height = img.naturalHeight || rect.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return 255;

    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const pixel = ctx.getImageData(
      Math.floor(localX * scaleX),
      Math.floor(localY * scaleY),
      1, 1
    ).data;
    return pixel[3];
  } catch {
    return 255;
  }
}
