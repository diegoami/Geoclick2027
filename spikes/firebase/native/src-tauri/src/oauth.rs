use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use rand::{rngs::OsRng, RngCore};
use serde::Deserialize;
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
#[derive(Clone, Deserialize)]
pub struct DesktopClient {
    pub client_id: String,
    pub project_id: String,
    #[serde(default)]
    client_secret: Option<String>,
}
// Deliberately not Serialize: renewable credentials must never cross Tauri IPC.
pub struct GoogleExchange {
    pub id_token: String,
    pub subject: String,
    pub refresh_token: Option<String>,
}
#[derive(Deserialize)]
struct TokenReply {
    id_token: Option<String>,
    refresh_token: Option<String>,
}

pub enum RefreshFailure {
    Revoked,
    Unavailable,
    Rejected,
    InvalidToken,
}
impl RefreshFailure {
    pub fn message(&self) -> &'static str {
        match self {
            Self::Revoked => "Saved sign-in expired or was revoked. Sign in again.",
            Self::Unavailable => {
                "Could not contact Google. The saved sign-in was retained; retry when online."
            }
            Self::Rejected => {
                "Google rejected the request. Check the Desktop-app configuration or sign in again."
            }
            Self::InvalidToken => {
                "Google returned an identity that could not be verified. Sign in again."
            }
        }
    }
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
    if client.installed.project_id.len() < 6
        || client.installed.project_id.len() > 30
        || !client
            .installed
            .project_id
            .bytes()
            .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'-')
    {
        return Err("The Desktop-app project ID is invalid.".into());
    }
    Ok(client.installed)
}

pub fn random_secret() -> String {
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

fn request_offline_access(url: &mut Url) {
    let pairs = url
        .query_pairs()
        .filter(|(key, _)| key != "prompt")
        .map(|(k, v)| (k.into_owned(), v.into_owned()))
        .collect::<Vec<_>>();
    url.set_query(None);
    url.query_pairs_mut()
        .extend_pairs(pairs)
        .append_pair("access_type", "offline")
        .append_pair("prompt", "consent select_account");
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
fn identity_claims(
    token: &str,
    nonce: Option<&str>,
    client: &str,
    now: u64,
) -> Result<String, String> {
    let pieces: Vec<_> = token.split('.').collect();
    if pieces.len() != 3 {
        return Err("Google returned an invalid ID token.".into());
    }
    let claims = URL_SAFE_NO_PAD
        .decode(pieces[1])
        .ok()
        .and_then(|bytes| serde_json::from_slice::<serde_json::Value>(&bytes).ok())
        .ok_or("Google returned an invalid ID token.")?;
    let subject = claims["sub"]
        .as_str()
        .filter(|s| !s.is_empty() && s.len() <= 255)
        .ok_or("Google returned an invalid identity.")?;
    if nonce.is_some_and(|n| claims["nonce"].as_str() != Some(n))
        || claims["aud"].as_str() != Some(client)
        || !matches!(
            claims["iss"].as_str(),
            Some("https://accounts.google.com" | "accounts.google.com")
        )
        || claims["exp"].as_u64().is_none_or(|exp| exp <= now)
    {
        return Err("Google's ID token does not match this sign-in attempt.".into());
    }
    Ok(subject.into())
}
fn check_claims(token: &str, nonce: &str, client: &str, now: u64) -> Result<String, String> {
    identity_claims(token, Some(nonce), client, now)
}
fn now_seconds() -> Result<u64, String> {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|time| time.as_secs())
        .map_err(|_| "Check this computer's clock.".into())
}
fn classify_rejection(body: &serde_json::Value) -> RefreshFailure {
    if body["error"].as_str() == Some("invalid_grant") {
        RefreshFailure::Revoked
    } else {
        RefreshFailure::Rejected
    }
}
async fn request_tokens(form: &[(&str, &str)]) -> Result<TokenReply, RefreshFailure> {
    let http = reqwest::Client::builder()
        .timeout(Duration::from_secs(20))
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .map_err(|_| RefreshFailure::Unavailable)?;
    let response = http
        .post(GOOGLE_TOKEN)
        .form(form)
        .send()
        .await
        .map_err(|_| RefreshFailure::Unavailable)?;
    if !response.status().is_success() {
        let body = response
            .json::<serde_json::Value>()
            .await
            .unwrap_or(serde_json::Value::Null);
        return Err(classify_rejection(&body));
    }
    response
        .json()
        .await
        .map_err(|_| RefreshFailure::InvalidToken)
}

pub async fn refresh(
    client: &DesktopClient,
    refresh_token: &str,
    expected_subject: &str,
    mut cancelled: watch::Receiver<bool>,
) -> Result<GoogleExchange, RefreshFailure> {
    if *cancelled.borrow() {
        return Err(RefreshFailure::Unavailable);
    }
    let mut form = vec![
        ("client_id", client.client_id.as_str()),
        ("refresh_token", refresh_token),
        ("grant_type", "refresh_token"),
    ];
    if let Some(secret) = client.client_secret.as_deref() {
        form.push(("client_secret", secret));
    }
    let request = async {
        let token = request_tokens(&form).await?;
        let id_token = token.id_token.ok_or(RefreshFailure::InvalidToken)?;
        let now = now_seconds().map_err(|_| RefreshFailure::InvalidToken)?;
        // Refresh is bound to a native-only renewable grant, not a new browser callback.
        // Firebase still performs signature/identity verification before confirmation.
        let subject = identity_claims(&id_token, None, &client.client_id, now)
            .map_err(|_| RefreshFailure::InvalidToken)?;
        if subject != expected_subject {
            return Err(RefreshFailure::InvalidToken);
        }
        Ok(GoogleExchange {
            id_token,
            subject,
            refresh_token: token.refresh_token,
        })
    };
    tokio::select! {_ = cancelled.changed()=>Err(RefreshFailure::Unavailable), result=request=>result}
}

pub async fn login(
    client: &DesktopClient,
    remember: bool,
    mut cancelled: watch::Receiver<bool>,
    open: impl FnOnce(String) -> Result<(), String>,
) -> Result<GoogleExchange, String> {
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
    let mut authorization = auth_url(&client.client_id, &redirect, &verifier, &state, &nonce);
    if remember {
        request_offline_access(&mut authorization);
    }
    open(authorization.to_string())?;
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
        let token = request_tokens(&form).await.map_err(|error| match error {
            RefreshFailure::Revoked => {
                "Google rejected the code exchange. Start a new sign-in.".to_owned()
            }
            other => other.message().to_owned(),
        })?;
        let id_token = token
            .id_token
            .ok_or("Google did not return an identity token.")?;
        let subject = check_claims(&id_token, &nonce, &client.client_id, now_seconds()?)?;
        Ok(GoogleExchange {
            id_token,
            subject,
            refresh_token: if remember { token.refresh_token } else { None },
        })
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
    fn offline_access_is_explicit_and_does_not_duplicate_prompt() {
        let mut url = auth_url(
            "client",
            "http://127.0.0.1:1234/oauth/callback",
            "verifier",
            "state",
            "nonce",
        );
        assert!(!url.query_pairs().any(|(key, _)| key == "access_type"));
        request_offline_access(&mut url);
        let prompts = url
            .query_pairs()
            .filter(|(key, _)| key == "prompt")
            .map(|(_, v)| v.into_owned())
            .collect::<Vec<_>>();
        assert_eq!(prompts, vec!["consent select_account"]);
        assert!(url
            .query_pairs()
            .any(|(k, v)| k == "access_type" && v == "offline"));
    }
    #[test]
    fn refresh_accepts_absent_nonce_but_not_wrong_identity_or_expiry() {
        let jwt = token("original-nonce", "client", 200);
        assert_eq!(
            identity_claims(&jwt, None, "client", 100).unwrap(),
            "synthetic-subject"
        );
        assert!(identity_claims(&jwt, Some("new-nonce"), "client", 100).is_err());
        assert!(identity_claims(&jwt, None, "other-client", 100).is_err());
        assert!(identity_claims(&jwt, None, "client", 200).is_err());
        assert!(matches!(
            classify_rejection(
                &serde_json::json!({"error":"invalid_grant","error_description":"sensitive-unprinted"})
            ),
            RefreshFailure::Revoked
        ));
        assert!(matches!(
            classify_rejection(&serde_json::json!({"error":"invalid_client"})),
            RefreshFailure::Rejected
        ));
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
        format!("header.{}.signature",URL_SAFE_NO_PAD.encode(serde_json::json!({"nonce":nonce,"aud":aud,"iss":"https://accounts.google.com","exp":expiry,"sub":"synthetic-subject"}).to_string()))
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
