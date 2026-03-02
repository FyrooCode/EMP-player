<script setup lang="ts">
import { computed } from 'vue'
import { Play, Pause, SkipBack, SkipForward, Volume2, Disc, Shuffle, Repeat, Repeat1 } from 'lucide-vue-next'
import { useSettingsStore } from '../stores/settings'
import { usePlayerStore } from '../stores/player' // 1. IMPORT PLAYER STORE

const settings = useSettingsStore()
const player = usePlayerStore() // Inisialisasi store

// Computed properties untuk warna berdasarkan theme (tetap sama)
const isDarkMode = computed(() => settings.isDarkMode)
const bgColor = computed(() => isDarkMode.value ? 'rgba(7, 7, 9, 0.95)' : '#F0F8FF')
const borderColor = computed(() => isDarkMode.value ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)')
const textPrimary = computed(() => isDarkMode.value ? '#ffffff' : '#0f172a')
const textSecondary = computed(() => isDarkMode.value ? 'rgba(255, 255, 255, 0.4)' : '#64748b')
const textTertiary = computed(() => isDarkMode.value ? 'rgba(255, 255, 255, 0.6)' : '#a0aeb8')
const bgButtonPrimary = computed(() => isDarkMode.value ? '#ffffff' : '#0f172a')
const textButtonPrimary = computed(() => isDarkMode.value ? '#0f172a' : '#ffffff')
const bgSecondary = computed(() => isDarkMode.value ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)')

// Helper untuk format menit:detik
const formatTime = (seconds: number) => {
  if (!seconds || isNaN(seconds)) return "0:00"
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

const toggleRepeat = () => {
  player.repeatMode = (player.repeatMode + 1) % 3
}

// Handler untuk Seek Bar
const handleSeek = (e: MouseEvent) => {
  if (!player.duration) return
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  const pos = (e.clientX - rect.left) / rect.width
  player.seek(pos * player.duration)
}

// Handler untuk Volume Bar
const handleVolume = (e: MouseEvent) => {
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  let pos = (e.clientX - rect.left) / rect.width
  pos = Math.max(0, Math.min(1, pos)) // Clamp 0-1
  player.setVolume(pos)
}
</script>

<template>
  <div class="h-24 flex items-center px-6 gap-6 shrink-0 transition-colors duration-500 z-50 backdrop-blur-xl rounded-main border"
       :style="{ backgroundColor: bgColor, borderColor: borderColor }">
    
    <div class="flex items-center gap-4 w-1/3 min-w-0">
      <div class="w-14 h-14 rounded-xl flex items-center justify-center overflow-hidden shrink-0 shadow-md transition-colors"
           :style="{ backgroundColor: bgSecondary }">
        <img v-if="player.coverUrl" :src="player.coverUrl" class="w-full h-full object-cover" />
        <Disc v-else :size="24" :style="{ color: textSecondary }" />
      </div>
      <div class="truncate">
        <p class="text-sm font-bold truncate transition-colors" :style="{ color: textPrimary }">
          {{ player.currentSong ? player.currentSong.title : 'No Track Selected' }}
        </p>
        <p class="text-[10px] font-bold tracking-widest uppercase truncate transition-colors" :style="{ color: textSecondary }">
          {{ player.currentSong ? player.currentSong.artist : 'EMP Player' }}
        </p>
      </div>
    </div>

    <div class="flex-1 flex flex-col items-center justify-center gap-2">
      <div class="flex items-center gap-5">
        
        <button 
          @click="player.isShuffle = !player.isShuffle"
          class="transition-colors cursor-pointer relative"
          :style="{ color: player.isShuffle ? textPrimary : textSecondary }"
        >
          <Shuffle :size="16" />
          <span v-if="player.isShuffle" class="absolute -bottom-2 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full transition-colors" :style="{ backgroundColor: textPrimary }"></span>
        </button>

        <button @click="player.prevTrack()" class="transition-colors cursor-pointer" :style="{ color: textSecondary }">
          <SkipBack :size="20" fill="currentColor" />
        </button>
        
        <button 
          @click="player.togglePlay()" 
          class="w-10 h-10 rounded-full flex items-center justify-center hover:scale-105 transition-transform shadow-lg cursor-pointer"
          :style="{ backgroundColor: bgButtonPrimary, color: textButtonPrimary, opacity: player.currentSong ? 1 : 0.5 }"
          :disabled="!player.currentSong"
        >
          <Play v-if="!player.isPlaying" :size="18" fill="currentColor" class="ml-1" />
          <Pause v-else :size="18" fill="currentColor" />
        </button>
        
        <button @click="player.nextTrack()" class="transition-colors cursor-pointer" :style="{ color: textSecondary }">
          <SkipForward :size="20" fill="currentColor" />
        </button>

        <button 
          @click="toggleRepeat"
          class="transition-colors cursor-pointer relative"
          :style="{ color: player.repeatMode !== 0 ? textPrimary : textSecondary }"
        >
          <Repeat1 v-if="player.repeatMode === 2" :size="16" />
          <Repeat v-else :size="16" />
          <span v-if="player.repeatMode !== 0" class="absolute -bottom-2 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full transition-colors" :style="{ backgroundColor: textPrimary }"></span>
        </button>

      </div>
      
      <div class="w-full max-w-md flex items-center gap-3 text-[10px] font-mono font-bold transition-colors" :style="{ color: textSecondary }">
        <span>{{ formatTime(player.currentTime) }}</span>
        
        <div @click="handleSeek" class="h-1.5 flex-grow rounded-full overflow-hidden cursor-pointer relative transition-colors" :style="{ backgroundColor: bgSecondary }">
          <div class="absolute top-0 left-0 h-full rounded-full transition-all" 
               :style="{ 
                 backgroundColor: textPrimary, 
                 width: player.duration ? (player.currentTime / player.duration) * 100 + '%' : '0%' 
               }">
          </div>
        </div>
        
        <span>{{ formatTime(player.duration) }}</span>
      </div>
    </div>

    <div class="w-1/3 flex items-center justify-end gap-3 transition-colors" :style="{ color: textSecondary }">
      <Volume2 :size="18" />
      <div @click="handleVolume" class="w-24 h-1.5 rounded-full overflow-hidden cursor-pointer relative transition-colors" :style="{ backgroundColor: bgSecondary }">
        <div class="absolute top-0 left-0 h-full rounded-full transition-colors" 
             :style="{ 
               backgroundColor: textTertiary,
               width: (player.volume * 100) + '%'
             }">
        </div>
      </div>
    </div>

  </div>
</template>