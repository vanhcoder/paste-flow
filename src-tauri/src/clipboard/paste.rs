use arboard::Clipboard;
use std::thread;
use std::time::Duration;

/// Queue paste: set clipboard, restore focus to saved target window, then Ctrl+V
pub fn paste_to_target(content: String, _target_hwnd: isize) -> Result<(), String> {
    let mut clipboard = Clipboard::new().map_err(|e| e.to_string())?;
    clipboard.set_text(&content).map_err(|e| e.to_string())?;

    // Wait for hotkey modifier keys to physically release (Ctrl+Shift+N)
    thread::sleep(Duration::from_millis(150));

    // Restore focus to the original target app before sending keystroke
    #[cfg(target_os = "windows")]
    if _target_hwnd != 0 {
        unsafe {
            windows_sys::Win32::UI::WindowsAndMessaging::SetForegroundWindow(
                _target_hwnd as windows_sys::Win32::Foundation::HWND
            );
        }
        thread::sleep(Duration::from_millis(50));
    }

    simulate_paste_keystroke()?;
    Ok(())
}

/// Tauri command: paste to whatever app is behind our window (used by quick-paste UI)
#[tauri::command]
pub fn paste_to_active_app(content: String) -> Result<(), String> {
    let mut clipboard = Clipboard::new().map_err(|e| e.to_string())?;
    clipboard.set_text(&content).map_err(|e| e.to_string())?;

    // Wait for our window to hide and OS to return focus to previous app
    thread::sleep(Duration::from_millis(300));

    simulate_paste_keystroke()?;
    Ok(())
}

#[cfg(target_os = "windows")]
fn simulate_paste_keystroke() -> Result<(), String> {
    use windows_sys::Win32::UI::Input::KeyboardAndMouse::{
        SendInput, INPUT, INPUT_0, INPUT_KEYBOARD, KEYBDINPUT, KEYEVENTF_KEYUP, VIRTUAL_KEY, VK_CONTROL,
    };
    use std::mem::size_of;

    let vk_v = 0x56u16;

    unsafe {
        let create_kb_input = |vk: u32, flags: u32| -> INPUT {
            let mut input: INPUT = std::mem::zeroed();
            input.r#type = INPUT_KEYBOARD;
            input.Anonymous = INPUT_0 {
                ki: KEYBDINPUT {
                    wVk: vk as VIRTUAL_KEY,
                    wScan: 0,
                    dwFlags: flags,
                    time: 0,
                    dwExtraInfo: 0,
                }
            };
            input
        };

        let mut inputs = [
            // Release all modifier keys first (hotkey Ctrl+Shift+N may linger in OS state)
            create_kb_input(0x10, KEYEVENTF_KEYUP),              // Shift UP
            create_kb_input(VK_CONTROL as u32, KEYEVENTF_KEYUP), // Ctrl UP
            create_kb_input(0x12, KEYEVENTF_KEYUP),              // Alt UP
            // Simulate clean Ctrl+V
            create_kb_input(VK_CONTROL as u32, 0),               // Ctrl Down
            create_kb_input(vk_v as u32, 0),                     // V Down
            create_kb_input(vk_v as u32, KEYEVENTF_KEYUP),      // V Up
            create_kb_input(VK_CONTROL as u32, KEYEVENTF_KEYUP), // Ctrl Up
        ];

        let count = inputs.len() as u32;
        let sent = SendInput(count, inputs.as_mut_ptr(), size_of::<INPUT>() as i32);
        if sent != count {
            return Err(format!("SendInput failed: sent {} of {}", sent, count));
        }
    }
    Ok(())
}

#[cfg(target_os = "macos")]
fn simulate_paste_keystroke() -> Result<(), String> {
    use std::process::Command;
    Command::new("osascript")
        .arg("-e")
        .arg(r#"tell application "System Events" to keystroke "v" using command down"#)
        .output()
        .map_err(|e| format!("osascript failed: {}", e))?;
    Ok(())
}

#[cfg(target_os = "linux")]
fn simulate_paste_keystroke() -> Result<(), String> {
    use std::process::Command;
    Command::new("xdotool")
        .args(["key", "ctrl+v"])
        .output()
        .map_err(|e| format!("xdotool failed: {}", e))?;
    Ok(())
}
