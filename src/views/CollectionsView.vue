<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Music, ListMusic, Loader2 } from 'lucide-vue-next'
import { useSettingsStore } from '../stores/settings'
import { getDB } from '../services/db'
import { readFile, BaseDirectory } from '@tauri-apps/plugin-fs'

const router = useRouter()
const settings = useSettingsStore()
const isLoading = ref(true)
const playlists = ref<any[]>([])
const playlistCovers = ref<Record<string, string>>({}) // Menyimpan Blob URL untuk cover

const isDarkMode = computed(() => settings.isDarkMode)

// Fungsi untuk load gambar cover dari local storage
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

// Gabungkan All Songs dengan playlist dari DB
const allCollections = computed(() => {
  const base = [
    {
      id: 'all-songs',
      title: 'All Songs',
      description: 'Every track in your library',
      icon: Music,
      color: 'bg-blue-500',
      type: 'system',
      coverUrl: null
    }
  ]
  
  const userPlaylists = playlists.value.map(p => ({
    id: p.id,
    title: p.name,
    description: 'Playlist',
    icon: ListMusic,
    color: 'bg-emerald-500',
    type: 'user',
    coverUrl: playlistCovers.value[p.id] || null // Gunakan Blob URL jika ada
  }))
  
  return [...base, ...userPlaylists]
})

const fetchPlaylists = async () => {
  try {
    const db = await getDB()
    const result = await db.select<any[]>("SELECT * FROM playlists ORDER BY created_at DESC")
    playlists.value = result

    // Setelah ambil data DB, langsung proses load gambarnya
    for (const p of result) {
      if (p.cover_path) {
        await loadCoverImage(p.cover_path, p.id)
      }
    }
  } catch (err) {
    console.error("Failed to fetch playlists:", err)
  } finally {
    isLoading.value = false
  }
}

onMounted(fetchPlaylists)

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
    <header class="mb-8">
      <h1 class="text-5xl font-black tracking-tighter italic uppercase text-slate-900 dark:text-white">Collections</h1>
    </header>

    <div v-if="isLoading" class="flex flex-col items-center justify-center h-64 gap-4">
      <Loader2 class="w-8 h-8 animate-spin text-slate-400" />
      <span class="text-xs font-bold uppercase tracking-[0.2em] opacity-40">Preparing Collections</span>
    </div>

    <div v-else class="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-8 animate-fade-in">
      <div v-for="item in allCollections" :key="item.id" 
           @click="goToCollection(item)"
           class="group cursor-pointer flex flex-col">
        
        <div class="relative aspect-square bg-slate-200/50 dark:bg-slate-800/50 rounded-2xl border border-black/5 dark:border-white/10 overflow-hidden flex flex-col items-center justify-center mb-3 shadow-sm hover:shadow-xl transition-all duration-300">
          
          <img v-if="item.coverUrl" :src="item.coverUrl" class="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
          
          <div v-if="!item.coverUrl" class="absolute inset-0 opacity-10 group-hover:opacity-20 transition-opacity duration-500" :class="item.color"></div>
          
          <div v-if="!item.coverUrl" class="z-10 flex flex-col items-center gap-3 transition-transform duration-500 group-hover:scale-110">
            <div class="w-16 h-16 rounded-2xl bg-white dark:bg-white/10 flex items-center justify-center shadow-lg">
                <component :is="item.icon" :size="32" class="text-slate-900 dark:text-white" />
            </div>
          </div>
        </div>

        <div class="space-y-0.5 px-1">
          <p class="font-bold text-sm truncate uppercase tracking-tight"
             :style="{ color: 'var(--text-primary)' }">
            {{ item.title }}
          </p>
          <p class="text-[10px] font-bold tracking-widest uppercase truncate"
             :style="{ color: 'var(--text-primary)', opacity: 0.4 }">
            {{ item.description }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.animate-fade-in {
  animation: fadeIn 0.4s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>