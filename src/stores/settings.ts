import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getDB } from '../services/db'

export const useSettingsStore = defineStore('settings', () => {
  const musicPath = ref('')
  const isDarkMode = ref(false)
  const crossfade = ref(0)
  const libraryView = ref<'grid' | 'list'>('grid')
  
  const isSaving = ref(false)

  async function loadSettingsFromDB() {
    const db = getDB()
    const result = await db.select<{ key: string, value: string }[]>("SELECT * FROM settings")
    result.forEach(setting => {
      if (setting.key === 'music_path') musicPath.value = setting.value
      if (setting.key === 'theme') isDarkMode.value = setting.value === 'dark'
      if (setting.key === 'crossfade') crossfade.value = parseInt(setting.value) || 0
      if (setting.key === 'library_view') libraryView.value = setting.value as 'grid' | 'list'
    })
  }

  async function updateLibraryView(view: 'grid' | 'list') {
    const db = getDB()
    libraryView.value = view
    await db.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('library_view', $1)", [view])
  }

  /**
   * REBORN: Fungsi Simpan Lagu dengan Logika Relasional
   */
  async function saveScannedSongs(songsMetadata: any[]) {
    if (isSaving.value) return;

    const db = getDB()
    isSaving.value = true;
    
    // Cache lokal untuk mempercepat proses ID lookup
    const artistCache = new Map<string, number>();
    const albumCache = new Map<string, number>();

    try {
      await db.execute("BEGIN TRANSACTION")

      // Bersihkan data lagu & lirik (Data Artis & Album tidak dihapus agar cache image/bio aman)
      await db.execute("DELETE FROM songs")
      await db.execute("DELETE FROM lyrics")

      for (const song of songsMetadata) {
        // --- 1. HANDLING ARTIST ---
        // Pecah artis jika ada kolaborasi
        const splitArtists = song.artist
          .split(/[,;&]|\bfeat\.|\bft\.|\//i)
          .map((a: string) => a.trim())
          .filter((a: string) => a.length > 0);

        const primaryArtistName = splitArtists[0] || "Unknown Artist";
        
        // Daftarkan semua artis yang terlibat ke tabel 'artists'
        for (const name of splitArtists) {
          await db.execute("INSERT OR IGNORE INTO artists (name) VALUES ($1)", [name]);
        }

        // Ambil ID Artis Utama (Primary)
        let artistId: number;
        if (artistCache.has(primaryArtistName)) {
          artistId = artistCache.get(primaryArtistName)!;
        } else {
          const res = await db.select<{id: number}[]>("SELECT id FROM artists WHERE name = $1", [primaryArtistName]);
          artistId = res[0].id;
          artistCache.set(primaryArtistName, artistId);
        }

        // --- 2. HANDLING ALBUM ---
        const albumTitle = song.album || "Unknown Album";
        const albumKey = `${albumTitle}-${artistId}`;
        
        let albumId: number;
        if (albumCache.has(albumKey)) {
          albumId = albumCache.get(albumKey)!;
        } else {
          // Insert album jika belum ada, masukkan juga cover_path-nya di sini
          await db.execute(
            "INSERT OR IGNORE INTO albums (title, artist_id, cover_path) VALUES ($1, $2, $3)",
            [albumTitle, artistId, song.cover_path]
          );
          const res = await db.select<{id: number}[]>(
            "SELECT id FROM albums WHERE title = $1 AND artist_id = $2", 
            [albumTitle, artistId]
          );
          albumId = res[0].id;
          albumCache.set(albumKey, albumId);
        }

        // --- 3. INSERT SONG ---
        await db.execute(
          `INSERT INTO songs (
            title, album_id, artist_id, path, duration, track_num, disc_num
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            song.title, albumId, artistId, song.path, 
            song.duration, song.track_num, song.disc_num
          ]
        );

        // --- 4. INSERT LYRICS ---
        // Ambil ID lagu yang barusan di-insert
        const songRes = await db.select<{id: number}[]>("SELECT id FROM songs WHERE path = $1", [song.path]);
        const songId = songRes[0].id;

        if (song.lyrics) {
          await db.execute(
            "INSERT INTO lyrics (song_id, raw_lyrics) VALUES ($1, $2)",
            [songId, song.lyrics]
          );
        }
      }

      await db.execute("COMMIT")
      console.log("Relational Database Sync Success.")
    } catch (err) {
      await db.execute("ROLLBACK")
      console.error("Critical Error during scan save:", err)
      throw err
    } finally {
      isSaving.value = false;
    }
  }

  /**
   * Update lirik sekarang menembak tabel 'lyrics'
   */
  async function updateSongLyrics(songId: number, lyrics: string, isOnline = false) {
    const db = getDB()
    if (isOnline) {
      await db.execute("UPDATE lyrics SET online_lyrics = $1 WHERE song_id = $2", [lyrics, songId])
    } else {
      await db.execute("UPDATE lyrics SET raw_lyrics = $1 WHERE song_id = $2", [lyrics, songId])
    }
  }

  async function updateMusicPath(newPath: string) {
    const db = getDB()
    musicPath.value = newPath
    await db.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('music_path', $1)", [newPath])
  }

  async function toggleTheme() {
    const db = getDB()
    isDarkMode.value = !isDarkMode.value
    const themeValue = isDarkMode.value ? 'dark' : 'light'
    await db.execute("UPDATE settings SET value = $1 WHERE key = 'theme'", [themeValue])
    localStorage.setItem('emp-theme', themeValue)
    applyTheme()
  }

  function applyTheme() {
    if (isDarkMode.value) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }

  async function updateCrossfade(val: number) {
    const db = getDB()
    crossfade.value = val
    await db.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('crossfade', $1)", [val.toString()])
  }

  return { 
    musicPath, isDarkMode, crossfade, libraryView, isSaving,
    loadSettingsFromDB, updateMusicPath, toggleTheme, applyTheme, 
    saveScannedSongs, updateCrossfade, updateSongLyrics, updateLibraryView 
  }
})