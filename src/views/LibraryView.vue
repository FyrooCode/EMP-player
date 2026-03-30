<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { getDB } from '../services/db'
import { invoke } from '@tauri-apps/api/core' 
import { convertFileSrc } from '@tauri-apps/api/core' 
import { appLocalDataDir, join } from '@tauri-apps/api/path' 
import { useSettingsStore } from '../stores/settings'
import { useToastStore } from '../stores/toast' // IMPORT TOAST
import { listen, emit } from '@tauri-apps/api/event'
import { 
  Disc, Loader2, LayoutGrid, List, ChevronDown, 
  User as ArtistIcon, Hash, Calendar, Clock, ArrowRight 
} from 'lucide-vue-next'

const router = useRouter()
const settings = useSettingsStore()
const toast = useToastStore() // INISIALISASI TOAST

// --- STATE ---
const items = ref<any[]>([])
const isLoading = ref(true)
const activeTab = ref<'albums' | 'artists'>('albums')
const sortBy = ref('name') 
const isSortOpen = ref(false)
const isSyncingMetadata = ref(false)

const viewMode = computed(() => settings.libraryView)

const sortLabels: Record<string, string> = {
  name: 'Alphabetical',
  artist: 'Artist Name',
  added: 'Recently Added',
  played: 'Recently Played'
}

/**
 * Sinkronisasi Foto Artis dengan NOTIFIKASI TOAST
 */
const syncMissingArtistImages = async (artists: any[]) => {
  if (isSyncingMetadata.value || activeTab.value !== 'artists') return;
  
  const missing = artists.filter(a => !a.cover_path || a.cover_path === "");
  if (missing.length === 0) return;

  isSyncingMetadata.value = true;
  const db = getDB();
  let successCount = 0;

  // Tampilkan toast loading di awal (persistent: false agar tidak hilang sendiri)
  const toastId = toast.show('loading', `Syncing metadata for ${missing.length} artists...`, false);

  for (const artist of missing) {
    try {
      const externalData = await invoke<any>('fetch_external_artist_data', { artist: artist.name });
      
      if (externalData && externalData.picture_xl) {
        const localPath = await invoke<string>('download_artist_image', { 
          url: externalData.picture_xl, 
          artistName: artist.name 
        });

        await db.execute(
          "UPDATE artists SET image_path = $1 WHERE name = $2",
          [localPath, artist.name]
        );
        successCount++;
      }
    } catch (err) {
      console.warn(`Skip ${artist.name}: ${err}`);
    }
  }

  isSyncingMetadata.value = false;

  // Update status toast berdasarkan hasil
  if (successCount > 0) {
    toast.updateStatus(toastId, 'success', `Successfully synced ${successCount} artist images!`);
    // Refresh UI
    await emit('library-updated');
  } else {
    // Jika tidak ada yang ditemukan, hilangkan saja toast-nya atau beri info
    toast.updateStatus(toastId, 'info', 'Artist metadata is up to date.');
  }
}

/**
 * Helper Resolusi Gambar
 */
const resolveImage = async (path: string | null, type: 'covers' | 'artist_images') => {
  if (!path || path === "") return null;
  try {
    const localDataPath = await appLocalDataDir();
    const filename = path.split(/[\\/]/).pop();
    const fullPath = await join(localDataPath, type, filename || '');
    return convertFileSrc(fullPath);
  } catch {
    return null;
  }
}

/**
 * Load Library
 */
const loadLibrary = async () => {
  try {
    isLoading.value = true
    const db = await getDB()
    
    if (activeTab.value === 'albums') {
      let orderClause = "ORDER BY al.title ASC"
      if (sortBy.value === 'artist') orderClause = "ORDER BY ar.name ASC"
      if (sortBy.value === 'added') orderClause = "ORDER BY (SELECT MAX(added_at) FROM songs WHERE album_id = al.id) DESC"
      if (sortBy.value === 'played') orderClause = "ORDER BY (SELECT MAX(last_played) FROM songs WHERE album_id = al.id) DESC"

      const query = `
        SELECT al.title as name, ar.name as artist, al.cover_path 
        FROM albums al
        JOIN artists ar ON al.artist_id = ar.id
        ${orderClause}
      `
      const data = await db.select<any[]>(query)
      items.value = await Promise.all(data.map(async (item) => ({
        ...item,
        coverUrl: await resolveImage(item.cover_path, 'covers')
      })))

    } else {
      const query = `
        SELECT ar.name, ar.image_path as cover_path,
        (SELECT COUNT(*) FROM albums WHERE artist_id = ar.id) as sub_text
        FROM artists ar
        ORDER BY ar.name ASC
      `
      const data = await db.select<any[]>(query)
      
      items.value = await Promise.all(data.map(async (item) => ({
        ...item,
        coverUrl: await resolveImage(item.cover_path, 'artist_images')
      })))

      // Jalankan sync background jika di tab Artists
      syncMissingArtistImages(data);
    }
  } catch (error) {
    console.error("Failed to load library:", error)
  } finally {
    isLoading.value = false
  }
}

watch([activeTab, sortBy], () => {
  loadLibrary()
  isSortOpen.value = false
})

let unlistenUpdate: any;
onMounted(async () => {
  await loadLibrary()
  unlistenUpdate = await listen('library-updated', () => {
    if (!isSyncingMetadata.value) loadLibrary();
  });
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
    <header class="flex flex-col mb-10 gap-6">
      <div class="flex items-center justify-between">
        <h1 class="text-5xl font-black tracking-tighter italic uppercase text-black dark:text-white transition-colors duration-500">
          Library
        </h1>
        
        <div v-if="isSyncingMetadata" class="flex items-center gap-2 px-3 py-1 bg-blue-500/10 rounded-full border border-blue-500/20">
          <Loader2 :size="12" class="animate-spin text-blue-500" />
          <span class="text-[8px] font-black uppercase tracking-widest text-blue-500">Syncing Artists</span>
        </div>
      </div>

      <div class="flex flex-wrap items-center justify-between gap-4">
        <div class="flex bg-black/5 dark:bg-white/5 p-1 rounded-2xl border border-black/5 dark:border-white/10 transition-all duration-500">
          <button @click="activeTab = 'albums'" class="px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all" :class="activeTab === 'albums' ? 'bg-white dark:bg-slate-700 shadow-md scale-105 text-black dark:text-white' : 'opacity-40'">Albums</button>
          <button @click="activeTab = 'artists'" class="px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all" :class="activeTab === 'artists' ? 'bg-white dark:bg-slate-700 shadow-md scale-105 text-black dark:text-white' : 'opacity-40'">Artists</button>
        </div>

        <div class="flex items-center gap-3">
          <div class="relative">
            <button @click="isSortOpen = !isSortOpen" class="flex items-center gap-2 px-4 py-2 bg-black/5 dark:bg-white/5 rounded-xl border border-black/5 dark:border-white/10 text-[10px] font-black uppercase tracking-widest hover:bg-black/10 dark:hover:bg-white/10 transition-all">
              <span>Sort: {{ sortLabels[sortBy] || 'Alphabetical' }}</span>
              <ChevronDown :size="14" :class="{'rotate-180': isSortOpen}" class="transition-transform" />
            </button>
            <div v-if="isSortOpen" class="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-900 border border-black/5 dark:border-white/10 rounded-2xl shadow-2xl z-[100] overflow-hidden p-1">
              <button v-for="(label, key) in sortLabels" :key="key" @click="sortBy = key as string" class="w-full flex items-center gap-3 px-4 py-3 text-[10px] font-bold uppercase tracking-widest hover:bg-blue-500 hover:text-white transition-colors rounded-xl" :class="sortBy === key ? 'text-blue-500' : 'text-slate-500 dark:text-slate-400'">
                <Hash v-if="key === 'name'" :size="14" />
                <ArtistIcon v-if="key === 'artist'" :size="14" />
                <Calendar v-if="key === 'added'" :size="14" />
                <Clock v-if="key === 'played'" :size="14" />
                {{ label }}
              </button>
            </div>
          </div>

          <div class="flex bg-black/5 dark:bg-white/5 p-1 rounded-xl border border-black/5 dark:border-white/10">
            <button @click="settings.updateLibraryView('grid')" class="p-2 rounded-lg transition-all" :class="viewMode === 'grid' ? 'bg-white dark:bg-slate-700 text-black dark:text-white shadow-md scale-110' : 'opacity-40'"><LayoutGrid :size="18" /></button>
            <button @click="settings.updateLibraryView('list')" class="p-2 rounded-lg transition-all" :class="viewMode === 'list' ? 'bg-white dark:bg-slate-700 text-black dark:text-white shadow-md scale-110' : 'opacity-40'"><List :size="18" /></button>
          </div>
        </div>
      </div>
    </header>

    <div v-if="isLoading" class="flex flex-col items-center justify-center h-64 gap-4">
      <Loader2 class="w-8 h-8 animate-spin text-slate-400" />
      <span class="text-xs font-bold uppercase tracking-widest text-slate-400">Syncing Collection</span>
    </div>

    <div v-else-if="items.length === 0" class="flex flex-col items-center justify-center h-64 text-slate-400 gap-2">
      <span class="font-bold uppercase tracking-widest text-sm">No items found</span>
    </div>

    <!-- GRID VIEW -->
    <div v-else-if="viewMode === 'grid'" class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-x-6 gap-y-8 animate-view">
      <div v-for="item in items" :key="item.name" @click="handleItemClick(item)" class="group cursor-pointer flex flex-col">
        <div class="relative aspect-square bg-slate-200/50 dark:bg-slate-800/50 rounded-2xl border border-black/5 dark:border-white/10 overflow-hidden flex flex-col items-center justify-center mb-3 transition-all duration-500 hover:shadow-xl">
          <img v-if="item.coverUrl" :src="item.coverUrl" class="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" alt="cover" />
          <div v-else class="text-black/40 dark:text-white/40 italic font-bold flex flex-col items-center gap-2">
            <ArtistIcon v-if="activeTab === 'artists'" :size="32" class="opacity-50" />
            <Disc v-else :size="32" class="opacity-50" />
            <span class="text-[8px] tracking-widest font-black">NO IMAGE</span>
          </div>
        </div>
        <div class="px-1">
          <p class="text-slate-900 dark:text-white font-bold text-sm truncate uppercase tracking-tighter">{{ item.name }}</p>
          <p v-if="activeTab === 'albums'" class="text-slate-500 dark:text-white/60 text-[10px] font-bold uppercase truncate tracking-widest">{{ item.artist }}</p>
          <p v-else class="text-blue-500 text-[10px] font-black uppercase truncate tracking-widest">{{ item.sub_text }} Albums</p>
        </div>
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