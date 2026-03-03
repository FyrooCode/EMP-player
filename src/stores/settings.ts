import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getDB } from '../services/db'

export const useSettingsStore = defineStore('settings', () => {
  const musicPath = ref('')
  const isDarkMode = ref(false)
  // STATE BARU: Menyimpan nilai durasi crossfade
  const crossfade = ref(0) 

  async function loadSettingsFromDB() {
    const db = getDB()
    const result = await db.select<{ key: string, value: string }[]>("SELECT * FROM settings")
    result.forEach(setting => {
      if (setting.key === 'music_path') musicPath.value = setting.value
      if (setting.key === 'theme') isDarkMode.value = setting.value === 'dark'
      // BACA DARI DB: Mengambil nilai crossfade
      if (setting.key === 'crossfade') crossfade.value = parseInt(setting.value) || 0
    })
  }

  async function saveScannedSongs(songsMetadata: any[]) {
    const db = getDB()
    await db.execute("DELETE FROM songs")
    
    for (const song of songsMetadata) {
      await db.execute(
        "INSERT OR IGNORE INTO songs (title, artist, album, path, duration, cover_path) VALUES ($1, $2, $3, $4, $5, $6)",
        [song.title, song.artist, song.album, song.path, song.duration, song.cover_path]
      )
    }
  }

  async function updateMusicPath(newPath: string) {
    const db = getDB()
    musicPath.value = newPath
    await db.execute("UPDATE settings SET value = $1 WHERE key = 'music_path'", [newPath])
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

  // FUNGSI BARU: Update Crossfade
  async function updateCrossfade(val: number) {
    const db = getDB()
    crossfade.value = val
    // INSERT OR REPLACE akan memasukkan baris baru jika 'key' belum ada, atau me-replace jika sudah ada
    await db.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('crossfade', $1)", [val.toString()])
  }

  return { 
    musicPath, isDarkMode, crossfade, 
    loadSettingsFromDB, updateMusicPath, toggleTheme, applyTheme, saveScannedSongs, updateCrossfade 
  }
})