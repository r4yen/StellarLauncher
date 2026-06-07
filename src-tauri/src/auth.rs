use chrono::{Duration, Utc};
use keyring::Entry;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::{collections::HashMap, fs, path::PathBuf, process::Command, sync::Mutex, time::Duration as StdDuration};
use tokio::time::sleep;
use uuid::Uuid;

const DEFAULT_MICROSOFT_CLIENT_ID: &str = "499546d9-bbfe-4b9b-a086-eb3d75afb78f";
const DEVICE_CODE_URL: &str = "https://login.microsoftonline.com/consumers/oauth2/v2.0/devicecode";
const TOKEN_URL: &str = "https://login.microsoftonline.com/consumers/oauth2/v2.0/token";
const XBOX_AUTH_URL: &str = "https://user.auth.xboxlive.com/user/authenticate";
const XSTS_AUTH_URL: &str = "https://xsts.auth.xboxlive.com/xsts/authorize";
const MINECRAFT_LOGIN_URL: &str = "https://api.minecraftservices.com/launcher/login";
const MINECRAFT_PROFILE_URL: &str = "https://api.minecraftservices.com/minecraft/profile";
const KEYRING_SERVICE: &str = "app.stellarlauncher.desktop";
const USER_AGENT: &str = "StellarLauncher/1.0.1";

#[derive(Default)]
pub struct AuthState {
    sessions: Mutex<HashMap<String, DeviceLoginSession>>,
}

#[derive(Debug, Clone)]
struct DeviceLoginSession {
    device_code: String,
    interval_seconds: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Account {
    id: String,
    username: String,
    uuid: String,
    r#type: String,
    avatar_color: String,
    skin_head_url: Option<String>,
    login_status: String,
    token_expires_at: Option<String>,
    last_used_at: Option<String>,
    is_active: bool,
    error_message: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceLoginStart {
    session_id: String,
    user_code: String,
    verification_uri: String,
    direct_verification_uri: String,
    message: String,
    expires_at: String,
    interval_seconds: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceLoginPollResult {
    status: String,
    account: Option<Account>,
    message: Option<String>,
}

#[derive(Debug, Deserialize)]
struct DeviceCodeResponse {
    device_code: String,
    user_code: String,
    verification_uri: String,
    message: String,
    expires_in: i64,
    interval: Option<u64>,
}

#[derive(Debug, Deserialize)]
struct MicrosoftTokenResponse {
    access_token: String,
    refresh_token: Option<String>,
    expires_in: Option<i64>,
}

#[derive(Debug, Deserialize)]
struct OAuthErrorResponse {
    error: String,
    error_description: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "PascalCase")]
struct XboxAuthResponse {
    token: String,
    display_claims: XboxDisplayClaims,
}

#[derive(Debug, Deserialize)]
struct XboxDisplayClaims {
    xui: Vec<XboxUserInfo>,
}

#[derive(Debug, Deserialize)]
struct XboxUserInfo {
    uhs: String,
}

#[derive(Debug, Deserialize)]
struct MinecraftTokenResponse {
    access_token: String,
    expires_in: i64,
}

#[derive(Debug, Deserialize)]
struct MinecraftProfile {
    id: String,
    name: String,
    skins: Option<Vec<MinecraftSkin>>,
}

#[derive(Debug, Deserialize)]
struct MinecraftSkin {
    url: String,
}

fn client_id() -> Result<String, String> {
    let value = std::env::var("STELLAR_MICROSOFT_CLIENT_ID").unwrap_or_else(|_| DEFAULT_MICROSOFT_CLIENT_ID.to_string());
    if value.trim().is_empty() {
        return Err("Microsoft Client ID is not configured. Set STELLAR_MICROSOFT_CLIENT_ID to your public desktop app registration id.".to_string());
    }
    Ok(value)
}

fn keyring_entry(account_id: &str) -> Result<Entry, String> {
    Entry::new(KEYRING_SERVICE, account_id).map_err(|error| format!("Cannot access OS keyring: {error}"))
}

fn store_token_bundle(account_id: &str, bundle: &serde_json::Value) -> Result<(), String> {
    let raw = bundle.to_string();
    let keyring_result = keyring_entry(account_id).and_then(|entry| {
        entry
            .set_password(&raw)
            .map_err(|error| format!("Cannot store account token material: {error}"))
    });
    write_fallback_token_bundle(account_id, &raw)?;
    keyring_result.or(Ok(()))
}

#[tauri::command]
pub fn remove_account_tokens(account_id: String) -> Result<(), String> {
    let _ = keyring_entry(&account_id).and_then(|entry| {
        entry
            .delete_credential()
            .map_err(|error| format!("Cannot remove account token material: {error}"))
    });

    let path = fallback_token_path(&account_id)?;
    if path.exists() {
        fs::remove_file(&path).map_err(|error| format!("Cannot remove fallback token material: {error}"))?;
    }

    Ok(())
}

fn fallback_token_dir() -> Result<PathBuf, String> {
    let base = std::env::var("APPDATA")
        .map(PathBuf::from)
        .or_else(|_| std::env::var("LOCALAPPDATA").map(PathBuf::from))
        .map_err(|_| "Cannot resolve AppData directory for token fallback storage.".to_string())?;
    let dir = base.join("StellarLauncher").join("account-tokens");
    fs::create_dir_all(&dir).map_err(|error| format!("Cannot create token fallback directory: {error}"))?;
    Ok(dir)
}

fn fallback_token_path(account_id: &str) -> Result<PathBuf, String> {
    let safe_id = account_id
        .chars()
        .filter(|character| character.is_ascii_alphanumeric() || *character == '-' || *character == '_')
        .collect::<String>();
    Ok(fallback_token_dir()?.join(format!("{safe_id}.json")))
}

fn write_fallback_token_bundle(account_id: &str, raw: &str) -> Result<(), String> {
    fs::write(fallback_token_path(account_id)?, raw).map_err(|error| format!("Cannot write fallback token material: {error}"))
}

fn read_token_bundle(account_id: &str) -> Result<String, String> {
    if let Ok(raw) = keyring_entry(account_id).and_then(|entry| {
        entry
            .get_password()
            .map_err(|error| format!("Cannot read account token material: {error}"))
    }) {
        return Ok(raw);
    }

    fs::read_to_string(fallback_token_path(account_id)?).map_err(|_| {
        "No token material is stored for this account. Remove the account and sign in again.".to_string()
    })
}

#[tauri::command]
pub fn open_external_url(url: String) -> Result<(), String> {
    let allowed = [
        "https://www.microsoft.com/link",
        "https://github.com/r4yen/StellarLauncher/",
        "https://discord.gg/8kMmj8Vb9Q",
    ];

    if !allowed.iter().any(|prefix| url.starts_with(prefix)) {
        return Err("This external link is not allowed.".to_string());
    }

    #[cfg(target_os = "windows")]
    let mut command = {
        let mut command = Command::new("rundll32");
        command.args(["url.dll,FileProtocolHandler", &url]);
        command
    };

    #[cfg(target_os = "macos")]
    let mut command = {
        let mut command = Command::new("open");
        command.arg(&url);
        command
    };

    #[cfg(all(unix, not(target_os = "macos")))]
    let mut command = {
        let mut command = Command::new("xdg-open");
        command.arg(&url);
        command
    };

    command
        .spawn()
        .map_err(|error| format!("Cannot open external link: {error}"))?;
    Ok(())
}

#[tauri::command]
pub async fn begin_ms_device_login(state: tauri::State<'_, AuthState>) -> Result<DeviceLoginStart, String> {
    let client_id = client_id()?;
    let response = Client::new()
        .post(DEVICE_CODE_URL)
        .form(&[
            ("client_id", client_id.as_str()),
            ("scope", "XboxLive.signin offline_access"),
        ])
        .send()
        .await
        .map_err(|error| format!("Cannot reach Microsoft device login endpoint: {error}"))?;

    if !response.status().is_success() {
        let status = response.status();
        let error_text = response.text().await.unwrap_or_else(|_| "Unknown Microsoft error".to_string());
        return Err(format!("Microsoft device login failed with {status}: {error_text}"));
    }

    let body = response
        .json::<DeviceCodeResponse>()
        .await
        .map_err(|error| format!("Cannot parse Microsoft device login response: {error}"))?;
    let session_id = Uuid::new_v4().to_string();
    let interval_seconds = body.interval.unwrap_or(5).max(2);
    let expires_at = (Utc::now() + Duration::seconds(body.expires_in)).to_rfc3339();

    state
        .sessions
        .lock()
        .map_err(|_| "Auth session lock failed.".to_string())?
        .insert(
            session_id.clone(),
            DeviceLoginSession {
                device_code: body.device_code,
                interval_seconds,
            },
        );

    let direct_verification_uri = format!("https://www.microsoft.com/link?otc={}", body.user_code);

    Ok(DeviceLoginStart {
        session_id,
        user_code: body.user_code,
        verification_uri: body.verification_uri,
        direct_verification_uri,
        message: body.message,
        expires_at,
        interval_seconds,
    })
}

#[tauri::command]
pub async fn poll_ms_device_login(state: tauri::State<'_, AuthState>, session_id: String) -> Result<DeviceLoginPollResult, String> {
    let client_id = client_id()?;
    let session = state
        .sessions
        .lock()
        .map_err(|_| "Auth session lock failed.".to_string())?
        .get(&session_id)
        .cloned()
        .ok_or_else(|| "Login session expired or not found.".to_string())?;

    let response = Client::new()
        .post(TOKEN_URL)
        .form(&[
            ("grant_type", "urn:ietf:params:oauth:grant-type:device_code"),
            ("client_id", client_id.as_str()),
            ("device_code", session.device_code.as_str()),
        ])
        .send()
        .await
        .map_err(|error| format!("Cannot poll Microsoft token endpoint: {error}"))?;

    if !response.status().is_success() {
        let error = response
            .json::<OAuthErrorResponse>()
            .await
            .unwrap_or(OAuthErrorResponse {
                error: "unknown_error".to_string(),
                error_description: None,
            });

        if error.error == "authorization_pending" || error.error == "slow_down" {
            return Ok(DeviceLoginPollResult {
                status: "pending".to_string(),
                account: None,
                message: error.error_description.or(Some(format!("Waiting for Microsoft authorization. Poll every {} seconds.", session.interval_seconds))),
            });
        }

        return Ok(DeviceLoginPollResult {
            status: "error".to_string(),
            account: None,
            message: Some(error.error_description.unwrap_or(error.error)),
        });
    }

    let microsoft_token = response
        .json::<MicrosoftTokenResponse>()
        .await
        .map_err(|error| format!("Cannot parse Microsoft token response: {error}"))?;
    let account = complete_minecraft_login(&microsoft_token).await?;

    state
        .sessions
        .lock()
        .map_err(|_| "Auth session lock failed.".to_string())?
        .remove(&session_id);

    Ok(DeviceLoginPollResult {
        status: "complete".to_string(),
        account: Some(account),
        message: None,
    })
}

#[tauri::command]
pub async fn refresh_minecraft_account(account_id: String) -> Result<DeviceLoginPollResult, String> {
    let raw = read_token_bundle(&account_id)?;
    let stored: serde_json::Value = serde_json::from_str(&raw).map_err(|error| format!("Cannot parse stored token metadata: {error}"))?;
    let refresh_token = stored
        .get("refreshToken")
        .and_then(|value| value.as_str())
        .ok_or_else(|| "No refresh token is stored for this account.".to_string())?;
    let client_id = client_id()?;

    let response = Client::new()
        .post(TOKEN_URL)
        .form(&[
            ("grant_type", "refresh_token"),
            ("client_id", client_id.as_str()),
            ("refresh_token", refresh_token),
            ("scope", "XboxLive.signin offline_access"),
        ])
        .send()
        .await
        .map_err(|error| format!("Cannot refresh Microsoft token: {error}"))?;

    if !response.status().is_success() {
        return Ok(DeviceLoginPollResult {
            status: "error".to_string(),
            account: None,
            message: Some("Microsoft refresh token was rejected. Sign in again.".to_string()),
        });
    }

    let microsoft_token = response
        .json::<MicrosoftTokenResponse>()
        .await
        .map_err(|error| format!("Cannot parse refreshed Microsoft token: {error}"))?;
    let account = complete_minecraft_login(&microsoft_token).await?;

    Ok(DeviceLoginPollResult {
        status: "complete".to_string(),
        account: Some(account),
        message: None,
    })
}

async fn complete_minecraft_login(microsoft_token: &MicrosoftTokenResponse) -> Result<Account, String> {
    let client = Client::new();
    let xbox_response = client
        .post(XBOX_AUTH_URL)
        .header("Accept", "application/json")
        .header("User-Agent", USER_AGENT)
        .json(&serde_json::json!({
            "Properties": {
                "AuthMethod": "RPS",
                "SiteName": "user.auth.xboxlive.com",
                "RpsTicket": format!("d={}", microsoft_token.access_token)
            },
            "RelyingParty": "http://auth.xboxlive.com",
            "TokenType": "JWT"
        }))
        .send()
        .await
        .map_err(|error| format!("Xbox Live authentication failed: {error}"))?;

    if !xbox_response.status().is_success() {
        return Err("Xbox Live authentication was rejected.".to_string());
    }

    let xbox = xbox_response
        .json::<XboxAuthResponse>()
        .await
        .map_err(|error| format!("Cannot parse Xbox Live response: {error}"))?;
    let xsts_response = client
        .post(XSTS_AUTH_URL)
        .header("Accept", "application/json")
        .header("User-Agent", USER_AGENT)
        .json(&serde_json::json!({
            "Properties": {
                "SandboxId": "RETAIL",
                "UserTokens": [xbox.token]
            },
            "RelyingParty": "rp://api.minecraftservices.com/",
            "TokenType": "JWT"
        }))
        .send()
        .await
        .map_err(|error| format!("XSTS authentication failed: {error}"))?;

    if !xsts_response.status().is_success() {
        return Err("XSTS authentication was rejected. The Microsoft account may not have Xbox access.".to_string());
    }

    let xsts = xsts_response
        .json::<XboxAuthResponse>()
        .await
        .map_err(|error| format!("Cannot parse XSTS response: {error}"))?;
    let user_hash = xsts
        .display_claims
        .xui
        .first()
        .map(|info| info.uhs.clone())
        .ok_or_else(|| "XSTS response did not include a user hash.".to_string())?;
    let identity_token = format!("XBL3.0 x={};{}", user_hash, xsts.token);
    let minecraft_token = request_minecraft_token(&client, &identity_token).await?;
    let profile_response = client
        .get(MINECRAFT_PROFILE_URL)
        .header("Accept", "application/json")
        .header("User-Agent", USER_AGENT)
        .bearer_auth(&minecraft_token.access_token)
        .send()
        .await
        .map_err(|error| format!("Cannot request Minecraft profile: {error}"))?;

    if !profile_response.status().is_success() {
        return Err("No Minecraft Java profile was returned for this Microsoft account.".to_string());
    }

    let profile = profile_response
        .json::<MinecraftProfile>()
        .await
        .map_err(|error| format!("Cannot parse Minecraft profile: {error}"))?;
    let account_id = profile.id.clone();
    let expires_at = (Utc::now() + Duration::seconds(minecraft_token.expires_in)).to_rfc3339();
    let skin_head_url = Some(format!("https://mc-heads.net/head/{}/96", profile.id));

    store_token_bundle(
        &account_id,
        &serde_json::json!({
            "refreshToken": microsoft_token.refresh_token.clone(),
            "minecraftAccessToken": minecraft_token.access_token.clone(),
            "minecraftTokenExpiresAt": expires_at.clone()
        }),
    )?;

    Ok(Account {
        id: account_id.clone(),
        username: profile.name,
        uuid: profile.id,
        r#type: "microsoft".to_string(),
        avatar_color: "#22d3ee".to_string(),
        skin_head_url,
        login_status: "active".to_string(),
        token_expires_at: Some(expires_at),
        last_used_at: Some(Utc::now().to_rfc3339()),
        is_active: true,
        error_message: None,
    })
}

async fn request_minecraft_token(client: &Client, identity_token: &str) -> Result<MinecraftTokenResponse, String> {
    let mut last_service_error = None;

    for attempt in 0..3 {
        let minecraft_response = client
            .post(MINECRAFT_LOGIN_URL)
            .header("Accept", "application/json")
            .header("User-Agent", USER_AGENT)
            .json(&serde_json::json!({
                "platform": "PC_LAUNCHER",
                "xtoken": identity_token
            }))
            .send()
            .await
            .map_err(|error| format!("Minecraft Services authentication failed: {error}"))?;

        if minecraft_response.status().is_success() {
            return minecraft_response
                .json::<MinecraftTokenResponse>()
                .await
                .map_err(|error| format!("Cannot parse Minecraft Services token response: {error}"));
        }

        let status = minecraft_response.status();
        let error_text = minecraft_response.text().await.unwrap_or_else(|_| "No response body".to_string());
        last_service_error = Some(format!("Minecraft Services launcher login rejected the XSTS token with {status}: {error_text}"));

        if matches!(status.as_u16(), 502 | 503 | 504) && attempt < 2 {
            sleep(StdDuration::from_millis(750 * (attempt + 1) as u64)).await;
            continue;
        }

        break;
    }

    Err(last_service_error.unwrap_or_else(|| "Minecraft Services authentication failed.".to_string()))
}
