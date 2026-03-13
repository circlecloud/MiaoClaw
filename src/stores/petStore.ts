import { create } from "zustand";
import type { PetStyle, PetAnimation, PetState } from "../types";

interface PetStore extends PetState {
  setStyle: (style: PetStyle) => void;
  setAnimation: (animation: PetAnimation) => void;
  setPosition: (x: number, y: number) => void;
  setMood: (mood: number) => void;
}

export const usePetStore = create<PetStore>((set) => ({
  currentStyle: "smd",
  currentAnimation: "idle",
  positionX: 100,
  positionY: 100,
  mood: 1.0,

  setStyle: (style) => set({ currentStyle: style }),
  setAnimation: (animation) => set({ currentAnimation: animation }),
  setPosition: (x, y) => set({ positionX: x, positionY: y }),
  setMood: (mood) => set({ mood: Math.max(0, Math.min(1, mood)) }),
}));
