export type Theme = "system" | "light" | "dark";

const STORAGE_KEY = "pasteflow-theme";

function getSystemPreference(): "light" | "dark" {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function applyTheme(theme: Theme) {
  const resolved = theme === "system" ? getSystemPreference() : theme;
  document.documentElement.classList.toggle("dark", resolved === "dark");
}

export function getSavedTheme(): Theme {
  return (localStorage.getItem(STORAGE_KEY) as Theme) ?? "system";
}

export function saveTheme(theme: Theme) {
  localStorage.setItem(STORAGE_KEY, theme);
  applyTheme(theme);
}

/** Call once at startup to restore saved preference and react to OS changes. */
export function initTheme() {
  const theme = getSavedTheme();
  applyTheme(theme);

  // Track OS dark/light changes when on "system" preference.
  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", () => {
      if (getSavedTheme() === "system") applyTheme("system");
    });

  // Sync theme changes made in OTHER windows (e.g. main → quick-paste).
  // The "storage" event fires in every window EXCEPT the one that wrote the value.
  window.addEventListener("storage", (e) => {
    if (e.key === "pasteflow-theme") applyTheme(getSavedTheme());
  });
}
