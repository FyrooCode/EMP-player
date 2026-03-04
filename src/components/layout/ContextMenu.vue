<script setup lang="ts">
import { ref } from 'vue'
import { useContextMenuStore } from '../../stores/contextMenu'
import { useToastStore } from '../../stores/toast' // IMPORT TOAST STORE
import { getDB } from '../../services/db'
import { emit } from '@tauri-apps/api/event'
import { 
  Plus, Search, ChevronRight, ListMusic, Trash2 
} from 'lucide-vue-next'

const menu = useContextMenuStore()
const toast = useToastStore() // INISIALISASI
const isSubMenuVisible = ref(false)

// Fungsi memasukkan lagu ke playlist
const addToPlaylist = async (playlistId: number) => {
  if (!menu.selectedSong) return
  
  // Cari nama playlist untuk pesan toast
  const targetPlaylist = menu.filteredPlaylists.find(p => p.id === playlistId)
  const playlistName = targetPlaylist ? targetPlaylist.name : 'Playlist'

  try {
    const db = await getDB()
    await db.execute(
      "INSERT OR IGNORE INTO playlist_songs (playlist_id, song_id) VALUES ($1, $2)",
      [playlistId, menu.selectedSong.id]
    )
    
    // TAMPILKAN TOAST SUKSES
    toast.show('success', `Added "${menu.selectedSong.title}" to ${playlistName}`)
    
  } catch (err) {
    console.error("Gagal tambah ke playlist:", err)
    toast.show('error', 'Failed to add song to playlist')
  } finally {
    menu.closeMenu()
    isSubMenuVisible.value = false
  }
}

// Fungsi menghapus lagu dari database library
const deleteFromLibrary = async () => {
  if (!menu.selectedSong) return
  const songTitle = menu.selectedSong.title
  const confirmDelete = confirm(`Are you sure you want to remove "${songTitle}" from your library?`)
  
  if (confirmDelete) {
    try {
      const db = await getDB()
      await db.execute("DELETE FROM songs WHERE id = $1", [menu.selectedSong.id])
      
      await emit('library-updated')
      
      // TAMPILKAN TOAST SUKSES HAPUS
      toast.show('success', `"${songTitle}" removed from library`)
      
    } catch (err) {
      console.error("Failed to delete song:", err)
      toast.show('error', 'Failed to remove song from library')
    } finally {
      menu.closeMenu()
    }
  }
}
</script>

<template>
  <Teleport to="body">
    <div 
      v-if="menu.isVisible"
      class="fixed z-[999] flex items-start animate-in fade-in zoom-in duration-100"
      :style="{ top: menu.y + 'px', left: menu.x + 'px' }"
      @click.stop
    >
      <div class="w-64 bg-slate-900/95 backdrop-blur-xl shadow-2xl rounded-xl border border-white/10 py-1.5 text-white/90">
        <div 
          @mouseenter="isSubMenuVisible = true"
          class="flex items-center justify-between px-3 py-2 hover:bg-white/10 cursor-pointer mx-1.5 rounded-lg group"
        >
          <div class="flex items-center gap-3">
            <Plus :size="18" />
            <span class="text-xs font-semibold">Add to playlist</span>
          </div>
          <ChevronRight :size="14" class="opacity-40" />
        </div>

        <div class="h-[1px] bg-white/5 my-1.5 mx-3"></div>

        <div class="px-1.5">
          <div 
            @click="deleteFromLibrary"
            class="flex items-center gap-3 px-3 py-2 hover:bg-red-500/20 hover:text-red-400 cursor-pointer rounded-lg text-xs font-semibold transition-colors"
          >
            <Trash2 :size="18" /> Delete from library
          </div>
        </div>
      </div>

      <div 
        v-if="isSubMenuVisible"
        @mouseleave="isSubMenuVisible = false"
        class="absolute left-[-264px] w-64 bg-slate-900/98 backdrop-blur-2xl shadow-2xl rounded-xl border border-white/10 overflow-hidden flex flex-col max-h-[480px] animate-in fade-in slide-in-from-right-2 duration-200"
      >
        <div class="p-3 border-b border-white/5">
          <div class="relative group">
            <Search :size="14" class="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 group-focus-within:text-white/60" />
            <input 
              v-model="menu.searchQuery"
              type="text"
              placeholder="Find a playlist"
              class="w-full bg-white/5 border-none outline-none rounded-md py-2 pl-9 pr-3 text-xs text-white placeholder:text-white/20 focus:bg-white/10 transition-colors"
              autoFocus
            />
          </div>
        </div>

        <div class="flex-1 overflow-y-auto py-1.5 px-1.5 scrollbar-thin max-h-[400px]">
          <div class="space-y-0.5">
            <button 
              v-for="pl in menu.filteredPlaylists" 
              :key="pl.id"
              @click="addToPlaylist(pl.id)"
              class="w-full text-left px-3 py-2.5 text-xs font-semibold hover:bg-white/10 rounded-lg flex items-center gap-3 transition-colors truncate"
            >
              <div class="w-8 h-8 bg-white/5 rounded flex items-center justify-center shrink-0">
                <ListMusic :size="16" class="opacity-40" />
              </div>
              <span class="truncate">{{ pl.name }}</span>
            </button>
          </div>

          <div v-if="menu.filteredPlaylists.length === 0" class="p-8 text-center opacity-30 text-[10px] uppercase font-bold tracking-widest">
            No playlist found
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.scrollbar-thin::-webkit-scrollbar {
  width: 4px;
}
.scrollbar-thin::-webkit-scrollbar-track {
  background: transparent;
}
.scrollbar-thin::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 10px;
}
.scrollbar-thin::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.2);
}
</style>