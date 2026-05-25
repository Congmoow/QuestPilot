use tauri::WebviewWindow;

use super::main_window;

#[tauri::command(rename_all = "camelCase")]
pub fn window_minimize(window: WebviewWindow) -> Result<(), String> {
    main_window(&window)?
        .minimize()
        .map_err(|error| error.to_string())
}

#[tauri::command(rename_all = "camelCase")]
pub fn window_maximize(window: WebviewWindow) -> Result<(), String> {
    let main = main_window(&window)?;
    let is_maximized = main.is_maximized().map_err(|error| error.to_string())?;
    if is_maximized {
        main.unmaximize().map_err(|error| error.to_string())
    } else {
        main.maximize().map_err(|error| error.to_string())
    }
}

#[tauri::command(rename_all = "camelCase")]
pub fn window_close(window: WebviewWindow) -> Result<(), String> {
    main_window(&window)?
        .close()
        .map_err(|error| error.to_string())
}

#[tauri::command(rename_all = "camelCase")]
pub fn window_is_maximized(window: WebviewWindow) -> Result<bool, String> {
    main_window(&window)?
        .is_maximized()
        .map_err(|error| error.to_string())
}
