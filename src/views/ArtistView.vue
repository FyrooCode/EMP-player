<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getDB } from '../services/db'
import { convertFileSrc } from '@tauri-apps/api/core'
import { appLocalDataDir, join } from '@tauri-apps/api/path'
import { usePlayerStore } from '../stores/player'
import { 
  Play, Disc, Music, ArrowLeft, LayoutGrid, User as ArtistIcon 
} from 'lucide-vue-next'

const route = useRoute()
const router = useRouter()
const player = usePlayerStore()

const artistName = computed(() => route.params.name as string)
const artistData = ref<any>(null)
const albums = ref<any[]>([])
const songs = ref<any[]>([])
const isLoading = ref(true)

const resolveImg = async (path: string | null, type: 'covers' | 'artist_images') => {
  if (!path) return null
  const localDir = await appLocalDataDir()
  const filename = path.split(/[\\/]/).pop()
  const fullPath = await join(localDir, type, filename || '')
  return convertFileSrc(fullPath)
}

const loadArtistDetails = async () => {
  try {
    isLoading.value = true
    const db = await getDB()
    const resArtist = await db.select<any[]>("SELECT * FROM artists WHERE name = $1", [artistName.value])
    if (resArtist.length > 0) {
      const artist = resArtist[0]
      artist.coverUrl = await resolveImg(artist.image_path, 'artist_images')
      artistData.value = artist
    }

    const resAlbums = await db.select<any[]>(
      "SELECT * FROM albums WHERE artist_id = (SELECT id FROM artists WHERE name = $1) ORDER BY year DESC",
      [artistName.value]
    )
    albums.value = await Promise.all(resAlbums.map(async (al) => ({
      ...al,
      coverUrl: await resolveImg(al.cover_path, 'covers')
    })))

    const resSongs = await db.select<any[]>(`
      SELECT s.*, al.title as album_title, al.cover_path as album_cover
      FROM songs s
      JOIN albums al ON s.album_id = al.id
      WHERE s.artist_id = (SELECT id FROM artists WHERE name = $1)
      ORDER BY al.title ASC, s.track_num ASC
    `, [artistName.value])
    
    songs.value = await Promise.all(resSongs.map(async (s) => ({
      ...s,
      coverUrl: await resolveImg(s.album_cover, 'covers'),
      artist: artistName.value
    })))
  } catch (err) {
    console.error(err)
  } finally {
    isLoading.value = false
  }
}

onMounted(loadArtistDetails)
const goBack = () => router.back()
const playAll = () => songs.value.length > 0 && player.playTrack(songs.value[0], songs.value)
const goToAlbum = (title: string) => router.push(`/album/${encodeURIComponent(title)}`)
</script>

<template>
  <div class="h-full overflow-y-auto no-scrollbar pb-32 animate-fade-in">
    <!-- HERO BANNER WITH DEEP BLUR -->
    <header class="relative w-full h-[450px] flex items-end overflow-hidden rounded-3xl bg-slate-950 shadow-2xl mb-12">
      <!-- Deep Blur Background (Lyrics Style) -->
      <div class="absolute inset-0 pointer-events-none select-none overflow-hidden">
        <img v-if="artistData?.coverUrl" :src="artistData.coverUrl" 
             class="w-full h-full object-cover blur-[100px] scale-150 opacity-50" />
        <div class="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent"></div>
      </div>

      <!-- Back Button -->
      <button @click="goBack" class="absolute top-8 left-8 z-20 flex items-center gap-2 px-4 py-2 bg-black/20 hover:bg-white/10 backdrop-blur-md rounded-full text-white transition-all group border border-white/5 cursor-pointer">
        <ArrowLeft :size="18" class="group-hover:-translate-x-1 transition-transform" />
        <span class="text-[10px] font-black uppercase tracking-widest">Back</span>
      </button>
      
      <!-- Artist Content -->
      <div class="relative z-10 flex items-center gap-10 p-10 w-full">
        <div class="w-56 h-56 rounded-2xl overflow-hidden shadow-2xl border border-white/10 shrink-0 bg-slate-800 flex items-center justify-center">
          <img v-if="artistData?.coverUrl" :src="artistData.coverUrl" class="w-full h-full object-cover" />
          <ArtistIcon v-else :size="80" class="opacity-20 text-white" />
        </div>

        <div class="flex flex-col gap-3">
          <div class="flex items-center gap-2">
            <div class="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
              <div class="w-1.5 h-1.5 bg-white rounded-full"></div>
            </div>
            <span class="text-[10px] font-black uppercase tracking-[0.4em] text-blue-400">Verified Artist</span>
          </div>
          <h1 class="text-8xl font-black tracking-tighter italic uppercase text-white leading-none">
            {{ artistName }}
          </h1>
          <div class="flex items-center gap-6 mt-4">
             <button @click="playAll" class="bg-white text-black px-10 py-4 rounded-full flex items-center gap-3 transition-all hover:scale-105 active:scale-95 shadow-2xl cursor-pointer">
               <Play :size="20" fill="currentColor" />
               <span class="text-xs font-black uppercase tracking-widest">Play All</span>
             </button>
             <div class="flex flex-col">
               <span class="text-xs font-black text-white uppercase tracking-widest">{{ songs.length }} Songs</span>
               <span class="text-[10px] font-bold text-white/40 uppercase tracking-widest">{{ albums.length }} Albums</span>
             </div>
          </div>
        </div>
      </div>
    </header>

    <div class="px-6 space-y-20">
      <!-- ALBUMS -->
      <section v-if="albums.length > 0">
        <h2 class="text-2xl font-black italic uppercase tracking-tighter dark:text-white mb-8 flex items-center gap-3">
          <LayoutGrid :size="22" class="text-blue-500" /> Discography
        </h2>
        <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-8">
          <div v-for="album in albums" :key="album.id" @click="goToAlbum(album.title)" class="group cursor-pointer">
            <div class="relative aspect-square rounded-2xl overflow-hidden border border-white/5 shadow-lg group-hover:shadow-blue-500/10 transition-all duration-500 mb-4">
              <img v-if="album.coverUrl" :src="album.coverUrl" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
            </div>
            <p class="font-bold text-xs uppercase truncate dark:text-white">{{ album.title }}</p>
            <p class="text-[9px] font-bold opacity-30 uppercase tracking-widest dark:text-white">{{ album.year }}</p>
          </div>
        </div>
      </section>

      <!-- SONGS -->
      <section v-if="songs.length > 0">
        <h2 class="text-2xl font-black italic uppercase tracking-tighter dark:text-white mb-8 flex items-center gap-3">
          <Music :size="22" class="text-blue-500" /> All Tracks
        </h2>
        <div class="flex flex-col gap-1">
          <div v-for="(song, idx) in songs" :key="song.id" @click="player.playTrack(song, songs)"
               class="flex items-center gap-4 p-4 rounded-2xl hover:bg-white/5 transition-all duration-300 group cursor-pointer">
            <span class="w-8 text-center text-xs font-black opacity-20 dark:text-white">{{ idx + 1 }}</span>
            <div class="w-12 h-12 rounded-lg overflow-hidden bg-slate-800 border border-white/5"><img v-if="song.coverUrl" :src="song.coverUrl" class="w-full h-full object-cover" /></div>
            <div class="flex-grow min-w-0"><p class="font-bold text-sm uppercase truncate dark:text-white">{{ song.title }}</p><p class="text-[10px] font-bold opacity-40 uppercase truncate dark:text-white">{{ song.album_title }}</p></div>
            <span class="text-[10px] font-mono opacity-40 dark:text-white">{{ Math.floor(song.duration/60) }}:{{ (song.duration%60).toString().padStart(2,'0') }}</span>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.animate-fade-in { animation: fadeIn 0.8s cubic-bezier(0.2, 0.8, 0.2, 1); }
@keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
.no-scrollbar::-webkit-scrollbar { display: none; }
</style>