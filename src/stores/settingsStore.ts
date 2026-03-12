import { create } from "zustand";
import type { AppConfig, ProviderConfig } from "../types";

interface SettingsStore {
  config: AppConfig;
  isFirstRun: boolean;
  updateConfig: (partial: Partial<AppConfig>) => void;
  addProvider: (provider: ProviderConfig) => void;
  removeProvider: (id: string) => void;
  setFirstRun: (value: boolean) => void;
}

const defaultConfig: AppConfig = {
  providers: [],
  petStyle: "css",
  alwaysOnTop: true,
  autoStart: false,
  globalShortcut: "CommandOrControl+Shift+M",
  language: "zh-CN",
};

export const useSettingsStore = create<SettingsStore>((set) => ({
  config: defaultConfig,
  isFirstRun: true,

  updateConfig: (partial) =>
    set((state) => ({ config: { ...state.config, ...partial } })),

  addProvider: (provider) =>
    set((state) => ({
      config: {
        ...state.config,
        providers: [...state.config.providers, provider],
      },
    })),

  removeProvider: (id) =>
    set((state) => ({
      config: {
        ...state.config,
        providers: state.config.providers.filter((p) => p.id !== id),
      },
    })),

  setFirstRun: (value) => set({ isFirstRun: value }),
}));
