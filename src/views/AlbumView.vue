<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getDB } from '../services/db'
import { readFile, BaseDirectory } from '@tauri-apps/plugin-fs'
import { useSettingsStore } from '../stores/settings'
import { usePlayerStore } from '../stores/player' 
// 1. IMPORT CONTEXT MENU STORE
import { useContextMenuStore } from '../stores/contextMenu' 
import { ArrowLeft, Play, Clock, Disc, Pause } from 'lucide-vue-next'

const route = useRoute()
const router = useRouter()
const settings = useSettingsStore()
const player = usePlayerStore() 
// 2. INISIALISASI CONTEXT MENU STORE
const contextMenu = useContextMenuStore() 

const albumName = ref(decodeURIComponent(route.params.name as string))
const songs = ref<any[]>([])
const albumInfo = ref<any>({ artist: 'Unknown Artist', coverUrl: null })

const isDarkMode = computed(() => settings.isDarkMode)
const textColor = computed(() => isDarkMode.value ? '#ffffff' : '#0f172a')
const secondaryTextColor = computed(() => isDarkMode.value ? 'rgba(255, 255, 255, 0.6)' : '#64748b')
const tertiaryTextColor = computed(() => isDarkMode.value ? 'rgba(160, 174, 192, 1)' : '#a0aeb8')

onMounted(async () => {
  try {
    const db = getDB()
    const result = await db.select<any[]>(
      "SELECT * FROM songs WHERE album = $1 ORDER BY title ASC",
      [albumName.value]
    )
    songs.value = result

    if (result.length > 0) {
      albumInfo.value.artist = result[0].artist
      
      const coverPath = result[0].cover_path
      if (coverPath) {
        try {
          const filename = coverPath.split(/[\\/]/).pop();
          const relativePath = `covers/${filename}`;
          const contents = await readFile(relativePath, { baseDir: BaseDirectory.AppLocalData });
          const blob = new Blob([contents], { type: 'image/jpeg' });
          albumInfo.value.coverUrl = URL.createObjectURL(blob);
        } catch (err) {
          console.error("Gagal load cover album:", err);
        }
      }
    }
  } catch (error) {
    console.error("Gagal memuat detail album:", error)
  }
})

const formatTime = (seconds: number) => {
  if (!seconds) return "0:00"
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

const goBack = () => {
  router.back()
}
</script>

<template>
  <div class="relative h-full overflow-y-auto pb-20 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
    
    <button @click="goBack" class="flex items-center gap-2 transition-colors mb-8 group cursor-pointer" :style="{ color: secondaryTextColor }">
      <ArrowLeft :size="20" class="group-hover:-translate-x-1 transition-transform" />
      <span class="text-xs font-bold uppercase tracking-widest" :style="{ color: secondaryTextColor }">Back to Library</span>
    </button>

    <div class="flex flex-col md:flex-row gap-8 mb-12 items-end">
      <div class="w-48 h-48 rounded-2xl overflow-hidden shadow-2xl flex-shrink-0 border flex items-center justify-center transition-colors" 
           :class="isDarkMode ? 'bg-slate-800/50 border-white/10' : 'bg-slate-200/50 border-black/5'">
        <img v-if="albumInfo.coverUrl" :src="albumInfo.coverUrl" class="w-full h-full object-cover" />
        <Disc v-else :size="48" :class="isDarkMode ? 'text-white/20' : 'text-black/20'" />
      </div>

      <div class="flex-grow space-y-2">
        <h1 class="text-5xl md:text-6xl font-black tracking-tighter italic uppercase leading-tight transition-colors" :style="{ color: textColor }">
          {{ albumName }}
        </h1>
        <p class="font-bold tracking-[0.2em] uppercase text-sm transition-colors" :style="{ color: secondaryTextColor }">
          {{ albumInfo.artist }} // {{ songs.length }} TRACKS
        </p>
      </div>
    </div>

    <div class="space-y-2">
      <div class="flex items-center px-4 pb-2 border-b text-[10px] font-bold tracking-widest uppercase transition-colors"
           :class="isDarkMode ? 'border-white/10' : 'border-black/5'"
           :style="{ color: tertiaryTextColor }">
        <div class="w-12 text-center">#</div>
        <div class="flex-grow">Title</div>
        <div class="w-20 text-right"><Clock :size="14" class="inline" /></div>
      </div>

      <div v-for="(song, index) in songs" :key="song.id" 
           @click="player.playTrack(song, songs)"
           @contextmenu.prevent="contextMenu.openMenu($event, song)"
           class="flex items-center px-4 py-3 rounded-xl transition-colors group cursor-pointer"
           :class="[
             isDarkMode ? 'hover:bg-white/5' : 'hover:bg-slate-200/50',
             player.currentSong?.id === song.id ? (isDarkMode ? 'bg-white/10' : 'bg-slate-200/80') : ''
           ]">
        
        <div class="w-12 text-center text-xs font-bold relative transition-colors" :style="{ color: tertiaryTextColor }">
          <span :class="{'opacity-0': player.currentSong?.id === song.id}" class="group-hover:opacity-0 transition-opacity">{{ index + 1 }}</span>
          
          <div v-if="player.currentSong?.id === song.id" class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center gap-0.5 h-3">
             <div class="w-1 bg-current h-full animate-bounce" :style="{ color: textColor, animationDelay: '0ms' }"></div>
             <div class="w-1 bg-current h-1/2 animate-bounce" :style="{ color: textColor, animationDelay: '150ms' }"></div>
             <div class="w-1 bg-current h-3/4 animate-bounce" :style="{ color: textColor, animationDelay: '300ms' }"></div>
          </div>
          
          <Play v-else :size="14" class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity fill-current" 
                :style="{ color: textColor }" />
        </div>

        <div class="flex-grow text-sm font-bold transition-colors" :style="{ color: player.currentSong?.id === song.id ? '#3b82f6' : textColor }">
          {{ song.title }}
        </div>

        <div class="w-20 text-right text-xs font-mono transition-colors" :style="{ color: secondaryTextColor }">
          {{ formatTime(song.duration) }}
        </div>
      </div>
    </div>

  </div>
</template>