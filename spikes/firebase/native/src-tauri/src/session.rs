use crate::{
    oauth::{self, GoogleExchange},
    vault::SecretStore,
};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tokio::sync::watch;

#[derive(Clone)]
pub struct Scope {
    pub project: String,
    pub client: String,
}
// No Debug: the refresh token must not be printed by error/debug formatting.
#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct SavedSession {
    version: u8,
    project: String,
    client: String,
    pub uid: String,
    pub subject: String,
    pub refresh_token: String,
}
impl SavedSession {
    pub fn decode(value: &str, scope: &Scope) -> Result<Self, String> {
        let record: Self = serde_json::from_str(value)
            .map_err(|_| "The saved sign-in is unreadable. Forget it and sign in again.")?;
        if record.version != 1
            || record.project != scope.project
            || record.client != scope.client
            || !valid_uid(&record.uid)
            || record.subject.is_empty()
            || record.subject.len() > 255
            || record.refresh_token.is_empty()
            || record.refresh_token.len() > 2048
        {
            return Err("The saved sign-in does not match this app configuration. Forget it and sign in again.".into());
        }
        Ok(record)
    }
}
fn valid_uid(uid: &str) -> bool {
    !uid.is_empty()
        && uid.len() <= 128
        && uid
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_')
}

#[derive(Serialize)]
pub struct AttemptCredential {
    pub id_token: String,
    pub attempt_id: String,
    pub expected_uid: Option<String>,
}
struct Candidate {
    epoch: u64,
    attempt: String,
    exchange: GoogleExchange,
    remember: bool,
    expected_uid: Option<String>,
}
#[derive(Default)]
struct Inner {
    epoch: u64,
    active: Option<(u64, watch::Sender<bool>)>,
    candidate: Option<Candidate>,
    // A cancel arriving while frontend finalization is in flight must roll this back.
    last_saved_commit: bool,
}
#[derive(Default)]
pub struct Coordinator(Mutex<Inner>);
impl Coordinator {
    pub fn start(&self, cancel: watch::Sender<bool>) -> Result<u64, String> {
        let mut state = self.0.lock().map_err(|_| "Could not start sign-in.")?;
        if state.active.is_some() {
            return Err("A sign-in attempt is already running.".into());
        }
        state.epoch += 1;
        state.candidate = None;
        state.last_saved_commit = false;
        let epoch = state.epoch;
        state.active = Some((epoch, cancel));
        Ok(epoch)
    }
    pub fn failed(&self, epoch: u64) {
        if let Ok(mut state) = self.0.lock() {
            if state.epoch == epoch {
                state.active = None;
                state.candidate = None;
            }
        }
    }
    pub fn finish(
        &self,
        epoch: u64,
        exchange: GoogleExchange,
        remember: bool,
        expected_uid: Option<String>,
    ) -> Result<AttemptCredential, String> {
        let mut state = self.0.lock().map_err(|_| "Could not finish sign-in.")?;
        if state.epoch != epoch
            || state
                .active
                .as_ref()
                .is_none_or(|(active, cancel)| *active != epoch || *cancel.borrow())
        {
            return Err("Sign-in cancelled.".into());
        }
        state.active = None;
        if remember && exchange.refresh_token.as_ref().is_none_or(String::is_empty) {
            return Err(
                "Google did not provide a renewable sign-in. Retry and approve the consent screen."
                    .into(),
            );
        }
        let attempt = oauth::random_secret();
        let credential = AttemptCredential {
            id_token: exchange.id_token.clone(),
            attempt_id: attempt.clone(),
            expected_uid: expected_uid.clone(),
        };
        state.candidate = Some(Candidate {
            epoch,
            attempt,
            exchange,
            remember,
            expected_uid,
        });
        Ok(credential)
    }
    pub fn finalize(
        &self,
        attempt: &str,
        uid: &str,
        scope: &Scope,
        store: &dyn SecretStore,
    ) -> Result<bool, String> {
        let mut state = self.0.lock().map_err(|_| "Could not finish sign-in.")?;
        if !state.candidate.as_ref().is_some_and(|candidate| {
            candidate.epoch == state.epoch && candidate.attempt == attempt && valid_uid(uid)
        }) {
            return Err("This sign-in attempt is no longer active.".into());
        }
        let candidate = state
            .candidate
            .take()
            .ok_or("This sign-in attempt is no longer active.")?;
        if candidate
            .expected_uid
            .as_deref()
            .is_some_and(|expected| expected != uid)
        {
            store.delete()?;
            return Err("The saved account changed. Sign in again.".into());
        }
        if candidate.remember {
            let record = SavedSession {
                version: 1,
                project: scope.project.clone(),
                client: scope.client.clone(),
                uid: uid.into(),
                subject: candidate.exchange.subject,
                refresh_token: candidate
                    .exchange
                    .refresh_token
                    .ok_or("Google did not provide a renewable sign-in.")?,
            };
            let value = serde_json::to_string(&record)
                .map_err(|_| "Could not encode the saved sign-in.")?;
            store.write(&value)?;
            state.last_saved_commit = true;
        } else {
            // A new memory-only login must not resurrect an older saved account on restart.
            store.delete()?;
            state.last_saved_commit = false;
        }
        Ok(candidate.remember)
    }
    pub fn cancel(&self, store: &dyn SecretStore) -> Result<(), String> {
        let mut state = self.0.lock().map_err(|_| "Could not cancel sign-in.")?;
        state.epoch += 1;
        if let Some((_, cancel)) = state.active.take() {
            let _ = cancel.send(true);
        }
        state.candidate = None;
        if state.last_saved_commit {
            store.delete()?;
            state.last_saved_commit = false;
        }
        Ok(())
    }
    pub fn forget(&self, store: &dyn SecretStore) -> Result<(), String> {
        let mut state = self
            .0
            .lock()
            .map_err(|_| "Could not forget the saved sign-in.")?;
        state.epoch += 1;
        if let Some((_, cancel)) = state.active.take() {
            let _ = cancel.send(true);
        }
        state.candidate = None;
        state.last_saved_commit = false;
        store.delete()
    }
    pub fn reject_saved(&self, epoch: u64, store: &dyn SecretStore) -> Result<(), String> {
        let mut state = self
            .0
            .lock()
            .map_err(|_| "Could not clear the expired sign-in.")?;
        if state.epoch == epoch {
            state.active = None;
            state.candidate = None;
            store.delete()?;
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::cell::RefCell;
    #[derive(Default)]
    struct Memory {
        value: RefCell<Option<String>>,
        fail_write: bool,
        fail_delete: bool,
    }
    impl SecretStore for Memory {
        fn read(&self) -> Result<Option<String>, String> {
            Ok(self.value.borrow().clone())
        }
        fn write(&self, v: &str) -> Result<(), String> {
            if self.fail_write {
                return Err("store unavailable".into());
            }
            *self.value.borrow_mut() = Some(v.into());
            Ok(())
        }
        fn delete(&self) -> Result<(), String> {
            if self.fail_delete {
                return Err("delete unavailable".into());
            }
            *self.value.borrow_mut() = None;
            Ok(())
        }
    }
    fn scope() -> Scope {
        Scope {
            project: "test-project".into(),
            client: "test-client".into(),
        }
    }
    fn exchange() -> GoogleExchange {
        GoogleExchange {
            id_token: "synthetic-id-token".into(),
            subject: "synthetic-subject".into(),
            refresh_token: Some("synthetic-private-refresh".into()),
        }
    }
    fn begin(c: &Coordinator) -> u64 {
        let (tx, _) = watch::channel(false);
        c.start(tx).unwrap()
    }
    #[test]
    fn persistence_waits_for_firebase_confirmation_and_hides_refresh_from_ipc() {
        let c = Coordinator::default();
        let s = Memory::default();
        let e = begin(&c);
        let a = c.finish(e, exchange(), true, None).unwrap();
        assert!(s.read().unwrap().is_none());
        let public = serde_json::to_string(&a).unwrap();
        assert!(!public.contains("synthetic-private-refresh"));
        assert!(!public.contains("refresh_token"));
        assert!(c
            .finalize(&a.attempt_id, "firebase-uid", &scope(), &s)
            .unwrap());
        let r = SavedSession::decode(&s.read().unwrap().unwrap(), &scope()).unwrap();
        assert_eq!(r.uid, "firebase-uid");
        assert!(c
            .finalize(&a.attempt_id, "firebase-uid", &scope(), &s)
            .is_err());
    }
    #[test]
    fn cancel_and_forget_prevent_late_completion_and_commit() {
        let c = Coordinator::default();
        let s = Memory::default();
        let e = begin(&c);
        c.cancel(&s).unwrap();
        assert!(c.finish(e, exchange(), true, None).is_err());
        let e = begin(&c);
        let a = c.finish(e, exchange(), true, None).unwrap();
        c.forget(&s).unwrap();
        assert!(c.finalize(&a.attempt_id, "uid", &scope(), &s).is_err());
        assert!(s.read().unwrap().is_none());
    }
    #[test]
    fn cancel_after_native_commit_rolls_back_late_persistence() {
        let c = Coordinator::default();
        let s = Memory::default();
        let e = begin(&c);
        let a = c.finish(e, exchange(), true, None).unwrap();
        c.finalize(&a.attempt_id, "uid", &scope(), &s).unwrap();
        c.cancel(&s).unwrap();
        assert!(s.read().unwrap().is_none());
    }
    #[test]
    fn stale_failure_cannot_clear_a_new_attempt() {
        let c = Coordinator::default();
        let s = Memory::default();
        let old = begin(&c);
        c.cancel(&s).unwrap();
        let new = begin(&c);
        c.failed(old);
        assert!(c.finish(new, exchange(), false, None).is_ok());
    }
    #[test]
    fn wrong_attempt_uid_or_configuration_cannot_restore_another_account() {
        let c = Coordinator::default();
        let s = Memory::default();
        let e = begin(&c);
        let a = c
            .finish(e, exchange(), true, Some("expected-uid".into()))
            .unwrap();
        assert!(c
            .finalize(&a.attempt_id, "different-uid", &scope(), &s)
            .is_err());
        assert!(s.read().unwrap().is_none());
        let e = begin(&c);
        let a = c.finish(e, exchange(), true, None).unwrap();
        c.finalize(&a.attempt_id, "uid", &scope(), &s).unwrap();
        let raw = s.read().unwrap().unwrap();
        assert!(SavedSession::decode(
            &raw,
            &Scope {
                project: "other".into(),
                client: "test-client".into()
            }
        )
        .is_err());
        assert!(SavedSession::decode("not-json", &scope()).is_err());
        assert!(
            SavedSession::decode(&raw.replace("\"version\":1", "\"version\":99"), &scope())
                .is_err()
        );
    }
    #[test]
    fn memory_only_login_clears_old_saved_account_and_save_failure_is_explicit() {
        let c = Coordinator::default();
        let s = Memory::default();
        s.write("old").unwrap();
        let e = begin(&c);
        let a = c.finish(e, exchange(), false, None).unwrap();
        assert!(!c.finalize(&a.attempt_id, "uid", &scope(), &s).unwrap());
        assert!(s.read().unwrap().is_none());
        let broken = Memory {
            fail_write: true,
            ..Default::default()
        };
        let e = begin(&c);
        let a = c.finish(e, exchange(), true, None).unwrap();
        assert!(c.finalize(&a.attempt_id, "uid", &scope(), &broken).is_err());
        assert!(broken.read().unwrap().is_none());
    }
    #[test]
    fn read_failure_or_delete_failure_does_not_claim_success() {
        let c = Coordinator::default();
        let broken = Memory {
            fail_delete: true,
            ..Default::default()
        };
        assert!(c.forget(&broken).is_err());
        let e = begin(&c);
        let a = c.finish(e, exchange(), false, None).unwrap();
        assert!(c.finalize(&a.attempt_id, "uid", &scope(), &broken).is_err());
    }
    #[test]
    fn stale_confirmation_does_not_consume_new_candidate() {
        let c = Coordinator::default();
        let s = Memory::default();
        let old = begin(&c);
        let old_attempt = c.finish(old, exchange(), true, None).unwrap();
        c.cancel(&s).unwrap();
        let fresh = begin(&c);
        let fresh_attempt = c.finish(fresh, exchange(), true, None).unwrap();
        assert!(c
            .finalize(&old_attempt.attempt_id, "uid", &scope(), &s)
            .is_err());
        assert!(c
            .finalize(&fresh_attempt.attempt_id, "uid", &scope(), &s)
            .unwrap());
    }
    #[test]
    fn revoked_old_restore_cannot_delete_new_saved_account() {
        let c = Coordinator::default();
        let s = Memory::default();
        let old = begin(&c);
        c.cancel(&s).unwrap();
        let fresh = begin(&c);
        let a = c.finish(fresh, exchange(), true, None).unwrap();
        c.finalize(&a.attempt_id, "new-uid", &scope(), &s).unwrap();
        c.reject_saved(old, &s).unwrap();
        assert_eq!(
            SavedSession::decode(&s.read().unwrap().unwrap(), &scope())
                .unwrap()
                .uid,
            "new-uid"
        );
    }
    #[test]
    fn interrupted_candidate_is_not_saved_and_existing_restore_is_not_deleted_by_early_cancel() {
        let s = Memory::default();
        {
            let c = Coordinator::default();
            let e = begin(&c);
            let _ = c.finish(e, exchange(), true, None).unwrap();
        }
        assert!(s.read().unwrap().is_none());
        s.write("existing-protected-record").unwrap();
        let c = Coordinator::default();
        let _ = begin(&c);
        c.cancel(&s).unwrap();
        assert_eq!(
            s.read().unwrap().as_deref(),
            Some("existing-protected-record")
        );
    }
    #[test]
    fn no_refresh_token_cannot_be_persisted() {
        let c = Coordinator::default();
        let e = begin(&c);
        let mut value = exchange();
        value.refresh_token = None;
        assert!(c.finish(e, value, true, None).is_err());
    }
}
