<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getDB } from '../services/db'
import { readFile, BaseDirectory } from '@tauri-apps/plugin-fs'
import { useSettingsStore } from '../stores/settings'
import { usePlayerStore } from '../stores/player' 
import { useContextMenuStore } from '../stores/contextMenu' 
import { ArrowLeft, Play, Clock, Disc, BarChart2 } from 'lucide-vue-next'

const route = useRoute()
const router = useRouter()
const settings = useSettingsStore()
const player = usePlayerStore() 
const contextMenu = useContextMenuStore() 

const albumName = ref(decodeURIComponent(route.params.name as string))
const songs = ref<any[]>([])
const albumInfo = ref<any>({ artist: 'Unknown Artist', coverUrl: null })

const isDarkMode = computed(() => settings.isDarkMode)
// Mapping warna untuk transisi light/dark
const textColor = computed(() => isDarkMode.value ? '#ffffff' : '#0f172a')
const secondaryTextColor = computed(() => isDarkMode.value ? 'rgba(255, 255, 255, 0.6)' : '#64748b')
const tertiaryTextColor = computed(() => isDarkMode.value ? 'rgba(255, 255, 255, 0.3)' : '#a0aeb8')

const fetchAlbumDetails = async () => {
  try {
    const db = await getDB()
    const albumRes = await db.select<any[]>(
      `SELECT al.*, ar.name as artist_name FROM albums al JOIN artists ar ON al.artist_id = ar.id WHERE al.title = $1 LIMIT 1`,
      [albumName.value]
    )

    if (albumRes.length > 0) {
      const albumData = albumRes[0]
      albumInfo.value.artist = albumData.artist_name
      
      if (albumData.cover_path) {
        try {
          const filename = albumData.cover_path.split(/[\\/]/).pop();
          const contents = await readFile(`covers/${filename}`, { baseDir: BaseDirectory.AppLocalData });
          albumInfo.value.coverUrl = URL.createObjectURL(new Blob([contents], { type: 'image/jpeg' }));
        } catch (e) { console.error("Cover load failed", e) }
      }

      const songsRes = await db.select<any[]>(
        `SELECT s.*, ar.name as artist, al.title as album, l.raw_lyrics as lyrics 
         FROM songs s JOIN artists ar ON s.artist_id = ar.id 
         JOIN albums al ON s.album_id = al.id LEFT JOIN lyrics l ON s.id = l.song_id
         WHERE s.album_id = $1 ORDER BY s.track_num ASC`,
        [albumData.id]
      )
      songs.value = songsRes
    }
  } catch (error) { console.error(error) }
}

onMounted(fetchAlbumDetails)
const formatTime = (s: number) => `${Math.floor(s/60)}:${Math.floor(s%60).toString().padStart(2,'0')}`
const goBack = () => router.back()
</script>

<template>
  <div class="h-full overflow-y-auto no-scrollbar pb-32 animate-fade-in">
    <!-- IMERSIVE BLURRED BANNER -->
    <header class="relative w-full h-[420px] flex items-end overflow-hidden rounded-3xl bg-slate-950 shadow-2xl mb-10">
      <div class="absolute inset-0 pointer-events-none select-none overflow-hidden">
        <img v-if="albumInfo.coverUrl" :src="albumInfo.coverUrl" class="w-full h-full object-cover blur-[120px] scale-150 opacity-40" />
        <div class="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent"></div>
      </div>

      <button @click="goBack" class="absolute top-8 left-8 z-20 flex items-center gap-2 px-4 py-2 bg-black/20 hover:bg-white/10 backdrop-blur-md rounded-full text-white transition-all group border border-white/5 cursor-pointer">
        <ArrowLeft :size="18" class="group-hover:-translate-x-1 transition-transform" />
        <span class="text-[10px] font-black uppercase tracking-widest">Back to Library</span>
      </button>

      <div class="relative z-10 flex items-center gap-10 p-10 w-full">
        <div class="w-52 h-52 rounded-2xl overflow-hidden shadow-2xl border border-white/10 shrink-0 bg-slate-800 flex items-center justify-center">
          <img v-if="albumInfo.coverUrl" :src="albumInfo.coverUrl" class="w-full h-full object-cover" />
          <Disc v-else :size="64" class="opacity-10 text-white" />
        </div>
        <div class="flex flex-col gap-2">
          <h1 class="text-7xl font-black tracking-tighter italic uppercase text-white leading-tight drop-shadow-2xl">{{ albumName }}</h1>
          <p class="font-black tracking-[0.4em] uppercase text-sm text-blue-400">{{ albumInfo.artist }}</p>
          <p class="text-[10px] font-bold text-white/40 uppercase tracking-[0.2em] mt-2">{{ songs.length }} Tracks // Album</p>
        </div>
      </div>
    </header>

    <!-- SONGS LIST WITH VISUALIZER -->
    <div class="px-6 space-y-1">
      <!-- Table Header -->
      <div class="flex items-center px-6 py-3 border-b border-white/5 text-[10px] font-black tracking-[0.3em] uppercase opacity-30 dark:text-white">
        <div class="w-12 text-center">#</div>
        <div class="flex-grow">Track Title</div>
        <div class="w-20 text-center"><BarChart2 :size="14" class="inline" /></div>
        <div class="w-20 text-right"><Clock :size="14" class="inline" /></div>
      </div>

      <!-- Song Rows -->
      <div v-for="(song, index) in songs" :key="song.id" 
           @click="player.playTrack(song, songs)"
           @contextmenu.prevent="contextMenu.openMenu($event, song)"
           class="flex items-center px-6 py-4 rounded-2xl transition-all group cursor-pointer"
           :class="[
             isDarkMode ? 'hover:bg-white/5' : 'hover:bg-slate-200/50',
             player.currentSong?.id === song.id ? (isDarkMode ? 'bg-white/10' : 'bg-slate-200/80') : ''
           ]">
        
        <!-- Index / Play Icon / Visualizer -->
        <div class="w-12 text-center text-xs font-black relative" :style="{ color: tertiaryTextColor }">
          <!-- Default Index Number -->
          <span :class="{'opacity-0': player.currentSong?.id === song.id}" class="group-hover:opacity-0 transition-opacity">
            {{ song.track_num || index + 1 }}
          </span>
          
          <!-- Animated Bouncing Bars (If Playing) -->
          <div v-if="player.currentSong?.id === song.id" class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center gap-0.5 h-3">
              <div class="w-1 bg-blue-500 h-full animate-bounce" style="animation-delay: 0ms"></div>
              <div class="w-1 bg-blue-500 h-1/2 animate-bounce" style="animation-delay: 150ms"></div>
              <div class="w-1 bg-blue-500 h-3/4 animate-bounce" style="animation-delay: 300ms"></div>
          </div>
          
          <!-- Play Icon (On Hover) -->
          <Play v-else :size="14" class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity fill-current text-blue-500" />
        </div>

        <!-- Title & Info -->
        <div class="flex-grow flex items-center gap-3 min-w-0">
          <span class="font-bold text-sm uppercase truncate transition-colors"
                :class="player.currentSong?.id === song.id ? 'text-blue-500' : 'dark:text-white text-slate-900'">
            {{ song.title }}
          </span>
          <span v-if="song.disc_num > 1" class="text-[8px] px-1.5 py-0.5 rounded bg-black/10 dark:bg-white/10 opacity-40 uppercase font-black shrink-0 dark:text-white">
            Disc {{ song.disc_num }}
          </span>
        </div>

        <!-- Play Count -->
        <div class="w-20 text-center text-[10px] font-black opacity-30 dark:text-white uppercase">
          {{ song.play_count || 0 }} <span class="text-[8px] opacity-40">Plays</span>
        </div>

        <!-- Duration -->
        <div class="w-20 text-right font-mono text-xs opacity-40 dark:text-white">
          {{ formatTime(song.duration) }}
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.no-scrollbar::-webkit-scrollbar { display: none; }
.animate-fade-in { animation: fadeIn 0.8s cubic-bezier(0.2, 0.8, 0.2, 1); }
@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

/* Visualizer Animation */
.animate-bounce { animation: visualizer 0.6s infinite alternate; }
@keyframes visualizer {
  from { transform: scaleY(0.4); }
  to { transform: scaleY(1.2); }
}
</style>