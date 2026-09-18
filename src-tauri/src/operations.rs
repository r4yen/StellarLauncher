use futures_util::future::{AbortHandle, Abortable};
use std::{
    collections::HashMap,
    future::Future,
    sync::{Mutex, OnceLock},
};

fn active() -> &'static Mutex<HashMap<String, AbortHandle>> {
    static ACTIVE: OnceLock<Mutex<HashMap<String, AbortHandle>>> = OnceLock::new();
    ACTIVE.get_or_init(|| Mutex::new(HashMap::new()))
}
struct Registration(String);
impl Drop for Registration {
    fn drop(&mut self) {
        if let Ok(mut active) = active().lock() {
            active.remove(&self.0);
        }
    }
}
pub async fn run<T>(
    id: String,
    operation: impl Future<Output = Result<T, String>>,
) -> Result<T, String> {
    let (handle, registration) = AbortHandle::new_pair();
    {
        let mut active = active().lock().map_err(|e| e.to_string())?;
        if active.contains_key(&id) {
            return Err("This operation is already running.".into());
        }
        active.insert(id.clone(), handle);
    }
    let _guard = Registration(id);
    Abortable::new(operation, registration)
        .await
        .map_err(|_| "Operation cancelled.".to_owned())?
}
#[tauri::command]
pub fn cancel_operation(operation_id: String) -> Result<(), String> {
    if let Some(handle) = active()
        .lock()
        .map_err(|e| e.to_string())?
        .get(&operation_id)
    {
        handle.abort();
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn cancellation_releases_registration_and_allows_retry() {
        tauri::async_runtime::block_on(async {
            let id = "cancel-test".to_owned();
            let future = run(id.clone(), async {
                cancel_operation("cancel-test".into()).unwrap();
                std::future::pending::<Result<(), String>>().await
            });
            assert_eq!(future.await.unwrap_err(), "Operation cancelled.");
            assert!(run(id, async { Ok(()) }).await.is_ok());
        });
    }
}
