#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod oauth;
mod session;
mod vault;
use session::{AttemptCredential, Coordinator, SavedSession, Scope};
use tauri::Manager;
use tauri_plugin_opener::OpenerExt;
use tokio::sync::watch;
use vault::{SecretStore, WindowsVault};

struct AppState {
    client: Result<oauth::DesktopClient, String>,
    coordinator: Coordinator,
}
impl AppState {
    fn client(&self) -> Result<&oauth::DesktopClient, String> {
        self.client.as_ref().map_err(Clone::clone)
    }
    fn scope(&self) -> Result<Scope, String> {
        let client = self.client()?;
        Ok(Scope {
            project: client.project_id.clone(),
            client: client.client_id.clone(),
        })
    }
    fn vault(&self) -> Result<WindowsVault, String> {
        let scope = self.scope()?;
        Ok(WindowsVault::new(&scope.project, &scope.client))
    }
}
#[derive(serde::Serialize)]
struct ConfigurationStatus {
    project_id: String,
    remember_available: bool,
    has_saved: bool,
    storage_warning: Option<String>,
}

#[tauri::command]
fn configuration_ready(state: tauri::State<'_, AppState>) -> Result<ConfigurationStatus, String> {
    let client = state.client()?;
    let store = state.vault()?;
    let (has_saved, storage_warning) = match store.read() {
        Ok(value) => (value.is_some(), None),
        Err(error) => (false, Some(error)),
    };
    Ok(ConfigurationStatus {
        project_id: client.project_id.clone(),
        remember_available: WindowsVault::supported() && storage_warning.is_none(),
        has_saved,
        storage_warning,
    })
}
#[tauri::command]
fn cancel_login(state: tauri::State<'_, AppState>) -> Result<(), String> {
    state.coordinator.cancel(&state.vault()?)
}
#[tauri::command]
fn forget_session(state: tauri::State<'_, AppState>) -> Result<(), String> {
    state.coordinator.forget(&state.vault()?)
}
#[tauri::command]
fn confirm_login(
    attempt_id: String,
    uid: String,
    state: tauri::State<'_, AppState>,
) -> Result<bool, String> {
    state
        .coordinator
        .finalize(&attempt_id, &uid, &state.scope()?, &state.vault()?)
}
#[tauri::command]
async fn google_login(
    remember: bool,
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<AttemptCredential, String> {
    if remember && !WindowsVault::supported() {
        return Err("Remembering sign-in is available only on Windows in this proof.".into());
    }
    let client = state.client()?;
    let (cancel, cancelled) = watch::channel(false);
    let epoch = state.coordinator.start(cancel)?;
    let result = oauth::login(client, remember, cancelled, |url| {
        app.opener()
            .open_url(url, None::<&str>)
            .map_err(|_| "Could not open the system browser.".to_owned())
    })
    .await;
    match result {
        Ok(exchange) => state.coordinator.finish(epoch, exchange, remember, None),
        Err(error) => {
            state.coordinator.failed(epoch);
            Err(error)
        }
    }
}
#[tauri::command]
async fn restore_login(
    state: tauri::State<'_, AppState>,
) -> Result<Option<AttemptCredential>, String> {
    let client = state.client()?;
    let store = state.vault()?;
    let scope = state.scope()?;
    let (cancel, cancelled) = watch::channel(false);
    let epoch = state.coordinator.start(cancel)?;
    let restore = async {
        let Some(value) = store.read()? else {
            return Ok(None);
        };
        let record = SavedSession::decode(&value, &scope)?;
        match oauth::refresh(
            client,
            &record.refresh_token,
            &record.subject,
            cancelled.clone(),
        )
        .await
        {
            Ok(mut exchange) => {
                if *cancelled.borrow() {
                    return Err("Sign-in cancelled.".into());
                }
                if exchange.refresh_token.is_none() {
                    exchange.refresh_token = Some(record.refresh_token);
                }
                state
                    .coordinator
                    .finish(epoch, exchange, true, Some(record.uid))
                    .map(Some)
            }
            Err(error) => {
                if *cancelled.borrow() {
                    return Err("Sign-in cancelled.".into());
                }
                if matches!(error, oauth::RefreshFailure::Revoked) {
                    state.coordinator.reject_saved(epoch, &store)?;
                }
                Err(error.message().into())
            }
        }
    }
    .await;
    if !matches!(restore, Ok(Some(_))) {
        state.coordinator.failed(epoch);
    }
    restore
}
fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _, _| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_opener::init())
        .manage(AppState {
            client: oauth::load_client(),
            coordinator: Coordinator::default(),
        })
        .invoke_handler(tauri::generate_handler![
            configuration_ready,
            google_login,
            restore_login,
            confirm_login,
            cancel_login,
            forget_session
        ])
        .run(tauri::generate_context!())
        .expect("Could not run the isolated sign-in proof");
}
