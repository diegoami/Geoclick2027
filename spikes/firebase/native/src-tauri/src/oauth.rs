use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use rand::{rngs::OsRng, RngCore};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    collections::HashMap,
    time::{Duration, SystemTime, UNIX_EPOCH},
};
use tokio::{
    io::{AsyncReadExt, AsyncWriteExt},
    net::{TcpListener, TcpStream},
    sync::watch,
};
use url::Url;

const GOOGLE_AUTH: &str = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN: &str = "https://oauth2.googleapis.com/token";
const CALLBACK: &str = "/oauth/callback";
const TIMEOUT: Duration = Duration::from_secs(180);

#[derive(Deserialize)]
struct DownloadedClient {
    installed: DesktopClient,
}
#[derive(Deserialize)]
pub struct DesktopClient {
    client_id: String,
    #[serde(default)]
    client_secret: Option<String>,
}
#[derive(Serialize)]
pub struct GoogleCredential {
    id_token: String,
}
#[derive(Deserialize)]
struct TokenReply {
    id_token: Option<String>,
}

pub fn load_client() -> Result<DesktopClient, String> {
    let file = std::env::var_os("GEOCLICK_GOOGLE_DESKTOP_CLIENT_FILE")
        .ok_or("Desktop-app OAuth configuration is not set.")?;
    let raw = std::fs::read_to_string(file)
        .map_err(|_| "Could not read the Desktop-app OAuth configuration.")?;
    let client: DownloadedClient = serde_json::from_str(&raw).map_err(|_| {
        "Use Google's downloaded Desktop-app OAuth JSON, not a Web client or service-account key."
    })?;
    if !client
        .installed
        .client_id
        .ends_with(".apps.googleusercontent.com")
    {
        return Err("The Desktop-app OAuth client ID is invalid.".into());
    }
    Ok(client.installed)
}

fn random_secret() -> String {
    let mut bytes = [0u8; 32];
    OsRng.fill_bytes(&mut bytes);
    URL_SAFE_NO_PAD.encode(bytes)
}
fn challenge(verifier: &str) -> String {
    URL_SAFE_NO_PAD.encode(Sha256::digest(verifier.as_bytes()))
}
fn auth_url(client: &str, redirect: &str, verifier: &str, state: &str, nonce: &str) -> Url {
    let mut url = Url::parse(GOOGLE_AUTH).expect("constant Google URL");
    url.query_pairs_mut().extend_pairs([
        ("client_id", client),
        ("redirect_uri", redirect),
        ("response_type", "code"),
        ("scope", "openid email profile"),
        ("code_challenge_method", "S256"),
        ("code_challenge", &challenge(verifier)),
        ("state", state),
        ("nonce", nonce),
        ("prompt", "select_account"),
    ]);
    url
}

// Never echo callback URLs, authorization codes or token-response bodies in errors.
#[derive(Debug, PartialEq)]
enum Callback {
    Code(String),
    Denied,
    Ignore,
}
fn parse_callback(request: &str, address: &str, expected_state: &str) -> Callback {
    let mut lines = request.split("\r\n");
    let Some(first) = lines.next() else {
        return Callback::Ignore;
    };
    let parts: Vec<_> = first.split_whitespace().collect();
    if parts.len() != 3
        || parts[0] != "GET"
        || !parts[1].starts_with('/')
        || parts[1].starts_with("//")
    {
        return Callback::Ignore;
    }
    let hosts: Vec<_> = lines
        .filter_map(|line| line.split_once(':'))
        .filter(|(name, _)| name.eq_ignore_ascii_case("host"))
        .map(|(_, value)| value.trim())
        .collect();
    if hosts != [address] {
        return Callback::Ignore;
    }
    let Ok(url) = Url::parse(&format!("http://{address}{}", parts[1])) else {
        return Callback::Ignore;
    };
    if url.path() != CALLBACK || url.fragment().is_some() {
        return Callback::Ignore;
    }
    let mut query = HashMap::new();
    for (key, value) in url.query_pairs() {
        if query.insert(key.into_owned(), value.into_owned()).is_some() {
            return Callback::Ignore;
        }
    }
    if query.get("state").map(String::as_str) != Some(expected_state) {
        return Callback::Ignore;
    }
    if query.contains_key("error") {
        return Callback::Denied;
    }
    match query.remove("code") {
        Some(code) if !code.is_empty() => Callback::Code(code),
        _ => Callback::Ignore,
    }
}

async fn request_head(stream: &mut TcpStream) -> Result<String, ()> {
    let mut bytes = Vec::new();
    let mut chunk = [0u8; 1024];
    loop {
        let read = stream.read(&mut chunk).await.map_err(|_| ())?;
        if read == 0 {
            return Err(());
        }
        bytes.extend_from_slice(&chunk[..read]);
        if bytes.len() > 8192 {
            return Err(());
        }
        if bytes.windows(4).any(|part| part == b"\r\n\r\n") {
            break;
        }
    }
    String::from_utf8(bytes).map_err(|_| ())
}
async fn reply(stream: &mut TcpStream, valid: bool) {
    let body = if valid {
        "Sign-in response received. Close this tab and return to Geoclick Firebase Proof."
    } else {
        "This is not a valid sign-in response. Return to the application."
    };
    let status = if valid { "200 OK" } else { "400 Bad Request" };
    let response = format!("HTTP/1.1 {status}\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Length: {}\r\nCache-Control: no-store\r\nReferrer-Policy: no-referrer\r\nConnection: close\r\n\r\n{body}", body.len());
    let _ = tokio::time::timeout(
        Duration::from_secs(2),
        stream.write_all(response.as_bytes()),
    )
    .await;
}
async fn receive_code(
    listener: TcpListener,
    state: &str,
    mut cancelled: watch::Receiver<bool>,
    timeout: Duration,
) -> Result<String, String> {
    if *cancelled.borrow() {
        return Err("Sign-in cancelled.".into());
    }
    let address = listener
        .local_addr()
        .map_err(|_| "Could not read the callback address.")?
        .to_string();
    let receive = async {
        loop {
            let accepted = tokio::select! {
                _ = cancelled.changed() => return Err("Sign-in cancelled.".to_owned()),
                connection = listener.accept() => connection,
            };
            let (mut stream, peer) =
                accepted.map_err(|_| "Could not receive the sign-in response.")?;
            if !peer.ip().is_loopback() {
                continue;
            }
            let request = tokio::select! {
                _ = cancelled.changed() => return Err("Sign-in cancelled.".to_owned()),
                head = tokio::time::timeout(Duration::from_secs(2), request_head(&mut stream)) => head,
            };
            let parsed = request
                .ok()
                .and_then(Result::ok)
                .map(|head| parse_callback(&head, &address, state))
                .unwrap_or(Callback::Ignore);
            reply(&mut stream, parsed != Callback::Ignore).await;
            match parsed {
                Callback::Code(code) => return Ok(code),
                Callback::Denied => return Err("Google sign-in was declined or cancelled.".into()),
                Callback::Ignore => {}
            }
        }
    };
    tokio::time::timeout(timeout, receive)
        .await
        .map_err(|_| "Sign-in timed out. Start a new attempt.".to_owned())?
}

// These checks bind the response to this attempt. Firebase must still verify
// the Google signature/identity; this parser alone is NOT token authentication.
fn check_claims(token: &str, nonce: &str, client: &str, now: u64) -> Result<(), String> {
    let pieces: Vec<_> = token.split('.').collect();
    if pieces.len() != 3 {
        return Err("Google returned an invalid ID token.".into());
    }
    let claims = URL_SAFE_NO_PAD
        .decode(pieces[1])
        .ok()
        .and_then(|data| serde_json::from_slice::<serde_json::Value>(&data).ok())
        .ok_or("Google returned an invalid ID token.")?;
    let issuer = claims["iss"].as_str();
    if claims["nonce"].as_str() != Some(nonce)
        || claims["aud"].as_str() != Some(client)
        || !matches!(
            issuer,
            Some("https://accounts.google.com" | "accounts.google.com")
        )
        || claims["exp"].as_u64().is_none_or(|expiry| expiry <= now)
    {
        return Err("Google's ID token does not match this sign-in attempt.".into());
    }
    Ok(())
}

pub async fn login(
    client: DesktopClient,
    mut cancelled: watch::Receiver<bool>,
    open: impl FnOnce(String) -> Result<(), String>,
) -> Result<GoogleCredential, String> {
    let listener = TcpListener::bind("127.0.0.1:0")
        .await
        .map_err(|_| "Could not open the local sign-in callback.")?;
    let address = listener
        .local_addr()
        .map_err(|_| "Could not read the callback address.")?;
    let redirect = format!("http://{address}{CALLBACK}");
    let verifier = random_secret();
    let state = random_secret();
    let nonce = random_secret();
    open(auth_url(&client.client_id, &redirect, &verifier, &state, &nonce).to_string())?;
    let code = receive_code(listener, &state, cancelled.clone(), TIMEOUT).await?;
    if *cancelled.borrow() {
        return Err("Sign-in cancelled.".into());
    }
    let mut form = vec![
        ("client_id", client.client_id.as_str()),
        ("code", code.as_str()),
        ("code_verifier", verifier.as_str()),
        ("redirect_uri", redirect.as_str()),
        ("grant_type", "authorization_code"),
    ];
    if let Some(secret) = client.client_secret.as_deref() {
        form.push(("client_secret", secret));
    }
    let exchange = async {
        let http = reqwest::Client::builder()
            .timeout(Duration::from_secs(20))
            .redirect(reqwest::redirect::Policy::none())
            .build()
            .map_err(|_| "Could not initialize the token exchange.")?;
        let response = http
            .post(GOOGLE_TOKEN)
            .form(&form)
            .send()
            .await
            .map_err(|_| "Could not contact Google. Start a new attempt.")?;
        if !response.status().is_success() {
            return Err(
                "Google rejected the code exchange. Check the Desktop-app client configuration."
                    .to_owned(),
            );
        }
        let token: TokenReply = response
            .json()
            .await
            .map_err(|_| "Google returned an unreadable token response.")?;
        let id_token = token
            .id_token
            .ok_or("Google did not return an identity token.")?;
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_err(|_| "Check this computer's clock.")?
            .as_secs();
        check_claims(&id_token, &nonce, &client.client_id, now)?;
        Ok(GoogleCredential { id_token })
    };
    tokio::select! { _ = cancelled.changed() => Err("Sign-in cancelled.".into()), result = exchange => result }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn request(target: &str) -> String {
        format!("GET {target} HTTP/1.1\r\nHost: 127.0.0.1:1234\r\n\r\n")
    }
    #[test]
    fn pkce_matches_rfc7636_vector() {
        assert_eq!(
            challenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"),
            "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"
        );
    }
    #[test]
    fn secrets_are_independent_and_long_enough() {
        let one = random_secret();
        assert_eq!(one.len(), 43);
        assert_ne!(one, random_secret());
    }
    #[test]
    fn request_is_bound_to_state_host_path_and_method() {
        let valid = request("/oauth/callback?state=expected&code=secret");
        assert_eq!(
            parse_callback(&valid, "127.0.0.1:1234", "expected"),
            Callback::Code("secret".into())
        );
        for invalid in [
            valid.replace("expected", "wrong"),
            valid.replace("127.0.0.1:1234", "attacker.test"),
            valid.replace("GET ", "POST "),
            valid.replace("/oauth/callback", "/wrong"),
            valid.replace("state=expected", "state=expected&state=wrong"),
            valid.replace("code=secret", "code="),
        ] {
            assert_eq!(
                parse_callback(&invalid, "127.0.0.1:1234", "expected"),
                Callback::Ignore
            );
        }
    }
    #[test]
    fn provider_error_requires_valid_state() {
        assert_eq!(
            parse_callback(
                &request("/oauth/callback?state=expected&error=access_denied"),
                "127.0.0.1:1234",
                "expected"
            ),
            Callback::Denied
        );
        assert_eq!(
            parse_callback(
                &request("/oauth/callback?state=wrong&error=access_denied"),
                "127.0.0.1:1234",
                "expected"
            ),
            Callback::Ignore
        );
    }
    #[test]
    fn authorization_uses_only_google_identity_scopes_and_pkce() {
        let url = auth_url(
            "client",
            "http://127.0.0.1:1234/oauth/callback",
            "verifier",
            "state",
            "nonce",
        );
        let pairs: HashMap<_, _> = url.query_pairs().collect();
        assert_eq!(
            url.origin().ascii_serialization(),
            "https://accounts.google.com"
        );
        assert_eq!(pairs["code_challenge_method"], "S256");
        assert_eq!(pairs["scope"], "openid email profile");
        assert!(!pairs.contains_key("client_secret"));
        assert!(!pairs.contains_key("code_verifier"));
    }
    fn token(nonce: &str, aud: &str, expiry: u64) -> String {
        format!("header.{}.signature",URL_SAFE_NO_PAD.encode(serde_json::json!({"nonce":nonce,"aud":aud,"iss":"https://accounts.google.com","exp":expiry}).to_string()))
    }
    #[test]
    fn id_token_claims_reject_other_attempts_clients_and_expiry() {
        assert!(check_claims(&token("nonce", "client", 200), "nonce", "client", 100).is_ok());
        for invalid in [
            token("other", "client", 200),
            token("nonce", "other", 200),
            token("nonce", "client", 100),
            "not-a-token".into(),
        ] {
            assert!(check_claims(&invalid, "nonce", "client", 100).is_err());
        }
    }
    #[tokio::test]
    async fn listener_rejects_forgery_then_accepts_once_and_closes() {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let address = listener.local_addr().unwrap();
        let (_cancel, receiver) = watch::channel(false);
        let task = tokio::spawn(async move {
            receive_code(listener, "expected", receiver, Duration::from_secs(3)).await
        });
        let http = reqwest::Client::new();
        let rejected = http
            .get(format!(
                "http://{address}/oauth/callback?state=wrong&code=forged"
            ))
            .send()
            .await
            .unwrap();
        assert_eq!(rejected.status(), 400);
        assert!(!rejected.text().await.unwrap().contains("forged"));
        let accepted = http
            .get(format!(
                "http://{address}/oauth/callback?state=expected&code=valid"
            ))
            .send()
            .await
            .unwrap();
        assert_eq!(accepted.status(), 200);
        assert_eq!(task.await.unwrap().unwrap(), "valid");
        assert!(http
            .get(format!(
                "http://{address}/oauth/callback?state=expected&code=replay"
            ))
            .send()
            .await
            .is_err());
    }
    #[tokio::test]
    async fn cancellation_closes_listener() {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let address = listener.local_addr().unwrap();
        let (cancel, receiver) = watch::channel(false);
        let task = tokio::spawn(async move {
            receive_code(listener, "state", receiver, Duration::from_secs(3)).await
        });
        cancel.send(true).unwrap();
        assert_eq!(task.await.unwrap().unwrap_err(), "Sign-in cancelled.");
        assert!(TcpStream::connect(address).await.is_err());
    }
    #[tokio::test]
    async fn timeout_closes_listener() {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let address = listener.local_addr().unwrap();
        let (_cancel, receiver) = watch::channel(false);
        assert!(
            receive_code(listener, "state", receiver, Duration::from_millis(10))
                .await
                .unwrap_err()
                .contains("timed out")
        );
        assert!(TcpStream::connect(address).await.is_err());
    }
}
