use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager, Runtime,
};

pub fn init_tray<R: Runtime>(app: &tauri::AppHandle<R>) -> tauri::Result<()> {
    let show_i = MenuItem::with_id(app, "show", "Show PasteFlow", true, None::<&str>)?;
    let hide_i = MenuItem::with_id(app, "hide", "Hide", true, None::<&str>)?;
    let quit_i = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show_i, &hide_i, &quit_i])?;

    let _tray = TrayIconBuilder::with_id("main-tray")
        .tooltip("PasteFlow")
        .icon(app.default_window_icon().unwrap().clone())
        .menu(&menu)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "quit" => {
                app.exit(0);
            }
            "show" => {
                if let Some(win) = app.get_webview_window("main") {
                    let _ = win.show();
                    let _ = win.set_focus();
                }
            }
            "hide" => {
                if let Some(win) = app.get_webview_window("main") {
                    let _ = win.hide();
                }
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                if let Some(win) = app.get_webview_window("main") {
                    let _ = win.show();
                    let _ = win.set_focus();
                }
            }
        })
        .build(app)?;

    Ok(())
}
