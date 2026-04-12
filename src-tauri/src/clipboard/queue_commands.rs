use tauri::{AppHandle, Emitter, State, Manager};
use super::queue::{PasteQueue, QueueMode, QueueItem};
use std::sync::Arc;

#[derive(serde::Serialize, Clone)]
pub struct QueueStatus {
    pub mode: QueueMode,
    pub total: usize,
    pub remaining: usize,
    pub all_items: Vec<QueueItem>,
    pub next_preview: Option<String>,
}

#[derive(serde::Serialize, Clone)]
pub struct QueueProgress {
    pub pasted_index: usize,
    pub remaining: usize,
    pub total: usize,
}

pub fn update_window_visibility(app: &AppHandle, mode: &QueueMode) {
    if let Some(win) = app.get_webview_window("queue-indicator") {
        match mode {
            QueueMode::Off => { let _ = win.hide(); }
            _ => {
                use tauri::window::Color;
                let _ = win.set_background_color(Some(Color(0, 0, 0, 0)));
                let _ = win.show();
                // NEVER set_focus() here — indicator must not steal focus from target app
            }
        }
    }
}

pub fn get_queue_status_raw(queue: &Arc<PasteQueue>) -> QueueStatus {
    let all_items = queue.peek_all();
    let next_preview = all_items.first().map(|i| i.preview.clone());

    QueueStatus {
        mode: queue.get_mode(),
        total: queue.total(),
        remaining: queue.remaining(),
        all_items,
        next_preview,
    }
}

#[tauri::command]
pub fn toggle_queue_mode(
    queue: State<'_, Arc<PasteQueue>>,
    app: AppHandle,
) -> Result<QueueMode, String> {
    let current = queue.get_mode();

    let new_mode = match current {
        QueueMode::Off => {
            queue.start_collecting();
            QueueMode::Collecting
        }
        QueueMode::Collecting => {
            if queue.remaining() == 0 {
                queue.clear();
                QueueMode::Off
            } else {
                queue.finish_collecting();

                // Nạp sẵn đạn
                if let Some(first) = queue.items.lock().unwrap().front() {
                    use arboard::Clipboard;
                    if let Ok(mut clipboard) = Clipboard::new() {
                        let _ = clipboard.set_text(&first.content);
                    }
                }

                QueueMode::Pasting
            }
        }
        QueueMode::Pasting => {
            queue.clear();
            QueueMode::Off
        }
    };

    update_window_visibility(&app, &new_mode);
    let _ = app.emit("queue-status-changed", get_queue_status_raw(&queue));
    Ok(new_mode)
}

#[tauri::command]
pub fn get_queue_status(
    queue: State<'_, Arc<PasteQueue>>,
) -> Result<QueueStatus, String> {
    Ok(get_queue_status_raw(&queue))
}

#[tauri::command]
pub fn queue_paste_next(
    queue: State<'_, Arc<PasteQueue>>,
    app: AppHandle,
) -> Result<Option<QueueItem>, String> {
    // Save foreground window BEFORE any focus changes (cast to isize for Send)
    #[cfg(target_os = "windows")]
    let target_hwnd = unsafe {
        windows_sys::Win32::UI::WindowsAndMessaging::GetForegroundWindow() as isize
    };
    #[cfg(not(target_os = "windows"))]
    let target_hwnd = 0isize;

    let item = queue.pop_next();

    if let Some(ref i) = item {
        let _ = app.emit("queue-progress", QueueProgress {
            pasted_index: i.index,
            remaining: queue.remaining(),
            total: queue.total(),
        });

        // Update UI first (show/hide indicator), then paste in background
        let mode = queue.get_mode();
        update_window_visibility(&app, &mode);
        let _ = app.emit("queue-status-changed", get_queue_status_raw(&queue));

        // Paste in background thread — clipboard write happens HERE only (no double-write)
        let content_clone = i.content.clone();
        std::thread::spawn(move || {
            let _ = crate::clipboard::paste::paste_to_target(content_clone, target_hwnd);
        });
    }

    Ok(item)
}

#[tauri::command]
pub fn skip_queue_item(
    queue: State<'_, Arc<PasteQueue>>,
    app: AppHandle,
) -> Result<(), String> {
    let _ = queue.pop_next();

    let mode = queue.get_mode();
    update_window_visibility(&app, &mode);
    let _ = app.emit("queue-status-changed", get_queue_status_raw(&queue));
    Ok(())
}

#[tauri::command]
pub fn cancel_queue(
    queue: State<'_, Arc<PasteQueue>>,
    app: AppHandle,
) -> Result<(), String> {
    queue.clear();
    update_window_visibility(&app, &QueueMode::Off);
    let _ = app.emit("queue-status-changed", get_queue_status_raw(&queue));
    Ok(())
}
