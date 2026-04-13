/// Platform abstraction layer for PasteFlow.
///
/// All OS-specific operations (focus management, keystroke simulation,
/// window transparency) are routed through this module so the rest of
/// the codebase stays platform-agnostic.
///
/// Adding a new platform:
///   1. Create `src/platform/<os>_impl.rs`
///   2. Add a `#[cfg]` mod declaration + re-export block below
///   3. Implement every function in the public API section
///   4. Add any required crates to `Cargo.toml` behind `[target.'cfg(...)'.dependencies]`

// ── Opaque window handle ──────────────────────────────────────────────────────

/// An opaque handle to a foreground window / focused application.
///
/// Interpretation is platform-specific:
///   - Windows : HWND   cast to `isize`
///   - macOS   : pid_t  cast to `isize`  (TODO — see macos_impl.rs)
///   - Linux   : X11 Window (XID) cast to `isize`  (TODO — see linux_impl.rs)
///
/// Always check against `NULL_WINDOW` before using; a null value means
/// "could not capture" or "platform not yet implemented".
pub type WindowHandle = isize;

/// Sentinel: no window captured, or platform not yet supported.
pub const NULL_WINDOW: WindowHandle = 0;

// ── Per-platform implementations ──────────────────────────────────────────────

#[cfg(target_os = "windows")]
mod windows_impl;

#[cfg(target_os = "macos")]
mod macos_impl;

#[cfg(target_os = "linux")]
mod linux_impl;

// ── Re-export unified API ─────────────────────────────────────────────────────

#[cfg(target_os = "windows")]
pub use windows_impl::{get_active_window, restore_window_focus, simulate_paste};

#[cfg(target_os = "macos")]
pub use macos_impl::{get_active_window, restore_window_focus, simulate_paste};

#[cfg(target_os = "linux")]
pub use linux_impl::{get_active_window, restore_window_focus, simulate_paste};
