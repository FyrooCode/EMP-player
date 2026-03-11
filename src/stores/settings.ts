import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getDB } from '../services/db'

export const useSettingsStore = defineStore('settings', () => {
  const musicPath = ref('')
  const isDarkMode = ref(false)
  const crossfade = ref(0)
  const libraryView = ref<'grid' | 'list'>('grid')
  
  // Satpam untuk mencegah database locked
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

  async function saveScannedSongs(songsMetadata: any[]) {
    // Jika sedang menyimpan, batalkan proses yang baru agar tidak tabrakan
    if (isSaving.value) {
      console.warn("Save process already in progress, skipping...");
      return;
    }

    const db = getDB()
    isSaving.value = true;
    
    try {
      await db.execute("BEGIN TRANSACTION")

      // Hapus lagu lama
      await db.execute("DELETE FROM songs")

      const uniqueArtists = new Set<string>()

      for (const song of songsMetadata) {
        await db.execute(
          `INSERT OR IGNORE INTO songs (
            title, artist, album, path, duration, cover_path, lyrics, track_num, disc_num
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            song.title, song.artist, song.album, song.path, 
            song.duration, song.cover_path, song.lyrics,
            song.track_num, song.disc_num
          ]
        )

        if (song.artist) {
          const splitResult = song.artist
            .split(/[,;&]|\bfeat\.|\bft\.|\//i)
            .map((a: string) => a.trim())
            .filter((a: string) => a.length > 0)
          splitResult.forEach((name: string) => uniqueArtists.add(name))
        }
      }

      for (const artistName of uniqueArtists) {
        await db.execute("INSERT OR IGNORE INTO artists (name) VALUES ($1)", [artistName])
      }

      await db.execute("COMMIT")
      console.log("Database Sync Success.")
    } catch (err) {
      try { await db.execute("ROLLBACK") } catch(e) { /* ignore rollback error */ }
      console.error("Failed to save scanned songs:", err)
      throw err
    } finally {
      // Pastikan satpam dilepas apapun yang terjadi
      isSaving.value = false;
    }
  }

  async function updateSongLyrics(songPath: string, lyrics: string) {
    const db = getDB()
    await db.execute("UPDATE songs SET lyrics = $1 WHERE path = $2", [lyrics, songPath])
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