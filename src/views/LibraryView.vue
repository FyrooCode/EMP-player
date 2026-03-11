<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { getDB } from '../services/db'
import { convertFileSrc } from '@tauri-apps/api/core' 
import { appLocalDataDir, join } from '@tauri-apps/api/path' 
import { useSettingsStore } from '../stores/settings'
import { listen } from '@tauri-apps/api/event'
import { 
  Disc, Loader2, LayoutGrid, List, ChevronDown, 
  User as ArtistIcon, Hash, Calendar, Clock, ArrowRight 
} from 'lucide-vue-next'

const router = useRouter()
const settings = useSettingsStore()

// --- STATE ---
const items = ref<any[]>([])
const isLoading = ref(true)
const activeTab = ref<'albums' | 'artists'>('albums')
const sortBy = ref('name') // name, artist, added, played
const isSortOpen = ref(false)

const viewMode = computed(() => settings.libraryView)

// --- MAPPING SORT LABEL ---
const sortLabels: Record<string, string> = {
  name: 'Alphabetical',
  artist: 'Artist Name',
  added: 'Recently Added',
  played: 'Recently Played'
}

/**
 * Helper untuk resolusi gambar cover
 */
const resolveCover = async (coverPath: string | null, localDataPath: string) => {
  if (!coverPath) return null;
  try {
    const filename = coverPath.split(/[\\/]/).pop();
    const fullPath = await join(localDataPath, 'covers', filename || '');
    return convertFileSrc(fullPath);
  } catch {
    return null;
  }
}

/**
 * Memuat library berdasarkan Tab dan Sort yang dipilih
 */
const loadLibrary = async () => {
  try {
    isLoading.value = true
    const db = await getDB()
    const localDataPath = await appLocalDataDir();
    
    if (activeTab.value === 'albums') {
      // --- LOGIC ALBUM ---
      let orderClause = "ORDER BY album ASC"
      if (sortBy.value === 'artist') orderClause = "ORDER BY artist ASC"
      if (sortBy.value === 'added') orderClause = "ORDER BY MAX(added_at) DESC"
      if (sortBy.value === 'played') orderClause = "ORDER BY MAX(last_played) DESC"

      const query = `SELECT album as name, artist, cover_path FROM songs GROUP BY album ${orderClause}`
      const data = await db.select<any[]>(query)
      
      items.value = await Promise.all(data.map(async (item) => ({
        ...item,
        coverUrl: await resolveCover(item.cover_path, localDataPath)
      })))

    } else {
      // --- LOGIC ARTIST (FIXED SPLITTING) ---
      const rawSongs = await db.select<any[]>("SELECT artist, album, cover_path FROM songs")
      const artistMap = new Map();

      rawSongs.forEach(song => {
        if (!song.artist) return;
        const individualArtists = song.artist
          .split(/[,;&]|\bfeat\.|\bft\.|\//i) 
          .map((a: string) => a.trim())
          .filter((a: string) => a.length > 0);

        individualArtists.forEach((artistName: string) => {
          if (!artistMap.has(artistName)) {
            artistMap.set(artistName, {
              name: artistName,
              albums: new Set(),
              cover_path: song.cover_path
            });
          }
          artistMap.get(artistName).albums.add(song.album);
        });
      });

      const processedArtists = Array.from(artistMap.values())
        .map(artist => ({
          name: artist.name,
          sub_text: artist.albums.size,
          cover_path: artist.cover_path
        }))
        .sort((a, b) => a.name.localeCompare(b.name));

      items.value = await Promise.all(processedArtists.map(async (item) => ({
        ...item,
        coverUrl: await resolveCover(item.cover_path, localDataPath)
      })))
    }
  } catch (error) {
    console.error("Failed to load library:", error)
  } finally {
    isLoading.value = false
  }
}

// Watch perubahan tab atau sort untuk reload data
watch([activeTab, sortBy], () => {
  loadLibrary()
  isSortOpen.value = false
})

let unlistenUpdate: any;
onMounted(async () => {
  await loadLibrary()
  unlistenUpdate = await listen('library-updated', () => loadLibrary());
})

onUnmounted(() => {
  if (unlistenUpdate) unlistenUpdate();
})

const handleItemClick = (item: any) => {
  if (activeTab.value === 'albums') {
    router.push(`/album/${encodeURIComponent(item.name)}`)
  } else {
    router.push(`/artist/${encodeURIComponent(item.name)}`)
  }
}
</script>

<template>
  <div class="relative h-full overflow-y-auto pb-20 no-scrollbar p-6">
    <!-- HEADER SECTION -->
    <header class="flex flex-col mb-10 gap-6">
      <h1 class="text-5xl font-black tracking-tighter italic uppercase text-black dark:text-white transition-colors duration-500">
        Library
      </h1>

      <div class="flex flex-wrap items-center justify-between gap-4">
        <!-- TABS SWITCHER -->
        <div class="flex bg-black/5 dark:bg-white/5 p-1 rounded-2xl border border-black/5 dark:border-white/10 transition-all duration-500">
          <button 
            @click="activeTab = 'albums'"
            class="px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all"
            :class="activeTab === 'albums' ? 'bg-white dark:bg-slate-700 shadow-md scale-105 text-black dark:text-white' : 'opacity-40'"
          >
            Albums
          </button>
          <button 
            @click="activeTab = 'artists'"
            class="px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all"
            :class="activeTab === 'artists' ? 'bg-white dark:bg-slate-700 shadow-md scale-105 text-black dark:text-white' : 'opacity-40'"
          >
            Artists
          </button>
        </div>

        <div class="flex items-center gap-3">
          <!-- SORT DROPDOWN -->
          <div class="relative">
            <button 
              @click="isSortOpen = !isSortOpen"
              class="flex items-center gap-2 px-4 py-2 bg-black/5 dark:bg-white/5 rounded-xl border border-black/5 dark:border-white/10 text-[10px] font-black uppercase tracking-widest hover:bg-black/10 dark:hover:bg-white/10 transition-all"
            >
              <span>Sort: {{ sortLabels[sortBy] || 'Alphabetical' }}</span>
              <ChevronDown :size="14" :class="{'rotate-180': isSortOpen}" class="transition-transform" />
            </button>

            <div v-if="isSortOpen" class="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-900 border border-black/5 dark:border-white/10 rounded-2xl shadow-2xl z-[100] overflow-hidden p-1">
              <button v-for="(label, key) in sortLabels" :key="key" 
                @click="sortBy = key as string"
                class="w-full flex items-center gap-3 px-4 py-3 text-[10px] font-bold uppercase tracking-widest hover:bg-blue-500 hover:text-white transition-colors rounded-xl"
                :class="sortBy === key ? 'text-blue-500' : 'text-slate-500 dark:text-slate-400'"
              >
                <Hash v-if="key === 'name'" :size="14" />
                <ArtistIcon v-if="key === 'artist'" :size="14" />
                <Calendar v-if="key === 'added'" :size="14" />
                <Clock v-if="key === 'played'" :size="14" />
                {{ label }}
              </button>
            </div>
          </div>

          <!-- GRID/LIST TOGGLE -->
          <div class="flex bg-black/5 dark:bg-white/5 p-1 rounded-xl border border-black/5 dark:border-white/10">
            <button @click="settings.updateLibraryView('grid')" class="p-2 rounded-lg transition-all" :class="viewMode === 'grid' ? 'bg-white dark:bg-slate-700 text-black dark:text-white shadow-md scale-110' : 'opacity-40'">
              <LayoutGrid :size="18" />
            </button>
            <button @click="settings.updateLibraryView('list')" class="p-2 rounded-lg transition-all" :class="viewMode === 'list' ? 'bg-white dark:bg-slate-700 text-black dark:text-white shadow-md scale-110' : 'opacity-40'">
              <List :size="18" />
            </button>
          </div>
        </div>
      </div>
    </header>

    <!-- CONTENT SECTION -->
    <div v-if="isLoading" class="flex flex-col items-center justify-center h-64 gap-4">
      <Loader2 class="w-8 h-8 animate-spin text-slate-400" />
      <span class="text-xs font-bold uppercase tracking-widest text-slate-400">Syncing Collection</span>
    </div>

    <div v-else-if="items.length === 0" class="flex flex-col items-center justify-center h-64 text-slate-400 gap-2">
      <span class="font-bold uppercase tracking-widest text-sm">No items found</span>
      <span class="text-[10px] uppercase tracking-widest opacity-60">Please scan your music folder in Settings</span>
    </div>

    <!-- GRID VIEW (DENGAN ANIMASI HOVER KLASIK) -->
    <div v-else-if="viewMode === 'grid'" class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-x-6 gap-y-8 animate-view">
      <div v-for="item in items" :key="item.name" @click="handleItemClick(item)" class="group cursor-pointer flex flex-col">
        <!-- Container Cover dengan Shadow & Rounding 2xl -->
        <div class="relative aspect-square bg-slate-200/50 dark:bg-slate-800/50 rounded-2xl border border-black/5 dark:border-white/10 overflow-hidden flex flex-col items-center justify-center mb-3 transition-all duration-500 hover:shadow-xl">
          <!-- Image dengan Scale-110 saat group hover -->
          <img v-if="item.coverUrl" :src="item.coverUrl" class="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" alt="cover" />
          <div v-else class="text-black/40 dark:text-white/40 italic font-bold flex flex-col items-center gap-2">
            <Disc :size="32" class="opacity-50" />
            <span class="text-[8px] tracking-widest">NO COVER</span>
          </div>
        </div>
        <!-- Info Text -->
        <div class="px-1">
          <p class="text-slate-900 dark:text-white font-bold text-sm truncate uppercase tracking-tighter">{{ item.name }}</p>
          <p v-if="activeTab === 'albums'" class="text-slate-500 dark:text-white/60 text-[10px] font-bold uppercase truncate tracking-widest">
            {{ item.artist }}
          </p>
          <p v-else class="text-blue-500 text-[10px] font-black uppercase truncate tracking-widest">
            {{ item.sub_text }} Albums
          </p>
        </div>
      </div>
    </div>

    <!-- LIST VIEW -->
    <div v-else class="flex flex-col gap-1 animate-view">
      <div v-for="item in items" :key="item.name" @click="handleItemClick(item)" 
           class="flex items-center gap-4 p-3 rounded-2xl hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer group transition-all duration-300">
        <div class="w-14 h-14 rounded-xl bg-slate-200/50 dark:bg-slate-800/50 flex-shrink-0 flex items-center justify-center overflow-hidden border border-black/5 dark:border-white/10">
          <img v-if="item.coverUrl" :src="item.coverUrl" class="w-full h-full object-cover" />
          <Disc v-else :size="20" class="opacity-20 dark:text-white" />
        </div>
        <div class="flex-grow min-w-0">
          <h3 class="font-bold text-base dark:text-white uppercase truncate">{{ item.name }}</h3>
          <p class="text-[10px] font-bold opacity-50 uppercase truncate dark:text-white">
            {{ activeTab === 'albums' ? item.artist : item.sub_text + ' Albums' }}
          </p>
        </div>
        <ArrowRight :size="18" class="opacity-0 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-slate-400" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.animate-view { animation: fadeIn 0.4s ease-out; }
@keyframes fadeIn { 
  from { opacity: 0; transform: translateY(10px); } 
  to { opacity: 1; transform: translateY(0); } 
}
.no-scrollbar::-webkit-scrollbar { display: none; }
</style>