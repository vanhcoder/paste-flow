use arboard::Clipboard;
use std::thread;
use std::time::Duration;
use crate::platform;

/// Queue paste: write `content` to clipboard, restore focus to the previously
/// captured target window, then simulate the OS paste shortcut (Ctrl/Cmd+V).
///
/// `target_window` is a `WindowHandle` captured with `platform::get_active_window()`
/// BEFORE the queue-indicator window became visible. Pass `platform::NULL_WINDOW`
/// if no window was captured (paste shortcut will still fire; the OS will deliver
/// it to whatever app currently has focus).
pub fn paste_to_target(content: String, target_window: platform::WindowHandle) -> Result<(), String> {
    let mut cb = Clipboard::new().map_err(|e| e.to_string())?;
    cb.set_text(&content).map_err(|e| e.to_string())?;

    // Give the OS time for hotkey modifier keys (e.g. Ctrl+Shift+N) to
    // physically release before we send our own synthetic keystroke.
    thread::sleep(Duration::from_millis(150));

    // Restore focus to the original app so Ctrl/Cmd+V reaches the right window.
    if target_window != platform::NULL_WINDOW {
        platform::restore_window_focus(target_window);
        thread::sleep(Duration::from_millis(50));
    }

    platform::simulate_paste()
}

/// Tauri command: paste clipboard content to whichever app was active before
/// the quick-paste overlay was shown.
///
/// The caller is expected to hide our window BEFORE calling this command so
/// the OS can return focus to the previous app. The 300 ms sleep gives the
/// window-hide animation and focus-transfer time to complete.
#[tauri::command]
pub fn paste_to_active_app(content: String) -> Result<(), String> {
    let mut cb = Clipboard::new().map_err(|e| e.to_string())?;
    cb.set_text(&content).map_err(|e| e.to_string())?;

    // Wait for our window to hide and the OS to return focus to the previous app.
    thread::sleep(Duration::from_millis(300));

    platform::simulate_paste()
}
