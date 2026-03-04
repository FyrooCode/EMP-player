<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { getDB } from '../services/db'
import { convertFileSrc } from '@tauri-apps/api/core' 
import { appLocalDataDir, join } from '@tauri-apps/api/path' 
import { useSettingsStore } from '../stores/settings'
import { listen } from '@tauri-apps/api/event'
import { Disc, Loader2, LayoutGrid, List, ArrowRight } from 'lucide-vue-next'

const router = useRouter()
const settings = useSettingsStore()
const albums = ref<any[]>([])
const isLoading = ref(true)

const viewMode = computed(() => settings.libraryView)

/**
 * Fungsi utama untuk memuat library album dari database
 * dan memetakan path cover ke URL yang bisa dibaca oleh build produksi.
 */
const loadLibrary = async () => {
  try {
    isLoading.value = true
    const db = await getDB()
    
    // Ambil daftar album unik dari database
    const songs = await db.select<{ album: string, artist: string, cover_path: string }[]>(
      "SELECT album, artist, cover_path FROM songs GROUP BY album ORDER BY album ASC"
    )

    if (songs.length === 0) {
      albums.value = []
      return
    }

    // Ambil path folder AppData/Local aplikasi (Dinamis untuk semua PC)
    const localDataPath = await appLocalDataDir();

    const processedAlbums = await Promise.all(songs.map(async (song) => {
      let coverUrl = null;
      if (song.cover_path) {
        try {
          // Ekstrak nama file saja dari path yang tersimpan
          const filename = song.cover_path.split(/[\\/]/).pop();
          // Gabungkan secara absolut ke folder covers di AppData
          const fullPath = await join(localDataPath, 'covers', filename || '');
          
          /**
           * KRUSIAL: convertFileSrc mengubah path sistem (C:\...) menjadi 
           * URL internal (asset://...) agar tidak diblokir oleh CSP di versi Build.
           */
          coverUrl = convertFileSrc(fullPath);
        } catch (err) {
          console.error(`Failed to load cover for album ${song.album}:`, err);
        }
      }
      return { ...song, coverUrl }
    }))

    albums.value = processedAlbums;
  } catch (error) {
    console.error("Failed to load library:", error)
  } finally {
    isLoading.value = false
  }
}

let unlistenUpdate: any;

onMounted(async () => {
  // Load data awal
  await loadLibrary();

  // Dengarkan event 'library-updated' (misal setelah scan lagu baru) agar view otomatis refresh
  unlistenUpdate = await listen('library-updated', () => {
    loadLibrary();
  });
})

// Bersihkan listener saat pindah halaman agar tidak memory leak
onUnmounted(() => {
  if (unlistenUpdate) unlistenUpdate();
})

const goToAlbum = (albumName: string) => {
  router.push(`/album/${encodeURIComponent(albumName)}`)
}
</script>

<template>
  <div class="relative h-full overflow-y-auto pb-20 no-scrollbar p-6">
    <header class="flex items-center justify-between mb-10">
      <h1 class="text-5xl font-black tracking-tighter italic uppercase text-black dark:text-white transition-colors duration-500">
        Library
      </h1>

      <div class="flex bg-black/5 dark:bg-white/5 p-1 rounded-xl border border-black/5 dark:border-white/10 transition-colors duration-500">
        <button 
          @click="settings.updateLibraryView('grid')" 
          class="p-2 rounded-lg transition-all duration-300 cursor-pointer" 
          :class="viewMode === 'grid' ? 'bg-white dark:bg-slate-800 shadow-md scale-110' : 'opacity-40'"
        >
          <LayoutGrid :size="18" />
        </button>
        <button 
          @click="settings.updateLibraryView('list')" 
          class="p-2 rounded-lg transition-all duration-300 cursor-pointer" 
          :class="viewMode === 'list' ? 'bg-white dark:bg-slate-800 shadow-md scale-110' : 'opacity-40'"
        >
          <List :size="18" />
        </button>
      </div>
    </header>

    <div v-if="isLoading" class="flex flex-col items-center justify-center h-64 gap-4">
      <Loader2 class="w-8 h-8 animate-spin text-slate-400 dark:text-slate-500" />
      <span class="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Syncing Collection</span>
    </div>

    <div v-else-if="albums.length === 0" class="flex flex-col items-center justify-center h-64 text-slate-400 dark:text-slate-500 gap-2">
      <span class="font-bold uppercase tracking-widest text-sm">No albums found</span>
      <span class="text-[10px] uppercase tracking-widest opacity-60">Please scan your music folder in Settings</span>
    </div>

    <div v-else-if="viewMode === 'grid'" class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-x-6 gap-y-8 animate-view">
      <div v-for="album in albums" :key="album.album" @click="goToAlbum(album.album)" class="group cursor-pointer flex flex-col">
        <div class="relative aspect-square bg-slate-200/50 dark:bg-slate-800/50 rounded-2xl border border-black/5 dark:border-white/10 overflow-hidden flex flex-col items-center justify-center mb-3 transition-all duration-500 hover:shadow-xl">
          <img 
            v-if="album.coverUrl" 
            :src="album.coverUrl" 
            class="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" 
            alt="cover" 
          />
          <div v-else class="text-black/40 dark:text-white/40 italic font-bold flex flex-col items-center gap-2">
            <Disc :size="32" class="opacity-50" />
            <span class="text-[8px] tracking-widest">NO COVER</span>
          </div>
        </div>
        <div class="px-1">
          <p class="text-slate-900 dark:text-white font-bold text-sm truncate">{{ album.album }}</p>
          <p class="text-slate-500 dark:text-white/60 text-[10px] font-bold uppercase truncate tracking-tighter">{{ album.artist }}</p>
        </div>
      </div>
    </div>

    <div v-else class="flex flex-col gap-1 animate-view">
      <div v-for="album in albums" :key="album.album" @click="goToAlbum(album.album)" class="flex items-center gap-4 p-3 rounded-2xl hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer group transition-all duration-300">
        <div class="w-14 h-14 rounded-xl bg-slate-200/50 dark:bg-slate-800/50 flex-shrink-0 flex items-center justify-center overflow-hidden border border-black/5 dark:border-white/10">
          <img v-if="album.coverUrl" :src="album.coverUrl" class="w-full h-full object-cover" />
          <Disc v-else :size="20" class="opacity-20 dark:text-white" />
        </div>
        <div class="flex-grow min-w-0">
          <h3 class="font-bold text-base dark:text-white truncate">{{ album.album }}</h3>
          <p class="text-[10px] font-bold opacity-50 uppercase truncate dark:text-white">{{ album.artist }}</p>
        </div>
        <ArrowRight :size="18" class="opacity-0 group-hover:opacity-100 transition-all text-slate-400" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.animate-view {
  animation: fadeIn 0.4s ease-out;
}
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
.no-scrollbar::-webkit-scrollbar { display: none; }
</style>