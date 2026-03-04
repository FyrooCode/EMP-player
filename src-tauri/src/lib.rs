use tauri_plugin_sql::{Migration, MigrationKind};
use std::fs;
use std::path::{Path, PathBuf};
use std::borrow::Cow;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Manager, State, Emitter}; // Ditambahkan Emitter untuk event
use lofty::prelude::*;
use lofty::probe::Probe;
use notify::{Watcher, RecursiveMode, Event}; // Membutuhkan crate notify di Cargo.toml

// State untuk menyimpan watcher agar tetap hidup selama aplikasi berjalan
struct WatcherState {
    watcher: Arc<Mutex<Option<notify::RecommendedWatcher>>>,
}

fn extract_cover(path: &Path, app_handle: &AppHandle) -> String {
    if let Ok(tagged_file) = Probe::open(path).unwrap().read() {
        if let Some(tag) = tagged_file.primary_tag() {
            if let Some(picture) = tag.pictures().first() {
                let local_data = app_handle.path().app_local_data_dir().unwrap_or_default();
                let covers_dir = local_data.join("covers");
                
                if !covers_dir.exists() {
                    let _ = fs::create_dir_all(&covers_dir);
                }

                let album_name = tag.album().unwrap_or(Cow::Borrowed("unknown"));
                let safe_album_name = album_name.replace(|c: char| !c.is_alphanumeric(), "_");
                let cover_path = covers_dir.join(format!("{}.jpg", safe_album_name));

                if !cover_path.exists() {
                    let _ = fs::write(&cover_path, picture.data());
                }

                return cover_path.to_string_lossy().into_owned();
            }
        }
    }
    String::new()
}

fn scan_directory_recursive(
    dir: &Path,
    music_data: &mut Vec<serde_json::Value>,
    app_handle: &AppHandle,
) {
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

                        match Probe::open(&entry_path).and_then(|p| p.read()) {
                            Ok(tagged_file) => {
                                let properties = tagged_file.properties();
                                duration = properties.duration().as_secs() as i32;

                                if let Some(tag) = tagged_file.primary_tag() {
                                    if let Some(t) = tag.title() { title = t.to_string(); }
                                    if let Some(a) = tag.artist() { artist = a.to_string(); }
                                    if let Some(al) = tag.album() { album = al.to_string(); }
                                    
                                    track_num = tag.track().unwrap_or(0) as i32;
                                    disc_num = tag.disk().unwrap_or(1) as i32;
                                    
                                    if let Some(lyr) = tag.get_string(lofty::tag::ItemKey::Lyrics) {
                                        lyrics = lyr.to_string();
                                    }
                                    
                                    cover_path = extract_cover(&entry_path, app_handle);
                                }
                            },
                            Err(e) => println!("Skipping metadata for {:?}: {}", entry_path, e),
                        }

                        music_data.push(serde_json::json!({
                            "title": title,
                            "artist": artist,
                            "album": album,
                            "path": entry_path.to_string_lossy(),
                            "duration": duration,
                            "cover_path": cover_path,
                            "lyrics": lyrics,
                            "track_num": track_num,
                            "disc_num": disc_num
                        }));
                    }
                }
            } else if entry_path.is_dir() {
                scan_directory_recursive(&entry_path, music_data, app_handle);
            }
        }
    }
}

// Command baru untuk memulai pemantauan folder musik secara otomatis
#[tauri::command]
async fn start_monitoring(
    path: String,
    app_handle: AppHandle,
    state: State<'_, WatcherState>,
) -> Result<(), String> {
    let mut watcher_lock = state.watcher.lock().unwrap();
    
    // Hentikan watcher lama jika ada sebelum memulai yang baru
    *watcher_lock = None;

    let path_to_watch = PathBuf::from(&path);
    if !path_to_watch.exists() {
        return Err("Path tidak ditemukan".into());
    }

    let app_handle_clone = app_handle.clone();
    
    // Inisialisasi watcher baru
    let mut watcher = notify::recommended_watcher(move |res: Result<Event, _>| {
        match res {
            Ok(_) => {
                // Emit event ke frontend bahwa ada perubahan di library
                let _ = app_handle_clone.emit("library-changed", ());
            },
            Err(e) => println!("Watcher error: {:?}", e),
        }
    }).map_err(|e| e.to_string())?;

    // Mulai memantau folder secara rekursif
    watcher.watch(&path_to_watch, RecursiveMode::Recursive).map_err(|e| e.to_string())?;
    
    // Simpan watcher ke dalam state agar tetap aktif
    *watcher_lock = Some(watcher);
    
    Ok(())
}

#[tauri::command]
async fn scan_music_folder(
    folder_path: String,
    app_handle: AppHandle,
) -> Result<Vec<serde_json::Value>, String> {
    let mut music_data = Vec::new();
    let path = Path::new(&folder_path);

    if path.is_dir() {
        scan_directory_recursive(path, &mut music_data, &app_handle);
    } else {
        return Err("Path is not a valid directory".to_string());
    }
    
    Ok(music_data)
}

#[tauri::command]
async fn read_lrc_file(path: String) -> Result<String, String> {
    fs::read_to_string(path).map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![Migration {
        version: 1,
        description: "initialize_all_tables",
        sql: "CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);
              CREATE TABLE IF NOT EXISTS songs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT, artist TEXT, album TEXT, 
                path TEXT UNIQUE, duration INTEGER, cover_path TEXT, lyrics TEXT,
                track_num INTEGER DEFAULT 0,
                disc_num INTEGER DEFAULT 1
              );
              CREATE TABLE IF NOT EXISTS playlists (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                cover_path TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
              );
              CREATE TABLE IF NOT EXISTS playlist_songs (
                playlist_id INTEGER,
                song_id INTEGER,
                FOREIGN KEY(playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
                FOREIGN KEY(song_id) REFERENCES songs(id) ON DELETE CASCADE,
                PRIMARY KEY (playlist_id, song_id)
              );
              INSERT OR IGNORE INTO settings (key, value) VALUES ('theme', 'light');
              INSERT OR IGNORE INTO settings (key, value) VALUES ('music_path', '');",
        kind: MigrationKind::Up,
    }];

    tauri::Builder::default()
        // Daftarkan WatcherState agar bisa diakses di command start_monitoring
        .manage(WatcherState {
            watcher: Arc::new(Mutex::new(None)),
        })
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:emp_player.db", migrations)
                .build(),
        )
        // Pastikan start_monitoring didaftarkan di invoke_handler
        .invoke_handler(tauri::generate_handler![
            scan_music_folder, 
            read_lrc_file, 
            start_monitoring
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}