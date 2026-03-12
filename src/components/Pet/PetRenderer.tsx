import type { PetRendererProps } from "../../types";
import { PixiRenderer } from "./PixiRenderer";
import { LottieRenderer } from "./LottieRenderer";
import { Live2DRenderer } from "./Live2DRenderer";
import { CSSRenderer } from "./CSSRenderer";
import { BedrockRenderer } from "./BedrockRenderer";
import { SMDRenderer } from "./SMDRenderer";

/**
 * 宠物渲染器 - 根据 style 自动选择对应的渲染引擎
 * 所有渲染器实现相同的 PetRendererProps 接口
 */
export function PetRenderer(props: PetRendererProps) {
  switch (props.style) {
    case "pixel":
      return <PixiRenderer {...props} />;
    case "lottie":
      return <LottieRenderer {...props} />;
    case "live2d":
      return <Live2DRenderer {...props} />;
    case "css":
      return <CSSRenderer {...props} />;
    case "bedrock":
      return <BedrockRenderer {...props} />;
    case "smd":
      return <SMDRenderer {...props} />;
    default:
      return <CSSRenderer {...props} />;
  }
}
