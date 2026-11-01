#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod oauth;
use std::sync::Mutex;
use tauri_plugin_opener::OpenerExt;
use tokio::sync::watch;

#[derive(Default)]
struct LoginState(Mutex<Option<watch::Sender<bool>>>);

#[tauri::command]
fn configuration_ready() -> bool {
    oauth::load_client().is_ok()
}

#[tauri::command]
fn cancel_login(state: tauri::State<'_, LoginState>) {
    if let Ok(pending) = state.0.lock() {
        if let Some(cancel) = pending.as_ref() {
            let _ = cancel.send(true);
        }
    }
}

#[tauri::command]
async fn google_login(
    app: tauri::AppHandle,
    state: tauri::State<'_, LoginState>,
) -> Result<oauth::GoogleCredential, String> {
    let client = oauth::load_client()?;
    let (cancel, cancelled) = watch::channel(false);
    {
        let mut pending = state.0.lock().map_err(|_| "Could not start sign-in.")?;
        if pending.is_some() {
            return Err("A sign-in attempt is already running.".into());
        }
        *pending = Some(cancel);
    }
    let result = oauth::login(client, cancelled, |url| {
        app.opener()
            .open_url(url, None::<&str>)
            .map_err(|_| "Could not open the system browser.".to_owned())
    })
    .await;
    if let Ok(mut pending) = state.0.lock() {
        *pending = None;
    }
    result
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(LoginState::default())
        .invoke_handler(tauri::generate_handler![
            configuration_ready,
            google_login,
            cancel_login
        ])
        .run(tauri::generate_context!())
        .expect("Could not run the isolated sign-in proof");
}
