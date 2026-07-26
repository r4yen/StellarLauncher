use discord_rich_presence::{
    activity::{Activity, ActivityType, Button},
    DiscordIpc, DiscordIpcClient,
};
use serde::Deserialize;
use std::sync::Mutex;

const DISCORD_APPLICATION_ID: &str = "1512044379957756014";
const GITHUB_URL: &str = "https://github.com/r4yen/StellarLauncher/";
const DISCORD_INVITE_URL: &str = "https://discord.gg/8kMmj8Vb9Q";

#[derive(Default)]
pub struct DiscordRpcState {
    client: Mutex<Option<DiscordIpcClient>>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiscordRpcActivity {
    pub enabled: bool,
    pub details: String,
    pub state: Option<String>,
}

#[tauri::command]
pub fn update_discord_rpc(
    state: tauri::State<DiscordRpcState>,
    activity: DiscordRpcActivity,
) -> Result<(), String> {
    if !activity.enabled {
        return clear_discord_rpc(state);
    }

    let mut guard = state
        .client
        .lock()
        .map_err(|_| "Cannot lock Discord RPC state.".to_string())?;
    if guard.is_none() {
        let mut client = DiscordIpcClient::new(DISCORD_APPLICATION_ID);
        client
            .connect()
            .map_err(|error| format!("Cannot connect to Discord RPC: {error}"))?;
        *guard = Some(client);
    }

    let mut payload = Activity::new()
        .activity_type(ActivityType::Playing)
        .details(activity.details)
        .buttons(vec![
            Button::new("View GitHub", GITHUB_URL),
            Button::new("Join Discord", DISCORD_INVITE_URL),
        ]);

    if let Some(state) = activity.state {
        if !state.trim().is_empty() {
            payload = payload.state(state);
        }
    }

    let client = guard
        .as_mut()
        .ok_or_else(|| "Discord RPC client is not available.".to_string())?;
    if client.set_activity(payload.clone()).is_err() {
        let mut client = DiscordIpcClient::new(DISCORD_APPLICATION_ID);
        client
            .connect()
            .map_err(|error| format!("Cannot reconnect to Discord RPC: {error}"))?;
        client
            .set_activity(payload)
            .map_err(|error| format!("Cannot update Discord RPC: {error}"))?;
        *guard = Some(client);
    }

    Ok(())
}

#[tauri::command]
pub fn clear_discord_rpc(state: tauri::State<DiscordRpcState>) -> Result<(), String> {
    let mut guard = state
        .client
        .lock()
        .map_err(|_| "Cannot lock Discord RPC state.".to_string())?;
    if let Some(client) = guard.as_mut() {
        let _ = client.clear_activity();
        let _ = client.close();
    }
    *guard = None;
    Ok(())
}
