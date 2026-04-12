import { create } from "zustand";
import { api, QueueStatus, QueueMode } from "../lib/tauri";
import { listen } from "@tauri-apps/api/event";

interface QueueState {
  status: QueueStatus;
  loading: boolean;

  fetchStatus: () => Promise<void>;
  toggleMode: () => Promise<void>;
  pasteNext: () => Promise<void>;
  skip: () => Promise<void>;
  cancel: () => Promise<void>;
}

export const useQueueStore = create<QueueState>((set) => ({
  status: {
    mode: "Off",
    total: 0,
    remaining: 0,
    all_items: [],
    next_preview: null,
  },
  loading: false,

  fetchStatus: async () => {
    try {
      const status = await api.getQueueStatus();
      set({ status });
    } catch (e) {
      console.error("Failed to fetch queue status:", e);
    }
  },

  toggleMode: async () => {
    try {
      await api.toggleQueueMode();
      const status = await api.getQueueStatus();
      set({ status });
    } catch (e) {
      console.error("Failed to toggle queue mode:", e);
    }
  },

  pasteNext: async () => {
    try {
      await api.queuePasteNext();
      // Status update will come via event listener or we can fetch manually
      const status = await api.getQueueStatus();
      set({ status });
    } catch (e) {
      console.error("Failed to paste next in queue:", e);
    }
  },

  skip: async () => {
    try {
      await api.skipQueueItem();
      const status = await api.getQueueStatus();
      set({ status });
    } catch (e) {
      console.error("Failed to skip item in queue:", e);
    }
  },

  cancel: async () => {
    try {
      await api.cancelQueue();
      const status = await api.getQueueStatus();
      set({ status });
    } catch (e) {
      console.error("Failed to cancel queue:", e);
    }
  },
}));

// Listeners removed - moved to QueueIndicator.tsx for more reliable window-specific updates
