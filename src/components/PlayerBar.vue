<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue'
import { Play, Pause, SkipBack, SkipForward, Volume2, Disc, Shuffle, Repeat, Repeat1 } from 'lucide-vue-next'
import { useSettingsStore } from '../stores/settings'
import { usePlayerStore } from '../stores/player'

const settings = useSettingsStore()
const player = usePlayerStore()

// Computed properties untuk warna berdasarkan theme
const isDarkMode = computed(() => settings.isDarkMode)
const bgColor = computed(() => isDarkMode.value ? 'rgba(7, 7, 9, 0.95)' : '#F0F8FF')
const borderColor = computed(() => isDarkMode.value ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)')
const textPrimary = computed(() => isDarkMode.value ? '#ffffff' : '#0f172a')
const textSecondary = computed(() => isDarkMode.value ? 'rgba(255, 255, 255, 0.4)' : '#64748b')
const textTertiary = computed(() => isDarkMode.value ? 'rgba(255, 255, 255, 0.6)' : '#a0aeb8')
const bgButtonPrimary = computed(() => isDarkMode.value ? '#ffffff' : '#0f172a')
const textButtonPrimary = computed(() => isDarkMode.value ? '#0f172a' : '#ffffff')
const bgSecondary = computed(() => isDarkMode.value ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)')

const formatTime = (seconds: number) => {
  if (!seconds || isNaN(seconds)) return "0:00"
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

const toggleRepeat = () => {
  player.repeatMode = (player.repeatMode + 1) % 3
}

// ==========================================
// LOGIKA DRAGGABLE UNTUK SEEK BAR (PROGRESS)
// ==========================================
const seekBarRef = ref<HTMLElement | null>(null)
const isDraggingSeek = ref(false)

const updateSeekFromEvent = (e: MouseEvent) => {
  if (!seekBarRef.value || !player.duration) return
  const rect = seekBarRef.value.getBoundingClientRect()
  let pos = (e.clientX - rect.left) / rect.width
  pos = Math.max(0, Math.min(1, pos))
  player.seek(pos * player.duration)
}

const startDragSeek = (e: MouseEvent) => {
  isDraggingSeek.value = true
  updateSeekFromEvent(e)
  window.addEventListener('mousemove', onDragSeek)
  window.addEventListener('mouseup', stopDragSeek)
}

const onDragSeek = (e: MouseEvent) => {
  if (!isDraggingSeek.value) return
  updateSeekFromEvent(e)
}

const stopDragSeek = () => {
  isDraggingSeek.value = false
  window.removeEventListener('mousemove', onDragSeek)
  window.removeEventListener('mouseup', stopDragSeek)
}

// ==========================================
// LOGIKA DRAGGABLE UNTUK VOLUME BAR
// ==========================================
const volumeBarRef = ref<HTMLElement | null>(null)
const isDraggingVolume = ref(false)

const updateVolumeFromEvent = (e: MouseEvent) => {
  if (!volumeBarRef.value) return
  const rect = volumeBarRef.value.getBoundingClientRect()
  let pos = (e.clientX - rect.left) / rect.width
  pos = Math.max(0, Math.min(1, pos))
  player.setVolume(pos)
}

const startDragVolume = (e: MouseEvent) => {
  isDraggingVolume.value = true
  updateVolumeFromEvent(e)
  window.addEventListener('mousemove', onDragVolume)
  window.addEventListener('mouseup', stopDragVolume)
}

const onDragVolume = (e: MouseEvent) => {
  if (!isDraggingVolume.value) return
  updateVolumeFromEvent(e)
}

const stopDragVolume = () => {
  isDraggingVolume.value = false
  window.removeEventListener('mousemove', onDragVolume)
  window.removeEventListener('mouseup', stopDragVolume)
}

// Bersihkan event listener saat komponen dihancurkan
onUnmounted(() => {
  window.removeEventListener('mousemove', onDragSeek)
  window.removeEventListener('mouseup', stopDragSeek)
  window.removeEventListener('mousemove', onDragVolume)
  window.removeEventListener('mouseup', stopDragVolume)
})
</script>

<template>
  <div class="h-24 flex items-center px-6 gap-6 shrink-0 transition-colors duration-500 z-50 backdrop-blur-xl rounded-main border select-none"
       :style="{ backgroundColor: bgColor, borderColor: borderColor }">
    
    <div class="flex items-center gap-4 w-1/3 min-w-0">
      <div class="w-14 h-14 rounded-xl flex items-center justify-center overflow-hidden shrink-0 shadow-md transition-colors"
           :style="{ backgroundColor: bgSecondary }">
        <img v-if="player.coverUrl" :src="player.coverUrl" class="w-full h-full object-cover" draggable="false" />
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
        <span class="w-8 text-right">{{ formatTime(player.currentTime) }}</span>
        
        <div class="h-6 flex-grow flex items-center cursor-pointer group relative"
             ref="seekBarRef"
             @mousedown="startDragSeek">
          <div class="w-full h-1.5 rounded-full relative transition-colors" :style="{ backgroundColor: bgSecondary }">
            <div class="absolute top-0 left-0 h-full rounded-full" 
                 :style="{ 
                   backgroundColor: textPrimary, 
                   width: player.duration ? (player.currentTime / player.duration) * 100 + '%' : '0%' 
                 }">
            </div>
            <div class="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full shadow-md transition-opacity"
                 :class="isDraggingSeek ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'"
                 :style="{
                   backgroundColor: textPrimary,
                   left: player.duration ? `calc(${(player.currentTime / player.duration) * 100}% - 6px)` : '0px'
                 }">
            </div>
          </div>
        </div>
        
        <span class="w-8">{{ formatTime(player.duration) }}</span>
      </div>
    </div>

    <div class="w-1/3 flex items-center justify-end gap-3 transition-colors" :style="{ color: textSecondary }">
      <Volume2 :size="18" />
      
      <div class="w-24 h-6 flex items-center cursor-pointer group relative"
           ref="volumeBarRef"
           @mousedown="startDragVolume">
        <div class="w-full h-1.5 rounded-full relative transition-colors" :style="{ backgroundColor: bgSecondary }">
          
          <div class="absolute top-0 left-0 h-full rounded-full transition-colors" 
               :style="{ 
                 backgroundColor: textTertiary,
                 width: (player.volume * 100) + '%'
               }">
          </div>

          <div class="absolute top-1/2 -translate-y-1/2 flex justify-center transition duration-200"
               :class="isDraggingVolume ? 'opacity-100 scale-100' : 'opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100'"
               :style="{ left: `calc(${(player.volume * 100)}% - 6px)` }">
            
            <div class="w-3 h-3 rounded-full shadow-md" :style="{ backgroundColor: textTertiary }"></div>
            
            <div class="absolute bottom-full mb-2 px-2 py-1 rounded bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[9px] font-bold tracking-widest shadow-xl whitespace-nowrap pointer-events-none transition duration-200"
                 :class="isDraggingVolume ? 'translate-y-0 opacity-100' : 'translate-y-1 opacity-0 group-hover:translate-y-0 group-hover:opacity-100'">
              {{ Math.round(player.volume * 100) }}%
              <div class="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900 dark:border-t-white"></div>
            </div>

          </div>

        </div>
      </div>

    </div>

  </div>
</template>