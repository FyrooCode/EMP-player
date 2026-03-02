import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getDB } from '../services/db'

export const useSettingsStore = defineStore('settings', () => {
  const musicPath = ref('')
  const isDarkMode = ref(false)

  async function loadSettingsFromDB() {
    const db = getDB()
    const result = await db.select<{ key: string, value: string }[]>(
      "SELECT * FROM settings"
    )

    result.forEach(setting => {
      if (setting.key === 'music_path') musicPath.value = setting.value
      if (setting.key === 'theme') {
        isDarkMode.value = setting.value === 'dark'
      }
    })
  }


  async function saveScannedSongs(filePaths: string[]) {
    const db = getDB()
    

    await db.execute("DELETE FROM songs")

    
    for (const path of filePaths) {
    
      const fileName = path.split(/[\\/]/).pop() || "Unknown Title"
      
      await db.execute(
        "INSERT OR IGNORE INTO songs (title, path) VALUES ($1, $2)",
        [fileName, path]
      )
    }
  }

  async function updateMusicPath(newPath: string) {
    const db = getDB()
    musicPath.value = newPath
    await db.execute(
      "UPDATE settings SET value = $1 WHERE key = 'music_path'",
      [newPath]
    )
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

  return { 
    musicPath, 
    isDarkMode, 
    loadSettingsFromDB, 
    updateMusicPath, 
    toggleTheme,
    applyTheme,
    saveScannedSongs 
  }
})