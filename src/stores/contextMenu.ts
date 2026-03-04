import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getDB } from '../services/db'

export const useContextMenuStore = defineStore('contextMenu', () => {
  const isVisible = ref(false)
  const x = ref(0)
  const y = ref(0)
  const selectedSong = ref<any>(null)
  const playlists = ref<any[]>([])
  const searchQuery = ref('') // State untuk pencarian playlist

  // Logika filter playlist berdasarkan input pencarian
  const filteredPlaylists = computed(() => {
    if (!searchQuery.value) return playlists.value
    return playlists.value.filter(pl => 
      pl.name.toLowerCase().includes(searchQuery.value.toLowerCase())
    )
  })

  const openMenu = async (event: MouseEvent, song: any) => {
    isVisible.value = false
    selectedSong.value = song
    searchQuery.value = '' // Reset pencarian setiap kali menu dibuka
    
    try {
      const db = await getDB()
      playlists.value = await db.select<any[]>("SELECT * FROM playlists ORDER BY created_at DESC")
    } catch (err) {
      console.error("Gagal load playlist:", err)
    }
    
    x.value = event.clientX
    y.value = event.clientY
    isVisible.value = true
  }

  const closeMenu = () => {
    isVisible.value = false
    searchQuery.value = ''
  }

  return { 
    isVisible, x, y, selectedSong, filteredPlaylists, searchQuery, 
    openMenu, closeMenu 
  }
})