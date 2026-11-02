mod oauth;
mod session;
mod vault;
use session::{AttemptCredential, Coordinator, SavedSession, Scope};
use std::sync::Mutex;
use tauri_plugin_opener::OpenerExt;
use tokio::sync::watch;
use vault::{SecretStore, WindowsVault};
include!(concat!(env!("OUT_DIR"), "/desktop_oauth_config.rs"));

pub struct WindowsAccount {
    client: Result<oauth::DesktopClient, String>,
    app_scope: String,
    actor_id: String,
    coordinator: Coordinator,
    request: Mutex<Option<String>>,
}
impl WindowsAccount {
    pub fn new(app_scope: String) -> Self {
        let client = DESKTOP_CLIENT_JSON
            .ok_or_else(|| "Desktop Google sign-in is not configured.".to_string())
            .and_then(oauth::parse_client);
        let actor_id = client
            .as_ref()
            .ok()
            .and_then(|client| {
                let store = WindowsVault::actor(&app_scope, &client.project_id);
                if let Ok(Some(value)) = store.read() {
                    if valid_request(&value) {
                        return Some(value);
                    }
                }
                let value = oauth::random_secret();
                store.write(&value).ok().map(|_| value)
            })
            .unwrap_or_else(oauth::random_secret);
        Self {
            client,
            app_scope,
            actor_id,
            coordinator: Coordinator::default(),
            request: Mutex::new(None),
        }
    }
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
        Ok(WindowsVault::new(
            &self.app_scope,
            &scope.project,
            &scope.client,
        ))
    }
    fn start(&self, id: &str, cancel: watch::Sender<bool>) -> Result<u64, String> {
        if !valid_request(id) {
            return Err("Invalid sign-in request.".into());
        }
        let request = self
            .request
            .lock()
            .map_err(|_| "Could not start sign-in.")?;
        if request.as_deref() != Some(id) {
            return Err("Sign-in cancelled.".into());
        }
        self.coordinator.start(cancel)
    }
    fn cancel_request(&self, id: &str, store: &dyn SecretStore) -> Result<(), String> {
        let mut request = self
            .request
            .lock()
            .map_err(|_| "Could not cancel sign-in.")?;
        if request.as_deref() == Some(id) {
            self.coordinator.cancel(store)?;
            *request = None;
        }
        Ok(())
    }
}
fn valid_request(id: &str) -> bool {
    !id.is_empty()
        && id.len() <= 128
        && id
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_')
}
#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Configuration {
    project_id: String,
    actor_id: String,
    cached_uid: Option<String>,
    cached_label: Option<String>,
    remember_available: bool,
    storage_warning: bool,
}
#[derive(serde::Serialize)]
#[serde(tag = "status", rename_all = "snake_case")]
pub enum Restored {
    None,
    Credential { credential: AttemptCredential },
    Unavailable,
    Revoked,
    Rejected,
}
#[tauri::command]
pub fn windows_account_configuration(
    state: tauri::State<'_, WindowsAccount>,
) -> Result<Option<Configuration>, String> {
    if !cfg!(windows) || state.client.is_err() {
        return Ok(None);
    }
    let scope = state.scope()?;
    let store = state.vault()?;
    let (cached_uid, cached_label, storage_warning) = match store.read() {
        Ok(Some(value)) => match SavedSession::decode(&value, &scope) {
            Ok(record) => (Some(record.uid), record.label, false),
            Err(_) => (None, None, true),
        },
        Ok(None) => (None, None, false),
        Err(_) => (None, None, true),
    };
    Ok(Some(Configuration {
        project_id: scope.project,
        actor_id: state.actor_id.clone(),
        cached_uid,
        cached_label,
        remember_available: WindowsVault::supported() && !storage_warning,
        storage_warning,
    }))
}
#[tauri::command]
pub fn windows_account_begin(
    request_id: String,
    state: tauri::State<'_, WindowsAccount>,
) -> Result<(), String> {
    if !valid_request(&request_id) {
        return Err("Invalid sign-in request.".into());
    }
    let mut request = state
        .request
        .lock()
        .map_err(|_| "Could not start sign-in.")?;
    *request = Some(request_id);
    Ok(())
}
#[tauri::command]
pub fn windows_account_cancel(
    request_id: String,
    state: tauri::State<'_, WindowsAccount>,
) -> Result<(), String> {
    state.cancel_request(&request_id, &state.vault()?)
}
#[tauri::command]
pub fn windows_account_forget(state: tauri::State<'_, WindowsAccount>) -> Result<(), String> {
    let mut request = state
        .request
        .lock()
        .map_err(|_| "Could not forget sign-in.")?;
    state.coordinator.forget(&state.vault()?)?;
    *request = None;
    Ok(())
}
#[tauri::command]
pub fn windows_account_confirm(
    request_id: String,
    attempt_id: String,
    uid: String,
    label: Option<String>,
    state: tauri::State<'_, WindowsAccount>,
) -> Result<bool, String> {
    let request = state
        .request
        .lock()
        .map_err(|_| "Could not finish sign-in.")?;
    if request.as_deref() != Some(request_id.as_str()) {
        return Err("Sign-in cancelled.".into());
    }
    state.coordinator.finalize_named(
        &attempt_id,
        &uid,
        label.as_deref(),
        &state.scope()?,
        &state.vault()?,
    )
}
#[tauri::command]
pub async fn windows_account_login(
    remember: bool,
    request_id: String,
    app: tauri::AppHandle,
    state: tauri::State<'_, WindowsAccount>,
) -> Result<AttemptCredential, String> {
    let client = state.client()?;
    let (cancel, cancelled) = watch::channel(false);
    let epoch = state.start(&request_id, cancel)?;
    let result = oauth::login(client, remember, cancelled, |url| {
        app.opener()
            .open_url(url, None::<&str>)
            .map_err(|_| "Could not open the system browser.".into())
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
pub async fn windows_account_restore(
    request_id: String,
    state: tauri::State<'_, WindowsAccount>,
) -> Result<Restored, String> {
    let client = state.client()?;
    let store = state.vault()?;
    let scope = state.scope()?;
    let (cancel, cancelled) = watch::channel(false);
    let epoch = state.start(&request_id, cancel)?;
    let result = async {
        let Some(value) = store.read()? else {
            return Ok(Restored::None);
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
                    .map(|credential| Restored::Credential { credential })
            }
            Err(oauth::RefreshFailure::Revoked) => {
                state.coordinator.reject_saved(epoch, &store)?;
                Ok(Restored::Revoked)
            }
            Err(oauth::RefreshFailure::Unavailable) => Ok(Restored::Unavailable),
            Err(_) => Ok(Restored::Rejected),
        }
    }
    .await;
    if !matches!(result, Ok(Restored::Credential { .. })) {
        state.coordinator.failed(epoch);
    }
    result
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::cell::Cell;
    struct Store(Cell<usize>);
    impl SecretStore for Store {
        fn read(&self) -> Result<Option<String>, String> {
            Ok(None)
        }
        fn write(&self, _: &str) -> Result<(), String> {
            Ok(())
        }
        fn delete(&self) -> Result<(), String> {
            self.0.set(self.0.get() + 1);
            Ok(())
        }
    }
    fn state() -> WindowsAccount {
        WindowsAccount {
            client: Err("not configured".into()),
            app_scope: "test".into(),
            actor_id: "test-actor".into(),
            coordinator: Coordinator::default(),
            request: Mutex::new(None),
        }
    }
    #[test]
    fn stale_request_cancellation_cannot_cancel_a_new_login() {
        let state = state();
        let store = Store(Cell::new(0));
        let (tx, _) = watch::channel(false);
        *state.request.lock().unwrap() = Some("old".into());
        state.start("old", tx).unwrap();
        state.cancel_request("old", &store).unwrap();
        let (tx, rx) = watch::channel(false);
        *state.request.lock().unwrap() = Some("new".into());
        let epoch = state.start("new", tx).unwrap();
        state.cancel_request("old", &store).unwrap();
        assert!(!*rx.borrow());
        assert!(state
            .coordinator
            .finish(
                epoch,
                oauth::GoogleExchange {
                    id_token: "synthetic-id".into(),
                    subject: "synthetic-sub".into(),
                    refresh_token: None
                },
                false,
                None
            )
            .is_ok());
        assert_eq!(store.0.get(), 0);
    }
    #[test]
    fn cancelled_registration_cannot_be_reopened_by_late_async_dispatch() {
        let state = state();
        let store = Store(Cell::new(0));
        *state.request.lock().unwrap() = Some("old".into());
        state.cancel_request("old", &store).unwrap();
        let (tx, _) = watch::channel(false);
        assert!(state.start("old", tx).is_err());
        *state.request.lock().unwrap() = Some("new".into());
        let (tx, _) = watch::channel(false);
        assert!(state.start("old", tx).is_err());
    }
    #[test]
    fn request_ids_are_bounded_and_cannot_be_urls() {
        assert!(valid_request("opaque-request_1"));
        assert!(!valid_request("https://outside.test"));
        assert!(!valid_request(&"x".repeat(129)));
    }
}
