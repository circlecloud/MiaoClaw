import { useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";

/**
 * 让窗口透明像素区域点击穿透。
 * 
 * 原理：每 50ms 用 canvas 截取鼠标位置的像素，
 * 检测 alpha 值，alpha=0 则穿透，否则可交互。
 */
export function useClickThrough(containerRef: React.RefObject<HTMLElement | null>) {
  const ignoring = useRef(false);
  const lastPos = useRef({ x: -1, y: -1 });

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      lastPos.current = { x: e.clientX, y: e.clientY };
    };

    const checkPixel = async () => {
      const { x, y } = lastPos.current;
      if (x < 0 || y < 0) return;

      const isTransparent = getPixelAlpha(x, y) === 0;

      if (isTransparent && !ignoring.current) {
        ignoring.current = true;
        await invoke("pet_set_ignore_cursor", { ignore: true }).catch(() => {});
      } else if (!isTransparent && ignoring.current) {
        ignoring.current = false;
        await invoke("pet_set_ignore_cursor", { ignore: false }).catch(() => {});
      }
    };

    const interval = setInterval(checkPixel, 50);
    document.addEventListener("mousemove", onMouseMove);

    return () => {
      clearInterval(interval);
      document.removeEventListener("mousemove", onMouseMove);
      invoke("pet_set_ignore_cursor", { ignore: false }).catch(() => {});
    };
  }, [containerRef]);
}

/**
 * 获取屏幕坐标 (x, y) 处的像素 alpha 值。
 * 使用 html2canvas 的思路：遍历该坐标下所有元素，
 * 检查是否有可见的非透明内容。
 */
function getPixelAlpha(x: number, y: number): number {
  // 获取该坐标下的所有元素
  const elements = document.elementsFromPoint(x, y);

  for (const el of elements) {
    // 跳过容器/body/html/root
    if (
      el === document.body ||
      el === document.documentElement ||
      el.id === "root"
    ) {
      continue;
    }

    // 检查元素是否有可见背景
    const style = window.getComputedStyle(el);
    const bg = style.backgroundColor;
    const bgImage = style.backgroundImage;
    const opacity = parseFloat(style.opacity);

    if (opacity === 0) continue;

    // 有背景图片
    if (bgImage && bgImage !== "none") return 255;

    // 有非透明背景色
    if (bg && bg !== "transparent" && bg !== "rgba(0, 0, 0, 0)") return 255;

    // 是 img/canvas/svg/video 元素
    const tag = el.tagName.toLowerCase();
    if (tag === "img" || tag === "svg" || tag === "video") {
      return getImageAlphaAt(el as HTMLElement, x, y);
    }
    if (tag === "canvas") {
      return getCanvasAlphaAt(el as HTMLCanvasElement, x, y);
    }

    // 有文字内容（emoji 等）
    if (el.childNodes.length > 0) {
      for (const child of el.childNodes) {
        if (child.nodeType === Node.TEXT_NODE && child.textContent?.trim()) {
          return 255;
        }
      }
    }

    // span/div 有 role="img"（emoji 渲染）
    if (el.getAttribute("role") === "img") return 255;
  }

  return 0;
}

/**
 * 对 img/svg 元素，绘制到临时 canvas 检测像素 alpha
 */
function getImageAlphaAt(el: HTMLElement, x: number, y: number): number {
  try {
    const rect = el.getBoundingClientRect();
    const localX = x - rect.left;
    const localY = y - rect.top;

    if (localX < 0 || localY < 0 || localX >= rect.width || localY >= rect.height) {
      return 0;
    }

    const canvas = document.createElement("canvas");
    canvas.width = rect.width;
    canvas.height = rect.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return 255;

    if (el instanceof HTMLImageElement) {
      ctx.drawImage(el, 0, 0, rect.width, rect.height);
    } else {
      // SVG 等无法直接 drawImage，视为不透明
      return 255;
    }

    const pixel = ctx.getImageData(Math.floor(localX), Math.floor(localY), 1, 1).data;
    return pixel[3]; // alpha
  } catch {
    return 255; // 跨域等错误，视为不透明
  }
}

/**
 * 对 canvas 元素直接读取像素
 */
function getCanvasAlphaAt(canvas: HTMLCanvasElement, x: number, y: number): number {
  try {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const localX = Math.floor((x - rect.left) * scaleX);
    const localY = Math.floor((y - rect.top) * scaleY);

    const ctx = canvas.getContext("2d");
    if (!ctx) return 255;

    const pixel = ctx.getImageData(localX, localY, 1, 1).data;
    return pixel[3];
  } catch {
    return 255;
  }
}
