use tauri::{AppHandle, Emitter, State, Manager};
use super::queue::{PasteQueue, QueueMode, QueueItem};
use std::sync::Arc;
use crate::platform;

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

// ── Window visibility ─────────────────────────────────────────────────────────

pub fn update_window_visibility(app: &AppHandle, mode: &QueueMode) {
    if let Some(win) = app.get_webview_window("queue-indicator") {
        match mode {
            QueueMode::Off => {
                let _ = win.hide();
            }
            _ => {
                // Ensure transparent background each time the window is shown.
                // On Windows, WebView2 can reset the background color after hide/show.
                //
                #[cfg(any(target_os = "windows", target_os = "macos"))]
                {
                    use tauri::window::Color;
                    let _ = win.set_background_color(Some(Color(0, 0, 0, 0)));
                }

                let _ = win.show();
                // NEVER call set_focus() here — the indicator must not steal focus
                // from the target app that is about to receive our paste keystroke.
            }
        }
    }
}

// ── Status helpers ────────────────────────────────────────────────────────────

pub fn get_queue_status_raw(queue: &Arc<PasteQueue>) -> QueueStatus {
    let all_items    = queue.peek_all();
    let next_preview = all_items.first().map(|i| i.preview.clone());
    QueueStatus {
        mode: queue.get_mode(),
        total: queue.total(),
        remaining: queue.remaining(),
        all_items,
        next_preview,
    }
}

// ── Tauri commands ────────────────────────────────────────────────────────────

#[tauri::command]
pub fn toggle_queue_mode(
    queue: State<'_, Arc<PasteQueue>>,
    app: AppHandle,
) -> Result<QueueMode, String> {
    let new_mode = match queue.get_mode() {
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
                // Pre-load the first item into the clipboard so the first
                // queue_paste_next call is instant.
                if let Some(first) = queue.items.lock().unwrap().front() {
                    if let Ok(mut cb) = arboard::Clipboard::new() {
                        let _ = cb.set_text(&first.content);
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
    // Capture the focused window NOW — before any of our code touches focus.
    //
    // On Windows this is a real HWND.
    // On macOS / Linux this currently returns NULL_WINDOW (stubs — see platform module).
    let target_window: platform::WindowHandle = platform::get_active_window();

    let item = queue.pop_next();

    if let Some(ref i) = item {
        let _ = app.emit("queue-progress", QueueProgress {
            pasted_index: i.index,
            remaining:    queue.remaining(),
            total:        queue.total(),
        });

        // Update indicator UI first, then paste in a background thread so the
        // Tauri command returns immediately (paste has a 150 ms sleep internally).
        let mode = queue.get_mode();
        update_window_visibility(&app, &mode);
        let _ = app.emit("queue-status-changed", get_queue_status_raw(&queue));

        let content = i.content.clone();
        std::thread::spawn(move || {
            let _ = crate::clipboard::paste::paste_to_target(content, target_window);
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
