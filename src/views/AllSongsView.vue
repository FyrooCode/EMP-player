<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { usePlayerStore } from '../stores/player'
import { useSettingsStore } from '../stores/settings'
import { useContextMenuStore } from '../stores/contextMenu' 
import { getDB } from '../services/db'
import { listen } from '@tauri-apps/api/event' 
import { 
  Music, User, Disc, Clock, Play, Loader2, ArrowLeft 
} from 'lucide-vue-next'
import { useRouter } from 'vue-router'

const router = useRouter()
const player = usePlayerStore()
const settings = useSettingsStore()
const contextMenu = useContextMenuStore() 

const songs = ref<any[]>([])
const isLoading = ref(true)

const isDarkMode = computed(() => settings.isDarkMode)
const textColor = computed(() => isDarkMode.value ? '#ffffff' : '#0f172a')
const secondaryTextColor = computed(() => isDarkMode.value ? 'rgba(255, 255, 255, 0.6)' : '#64748b')
const tertiaryTextColor = computed(() => isDarkMode.value ? 'rgba(160, 174, 192, 1)' : '#a0aeb8')

/**
 * FETCH DENGAN SQL JOIN
 * Kita mengambil data dari tabel songs, lalu menggabungkannya dengan 
 * tabel artists dan albums berdasarkan ID-nya.
 */
const fetchAllSongs = async () => {
  try {
    isLoading.value = true
    const db = getDB()
    
    // Query Relational: Mengambil nama artist dan title album menggunakan JOIN
    const query = `
      SELECT 
        s.*, 
        a.name as artist, 
        al.title as album 
      FROM songs s
      LEFT JOIN artists a ON s.artist_id = a.id
      LEFT JOIN albums al ON s.album_id = al.id
      ORDER BY s.title ASC
    `
    
    const result = await db.select<any[]>(query)
    songs.value = result
  } catch (err) {
    console.error("Failed to fetch all songs:", err)
  } finally {
    isLoading.value = false
  }
}

const formatDuration = (seconds: number) => {
  if (!seconds) return "0:00"
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

const playSong = (song: any) => {
  // song sudah include .artist dan .album karena alias di SQL (a.name as artist)
  player.playTrack(song, songs.value)
}

let unlistenLibrary: any;

onMounted(async () => {
  await fetchAllSongs()

  unlistenLibrary = await listen('library-updated', () => {
    fetchAllSongs()
  })
})

onUnmounted(() => {
  if (unlistenLibrary) unlistenLibrary()
})
</script>

<template>
  <div class="relative h-full overflow-y-auto pb-20 no-scrollbar">
    
    <header class="mb-8 shrink-0">
      <button 
        @click="router.back()" 
        class="mb-4 flex items-center gap-2 transition-colors group cursor-pointer"
        :style="{ color: secondaryTextColor }"
      >
        <ArrowLeft :size="20" class="group-hover:-translate-x-1 transition-transform" />
        <span class="text-xs font-bold uppercase tracking-widest">Back to Collections</span>
      </button>
      
      <h1 class="text-5xl md:text-6xl font-black tracking-tighter italic uppercase leading-tight transition-colors" 
          :style="{ color: textColor }">
        All Songs
      </h1>
      <div class="flex items-center gap-4 mt-2 font-bold tracking-[0.2em] uppercase text-sm transition-colors" 
           :style="{ color: secondaryTextColor }">
        <span>{{ songs.length }} Tracks</span>
        <span class="opacity-30">//</span>
        <span>Complete Library</span>
      </div>
    </header>

    <div v-if="isLoading" class="flex-1 flex flex-col items-center justify-center h-64 gap-4">
      <Loader2 class="animate-spin text-slate-400" :size="32" />
      <p class="text-[10px] font-bold uppercase tracking-widest opacity-40" :style="{ color: textColor }">
        Reading Relational DB...
      </p>
    </div>

    <div v-else-if="songs.length === 0" class="flex-1 flex flex-col items-center justify-center h-64 opacity-20 italic">
      <Music :size="64" :style="{ color: textColor }" />
      <p class="mt-4 font-bold uppercase tracking-widest" :style="{ color: textColor }">Your library is empty</p>
    </div>

    <div v-else class="space-y-2">
      <!-- HEADER TABEL -->
      <div class="flex items-center px-4 pb-2 border-b text-[10px] font-bold tracking-widest uppercase transition-colors"
           :class="isDarkMode ? 'border-white/10' : 'border-black/5'"
           :style="{ color: tertiaryTextColor }">
        <div class="w-12 text-center">#</div>
        <div class="flex-grow">Title / Artist</div>
        <div class="hidden md:block w-1/4">Album</div>
        <div class="w-20 text-right"><Clock :size="14" class="inline" /></div>
      </div>

      <!-- ROW LAGU -->
      <div 
        v-for="(song, index) in songs" 
        :key="song.id"
        @click="playSong(song)"
        @contextmenu.prevent="contextMenu.openMenu($event, song)"
        class="flex items-center px-4 py-3 rounded-xl transition-colors group cursor-pointer"
        :class="[
          isDarkMode ? 'hover:bg-white/5' : 'hover:bg-slate-200/50',
          player.currentSong?.id === song.id ? (isDarkMode ? 'bg-white/10' : 'bg-slate-200/80') : ''
        ]"
      >
        <!-- INDEX / PLAY ICON -->
        <div class="w-12 text-center text-xs font-bold relative transition-colors" :style="{ color: tertiaryTextColor }">
          <span :class="{'opacity-0': player.currentSong?.id === song.id}" class="group-hover:opacity-0 transition-opacity">
            {{ index + 1 }}
          </span>
          
          <div v-if="player.currentSong?.id === song.id" class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center gap-0.5 h-3">
             <div class="w-1 bg-current h-full animate-bounce" :style="{ color: textColor, animationDelay: '0ms' }"></div>
             <div class="w-1 bg-current h-1/2 animate-bounce" :style="{ color: textColor, animationDelay: '150ms' }"></div>
             <div class="w-1 bg-current h-3/4 animate-bounce" :style="{ color: textColor, animationDelay: '300ms' }"></div>
          </div>
          
          <Play v-else :size="14" class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity fill-current" 
                :style="{ color: textColor }" />
        </div>

        <!-- INFO JUDUL & ARTIS -->
        <div class="flex-grow truncate pr-4">
          <p class="font-bold text-sm truncate transition-colors" 
             :style="{ color: player.currentSong?.id === song.id ? '#3b82f6' : textColor }">
            {{ song.title }}
          </p>
          <p class="text-[10px] font-bold uppercase tracking-widest mt-0.5 transition-colors" 
             :style="{ color: secondaryTextColor }">
            {{ song.artist }}
          </p>
        </div>

        <!-- INFO ALBUM -->
        <div class="hidden md:block w-1/4 truncate text-[10px] font-bold uppercase tracking-widest transition-colors"
             :style="{ color: secondaryTextColor }">
          {{ song.album }}
        </div>

        <!-- DURASI -->
        <div class="w-20 text-right text-xs font-mono transition-colors" :style="{ color: secondaryTextColor }">
          {{ formatDuration(song.duration) }}
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.no-scrollbar::-webkit-scrollbar { display: none; }
.animate-bounce {
  animation: bounce 0.6s infinite alternate;
}
@keyframes bounce {
  from { transform: scaleY(0.4); }
  to { transform: scaleY(1); }
}
</style>