<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router' // Added Vue Router
import { getDB } from '../services/db'
import { readFile, BaseDirectory } from '@tauri-apps/plugin-fs'
import { Disc } from 'lucide-vue-next'

const router = useRouter() // Initialize router
const albums = ref<any[]>([])

onMounted(async () => {
  try {
    const db = getDB()
    const songs = await db.select<{ album: string, artist: string, cover_path: string }[]>(
      "SELECT album, artist, cover_path FROM songs GROUP BY album"
    )

    if (songs.length === 0) {
      console.log("Database kosong, tidak ada album untuk ditampilkan.")
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
          console.error(`Gagal load cover untuk album ${song.album}:`, err);
        }
      }

      return {
        ...song,
        coverUrl
      }
    }))

    albums.value = processedAlbums;
  } catch (error) {
    console.error("Gagal memuat library:", error)
  }
})

// Added navigation function
const goToAlbum = (albumName: string) => {
  router.push(`/album/${encodeURIComponent(albumName)}`)
}
</script>

<template>
  <div class="relative h-full overflow-y-auto pb-20 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
    <header class="mb-8">
      <h1 class="text-5xl font-black tracking-tighter italic uppercase text-black dark:text-white">Library</h1>
      <p class="text-black/60 dark:text-white/60 font-semibold tracking-wide uppercase text-xs mt-1">
        EMP Player // {{ albums.length }} Albums
      </p>
    </header>

    <div v-if="albums.length === 0" class="flex items-center justify-center h-64 text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest text-sm">
      Belum ada data. Silakan scan folder di Settings.
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