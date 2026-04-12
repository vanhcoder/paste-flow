import { create } from "zustand";
import { api } from "../lib/tauri";

interface SettingsState {
  settings: Record<string, string | null>;
  loading: boolean;

  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, getState) => ({
  settings: {},
  loading: false,

  get: async (key) => {
    const cached = getState().settings[key];
    if (cached !== undefined) return cached;

    const value = await api.getSetting(key);
    set((s) => ({
      settings: { ...s.settings, [key]: value },
    }));
    return value;
  },

  set: async (key, value) => {
    await api.setSetting(key, value);
    set((s) => ({
      settings: { ...s.settings, [key]: value },
    }));
  },
}));
