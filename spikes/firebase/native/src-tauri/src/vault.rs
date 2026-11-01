// Only our proof's scoped entry is read/written. No credential enumeration.
use sha2::{Digest, Sha256};

pub trait SecretStore {
    fn read(&self) -> Result<Option<String>, String>;
    fn write(&self, value: &str) -> Result<(), String>;
    fn delete(&self) -> Result<(), String>;
}

pub struct WindowsVault {
    target: String,
}
impl WindowsVault {
    pub fn new(project: &str, client: &str) -> Self {
        let hash = Sha256::digest(client.as_bytes());
        let suffix = hash
            .iter()
            .map(|byte| format!("{byte:02x}"))
            .collect::<String>();
        Self {
            target: format!("Geoclick/FirebaseProof/v1/{project}/{suffix}"),
        }
    }
    pub fn supported() -> bool {
        cfg!(windows)
    }
}

#[cfg(windows)]
impl SecretStore for WindowsVault {
    fn read(&self) -> Result<Option<String>, String> {
        use windows_sys::Win32::{
            Foundation::{GetLastError, ERROR_NOT_FOUND},
            Security::Credentials::*,
        };
        let target = self.target.encode_utf16().chain([0]).collect::<Vec<_>>();
        let mut raw = std::ptr::null_mut();
        // SAFETY: target is terminated and lives across the call; raw is an out pointer.
        if unsafe { CredReadW(target.as_ptr(), CRED_TYPE_GENERIC, 0, &mut raw) } == 0 {
            return if unsafe { GetLastError() } == ERROR_NOT_FOUND {
                Ok(None)
            } else {
                Err("Windows could not read the saved sign-in.".into())
            };
        }
        if raw.is_null() {
            return Err("Windows returned an unreadable saved sign-in.".into());
        }
        struct Guard(*mut CREDENTIALW);
        impl Drop for Guard {
            fn drop(&mut self) {
                unsafe { CredFree(self.0.cast()) };
            }
        }
        let guard = Guard(raw);
        // SAFETY: successful CredReadW owns this allocation until guard calls CredFree.
        let credential = unsafe { &*guard.0 };
        let size = credential.CredentialBlobSize as usize;
        if size > CRED_MAX_CREDENTIAL_BLOB_SIZE as usize
            || (size > 0 && credential.CredentialBlob.is_null())
        {
            return Err("Windows returned an unreadable saved sign-in.".into());
        }
        let bytes = if size == 0 {
            &[][..]
        } else {
            unsafe { std::slice::from_raw_parts(credential.CredentialBlob, size) }
        };
        String::from_utf8(bytes.to_vec())
            .map(Some)
            .map_err(|_| "The saved sign-in is unreadable. Forget it and sign in again.".into())
    }
    fn write(&self, value: &str) -> Result<(), String> {
        use windows_sys::Win32::Security::Credentials::*;
        if value.len() > CRED_MAX_CREDENTIAL_BLOB_SIZE as usize {
            return Err("The sign-in is too large for Windows Credential Manager.".into());
        }
        let mut target = self.target.encode_utf16().chain([0]).collect::<Vec<_>>();
        let mut username = "Google".encode_utf16().chain([0]).collect::<Vec<_>>();
        let credential = CREDENTIALW {
            Type: CRED_TYPE_GENERIC,
            TargetName: target.as_mut_ptr(),
            CredentialBlobSize: value.len() as u32,
            CredentialBlob: value.as_ptr().cast_mut(),
            Persist: CRED_PERSIST_LOCAL_MACHINE,
            UserName: username.as_mut_ptr(),
            ..unsafe { std::mem::zeroed() }
        };
        // SAFETY: all input buffers outlive this synchronous copying call; optional fields are zero.
        if unsafe { CredWriteW(&credential, 0) } == 0 {
            Err("Windows could not save this sign-in. Nothing was saved as plaintext.".into())
        } else {
            Ok(())
        }
    }
    fn delete(&self) -> Result<(), String> {
        use windows_sys::Win32::{
            Foundation::{GetLastError, ERROR_NOT_FOUND},
            Security::Credentials::*,
        };
        let target = self.target.encode_utf16().chain([0]).collect::<Vec<_>>();
        if unsafe { CredDeleteW(target.as_ptr(), CRED_TYPE_GENERIC, 0) } != 0
            || unsafe { GetLastError() } == ERROR_NOT_FOUND
        {
            Ok(())
        } else {
            Err("Windows could not remove the saved sign-in. Retry forgetting this device.".into())
        }
    }
}

#[cfg(not(windows))]
impl SecretStore for WindowsVault {
    fn read(&self) -> Result<Option<String>, String> {
        Ok(None)
    }
    fn write(&self, _value: &str) -> Result<(), String> {
        Err("Remembering sign-in is available only on Windows in this proof.".into())
    }
    fn delete(&self) -> Result<(), String> {
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn targets_separate_clients_and_projects() {
        assert_ne!(
            WindowsVault::new("one", "client").target,
            WindowsVault::new("two", "client").target
        );
        assert_ne!(
            WindowsVault::new("one", "client").target,
            WindowsVault::new("one", "other").target
        );
        assert!(WindowsVault::new("one", "client")
            .target
            .starts_with("Geoclick/FirebaseProof/v1/one/"));
    }
    #[cfg(windows)]
    #[test]
    fn real_windows_vault_roundtrip_and_deletion_use_disposable_entry_only() {
        let unique = crate::oauth::random_secret();
        let vault = WindowsVault::new("disposable-test", &unique);
        struct Cleanup<'a>(&'a WindowsVault);
        impl Drop for Cleanup<'_> {
            fn drop(&mut self) {
                let _ = self.0.delete();
            }
        }
        let _cleanup = Cleanup(&vault);
        assert!(vault.read().unwrap().is_none());
        vault.write("synthetic-secret-one").unwrap();
        assert_eq!(
            vault.read().unwrap().as_deref(),
            Some("synthetic-secret-one")
        );
        vault.write("synthetic-secret-two").unwrap();
        assert_eq!(
            vault.read().unwrap().as_deref(),
            Some("synthetic-secret-two")
        );
        vault.delete().unwrap();
        assert!(vault.read().unwrap().is_none());
        vault.delete().unwrap();
    }
    #[cfg(windows)]
    #[test]
    fn oversize_blob_does_not_replace_existing_entry() {
        let vault = WindowsVault::new("disposable-test", &crate::oauth::random_secret());
        vault.write("synthetic-existing").unwrap();
        let result = vault.write(&"x".repeat(3000));
        let retained = vault.read().unwrap();
        vault.delete().unwrap();
        assert!(result.is_err());
        assert_eq!(retained.as_deref(), Some("synthetic-existing"));
    }
}
