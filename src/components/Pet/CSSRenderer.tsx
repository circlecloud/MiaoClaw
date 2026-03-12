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

const ANIMATION_EMOJI: Record<PetAnimation, string> = {
  idle: "🐱",
  walk: "🐱‍👤",
  talk: "😺",
  sleep: "😴",
  happy: "😸",
  sad: "😿",
  think: "🤔",
  wave: "👋",
  eat: "😋",
  custom: "🐱",
};

/**
 * CSS + SVG 极简风渲染器
 * 零外部依赖，纯 CSS 动画
 */
export function CSSRenderer({ animation, width, height }: PetRendererProps) {
  const animClass = ANIMATION_STYLES[animation] || "";
  const emoji = ANIMATION_EMOJI[animation] || "🐱";

  return (
    <div
      className={`flex items-center justify-center select-none ${animClass}`}
      style={{ width, height }}
    >
      <div className="relative">
        <span className="text-6xl drop-shadow-lg" role="img" aria-label="pet">
          {emoji}
        </span>
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
