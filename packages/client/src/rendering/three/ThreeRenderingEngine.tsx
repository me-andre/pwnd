import type { ReactNode } from "react";
import type { RenderOptions, RenderingEngine } from "../RenderingEngine.js";
import { ThreeBoardScene } from "./ThreeBoardScene.js";

export class ThreeRenderingEngine implements RenderingEngine {
  render(options: RenderOptions): ReactNode {
    return <ThreeBoardScene {...options} />;
  }
}
