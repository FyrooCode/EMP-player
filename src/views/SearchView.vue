<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useSearchStore } from '../stores/search'
import { usePlayerStore } from '../stores/player'
import { useSettingsStore } from '../stores/settings'
import { Music, User, Disc, Loader2, Search } from 'lucide-vue-next'
import { readFile, BaseDirectory } from '@tauri-apps/plugin-fs'

const searchStore = useSearchStore()
const player = usePlayerStore()
const settings = useSettingsStore()

const isDarkMode = computed(() => settings.isDarkMode)
const resultCovers = ref<Record<string, string>>({})

const loadResultCover = async (path: string) => {
  if (!path || resultCovers.value[path]) return
  
  try {
    const filename = path.split(/[\\/]/).pop()
    const relativePath = `covers/${filename}`
    const contents = await readFile(relativePath, { baseDir: BaseDirectory.AppLocalData })
    const blob = new Blob([contents], { type: 'image/jpeg' })
    resultCovers.value[path] = URL.createObjectURL(blob)
  } catch (err) {
    console.error("Failed to load search result cover:", err)
  }
}

watch(() => searchStore.searchResults, (newResults) => {
  newResults.forEach(song => {
    if (song.cover_path) loadResultCover(song.cover_path)
  })
}, { immediate: true })

const playSong = (song: any) => {
  player.playTrack(song, searchStore.searchResults)
}
</script>

<template>
  <div class="h-full flex flex-col pb-20 overflow-hidden">
    <header class="mb-8 shrink-0">
      <h1 class="text-5xl font-black tracking-tighter italic uppercase">Results</h1>
      <p class="text-xs font-bold tracking-[0.2em] mt-2 opacity-40">
        Found {{ searchStore.searchResults.length }} tracks for "{{ searchStore.searchQuery }}"
      </p>
    </header>

    <div v-if="searchStore.isSearching" class="flex-1 flex flex-col items-center justify-center gap-4">
      <Loader2 class="animate-spin text-slate-400" :size="32" />
      <p class="text-[10px] font-bold uppercase tracking-widest opacity-40">Searching database...</p>
    </div>

    <div v-else-if="searchStore.searchResults.length === 0" class="flex-1 flex flex-col items-center justify-center opacity-20 italic">
      <Search :size="64" />
      <p class="mt-4 font-bold uppercase tracking-widest">No tracks found</p>
    </div>

    <div v-else class="flex-1 overflow-y-auto space-y-1 pr-4 no-scrollbar">
      <div 
        v-for="song in searchStore.searchResults" 
        :key="song.id"
        @click="playSong(song)"
        class="flex items-center gap-4 px-4 py-3 rounded-xl transition-colors group cursor-pointer"
        :class="[
          isDarkMode ? 'hover:bg-white/5' : 'hover:bg-slate-200/50',
          player.currentSong?.id === song.id ? (isDarkMode ? 'bg-white/10' : 'bg-slate-200/80') : ''
        ]"
      >
        <div class="w-12 h-12 bg-slate-200 dark:bg-slate-800 rounded-xl flex items-center justify-center shrink-0 overflow-hidden shadow-sm">
           <img v-if="song.cover_path && resultCovers[song.cover_path]" 
                :src="resultCovers[song.cover_path]" 
                class="w-full h-full object-cover" />
           <Music v-else :size="20" class="opacity-20" />
        </div>
        
        <div class="flex-1 truncate">
          <p class="font-bold text-sm truncate" :style="{ color: 'var(--text-primary)' }">
            {{ song.title }}
          </p>
          <div class="flex items-center gap-4 text-[10px] font-bold uppercase tracking-widest mt-1"
               :style="{ color: 'var(--text-primary)', opacity: 0.4 }">
             <span class="flex items-center gap-1"><User :size="10" /> {{ song.artist }}</span>
             <span class="flex items-center gap-1"><Disc :size="10" /> {{ song.album }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.no-scrollbar::-webkit-scrollbar { display: none; }
</style>