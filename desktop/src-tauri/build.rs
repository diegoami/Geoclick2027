use std::{env, fs, path::PathBuf};
fn main() {
    println!("cargo:rerun-if-env-changed=GEOCLICK_GOOGLE_DESKTOP_CLIENT_FILE");
    let source = match env::var_os("GEOCLICK_GOOGLE_DESKTOP_CLIENT_FILE") {
        Some(file) => {
            let path = PathBuf::from(file)
                .canonicalize()
                .expect("Desktop OAuth configuration file is unavailable");
            println!("cargo:rerun-if-changed={}", path.display());
            // Generated source contains only the external path. The downloaded JSON
            // stays outside the repo and no client contents are printed in build logs.
            format!(
                "pub const DESKTOP_CLIENT_JSON: Option<&str> = Some(include_str!({:?}));",
                path.to_string_lossy()
            )
        }
        None => "pub const DESKTOP_CLIENT_JSON: Option<&str> = None;".to_string(),
    };
    let output = PathBuf::from(env::var_os("OUT_DIR").expect("Missing build output"));
    fs::write(output.join("desktop_oauth_config.rs"), source)
        .expect("Could not prepare native account configuration");
    tauri_build::build()
}
