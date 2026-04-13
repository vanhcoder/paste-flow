/// Windows implementation of the platform abstraction layer.
///
/// Dependencies (already in Cargo.toml):
///   windows-sys = { version = "0.59", features = [
///       "Win32_Foundation",
///       "Win32_UI_WindowsAndMessaging",
///       "Win32_UI_Input_KeyboardAndMouse",
///   ]}
use super::WindowHandle;

// ── Focus management ──────────────────────────────────────────────────────────

/// Returns the HWND of the window that currently has keyboard focus.
///
/// Call this BEFORE our own window becomes visible (showing the quick-paste
/// overlay or queue indicator steals focus). Store the result and pass it
/// to `restore_window_focus` after pasting.
pub fn get_active_window() -> WindowHandle {
    unsafe {
        windows_sys::Win32::UI::WindowsAndMessaging::GetForegroundWindow() as WindowHandle
    }
}

/// Brings the window identified by `handle` back to the foreground.
///
/// No-op when `handle` is `NULL_WINDOW` (0).
pub fn restore_window_focus(handle: WindowHandle) {
    if handle == 0 {
        return;
    }
    unsafe {
        windows_sys::Win32::UI::WindowsAndMessaging::SetForegroundWindow(
            handle as windows_sys::Win32::Foundation::HWND,
        );
    }
}

// ── Keystroke simulation ──────────────────────────────────────────────────────

/// Sends a synthetic Ctrl+V to the OS input stream via `SendInput`.
///
/// Before the Ctrl+V sequence the function releases Shift, Ctrl, and Alt so
/// any lingering modifier state from the trigger hotkey (e.g. Ctrl+Shift+N)
/// does not corrupt the paste.
pub fn simulate_paste() -> Result<(), String> {
    use std::mem::size_of;
    use windows_sys::Win32::UI::Input::KeyboardAndMouse::{
        SendInput, INPUT, INPUT_0, INPUT_KEYBOARD, KEYBDINPUT,
        KEYEVENTF_KEYUP, VIRTUAL_KEY, VK_CONTROL,
    };

    const VK_V: u32     = 0x56;
    const VK_SHIFT: u32 = 0x10;
    const VK_ALT: u32   = 0x12;

    unsafe {
        let kb = |vk: u32, flags: u32| -> INPUT {
            let mut inp: INPUT = std::mem::zeroed();
            inp.r#type = INPUT_KEYBOARD;
            inp.Anonymous = INPUT_0 {
                ki: KEYBDINPUT {
                    wVk: vk as VIRTUAL_KEY,
                    wScan: 0,
                    dwFlags: flags,
                    time: 0,
                    dwExtraInfo: 0,
                },
            };
            inp
        };

        let mut inputs = [
            // 1. Release any lingering modifier keys from the trigger hotkey
            kb(VK_SHIFT,              KEYEVENTF_KEYUP), // Shift ↑
            kb(VK_CONTROL as u32,     KEYEVENTF_KEYUP), // Ctrl  ↑
            kb(VK_ALT,                KEYEVENTF_KEYUP), // Alt   ↑
            // 2. Clean Ctrl+V
            kb(VK_CONTROL as u32,     0),               // Ctrl  ↓
            kb(VK_V,                  0),               // V     ↓
            kb(VK_V,                  KEYEVENTF_KEYUP), // V     ↑
            kb(VK_CONTROL as u32,     KEYEVENTF_KEYUP), // Ctrl  ↑
        ];

        let count = inputs.len() as u32;
        let sent  = SendInput(count, inputs.as_mut_ptr(), size_of::<INPUT>() as i32);
        if sent != count {
            return Err(format!("SendInput: sent {} of {} events", sent, count));
        }
    }

    Ok(())
}
