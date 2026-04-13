/// macOS implementation of the platform abstraction layer.
///
/// ┌─────────────────────────────────────────────────────────────────────────┐
/// │  STATUS: STUB — all functions compile but do not yet work correctly.    │
/// │  Fill in each TODO block before shipping a macOS build.                 │
/// └─────────────────────────────────────────────────────────────────────────┘
///
/// Required Cargo.toml additions for full implementation:
///
///   [target.'cfg(target_os = "macos")'.dependencies]
///   # For low-level Cmd+V simulation (no permission dialog):
///   core-graphics = "0.23"
///
///   # For Objective-C / AppKit access (focus management):
///   objc2          = "0.5"
///   objc2-app-kit  = "0.2"
///   objc2-foundation = "0.2"
///
/// Required entitlements in `src-tauri/entitlements.plist`:
///   <key>com.apple.security.automation.apple-events</key><true/>   ← osascript
///   OR disable App Sandbox entirely for the accessibility/CGEvent approach.
///
/// Tauri config (`tauri.conf.json`) changes for macOS:
///   - Set `"transparent": true` on floating windows (queue-indicator, quick-paste)
///   - Set `"decorations": false` + `"titleBarStyle": "Overlay"` or `"Hidden"`
///   - Add `"fullscreenEnabled": false` as appropriate
use super::WindowHandle;

// ── Focus management ──────────────────────────────────────────────────────────

/// Returns the PID of the application that currently has keyboard focus.
///
/// TODO(macOS): Implement with NSWorkspace / AppKit:
///
/// ```rust,ignore
/// use objc2_app_kit::NSWorkspace;
/// use objc2::rc::Retained;
///
/// pub fn get_active_window() -> WindowHandle {
///     unsafe {
///         let workspace = NSWorkspace::sharedWorkspace();
///         if let Some(app) = workspace.frontmostApplication() {
///             return app.processIdentifier() as WindowHandle;
///         }
///     }
///     0
/// }
/// ```
///
/// Alternative (simpler, no extra crates, slightly slower):
/// ```rust,ignore
/// use std::process::Command;
/// let out = Command::new("osascript")
///     .args(["-e", "tell application \"System Events\" to get unix id of first process whose frontmost is true"])
///     .output().ok()?;
/// String::from_utf8_lossy(&out.stdout).trim().parse::<i32>().ok()
///     .map(|pid| pid as WindowHandle)
///     .unwrap_or(0)
/// ```
pub fn get_active_window() -> WindowHandle {
    // TODO(macOS): implement — see doc-comment above
    0
}

/// Activates (brings to foreground) the application with the given PID.
///
/// TODO(macOS): Implement with NSRunningApplication:
///
/// ```rust,ignore
/// use objc2_app_kit::{NSRunningApplication, NSApplicationActivationOptions};
///
/// pub fn restore_window_focus(handle: WindowHandle) {
///     if handle == 0 { return; }
///     unsafe {
///         let app = NSRunningApplication::runningApplicationWithProcessIdentifier(
///             handle as i32
///         );
///         if let Some(app) = app {
///             app.activateWithOptions(
///                 NSApplicationActivationOptions::NSApplicationActivateIgnoringOtherApps
///             );
///         }
///     }
/// }
/// ```
pub fn restore_window_focus(handle: WindowHandle) {
    if handle == 0 {
        return;
    }
    // TODO(macOS): implement — see doc-comment above
}

// ── Keystroke simulation ──────────────────────────────────────────────────────

/// Sends a synthetic Cmd+V to paste clipboard content.
///
/// Current implementation uses `osascript` (AppleScript) which is reliable
/// but requires the `com.apple.security.automation.apple-events` entitlement
/// and shows a permission prompt on first run.
///
/// TODO(macOS): Replace with CoreGraphics CGEvent for silent operation:
///
/// ```rust,ignore
/// use core_graphics::event::{CGEvent, CGEventFlags, CGEventTapLocation};
/// use core_graphics::event_source::{CGEventSource, CGEventSourceStateID};
///
/// pub fn simulate_paste() -> Result<(), String> {
///     // kVK_Command = 0x37, kVK_ANSI_V = 0x09  (from Carbon HIToolbox/Events.h)
///     let source = CGEventSource::new(CGEventSourceStateID::HIDSystemState)
///         .map_err(|_| "CGEventSource failed")?;
///
///     let flag_cmd = CGEventFlags::CGEventFlagCommand;
///
///     let v_down = CGEvent::new_keyboard_event(source.clone(), 0x09, true)
///         .map_err(|_| "CGEvent (V down) failed")?;
///     v_down.set_flags(flag_cmd);
///
///     let v_up = CGEvent::new_keyboard_event(source, 0x09, false)
///         .map_err(|_| "CGEvent (V up) failed")?;
///     v_up.set_flags(flag_cmd);
///
///     v_down.post(CGEventTapLocation::HID);
///     v_up.post(CGEventTapLocation::HID);
///     Ok(())
/// }
/// ```
///
/// The CGEvent approach requires the app to be trusted in
/// System Preferences → Privacy & Security → Accessibility,
/// but does NOT trigger the apple-events permission dialog.
pub fn simulate_paste() -> Result<(), String> {
    // Temporary: osascript fallback (works but needs apple-events entitlement)
    std::process::Command::new("osascript")
        .arg("-e")
        .arg(r#"tell application "System Events" to keystroke "v" using command down"#)
        .output()
        .map_err(|e| format!("osascript failed: {}", e))?;
    Ok(())
}
