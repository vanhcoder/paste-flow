/// macOS implementation of the platform abstraction layer.
///
/// Permission requirements:
///   - get_active_window / restore_window_focus: no special permissions —
///     NSWorkspace (read-only) and NSRunningApplication.activateWithOptions
///     are standard AppKit calls available to any app.
///   - simulate_paste: requires Accessibility permission (System Settings →
///     Privacy & Security → Accessibility). This is standard for any app that
///     sends synthetic keystrokes; Tauri's global-shortcut plugin already
///     triggers this prompt on first launch.
///
/// Cargo.toml additions (under [target.'cfg(target_os = "macos")'.dependencies]):
///   core-graphics   = "0.23"
///   objc2           = "0.5"
///   objc2-app-kit   = { version = "0.2", features = ["NSWorkspace", "NSRunningApplication", "libc"] }
///   objc2-foundation = "0.2"
use super::WindowHandle;

// ── Focus management ──────────────────────────────────────────────────────────

/// Returns the pid_t of the application that currently has keyboard focus.
///
/// Uses NSWorkspace.frontmostApplication — no special permissions required.
/// Call this BEFORE our overlay window becomes visible, then pass the result
/// to restore_window_focus after pasting.
pub fn get_active_window() -> WindowHandle {
    use objc2_app_kit::NSWorkspace;

    // SAFETY: NSWorkspace.sharedWorkspace() is documented thread-safe by Apple.
    // frontmostApplication() reads process state — safe from any thread.
    unsafe {
        let workspace = NSWorkspace::sharedWorkspace();
        if let Some(app) = workspace.frontmostApplication() {
            return app.processIdentifier() as WindowHandle;
        }
    }
    0
}

/// Brings the application identified by `handle` (a pid_t) back to the foreground.
///
/// No-op when `handle` is `NULL_WINDOW` (0).
pub fn restore_window_focus(handle: WindowHandle) {
    if handle == 0 {
        return;
    }

    use objc2_app_kit::{NSApplicationActivationOptions, NSRunningApplication};

    // SAFETY: standard AppKit call. The pid was captured moments before our
    // overlay appeared, so the target process should still be running.
    unsafe {
        if let Some(app) =
            NSRunningApplication::runningApplicationWithProcessIdentifier(handle as i32)
        {
            // NSApplicationActivateIgnoringOtherApps is deprecated in macOS 14
            // but still functional. objc2-app-kit 0.2 doesn't expose the newer
            // activate() API, so suppress the warning until we upgrade the crate.
            #[allow(deprecated)]
            app.activateWithOptions(
                NSApplicationActivationOptions::NSApplicationActivateIgnoringOtherApps,
            );
        }
    }
}

// ── Keystroke simulation ──────────────────────────────────────────────────────

/// Sends a synthetic Cmd+V via CoreGraphics CGEvent.
///
/// Requires Accessibility permission (one-time prompt) — avoids the per-launch
/// apple-events permission dialog that the osascript fallback triggers.
///
/// Key codes (Carbon HIToolbox/Events.h):
///   kVK_ANSI_V = 0x09
pub fn simulate_paste() -> Result<(), String> {
    use core_graphics::event::{CGEvent, CGEventFlags, CGEventTapLocation};
    use core_graphics::event_source::{CGEventSource, CGEventSourceStateID};

    let source = CGEventSource::new(CGEventSourceStateID::HIDSystemState)
        .map_err(|_| "CGEventSource::new failed — grant Accessibility in System Settings")?;

    let v_down = CGEvent::new_keyboard_event(source.clone(), 0x09, true)
        .map_err(|_| "CGEvent V-down failed")?;
    v_down.set_flags(CGEventFlags::CGEventFlagCommand);

    let v_up = CGEvent::new_keyboard_event(source, 0x09, false)
        .map_err(|_| "CGEvent V-up failed")?;
    v_up.set_flags(CGEventFlags::CGEventFlagCommand);

    v_down.post(CGEventTapLocation::HID);
    v_up.post(CGEventTapLocation::HID);

    Ok(())
}
