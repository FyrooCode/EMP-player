use tauri_plugin_sql::{Migration, MigrationKind};
use std::fs;
use std::path::{Path, PathBuf};
use std::borrow::Cow;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Manager, State, Emitter}; 
use lofty::prelude::*;
use lofty::probe::Probe;
use notify::{Watcher, RecursiveMode};

struct WatcherState {
    watcher: Arc<Mutex<Option<notify::RecommendedWatcher>>>,
}

fn extract_cover(path: &Path, app_handle: &AppHandle) -> String {
    if let Ok(tagged_file) = Probe::open(path).unwrap().read() {
        if let Some(tag) = tagged_file.primary_tag() {
            if let Some(picture) = tag.pictures().first() {
                let local_data = app_handle.path().app_local_data_dir().unwrap_or_default();
                let covers_dir = local_data.join("covers");
                if !covers_dir.exists() { let _ = fs::create_dir_all(&covers_dir); }

                let album_name = tag.album().unwrap_or(Cow::Borrowed("unknown"));
                let safe_album_name = album_name.replace(|c: char| !c.is_alphanumeric(), "_");
                let cover_path = covers_dir.join(format!("{}.jpg", safe_album_name));

                if !cover_path.exists() { let _ = fs::write(&cover_path, picture.data()); }
                return cover_path.to_string_lossy().into_owned();
            }
        }
    }
    String::new()
}

fn scan_directory_recursive(dir: &Path, music_data: &mut Vec<serde_json::Value>, app_handle: &AppHandle) {
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let entry_path = entry.path();
            if entry_path.is_file() {
                if let Some(ext) = entry_path.extension() {
                    let ext_str = ext.to_string_lossy().to_lowercase();
                    if ["mp3", "flac", "wav", "m4a", "ogg"].contains(&ext_str.as_str()) {
                        let mut title = entry_path.file_name().unwrap().to_string_lossy().into_owned();
                        let mut artist = String::from("Unknown Artist");
                        let mut album = String::from("Unknown Album");
                        let mut duration = 0;
                        let mut cover_path = String::new();
                        let mut lyrics = String::new();
                        let mut track_num = 0;
                        let mut disc_num = 1;

                        if let Ok(tagged_file) = Probe::open(&entry_path).and_then(|p| p.read()) {
                            duration = tagged_file.properties().duration().as_secs() as i32;
                            if let Some(tag) = tagged_file.primary_tag() {
                                if let Some(t) = tag.title() { title = t.to_string(); }
                                if let Some(a) = tag.artist() { artist = a.to_string(); }
                                if let Some(al) = tag.album() { album = al.to_string(); }
                                track_num = tag.track().unwrap_or(0) as i32;
                                disc_num = tag.disk().unwrap_or(1) as i32;
                                if let Some(lyr) = tag.get_string(lofty::tag::ItemKey::Lyrics) { lyrics = lyr.to_string(); }
                                cover_path = extract_cover(&entry_path, app_handle);
                            }
                        }

                        music_data.push(serde_json::json!({
                            "title": title, "artist": artist, "album": album,
                            "path": entry_path.to_string_lossy(), "duration": duration,
                            "cover_path": cover_path, "lyrics": lyrics,
                            "track_num": track_num, "disc_num": disc_num
                        }));
                    }
                }
            } else if entry_path.is_dir() { scan_directory_recursive(&entry_path, music_data, app_handle); }
        }
    }
}

#[tauri::command]
async fn fetch_external_artist_data(artist: String) -> Result<serde_json::Value, String> {
    let url = format!("https://api.deezer.com/search/artist?q={}", urlencoding::encode(&artist));
    let client = reqwest::Client::new();
    let response = client.get(url).header("User-Agent", "EMP-Player/1.0").send().await.map_err(|e| e.to_string())?.json::<serde_json::Value>().await.map_err(|e| e.to_string())?;
    if let Some(data) = response["data"].get(0) { return Ok(data.clone()); }
    Err("Not found".into())
}

#[tauri::command]
async fn download_artist_image(url: String, artist_name: String, app_handle: AppHandle) -> Result<String, String> {
    let artist_dir = app_handle.path().app_local_data_dir().unwrap_or_default().join("artist_images");
    if !artist_dir.exists() { fs::create_dir_all(&artist_dir).map_err(|e| e.to_string())?; }
    let file_path = artist_dir.join(format!("{}.jpg", artist_name.replace(|c: char| !c.is_alphanumeric(), "_")));
    if file_path.exists() { return Ok(file_path.to_string_lossy().into_owned()); }
    let bytes = reqwest::get(url).await.map_err(|e| e.to_string())?.bytes().await.map_err(|e| e.to_string())?;
    fs::write(&file_path, bytes).map_err(|e| e.to_string())?;
    Ok(file_path.to_string_lossy().into_owned())
}

#[tauri::command]
async fn start_monitoring(path: String, app_handle: AppHandle, state: State<'_, WatcherState>) -> Result<(), String> {
    let mut watcher_lock = state.watcher.lock().unwrap();
    let path_to_watch = PathBuf::from(&path);
    let app_handle_clone = app_handle.clone();
    
    let mut watcher = notify::recommended_watcher(move |res: notify::Result<notify::Event>| { 
        if res.is_ok() { 
            let _ = app_handle_clone.emit("library-changed", ()); 
        } 
    }).map_err(|e| e.to_string())?;

    watcher.watch(&path_to_watch, RecursiveMode::Recursive).map_err(|e| e.to_string())?;
    *watcher_lock = Some(watcher);
    Ok(())
}

#[tauri::command]
async fn scan_music_folder(folder_path: String, app_handle: AppHandle) -> Result<Vec<serde_json::Value>, String> {
    let mut data = Vec::new();
    let path = Path::new(&folder_path);
    if path.is_dir() { scan_directory_recursive(path, &mut data, &app_handle); Ok(data) }
    else { Err("Invalid path".into()) }
}

#[tauri::command]
async fn read_lrc_file(path: String) -> Result<String, String> { fs::read_to_string(path).map_err(|e| e.to_string()) }

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![
        Migration {
            version: 1,
            description: "normalized_schema_v2",
            sql: "
                PRAGMA journal_mode=WAL;
                PRAGMA synchronous=NORMAL;
                PRAGMA busy_timeout=5000;

                CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);
                CREATE TABLE IF NOT EXISTS artists (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT UNIQUE,
                    image_path TEXT,
                    bio TEXT,
                    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
                );
                CREATE TABLE IF NOT EXISTS albums (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    title TEXT,
                    artist_id INTEGER,
                    cover_path TEXT,
                    year INTEGER,
                    FOREIGN KEY (artist_id) REFERENCES artists (id) ON DELETE SET NULL,
                    UNIQUE(title, artist_id)
                );
                CREATE TABLE IF NOT EXISTS songs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    album_id INTEGER,
                    artist_id INTEGER,
                    title TEXT,
                    path TEXT UNIQUE,
                    duration INTEGER,
                    track_num INTEGER,
                    disc_num INTEGER,
                    play_count INTEGER DEFAULT 0,
                    last_played DATETIME,
                    added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (album_id) REFERENCES albums (id) ON DELETE CASCADE,
                    FOREIGN KEY (artist_id) REFERENCES artists (id) ON DELETE CASCADE
                );
                CREATE TABLE IF NOT EXISTS lyrics (
                    song_id INTEGER PRIMARY KEY,
                    raw_lyrics TEXT,
                    online_lyrics TEXT,
                    is_synced BOOLEAN DEFAULT 0,
                    FOREIGN KEY (song_id) REFERENCES songs (id) ON DELETE CASCADE
                );
                CREATE TABLE IF NOT EXISTS playlists (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    cover_path TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    last_played DATETIME
                );
                CREATE TABLE IF NOT EXISTS playlist_songs (
                    playlist_id INTEGER,
                    song_id INTEGER,
                    PRIMARY KEY (playlist_id, song_id),
                    FOREIGN KEY (playlist_id) REFERENCES playlists (id) ON DELETE CASCADE,
                    FOREIGN KEY (song_id) REFERENCES songs (id) ON DELETE CASCADE
                );

                INSERT OR IGNORE INTO settings (key, value) VALUES ('theme', 'dark'), ('music_path', ''), ('crossfade', '0'), ('library_view', 'grid');
            ",
            kind: MigrationKind::Up,
        }
    ];

    tauri::Builder::default()
        .manage(WatcherState { watcher: Arc::new(Mutex::new(None)) })
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_sql::Builder::default().add_migrations("sqlite:emp_player.db", migrations).build())
        .invoke_handler(tauri::generate_handler![
            scan_music_folder, read_lrc_file, start_monitoring,
            fetch_external_artist_data, download_artist_image
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}