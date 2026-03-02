use tauri_plugin_sql::{Migration, MigrationKind};
// Import library standar Rust untuk manipulasi file
use std::fs;
use std::path::Path;

// 1. Definisikan fungsi Scanner di sini
#[tauri::command]
async fn scan_music_folder(folder_path: String) -> Result<Vec<String>, String> {
    let mut music_files = Vec::new();
    let path = Path::new(&folder_path);

    if path.is_dir() {
        // Membaca isi folder
        if let Ok(entries) = fs::read_dir(path) {
            for entry in entries.flatten() {
                let entry_path = entry.path();
                if entry_path.is_file() {
                    // Filter file berdasarkan ekstensi audio
                    if let Some(ext) = entry_path.extension() {
                        let ext_str = ext.to_string_lossy().to_lowercase();
                        if ext_str == "mp3" || ext_str == "flac" || ext_str == "wav" || ext_str == "m4a" {
                            music_files.push(entry_path.to_string_lossy().into_owned());
                        }
                    }
                }
            }
        }
    } else {
        return Err("Path is not a valid directory".to_string());
    }
    
    Ok(music_files)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![Migration {
        version: 1,
        description: "create_initial_tables",
        sql: "CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);
              CREATE TABLE IF NOT EXISTS songs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT, artist TEXT, album TEXT, 
                path TEXT UNIQUE, duration INTEGER, cover_path TEXT
              );
              INSERT OR IGNORE INTO settings (key, value) VALUES ('theme', 'light');
              INSERT OR IGNORE INTO settings (key, value) VALUES ('music_path', '');",
        kind: MigrationKind::Up,
    }];

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:emp_player.db", migrations)
                .build(),
        )
        .invoke_handler(tauri::generate_handler![scan_music_folder])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}