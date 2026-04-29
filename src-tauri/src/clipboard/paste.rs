use arboard::Clipboard;
use std::thread;
use std::time::Duration;
use tauri::State;
use crate::platform;

/// Queue paste: write `content` to clipboard, restore focus, then Ctrl/Cmd+V.
pub fn paste_to_target(content: String, target_window: platform::WindowHandle) -> Result<(), String> {
    let mut cb = Clipboard::new().map_err(|e| e.to_string())?;
    cb.set_text(&content).map_err(|e| e.to_string())?;

    thread::sleep(Duration::from_millis(150));

    if target_window != platform::NULL_WINDOW {
        platform::restore_window_focus(target_window);
        thread::sleep(Duration::from_millis(50));
    }

    platform::simulate_paste()
}

/// Tauri command: paste to the app that was frontmost before quick-paste opened.
///
/// Order of operations matters on macOS:
///   1. Restore focus to the target app FIRST — before any sleep and before the
///      quick-paste window hides — so macOS never gets a chance to activate our
///      main window in the gap between hide() and restore.
///   2. Set clipboard text.
///   3. Sleep to let focus fully transfer and modifier keys physically release.
///   4. Simulate Cmd+V via CGEvent.
///
/// The caller (JS) hides the quick-paste window AFTER this command resolves.
#[tauri::command]
pub fn paste_to_active_app(
    content: String,
    target: State<'_, crate::QuickPasteTarget>,
) -> Result<(), String> {
    let target_window = *target.0.lock().unwrap();
    let our_pid = std::process::id() as platform::WindowHandle;

    // Step 1 — restore focus immediately, before any sleep.
    if target_window != platform::NULL_WINDOW && target_window != our_pid {
        platform::restore_window_focus(target_window);
    }

    // Step 2 — write to clipboard.
    let mut cb = Clipboard::new().map_err(|e| e.to_string())?;
    cb.set_text(&content).map_err(|e| e.to_string())?;

    // Step 3 — wait for focus transfer and modifier-key release.
    thread::sleep(Duration::from_millis(200));

    // Step 4 — send Cmd+V.
    platform::simulate_paste()
}
