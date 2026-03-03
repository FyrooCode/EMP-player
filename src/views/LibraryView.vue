<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { getDB } from '../services/db'
import { readFile, BaseDirectory } from '@tauri-apps/plugin-fs'
import { Disc, Loader2 } from 'lucide-vue-next'

const router = useRouter()
const albums = ref<any[]>([])
const isLoading = ref(true) // Added loading state

onMounted(async () => {
  try {
    isLoading.value = true
    const db = getDB()
    const songs = await db.select<{ album: string, artist: string, cover_path: string }[]>(
      "SELECT album, artist, cover_path FROM songs GROUP BY album"
    )

    if (songs.length === 0) {
      isLoading.value = false
      return
    }

    const processedAlbums = await Promise.all(songs.map(async (song) => {
      let coverUrl = null;

      if (song.cover_path) {
        try {
          const filename = song.cover_path.split(/[\\/]/).pop();
          const relativePath = `covers/${filename}`;

          const contents = await readFile(relativePath, { 
            baseDir: BaseDirectory.AppLocalData 
          });

          const blob = new Blob([contents], { type: 'image/jpeg' });
          coverUrl = URL.createObjectURL(blob);
        } catch (err) {
          console.error(`Failed to load cover for album ${song.album}:`, err);
        }
      }

      return {
        ...song,
        coverUrl
      }
    }))

    albums.value = processedAlbums;
  } catch (error) {
    console.error("Failed to load library:", error)
  } finally {
    isLoading.value = false // Stop loading regardless of outcome
  }
})

const goToAlbum = (albumName: string) => {
  router.push(`/album/${encodeURIComponent(albumName)}`)
}
</script>

<template>
  <div class="relative h-full overflow-y-auto pb-20 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
    <header class="mb-8">
      <h1 class="text-5xl font-black tracking-tighter italic uppercase text-black dark:text-white">Library</h1>
    </header>

    <div v-if="isLoading" class="flex flex-col items-center justify-center h-64 gap-4">
      <Loader2 class="w-8 h-8 animate-spin text-slate-400 dark:text-slate-500" />
      <span class="text-xs font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">Loading Collection</span>
    </div>

    <div v-else-if="albums.length === 0" class="flex flex-col items-center justify-center h-64 text-slate-400 dark:text-slate-500 gap-2">
      <span class="font-bold uppercase tracking-widest text-sm">No albums found</span>
      <span class="text-[10px] uppercase tracking-widest opacity-60">Please scan your music folder in Settings</span>
    </div>

    <div v-else class="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-8">
      <div v-for="album in albums" :key="album.album" 
           @click="goToAlbum(album.album)"
           class="group cursor-pointer flex flex-col">
        
        <div class="relative aspect-square bg-slate-200/50 dark:bg-slate-800/50 rounded-2xl border border-black/5 dark:border-white/10 overflow-hidden flex flex-col items-center justify-center mb-3 shadow-sm hover:shadow-xl transition-shadow duration-300">
          <img 
            v-if="album.coverUrl" 
            :src="album.coverUrl" 
            class="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" 
            alt="cover" 
            loading="lazy"
          />
          <div v-else class="z-10 text-black/40 dark:text-white/40 text-xs flex flex-col items-center gap-2 font-bold italic">
            <Disc :size="32" class="opacity-50" />
            <span>NO COVER</span>
          </div>
        </div>

        <div class="space-y-0.5 px-1">
          <p class="text-slate-900 dark:text-white font-bold text-sm truncate not-italic">
            {{ album.album }}
          </p>
          <p class="text-slate-500 dark:text-white/60 text-[10px] font-bold tracking-widest uppercase truncate not-italic">
            {{ album.artist }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Added a smooth fade for the grid appearance */
.grid {
  animation: fadeIn 0.4s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>