import { invoke } from "@tauri-apps/api/core";
import type { AppConfig, ValidateResult } from "../types";

export const configAPI = {
  get: () => invoke<AppConfig>("config_get"),
  update: (config: AppConfig) => invoke<void>("config_update", { config }),
  patch: (patch: Partial<AppConfig>) => invoke<AppConfig>("config_patch", { patch }),
  isFirstRun: () => invoke<boolean>("config_is_first_run"),
  validateProvider: (baseUrl: string, apiKey: string | null, providerType: string) =>
    invoke<ValidateResult>("config_validate_provider", { baseUrl, apiKey, providerType }),
};

export const aiAPI = {
  sendMessage: (messages: { role: string; content: string }[], options: Record<string, unknown>, providerId?: string) =>
    invoke<string>("ai_send_message", { messages, options, providerId }),
  listProviders: () => invoke<string[]>("ai_list_providers"),
};
