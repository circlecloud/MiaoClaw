import { create } from "zustand";
import type { AppConfig, ProviderEntry } from "../types";

interface SettingsStore {
  config: AppConfig;
  isFirstRun: boolean;
  updateConfig: (partial: Partial<AppConfig>) => void;
  updatePet: (partial: Partial<AppConfig["pet"]>) => void;
  addProvider: (id: string, entry: ProviderEntry) => void;
  removeProvider: (id: string) => void;
  setFirstRun: (value: boolean) => void;
}

const defaultConfig: AppConfig = {
  identity: { name: "MiaoClaw", theme: "可爱的桌面宠物猫", emoji: "🐱" },
  models: { fallbacks: [], providers: {} },
  channels: {},
  plugins: { dirs: [], config: {} },
  pet: {
    style: "smd",
    alwaysOnTop: true,
    autoStart: false,
    globalShortcut: "CommandOrControl+Shift+M",
  },
};

export const useSettingsStore = create<SettingsStore>((set) => ({
  config: defaultConfig,
  isFirstRun: true,

  updateConfig: (partial) =>
    set((state) => ({ config: { ...state.config, ...partial } })),

  updatePet: (partial) =>
    set((state) => ({
      config: { ...state.config, pet: { ...state.config.pet, ...partial } },
    })),

  addProvider: (id, entry) =>
    set((state) => ({
      config: {
        ...state.config,
        models: {
          ...state.config.models,
          providers: { ...state.config.models.providers, [id]: entry },
        },
      },
    })),

  removeProvider: (id) =>
    set((state) => {
      const { [id]: _, ...rest } = state.config.models.providers;
      return {
        config: {
          ...state.config,
          models: { ...state.config.models, providers: rest },
        },
      };
    }),

  setFirstRun: (value) => set({ isFirstRun: value }),
}));
