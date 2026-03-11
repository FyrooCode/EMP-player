<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { Music, ListMusic, Loader2 } from 'lucide-vue-next'
import { useSettingsStore } from '../stores/settings'
import { getDB } from '../services/db'
import { readFile, BaseDirectory } from '@tauri-apps/plugin-fs'

const router = useRouter()
const settings = useSettingsStore()
const isLoading = ref(true)
const playlists = ref<any[]>([])
const allSongsCount = ref(0)
const playlistCovers = ref<Record<string, string>>({}) 

const isDarkMode = computed(() => settings.isDarkMode)

/**
 * Load gambar cover playlist dari folder local
 */
const loadCoverImage = async (path: string, playlistId: string) => {
  if (!path) return
  try {
    const filename = path.split(/[\\/]/).pop()
    const contents = await readFile(`playlist_covers/${filename}`, { 
      baseDir: BaseDirectory.AppLocalData 
    })
    const blob = new Blob([contents], { type: 'image/jpeg' })
    playlistCovers.value[playlistId] = URL.createObjectURL(blob)
  } catch (e) {
    console.error(`Failed to load cover for playlist ${playlistId}:`, e)
  }
}

/**
 * Gabungkan Koleksi Sistem (All Songs) dengan User Playlists
 */
const allCollections = computed(() => {
  const base = [
    {
      id: 'all-songs',
      title: 'All Songs',
      description: `${allSongsCount.value} Tracks`,
      icon: Music,
      color: 'bg-blue-600',
      type: 'system',
      coverUrl: null
    }
  ]
  
  const userPlaylists = playlists.value.map(p => ({
    id: p.id,
    title: p.name,
    description: `${p.song_count || 0} Tracks`,
    icon: ListMusic,
    color: 'bg-emerald-600',
    type: 'user',
    coverUrl: playlistCovers.value[p.id] || null 
  }))
  
  return [...base, ...userPlaylists]
})

/**
 * Fetch Data Playlists & Count Songs
 */
const fetchCollections = async () => {
  try {
    isLoading.value = true
    const db = await getDB()
    
    // 1. Ambil total lagu di library
    const songsRes = await db.select<{total: number}[]>("SELECT COUNT(*) as total FROM songs")
    allSongsCount.value = songsRes[0]?.total || 0

    // 2. Ambil playlist beserta jumlah lagunya (Relational Join)
    const playlistRes = await db.select<any[]>(`
      SELECT 
        p.*, 
        (SELECT COUNT(*) FROM playlist_songs WHERE playlist_id = p.id) as song_count
      FROM playlists p 
      ORDER BY p.created_at DESC
    `)
    playlists.value = playlistRes

    // 3. Load semua cover playlist
    for (const p of playlistRes) {
      if (p.cover_path) {
        await loadCoverImage(p.cover_path, p.id)
      }
    }
  } catch (err) {
    console.error("Failed to fetch collections:", err)
  } finally {
    isLoading.value = false
  }
}

onMounted(fetchCollections)

const goToCollection = (item: any) => {
  if (item.id === 'all-songs') {
    router.push('/collection/all-songs')
  } else {
    router.push(`/playlist/${item.id}`)
  }
}
</script>

<template>
  <div class="relative h-full overflow-y-auto pb-20 no-scrollbar">
    <header class="mb-10">
      <h1 class="text-5xl md:text-6xl font-black tracking-tighter italic uppercase text-slate-900 dark:text-white transition-colors duration-500">
        Collections
      </h1>
    </header>

    <!-- LOADING STATE -->
    <div v-if="isLoading" class="flex flex-col items-center justify-center h-64 gap-4">
      <Loader2 class="w-8 h-8 animate-spin text-blue-500" />
      <span class="text-[10px] font-black uppercase tracking-[0.3em] opacity-40 dark:text-white">Relational Sync...</span>
    </div>

    <!-- COLLECTIONS GRID -->
    <div v-else class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-x-6 gap-y-10 animate-fade-in">
      <div v-for="item in allCollections" :key="item.id" 
           @click="goToCollection(item)"
           class="group cursor-pointer flex flex-col">
        
        <!-- CARD CONTAINER -->
        <div class="relative aspect-square bg-slate-200/50 dark:bg-slate-800/50 rounded-2xl border border-black/5 dark:border-white/10 overflow-hidden flex flex-col items-center justify-center mb-4 transition-all duration-500 hover:shadow-2xl hover:-translate-y-2">
          
          <!-- IMAGE OVERLAY -->
          <img v-if="item.coverUrl" :src="item.coverUrl" class="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
          
          <!-- COLOR PLACEHOLDER -->
          <div v-if="!item.coverUrl" class="absolute inset-0 opacity-10 group-hover:opacity-25 transition-all duration-500" :class="item.color"></div>
          
          <!-- ICON SECTION -->
          <div v-if="!item.coverUrl" class="z-10 flex flex-col items-center gap-3 transition-all duration-500 group-hover:scale-110">
            <div class="w-16 h-16 rounded-3xl bg-white dark:bg-white/10 flex items-center justify-center shadow-2xl">
                <component :is="item.icon" :size="32" class="text-slate-900 dark:text-white" />
            </div>
          </div>
        </div>

        <!-- TEXT INFO -->
        <div class="space-y-0.5 px-1">
          <p class="font-black text-sm truncate uppercase tracking-tighter text-slate-900 dark:text-white transition-colors">
            {{ item.title }}
          </p>
          <p class="text-[10px] font-bold tracking-[0.2em] uppercase truncate opacity-40 text-slate-900 dark:text-white">
            {{ item.description }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.no-scrollbar::-webkit-scrollbar { display: none; }

.animate-fade-in {
  animation: fadeIn 0.5s cubic-bezier(0.2, 0.8, 0.2, 1);
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>