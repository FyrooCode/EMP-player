import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getDB } from '../services/db'

export const useContextMenuStore = defineStore('contextMenu', () => {
  const isVisible = ref(false)
  const x = ref(0)
  const y = ref(0)
  const selectedSong = ref<any>(null)
  const playlists = ref<any[]>([])
  const searchQuery = ref('')

  const filteredPlaylists = computed(() => {
    if (!searchQuery.value) return playlists.value
    return playlists.value.filter(pl => 
      pl.name.toLowerCase().includes(searchQuery.value.toLowerCase())
    )
  })

  const openMenu = async (event: MouseEvent, song: any) => {
    // Tutup dulu jika sedang terbuka (reset state)
    isVisible.value = false
    selectedSong.value = song
    searchQuery.value = ''
    
    try {
      const db = getDB()
      // Mengambil playlist terbaru
      playlists.value = await db.select<any[]>("SELECT * FROM playlists ORDER BY created_at DESC")
    } catch (err) {
      console.error("Gagal load playlist:", err)
    }
    
    // Set posisi munculnya menu
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