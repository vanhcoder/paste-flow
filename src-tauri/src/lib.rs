mod db;
mod clipboard;
mod templates;
mod ai;
mod search;
mod system;

pub use clipboard::*;
pub use db::*;
pub use search::*;
pub use templates::*;

use clipboard::watcher::ClipboardWatcher;
use std::sync::Arc;
use tauri::Manager;
use system::hotkey::HotkeyMap;
use std::collections::HashMap;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new()
            .with_handler(move |app_handle, shortcut, event| {
                use tauri_plugin_global_shortcut::ShortcutState;
                if event.state == ShortcutState::Pressed {
                    let s = shortcut.to_string().to_lowercase()
                        .replace("control", "ctrl")
                        .replace("command", "cmd");

                    // Look up action from dynamic HotkeyMap
                    let action = system::hotkey::resolve_action(app_handle, &s);

                    match action.as_deref() {
                        Some("quick_paste") => {
                            if let Some(win) = app_handle.get_webview_window("quick-paste") {
                                let is_visible = win.is_visible().unwrap_or(false);
                                if is_visible { let _ = win.hide(); }
                                else { let _ = win.show(); let _ = win.set_focus(); }
                            }
                        }
                        Some("queue_toggle") => {
                            use crate::clipboard::queue_commands::toggle_queue_mode;
                            let queue = app_handle.state::<Arc<clipboard::queue::PasteQueue>>();
                            let _ = toggle_queue_mode(queue, app_handle.clone());
                        }
                        Some("queue_next") => {
                            use crate::clipboard::queue_commands::queue_paste_next;
                            let queue = app_handle.state::<Arc<clipboard::queue::PasteQueue>>();
                            let _ = queue_paste_next(queue, app_handle.clone());
                        }
                        _ => {}
                    }
                }
            })
            .build())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec![]),
        ))
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            // ── Init DB ──
            let database = Arc::new(db::init_db(app.handle()));
            app.manage(database.clone());

            // ── HotkeyMap state (must be managed before registering) ──
            app.manage(HotkeyMap(Arc::new(std::sync::Mutex::new(HashMap::new()))));

            // ── Start Clipboard Watcher ──
            let watcher = ClipboardWatcher::new();
            let queue = Arc::new(clipboard::queue::PasteQueue::new());

            watcher.start(app.handle().clone(), database.clone(), queue.clone());
            app.manage(watcher);
            app.manage(queue);

            // ── Register Global Hotkeys from DB settings ──
            system::hotkey::register_hotkeys_from_settings(app.handle(), &database);

            // ── Init Tray ──
            let _ = system::tray::init_tray(app.handle());

            // ── Hide Main Window on Close instead of Exit ──
            if let Some(win) = app.get_webview_window("main") {
                let win_clone = win.clone();
                win.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        api.prevent_close();
                        let _ = win_clone.hide();
                    }
                });
            }

            // ── Hide Quick Paste on Lost Focus ──
            let handle_clone = app.handle().clone();
            if let Some(win) = app.get_webview_window("quick-paste") {
                win.on_window_event(move |event| {
                    if let tauri::WindowEvent::Focused(false) = event {
                        if let Some(w) = handle_clone.get_webview_window("quick-paste") {
                            let _ = w.hide();
                        }
                    }
                });
            }

            // ── Queue Indicator: transparent bg + bottom-right position ──
            if let Some(queue_win) = app.get_webview_window("queue-indicator") {
                use tauri::window::Color;
                let _ = queue_win.set_background_color(Some(Color(0, 0, 0, 0)));

                if let Ok(Some(monitor)) = queue_win.primary_monitor() {
                    let size = monitor.size();
                    let scale = monitor.scale_factor();
                    let screen_w = size.width as f64 / scale;
                    let screen_h = size.height as f64 / scale;
                    let _ = queue_win.set_position(tauri::Position::Logical(
                        tauri::LogicalPosition::new(screen_w - 120.0, screen_h - 160.0),
                    ));
                }
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            clipboard::history::get_recent_items,
            clipboard::history::get_clip_content,
            clipboard::history::pin_item,
            clipboard::history::delete_item,
            clipboard::history::clear_history,
            clipboard::paste::paste_to_active_app,
            clipboard::queue_commands::toggle_queue_mode,
            clipboard::queue_commands::get_queue_status,
            clipboard::queue_commands::queue_paste_next,
            clipboard::queue_commands::skip_queue_item,
            clipboard::queue_commands::cancel_queue,
            search::fuzzy::search_all,
            templates::list_template_groups,
            templates::create_template_group,
            templates::list_templates,
            templates::create_template,
            templates::update_template,
            templates::delete_template,
            templates::get_template,
            system::settings::get_setting,
            system::settings::set_setting,
            system::hotkey::get_hotkeys,
            system::hotkey::update_hotkey,
        ])
        .run(tauri::generate_context!())
        .expect("error while running PasteFlow");
}
