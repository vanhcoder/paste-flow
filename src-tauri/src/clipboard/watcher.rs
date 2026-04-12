use arboard::Clipboard;
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;
use tauri::{AppHandle, Emitter};
use crate::db::DbPool;

pub struct ClipboardWatcher {
    running: Arc<Mutex<bool>>,
}

impl ClipboardWatcher {
    pub fn new() -> Self {
        Self {
            running: Arc::new(Mutex::new(false)),
        }
    }

    pub fn start(&self, app: AppHandle, db: Arc<DbPool>, queue: Arc<crate::clipboard::queue::PasteQueue>) {
        let running = self.running.clone();
        *running.lock().unwrap() = true;

        thread::spawn(move || {
            let mut clipboard = match Clipboard::new() {
                Ok(c) => c,
                Err(e) => {
                    eprintln!("Clipboard init failed: {}", e);
                    return;
                }
            };

            let mut last_text = String::new();
            let poll_ms = 500;

            while *running.lock().unwrap() {
                if let Ok(current) = clipboard.get_text() {
                    if !current.is_empty()
                        && current != last_text
                        && current.len() < 1_000_000 // Skip nếu quá lớn (>1MB)
                    {
                        last_text = current.clone();

                        // ── Check Queue Mode ──
                        use crate::clipboard::queue::QueueMode;
                        if queue.get_mode() == QueueMode::Collecting {
                            let index = queue.add_item(current.clone());
                            println!(">>> QUEUE ADDED [{}]: {}", index, current.chars().take(20).collect::<String>());

                            #[derive(serde::Serialize, Clone)]
                            struct QueueItemEvent {
                                index: usize,
                                preview: String,
                            }
                            
                            let _ = app.emit("queue-item-added", QueueItemEvent {
                                index,
                                preview: current.chars().take(50).collect(),
                            });

                            // Cập nhật toàn bộ status cho Frontend
                            use crate::clipboard::queue_commands::get_queue_status_raw;
                            let _ = app.emit("queue-status-changed", get_queue_status_raw(&queue));
                            
                            continue; // Bỏ qua lưu vào history
                        }

                        let preview: String = current.chars().take(200).collect();
                        let id = uuid::Uuid::new_v4().to_string();
                        let byte_size = current.len() as i64;
                        let source_app = get_active_app_name();

                        // Lưu vào DB
                        let db_lock = db.0.lock().unwrap();
                        let _ = db_lock.execute(
                            "INSERT INTO clipboard_items
                             (id, content_type, content_text, content_preview,
                              source_app, byte_size)
                             VALUES (?1, 'text', ?2, ?3, ?4, ?5)",
                            rusqlite::params![
                                id,
                                current,
                                preview,
                                source_app,
                                byte_size,
                            ],
                        );
                        drop(db_lock);

                        // Notify frontend
                        #[derive(serde::Serialize, Clone)]
                        struct ClipEvent {
                            id: String,
                            preview: String,
                            content_type: String,
                        }

                        let _ = app.emit(
                            "clipboard-changed",
                            ClipEvent {
                                id,
                                preview,
                                content_type: "text".into(),
                            },
                        );
                    }
                }

                thread::sleep(Duration::from_millis(poll_ms));
            }
        });
    }

    pub fn stop(&self) {
        *self.running.lock().unwrap() = false;
    }
}

#[cfg(target_os = "windows")]
fn get_active_app_name() -> Option<String> {
    use std::os::windows::ffi::OsStringExt;
    use windows_sys::Win32::System::Threading::{
        OpenProcess, QueryFullProcessImageNameW, PROCESS_QUERY_LIMITED_INFORMATION,
    };
    use windows_sys::Win32::UI::WindowsAndMessaging::{GetForegroundWindow, GetWindowThreadProcessId};

    unsafe {
        let hwnd = GetForegroundWindow();
        if hwnd == 0 as _ {
            return None;
        }

        let mut pid: u32 = 0;
        GetWindowThreadProcessId(hwnd, &mut pid);

        let handle = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid);
        if handle == 0 as _ {
            return None;
        }

        let mut buffer = [0u16; 1024];
        let mut size = buffer.len() as u32;
        let success = QueryFullProcessImageNameW(handle, 0, buffer.as_mut_ptr(), &mut size);
        
        // Close handle
        windows_sys::Win32::Foundation::CloseHandle(handle);

        if success == 0 {
            return None;
        }

        let path = std::ffi::OsString::from_wide(&buffer[..size as usize]);
        let path_str = path.to_string_lossy();
        
        std::path::Path::new(&*path_str)
            .file_stem()
            .map(|s| s.to_string_lossy().to_string())
    }
}

#[cfg(target_os = "macos")]
fn get_active_app_name() -> Option<String> {
    use std::process::Command;
    let output = Command::new("osascript")
        .args([
            "-e",
            r#"tell application "System Events" to get name of first application process whose frontmost is true"#,
        ])
        .output()
        .ok()?;
    let name = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if name.is_empty() {
        None
    } else {
        Some(name)
    }
}

#[cfg(not(any(target_os = "windows", target_os = "macos")))]
fn get_active_app_name() -> Option<String> {
    None
}
