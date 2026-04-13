/// Linux implementation of the platform abstraction layer.
///
/// ┌─────────────────────────────────────────────────────────────────────────┐
/// │  STATUS: PARTIAL STUB                                                   │
/// │  • `simulate_paste` works on X11 (requires xdotool) and partially      │
/// │    on Wayland (requires ydotool + ydotoold daemon).                     │
/// │  • `get_active_window` / `restore_window_focus` are not yet implemented │
/// │    (Wayland has no global focus API; X11 path is commented out).        │
/// └─────────────────────────────────────────────────────────────────────────┘
///
/// Required Cargo.toml additions for full X11 implementation:
///
///   [target.'cfg(target_os = "linux")'.dependencies]
///   x11rb = { version = "0.13", features = ["allow-unsafe-code"] }
///
/// Runtime dependencies (installed by the user / distro package manager):
///   X11     → xdotool  (paste simulation)
///   Wayland → ydotool + ydotoold daemon  (requires /dev/uinput permissions)
///             OR wtype (wlroots compositors only)
///
/// Display server detection at runtime: check $WAYLAND_DISPLAY or $XDG_SESSION_TYPE.
use super::WindowHandle;

// ── Helpers ───────────────────────────────────────────────────────────────────

/// Returns true when the session is running under native Wayland.
/// Falls back to false (assume X11 / XWayland) when the env vars are absent.
fn is_wayland() -> bool {
    std::env::var("WAYLAND_DISPLAY").is_ok()
        || std::env::var("XDG_SESSION_TYPE")
            .map(|v| v.eq_ignore_ascii_case("wayland"))
            .unwrap_or(false)
}

// ── Focus management ──────────────────────────────────────────────────────────

/// Returns the X11 Window ID (XID) of the currently focused window.
///
/// Under native Wayland this always returns `NULL_WINDOW` because the
/// Wayland security model intentionally forbids apps from querying or
/// changing focus of other windows.
///
/// TODO(Linux/X11): Implement with x11rb:
///
/// ```rust,ignore
/// use x11rb::connection::Connection;
/// use x11rb::rust_connection::RustConnection;
/// use x11rb::protocol::xproto::ConnectionExt;
///
/// pub fn get_active_window() -> WindowHandle {
///     let Ok((conn, _)) = RustConnection::connect(None) else { return 0 };
///     let Ok(reply)     = conn.get_input_focus().and_then(|c| c.reply()) else { return 0 };
///     reply.focus as WindowHandle
/// }
/// ```
///
/// TODO(Linux/Wayland): No standard equivalent. Potential workarounds:
///   1. xdg-activation protocol — requires explicit compositor token grant,
///      not suitable for our use-case.
///   2. AT-SPI (Accessibility Technology Service Provider Interface) —
///      can query focused app but needs at-spi2-core running.
///   3. Run the app under XWayland and use the X11 path above.
pub fn get_active_window() -> WindowHandle {
    // TODO(Linux/X11): implement — see doc-comment above
    0
}

/// Raises the window with the given X11 XID and gives it input focus.
///
/// Under Wayland: always a no-op.
///
/// TODO(Linux/X11): Implement with x11rb:
///
/// ```rust,ignore
/// use x11rb::connection::Connection;
/// use x11rb::rust_connection::RustConnection;
/// use x11rb::protocol::xproto::{ConnectionExt, InputFocus};
/// use x11rb::CURRENT_TIME;
///
/// pub fn restore_window_focus(handle: WindowHandle) {
///     if handle == 0 { return; }
///     let Ok((conn, _)) = RustConnection::connect(None) else { return };
///     let _ = conn.set_input_focus(InputFocus::POINTER_ROOT, handle as u32, CURRENT_TIME);
///     let _ = conn.flush();
/// }
/// ```
pub fn restore_window_focus(handle: WindowHandle) {
    if handle == 0 || is_wayland() {
        return;
    }
    // TODO(Linux/X11): implement — see doc-comment above
}

// ── Keystroke simulation ──────────────────────────────────────────────────────

/// Sends a synthetic Ctrl+V using the best available tool for the current
/// display server.
///
/// X11  → `xdotool key ctrl+v`
///         Install: `apt install xdotool` / `dnf install xdotool`
///
/// Wayland → `ydotool key 29:1 47:1 47:0 29:0`  (KEY_LEFTCTRL + KEY_V)
///            Install: `apt install ydotool`
///            Requires: `ydotoold` daemon running + user in `input` group
///                      OR `/dev/uinput` writable by the user.
///
///            Alternative: `wtype -M ctrl v -m ctrl`
///            Works on wlroots-based compositors (Sway, Hyprland, etc.)
///            Install: `apt install wtype`
///
/// TODO(Linux): Consider replacing external tools with a Rust crate:
///   - `enigo` crate: cross-platform (Windows/macOS/X11/Wayland)
///     `enigo = { version = "0.2", features = ["wayland", "x11rb"] }`
///     This is the recommended long-term approach as it requires no
///     external binaries and works without root/uinput permissions.
///
///     ```rust,ignore
///     use enigo::{Enigo, Key, Keyboard, Settings, Direction};
///     let mut enigo = Enigo::new(&Settings::default()).map_err(|e| e.to_string())?;
///     enigo.key(Key::Control, Direction::Press).map_err(|e| e.to_string())?;
///     enigo.key(Key::Unicode('v'), Direction::Click).map_err(|e| e.to_string())?;
///     enigo.key(Key::Control, Direction::Release).map_err(|e| e.to_string())?;
///     ```
pub fn simulate_paste() -> Result<(), String> {
    if is_wayland() {
        // Try ydotool first (generic Wayland), then wtype (wlroots only)
        // KEY codes: 29 = KEY_LEFTCTRL, 47 = KEY_V
        // ydotool key format: <keycode>:<value> where 1=press, 0=release
        let ydotool = std::process::Command::new("ydotool")
            .args(["key", "29:1", "47:1", "47:0", "29:0"])
            .output();

        match ydotool {
            Ok(out) if out.status.success() => return Ok(()),
            _ => {}
        }

        // Fallback: wtype (wlroots compositors)
        let wtype = std::process::Command::new("wtype")
            .args(["-M", "ctrl", "v", "-m", "ctrl"])
            .output();

        return match wtype {
            Ok(out) if out.status.success() => Ok(()),
            _ => Err(
                "Paste simulation failed on Wayland. \
                 Install `ydotool` (and start `ydotoold`) or `wtype`, \
                 or consider using the `enigo` crate instead."
                    .into(),
            ),
        };
    }

    // X11 / XWayland
    let out = std::process::Command::new("xdotool")
        .args(["key", "ctrl+v"])
        .output()
        .map_err(|e| format!("xdotool failed (is it installed?): {}", e))?;

    if !out.status.success() {
        let stderr = String::from_utf8_lossy(&out.stderr);
        return Err(format!("xdotool error: {}", stderr));
    }

    Ok(())
}
