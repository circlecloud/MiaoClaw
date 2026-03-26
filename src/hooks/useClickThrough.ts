import { useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";

interface PetCursorInfo {
  x: number;
  y: number;
  inside: boolean;
}

export function useClickThrough(
  containerRef: React.RefObject<HTMLElement | null>,
  suspendedRef: React.MutableRefObject<boolean>,
) {
  const ignoring = useRef(false);

  useEffect(() => {
    const interval = setInterval(async () => {
      if (suspendedRef.current) {
        if (ignoring.current) {
          ignoring.current = false;
          await invoke("pet_set_ignore_cursor", { ignore: false }).catch(() => {});
        }
        return;
      }

      const container = containerRef.current;
      if (!container) return;

      const cursor = await invoke<PetCursorInfo>("pet_cursor_info").catch(() => null);
      if (!cursor || !cursor.inside) {
        if (!ignoring.current) {
          ignoring.current = true;
          await invoke("pet_set_ignore_cursor", { ignore: true }).catch(() => {});
        }
        return;
      }

      const alpha = getAlphaAtPoint(container, cursor.x, cursor.y);
      const isTransparent = alpha === 0;

      if (isTransparent && !ignoring.current) {
        ignoring.current = true;
        await invoke("pet_set_ignore_cursor", { ignore: true }).catch(() => {});
      } else if (!isTransparent && ignoring.current) {
        ignoring.current = false;
        await invoke("pet_set_ignore_cursor", { ignore: false }).catch(() => {});
      }
    }, 50);

    return () => {
      clearInterval(interval);
      void invoke("pet_set_ignore_cursor", { ignore: false }).catch(() => {});
    };
  }, [containerRef, suspendedRef]);
}

function getAlphaAtPoint(container: HTMLElement, x: number, y: number): number {
  const canvas = container.querySelector("canvas");
  if (canvas) return getCanvasAlpha(canvas, x, y);

  const img = container.querySelector("img");
  if (img) return getImageAlpha(img, x, y);

  const el = document.elementFromPoint(x, y);
  if (!el || el === container || el === document.body || el === document.documentElement) {
    return 0;
  }

  for (const child of el.childNodes) {
    if (child.nodeType === Node.TEXT_NODE && child.textContent?.trim()) return 255;
  }

  const style = window.getComputedStyle(el);
  if (
    style.backgroundColor &&
    style.backgroundColor !== "transparent" &&
    style.backgroundColor !== "rgba(0, 0, 0, 0)"
  ) {
    return 255;
  }

  return 0;
}

function getCanvasAlpha(canvas: HTMLCanvasElement, x: number, y: number): number {
  try {
    const rect = canvas.getBoundingClientRect();
    const localX = x - rect.left;
    const localY = y - rect.top;
    if (localX < 0 || localY < 0 || localX >= rect.width || localY >= rect.height) return 0;

    const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
    if (gl) {
      const pixelX = Math.floor(localX * (canvas.width / rect.width));
      const pixelY = canvas.height - Math.floor(localY * (canvas.height / rect.height)) - 1;
      const pixel = new Uint8Array(4);
      gl.readPixels(pixelX, pixelY, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
      return pixel[3];
    }

    const ctx = canvas.getContext("2d");
    if (ctx) {
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const pixel = ctx.getImageData(
        Math.floor(localX * scaleX),
        Math.floor(localY * scaleY),
        1,
        1,
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
    if (localX < 0 || localY < 0 || localX >= rect.width || localY >= rect.height) return 0;

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
      1,
      1,
    ).data;
    return pixel[3];
  } catch {
    return 255;
  }
}
