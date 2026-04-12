import { create } from "zustand";
import { api, ClipboardItem } from "../lib/tauri";
import { listen } from "@tauri-apps/api/event";

interface ClipboardState {
  items: ClipboardItem[];
  loading: boolean;

  load: () => Promise<void>;
  pin: (id: string, pinned: boolean) => Promise<void>;
  remove: (id: string) => Promise<void>;
  clearAll: () => Promise<void>;
  pasteItem: (id: string) => Promise<void>;
  startListening: () => void;
}

export const useClipboardStore = create<ClipboardState>((set, get) => ({
  items: [],
  loading: false,

  load: async () => {
    set({ loading: true });
    try {
      const items = await api.getRecentItems(100);
      set({ items });
    } finally {
      set({ loading: false });
    }
  },

  pin: async (id, pinned) => {
    await api.pinItem(id, pinned);
    set((s) => ({
      items: s.items.map((i) =>
        i.id === id ? { ...i, is_pinned: pinned } : i,
      ),
    }));
  },

  remove: async (id) => {
    await api.deleteItem(id);
    set((s) => ({
      items: s.items.filter((i) => i.id !== id),
    }));
  },

  clearAll: async () => {
    await api.clearHistory();
    set((s) => ({
      items: s.items.filter((i) => i.is_pinned),
    }));
  },

  pasteItem: async (id) => {
    const content = await api.getClipContent(id);
    await api.pasteToActiveApp(content);
  },

  startListening: () => {
    listen<{ id: string; preview: string; content_type: string }>(
      "clipboard-changed",
      (_event) => {
        get().load();
      },
    );
  },
}));
