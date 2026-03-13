import { useState } from "react";
import type { PetRendererProps, PetAnimation } from "../../types";

const ANIMATION_STYLES: Record<PetAnimation, string> = {
  idle: "animate-bounce-slow",
  walk: "animate-walk",
  talk: "animate-talk",
  sleep: "animate-sleep",
  happy: "animate-happy",
  sad: "animate-sad",
  think: "animate-think",
  wave: "animate-wave",
  eat: "animate-eat",
  custom: "",
};

/**
 * CSS 极简风渲染器 - 使用 pet.png，加载失败回退到 emoji
 */
export function CSSRenderer({ animation, width, height }: PetRendererProps) {
  const animClass = ANIMATION_STYLES[animation] || "";
  const [imgError, setImgError] = useState(false);

  return (
    <div
      className={`flex items-center justify-center select-none ${animClass}`}
      style={{ width, height }}
    >
      <div className="relative">
        {imgError ? (
          <span style={{ fontSize: width * 0.6 }}>🐱</span>
        ) : (
          <img
            src="/pets/pet.png"
            alt="MiaoClaw"
            draggable={false}
            onError={() => setImgError(true)}
            style={{ width: width * 0.85, height: height * 0.85, objectFit: "contain" }}
          />
        )}
        {animation === "talk" && (
          <div className="absolute -top-8 -right-4 bg-white rounded-lg px-2 py-1 text-xs shadow-md">
            💬
          </div>
        )}
        {animation === "sleep" && (
          <div className="absolute -top-6 right-0 text-lg animate-float">
            💤
          </div>
        )}
      </div>
    </div>
  );
}
