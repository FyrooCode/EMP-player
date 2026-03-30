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
    const db = await getDB()
    const result = await db.select<{ key: string, value: string }[]>("SELECT * FROM settings")
    result.forEach(setting => {
      if (setting.key === 'music_path') musicPath.value = setting.value
      if (setting.key === 'theme') isDarkMode.value = setting.value === 'dark'
      if (setting.key === 'crossfade') crossfade.value = parseInt(setting.value) || 0
      if (setting.key === 'library_view') libraryView.value = setting.value as 'grid' | 'list'
    })
  }

  async function updateLibraryView(view: 'grid' | 'list') {
    const db = await getDB()
    libraryView.value = view
    await db.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('library_view', $1)", [view])
  }

  async function saveScannedSongs(songsMetadata: any[]) {
    if (isSaving.value) return;

    const db = await getDB()
    isSaving.value = true;
    let transactionActive = false;

    try {
      // Optimasi: Gunakan Transaction yang lebih cepat
      await db.execute("BEGIN TRANSACTION")
      transactionActive = true;

      // Hapus lagu lama
      await db.execute("DELETE FROM songs")
      await db.execute("DELETE FROM lyrics")

      // Cache untuk ID Artis & Album (Mencegah SELECT berulang)
      const artistCache = new Map<string, number>();
      const albumCache = new Map<string, number>();

      for (const song of songsMetadata) {
        // --- 1. HANDLING ARTIST ---
        const splitArtists = song.artist
          .split(/[,;&]|\bfeat\.|\bft\.|\//i)
          .map((a: string) => a.trim())
          .filter((a: string) => a.length > 0);

        const primaryArtistName = splitArtists[0] || "Unknown Artist";
        
        for (const name of splitArtists) {
          await db.execute("INSERT OR IGNORE INTO artists (name) VALUES ($1)", [name]);
        }

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
          `INSERT INTO songs (title, album_id, artist_id, path, duration, track_num, disc_num) 
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [song.title, albumId, artistId, song.path, song.duration, song.track_num, song.disc_num]
        );

        // --- 4. INSERT LYRICS (Pakai last_insert_rowid() lebih aman/cepat) ---
        if (song.lyrics) {
          const lastIdRes = await db.select<{id: number}[]>("SELECT last_insert_rowid() as id");
          const songId = lastIdRes[0].id;
          await db.execute("INSERT INTO lyrics (song_id, raw_lyrics) VALUES ($1, $2)", [songId, song.lyrics]);
        }
      }

      await db.execute("COMMIT")
      transactionActive = false;
      console.log("Sync success.");
    } catch (err) {
      if (transactionActive) await db.execute("ROLLBACK");
      console.error("Critical Error during scan save:", err);
      throw err;
    } finally {
      isSaving.value = false;
    }
  }

  async function updateSongLyrics(songId: number, lyrics: string, isOnline = false) {
    const db = await getDB()
    if (isOnline) {
      await db.execute("UPDATE lyrics SET online_lyrics = $1 WHERE song_id = $2", [lyrics, songId])
    } else {
      await db.execute("UPDATE lyrics SET raw_lyrics = $1 WHERE song_id = $2", [lyrics, songId])
    }
  }

  async function updateMusicPath(newPath: string) {
    const db = await getDB()
    musicPath.value = newPath
    await db.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('music_path', $1)", [newPath])
  }

  async function toggleTheme() {
    const db = await getDB()
    isDarkMode.value = !isDarkMode.value
    const themeValue = isDarkMode.value ? 'dark' : 'light'
    await db.execute("UPDATE settings SET value = $1 WHERE key = 'theme'", [themeValue])
    applyTheme()
  }

  function applyTheme() {
    if (isDarkMode.value) document.documentElement.classList.add('dark')
    else document.documentElement.classList.remove('dark')
  }

  async function updateCrossfade(val: number) {
    const db = await getDB()
    crossfade.value = val
    await db.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('crossfade', $1)", [val.toString()])
  }

  return { 
    musicPath, isDarkMode, crossfade, libraryView, isSaving,
    loadSettingsFromDB, updateMusicPath, toggleTheme, applyTheme, 
    saveScannedSongs, updateCrossfade, updateSongLyrics, updateLibraryView 
  }
})