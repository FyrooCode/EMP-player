<script setup lang="ts">
import { computed, ref, watch, nextTick, onMounted } from 'vue'
import { usePlayerStore } from '../stores/player'
import { useSettingsStore } from '../stores/settings'
import { open } from '@tauri-apps/plugin-dialog'
import { invoke } from '@tauri-apps/api/core'
// TAMBAHKAN Loader2 DI SINI
import { Plus, RefreshCw, Music, Loader2, AlertCircle } from 'lucide-vue-next'

const player = usePlayerStore()
const settings = useSettingsStore()
const lyricContainer = ref<HTMLElement | null>(null)

// --- STATE ---
const isHoveringLyrics = ref(false)
const isSyncing = ref(false)
const syncError = ref(false)

/**
 * LOGIKA AUTO SYNC ONLINE (LRCLIB)
 */
const fetchOnlineLyrics = async () => {
  if (!player.currentSong || player.parsedLyrics.length > 0) return

  isSyncing.value = true
  syncError.value = false
  
  const title = player.currentSong.title
  const artist = player.currentSong.artist
  
  try {
    const url = `https://lrclib.net/api/get?artist_name=${encodeURIComponent(artist)}&track_name=${encodeURIComponent(title)}`
    const response = await fetch(url)
    
    if (response.ok) {
      const data = await response.json()
      const rawLyrics = data.syncedLyrics || data.plainLyrics
      
      if (rawLyrics) {
        await settings.updateSongLyrics(player.currentSong.id, rawLyrics)
        player.currentSong.lyrics = rawLyrics
        player.parseLyrics(rawLyrics)
      } else {
        syncError.value = true
      }
    } else {
      // Jika 404 atau error lain dari API
      syncError.value = true
    }
  } catch (err) {
    console.error("Auto Sync Error:", err)
    syncError.value = true
  } finally {
    isSyncing.value = false
  }
}

/**
 * IMPORT MANUAL
 */
const importLrcFile = async () => {
  if (!player.currentSong) return

  const selected = await open({
    multiple: false,
    filters: [{ name: 'Lyrics', extensions: ['lrc', 'txt'] }]
  })

  if (selected && typeof selected === 'string') {
    try {
      const content = await invoke<string>('read_lrc_file', { path: selected })
      await settings.updateSongLyrics(player.currentSong.id, content)
      player.currentSong.lyrics = content
      player.parseLyrics(content)
      syncError.value = false
    } catch (err) {
      console.error("Gagal mengimpor lirik:", err)
    }
  }
}

// --- PLAYER LOGIC ---
const activeIndex = computed(() => {
  if (!player.parsedLyrics.length) return -1
  return player.parsedLyrics.findLastIndex(l => player.currentTime >= l.time)
})

watch(activeIndex, (newIndex) => {
  if (newIndex === -1 && lyricContainer.value) {
     lyricContainer.value.scrollTo({ top: 0, behavior: 'smooth' })
     return
  }
  nextTick(() => {
    const activeEl = document.querySelector('.lyric-line-active')
    if (activeEl && lyricContainer.value) {
      activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  })
})

watch(() => player.currentSong?.id, () => {
  if (player.parsedLyrics.length === 0) {
    fetchOnlineLyrics()
  }
})

onMounted(() => {
  if (player.parsedLyrics.length === 0) {
    fetchOnlineLyrics()
  }
})
</script>

<template>
  <div 
    class="relative w-full h-full overflow-hidden bg-[#070709] transition-colors duration-1000"
    @mouseenter="isHoveringLyrics = true"
    @mouseleave="isHoveringLyrics = false"
  >
    <!-- BACKGROUND BLUR IMMERSIVE -->
    <div class="absolute inset-0 opacity-20 pointer-events-none select-none overflow-hidden">
      <img v-if="player.coverUrl" :src="player.coverUrl" class="w-full h-full object-cover blur-[120px] scale-150" />
    </div>

    <!-- MAIN CONTAINER -->
    <div ref="lyricContainer" class="relative z-10 w-full h-full overflow-y-auto no-scrollbar scroll-smooth">
      
      <!-- STATE: EMPTY / LOADING / NOT FOUND -->
      <div v-if="player.parsedLyrics.length === 0" class="h-full w-full flex flex-col items-center justify-center p-12 text-center">
        
        <div class="mb-10 space-y-6 animate-in fade-in zoom-in duration-700">
          <div class="w-24 h-24 bg-white/5 rounded-[2.5rem] flex items-center justify-center mx-auto shadow-2xl border border-white/5 relative">
            <Loader2 v-if="isSyncing" class="w-10 h-10 text-blue-500 animate-spin" />
            <AlertCircle v-else-if="syncError" class="w-10 h-10 text-amber-500/50" />
            <Music v-else class="w-10 h-10 text-white/20" />
          </div>
          
          <div class="space-y-2">
            <h2 class="text-4xl font-black italic uppercase tracking-tighter text-white">
              {{ isSyncing ? 'Searching...' : (syncError ? 'Lyrics Not Found' : 'No Lyrics') }}
            </h2>
            <p class="text-[10px] font-black uppercase tracking-[0.4em] text-white/30 max-w-xs mx-auto leading-relaxed">
              {{ isSyncing ? 'Checking database for sync data' : 'The lyrics for this track aren\'t available in our online database yet.' }}
            </p>
          </div>
        </div>

        <!-- Tombol Aksi (Hanya muncul saat hover atau lirik kosong) -->
        <div class="flex flex-col sm:flex-row items-center gap-4 transition-all duration-500" :class="isHoveringLyrics || syncError ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'">
          <button 
            @click="fetchOnlineLyrics"
            :disabled="isSyncing"
            class="flex items-center gap-3 px-10 py-4 bg-white text-black hover:bg-blue-500 hover:text-white rounded-full font-black uppercase tracking-widest text-[10px] transition-all shadow-2xl cursor-pointer disabled:opacity-50"
          >
            <RefreshCw :size="16" :class="{'animate-spin': isSyncing}" />
            {{ syncError ? 'Retry Search' : 'Search Online' }}
          </button>

          <button 
            @click="importLrcFile"
            class="flex items-center gap-3 px-10 py-4 bg-white/5 hover:bg-white/10 text-white rounded-full font-black uppercase tracking-widest text-[10px] transition-all border border-white/10 cursor-pointer backdrop-blur-md"
          >
            <Plus :size="16" />
            Import .LRC
          </button>
        </div>

        <p v-if="syncError" class="mt-8 text-[9px] font-bold text-white/20 uppercase tracking-widest">
          Try importing a local file if it's missing online
        </p>
      </div>

      <!-- LYRICS LIST -->
      <div v-else class="pl-24 pr-12 pt-[45vh] pb-[40vh]">
        <div 
          v-for="(line, index) in player.parsedLyrics" 
          :key="index"
          class="lyric-line py-4 text-4xl font-black transition-all duration-700 cursor-pointer origin-left select-none leading-tight tracking-tighter"
          :class="activeIndex === index ? 'lyric-line-active text-white opacity-100' : 'text-white/10 opacity-100 hover:text-white/40'"
          @click="player.seek(line.time)"
        >
          {{ line.text }}
        </div>
      </div>

    </div>
  </div>
</template>

<style scoped>
.no-scrollbar::-webkit-scrollbar { display: none; }
.lyric-line { transform-origin: center left; }

.lyric-line-active {
  transform: scale(1.08);
  filter: drop-shadow(0 0 30px rgba(255,255,255,0.4));
}

.animate-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>