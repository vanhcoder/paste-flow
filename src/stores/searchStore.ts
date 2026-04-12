import { create } from "zustand";
import { api, SearchResult } from "../lib/tauri";

interface SearchState {
  query: string;
  results: SearchResult[];
  loading: boolean;
  selectedIdx: number;

  setQuery: (query: string) => void;
  search: () => Promise<void>;
  moveSelection: (direction: "up" | "down") => void;
  reset: () => void;
}

export const useSearchStore = create<SearchState>((set, get) => ({
  query: "",
  results: [],
  loading: false,
  selectedIdx: 0,

  setQuery: (query) => {
    set({ query });
    get().search();
  },

  search: async () => {
    const { query } = get();
    set({ loading: true });
    try {
      if (!query.trim()) {
        const recent = await api.getRecentItems(10);
        const mapped: SearchResult[] = recent.map((i) => ({
          id: i.id,
          result_type: "history",
          title: i.source_app || "Clipboard",
          preview: i.content_preview || "",
          score: 0.5,
          group_name: null,
        }));
        set({ results: mapped });
      } else {
        const results = await api.searchAll(query, 15);
        set({ results });
      }
      set({ selectedIdx: 0 });
    } finally {
      set({ loading: false });
    }
  },

  moveSelection: (direction) => {
    const { selectedIdx, results } = get();
    if (results.length === 0) return;

    if (direction === "down") {
      set({ selectedIdx: (selectedIdx + 1) % results.length });
    } else {
      set({ selectedIdx: (selectedIdx - 1 + results.length) % results.length });
    }
  },

  reset: () => {
    set({ query: "", results: [], selectedIdx: 0 });
  },
}));
