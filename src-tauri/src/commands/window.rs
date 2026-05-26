use tauri::WebviewWindow;

use crate::error::AppError;

use super::main_window;

#[tauri::command(rename_all = "camelCase")]
#[tracing::instrument(skip(window), err)]
pub fn window_minimize(window: WebviewWindow) -> Result<(), AppError> {
    main_window(&window)?
        .minimize()
        .map_err(|e| AppError::Config(e.to_string()))
}

#[tauri::command(rename_all = "camelCase")]
#[tracing::instrument(skip(window), err)]
pub fn window_maximize(window: WebviewWindow) -> Result<(), AppError> {
    let main = main_window(&window)?;
    let is_maximized = main
        .is_maximized()
        .map_err(|e| AppError::Config(e.to_string()))?;
    if is_maximized {
        main.unmaximize()
            .map_err(|e| AppError::Config(e.to_string()))
    } else {
        main.maximize().map_err(|e| AppError::Config(e.to_string()))
    }
}

#[tauri::command(rename_all = "camelCase")]
#[tracing::instrument(skip(window), err)]
pub fn window_close(window: WebviewWindow) -> Result<(), AppError> {
    main_window(&window)?
        .close()
        .map_err(|e| AppError::Config(e.to_string()))
}

#[tauri::command(rename_all = "camelCase")]
#[tracing::instrument(skip(window), err)]
pub fn window_is_maximized(window: WebviewWindow) -> Result<bool, AppError> {
    main_window(&window)?
        .is_maximized()
        .map_err(|e| AppError::Config(e.to_string()))
}
