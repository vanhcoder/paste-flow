import { create } from "zustand";
import { api, Template, TemplateGroup } from "../lib/tauri";

interface TemplateState {
  groups: TemplateGroup[];
  templates: Template[];
  loading: boolean;
  selectedGroupId: string | null;

  // Actions
  loadGroups: () => Promise<void>;
  loadTemplates: (group_id?: string | null) => Promise<void>;
  addGroup: (name: string, icon?: string, color?: string) => Promise<void>;
  addTemplate: (title: string, content: string, group_id?: string | null) => Promise<void>;
  removeTemplate: (id: string) => Promise<void>;
  moveTemplate: (id: string, group_id: string | null) => Promise<void>;
  pinTemplate: (id: string, pinned: boolean) => Promise<void>;
  setSelectedGroup: (groupId: string | null) => void;
}

export const useTemplateStore = create<TemplateState>((set, get) => ({
  groups: [],
  templates: [],
  loading: false,
  selectedGroupId: null,

  loadGroups: async () => {
    set({ loading: true });
    try {
      const groups = await api.listGroups();
      set({ groups });
    } finally {
      set({ loading: false });
    }
  },

  loadTemplates: async (group_id) => {
    set({ loading: true });
    try {
      const templates = await api.listTemplates(group_id || null);
      set({ templates });
    } finally {
      set({ loading: false });
    }
  },

  addGroup: async (name, icon, color) => {
    await api.createGroup(name, icon, color);
    await get().loadGroups();
  },

  addTemplate: async (title, content, group_id) => {
    await api.createTemplate(title, content, group_id || null);
    await get().loadTemplates(group_id || get().selectedGroupId || null);
  },

  removeTemplate: async (id) => {
    await api.deleteTemplate(id);
    await get().loadTemplates(get().selectedGroupId || null);
  },

  moveTemplate: async (id, group_id) => {
    await api.updateTemplate(id, undefined, undefined, group_id);
    await get().loadTemplates(get().selectedGroupId || null);
  },

  pinTemplate: async (id, pinned) => {
    await api.pinTemplate(id, pinned);
    await get().loadTemplates(get().selectedGroupId || null);
  },

  setSelectedGroup: (groupId) => {
    set({ selectedGroupId: groupId });
    get().loadTemplates(groupId);
  },
}));
