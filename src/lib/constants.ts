export const APP_NAME = "PasteFlow";
export const MAX_PREVIEW_LENGTH = 200;
export const SEARCH_DEBOUNCE_MS = 100;
export const PASTE_DELAY_MS = 50;
export const DEFAULT_HISTORY_LIMIT = 50;
export const CLIPBOARD_POLL_MS = 500;

export const PLATFORMS = [
  { id: "twitter", label: "Twitter/X", icon: "𝕏", maxLen: 280 },
  { id: "linkedin", label: "LinkedIn", icon: "in", maxLen: 1500 },
  { id: "email", label: "Email", icon: "✉", maxLen: null },
  { id: "facebook", label: "Facebook", icon: "f", maxLen: 800 },
] as const;
