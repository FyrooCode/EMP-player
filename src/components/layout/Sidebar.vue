<script setup>
import { ref, nextTick, onMounted, onUnmounted } from 'vue'
import { 
  Library, Settings, Disc3, ChevronRight, LayoutGrid, Search, Plus, ListMusic, Music
} from 'lucide-vue-next'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { useSearchStore } from '../../stores/search'
import { getDB } from '../../services/db'
import { listen } from '@tauri-apps/api/event'
import { convertFileSrc } from '@tauri-apps/api/core' 
import { appLocalDataDir, join } from '@tauri-apps/api/path' 

const isExpanded = ref(false)
const recentItems = ref([]) 

const route = useRoute()
const router = useRouter()
const searchStore = useSearchStore()

const searchInputRef = ref(null)

const toggleSidebar = () => isExpanded.value = !isExpanded.value

/**
 * FETCH RECENT ACTIVITY (Relational Version)
 */
const fetchRecentActivity = async () => {
  try {
    const db = await getDB()
    const localDataPath = await appLocalDataDir()

    const query = `
      SELECT 
        s.id, 
        s.title as name, 
        'song' as type, 
        COALESCE(s.last_played, s.added_at) as activity_time, 
        al.title as album_name, 
        al.cover_path 
      FROM songs s
      LEFT JOIN albums al ON s.album_id = al.id
      
      UNION ALL
      
      SELECT 
        id, 
        name, 
        'playlist' as type, 
        COALESCE(last_played, created_at) as activity_time, 
        NULL as album_name, 
        cover_path
      FROM playlists
      
      ORDER BY activity_time DESC
      LIMIT 10
    `

    const results = await db.select(query)

    const processedItems = await Promise.all(
      results.map(async (item) => {
        let coverUrl = null

        if (item.cover_path) {
          try {
            const filename = item.cover_path.split(/[\\/]/).pop()
            const folder = item.type === 'playlist' ? 'playlist_covers' : 'covers'
            const fullPath = await join(localDataPath, folder, filename || '')
            coverUrl = convertFileSrc(fullPath)
          } catch (e) {
            console.error("Sidebar Image Error:", e)
          }
        }

        return { ...item, coverUrl }
      })
    )

    recentItems.value = processedItems
  } catch (err) {
    console.error("Failed to fetch activity:", err)
  }
}

let unlistenActivity
let unlistenLibrary

onMounted(async () => {
  await fetchRecentActivity()
  unlistenLibrary = await listen('library-changed', () => fetchRecentActivity())
  unlistenActivity = await listen('activity-updated', () => fetchRecentActivity())
})

onUnmounted(() => {
  if (unlistenLibrary) unlistenLibrary()
  if (unlistenActivity) unlistenActivity()
})

const handleSearchClick = async () => {
  if (!isExpanded.value) isExpanded.value = true
  await nextTick()
  if (searchInputRef.value) searchInputRef.value.focus()
}

const handleSearchInput = (e) => {
  const val = e.target.value
  searchStore.searchQuery = val
  if (val.length > 0) {
    router.push('/search')
    searchStore.performSearch(val)
  }
}

// Handler Navigasi Manual untuk Recent Items (Tanpa Active State)
const navigateToRecent = (item) => {
  const path = item.type === 'playlist' 
    ? `/playlist/${item.id}` 
    : `/album/${encodeURIComponent(item.album_name)}`;
  router.push(path);
}

const createNewPlaylist = async () => {
  try {
    const db = await getDB()
    const existing = await db.select("SELECT COUNT(*) as count FROM playlists")
    const nextNumber = (existing[0].count || 0) + 1
    const result = await db.execute(
      "INSERT INTO playlists (name) VALUES ($1)",
      [`My Playlist #${nextNumber}`]
    )
    isExpanded.value = true
    await fetchRecentActivity()
    router.push(`/playlist/${result.lastInsertId}`)
  } catch (err) {
    console.error("Failed to create playlist:", err)
  }
}
</script>

<template>
  <aside
    class="h-full bg-alice rounded-main flex flex-col shadow-2xl border border-white/10 relative transition-[width] duration-500 ease-in-out group shrink-0"
    :class="isExpanded ? 'w-64' : 'w-20'"
  >
    <!-- Toggle Button -->
    <button
      @click="toggleSidebar"
      class="absolute -right-3 top-20 w-6 h-6 bg-slate-800 dark:bg-slate-600 text-white rounded-full flex items-center justify-center shadow-lg cursor-pointer hover:scale-110 transition-transform z-50"
    >
      <ChevronRight
        :size="14"
        :style="{
          transition: 'transform 500ms cubic-bezier(0.4,0,0.2,1)',
          transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)'
        }"
      />
    </button>

    <div class="w-full h-full flex flex-col overflow-hidden px-4">
      <!-- Logo Section -->
      <div
        class="py-8 flex items-center mb-6 shrink-0 h-28 transition-all duration-500 ease-in-out"
        :class="isExpanded ? 'gap-4' : 'gap-0'"
      >
        <div class="min-w-12 h-12 bg-slate-800 dark:bg-slate-700 rounded-2xl flex items-center justify-center text-white shadow-lg shrink-0">
          <Disc3 :size="28" class="animate-spin-slow" />
        </div>

        <div
          class="transition-all duration-500 ease-in-out whitespace-nowrap overflow-hidden flex flex-col justify-center"
          :class="isExpanded ? 'w-32 opacity-100' : 'w-0 opacity-0 pointer-events-none'"
        >
          <h2 class="font-black text-xl tracking-tighter italic uppercase text-slate-800 dark:text-white">
            EMP
          </h2>
          <p class="text-[8px] font-bold opacity-40 uppercase tracking-[0.2em] text-slate-800 dark:text-white">
            System v1.0
          </p>
        </div>
      </div>

      <!-- Main Nav -->
      <nav class="flex flex-col gap-2 flex-1 overflow-y-auto no-scrollbar pb-6">
        <!-- Search -->
        <div
          @click="handleSearchClick"
          class="flex items-center p-3 rounded-xl transition-all duration-500 hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
          :class="isExpanded ? 'gap-4' : 'gap-0'"
        >
          <Search :size="20" class="text-slate-600 dark:text-slate-400 shrink-0" />
          <input
            ref="searchInputRef"
            type="text"
            placeholder="Search..."
            :value="searchStore.searchQuery"
            @input="handleSearchInput"
            class="bg-transparent border-none outline-none text-xs font-bold tracking-widest transition-all duration-500 text-slate-800 dark:text-white"
            :class="isExpanded ? 'w-32 opacity-100' : 'w-0 opacity-0 pointer-events-none'"
          />
        </div>

        <hr class="border-black/10 dark:border-white/10 my-2" />

        <RouterLink to="/" class="sidebar-link" :class="isExpanded ? 'gap-4' : 'gap-0'" active-class="sidebar-link-active">
          <Library :size="20" class="shrink-0" />
          <span 
            class="text-xs font-bold uppercase tracking-widest transition-all duration-500 overflow-hidden whitespace-nowrap"
            :class="isExpanded ? 'w-32 opacity-100' : 'w-0 opacity-0 pointer-events-none'"
          >
            Library
          </span>
        </RouterLink>

        <RouterLink to="/collections" class="sidebar-link" :class="isExpanded ? 'gap-4' : 'gap-0'" active-class="sidebar-link-active">
          <LayoutGrid :size="20" class="shrink-0" />
          <span 
            class="text-xs font-bold uppercase tracking-widest transition-all duration-500 overflow-hidden whitespace-nowrap"
            :class="isExpanded ? 'w-32 opacity-100' : 'w-0 opacity-0 pointer-events-none'"
          >
            Collections
          </span>
        </RouterLink>

        <button
          @click="createNewPlaylist"
          class="sidebar-link border border-dashed border-black/10 dark:border-white/10 mt-2 cursor-pointer"
          :class="isExpanded ? 'gap-4' : 'gap-0'"
        >
          <Plus :size="20" class="text-slate-600 dark:text-slate-400 shrink-0" />
          <span 
            class="text-xs font-bold uppercase tracking-widest text-left transition-all duration-500 overflow-hidden whitespace-nowrap"
            :class="isExpanded ? 'w-32 opacity-100' : 'w-0 opacity-0 pointer-events-none'"
          >
            New Playlist
          </span>
        </button>

        <!-- Recent Activity Section -->
        <template v-if="recentItems.length > 0">
          <hr class="border-black/10 dark:border-white/10 my-4" />

          <p
            class="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2 transition-all duration-500 overflow-hidden whitespace-nowrap"
            :class="isExpanded ? 'w-32 opacity-100 px-3' : 'w-0 opacity-0 px-0 pointer-events-none'"
          >
            Recent Activity
          </p>

          <div class="flex flex-col gap-1">
            <!-- DIUBAH DARI RouterLink KE div UNTUK MENGHILANGKAN ACTIVE STATE -->
            <div
              v-for="item in recentItems"
              :key="item.type + item.id"
              @click="navigateToRecent(item)"
              class="flex items-center p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer transition-all duration-500 group/item"
              :class="isExpanded ? 'gap-4' : 'gap-0'"
            >
              <div class="w-9 h-9 rounded-lg overflow-hidden flex-shrink-0 bg-slate-200 dark:bg-slate-800 flex items-center justify-center border border-black/5 dark:border-white/5 shadow-sm">
                <img v-if="item.coverUrl" :src="item.coverUrl" class="w-full h-full object-cover group-hover/item:scale-110 transition-transform duration-500" />
                <ListMusic v-else-if="item.type === 'playlist'" :size="16" class="text-slate-400" />
                <Music v-else :size="16" class="text-slate-400" />
              </div>

              <div
                class="flex flex-col min-w-0 transition-all duration-500 ease-in-out overflow-hidden whitespace-nowrap"
                :class="isExpanded ? 'w-32 opacity-100' : 'w-0 opacity-0 pointer-events-none'"
              >
                <span class="text-[11px] font-bold truncate text-slate-800 dark:text-slate-200">
                  {{ item.name }}
                </span>
                <span class="text-[8px] uppercase opacity-50 font-black tracking-tighter text-slate-500 dark:text-slate-400">
                  {{ item.type === 'song' ? item.album_name : 'Playlist' }}
                </span>
              </div>
            </div>
          </div>
        </template>
      </nav>

      <!-- Bottom Nav -->
      <div class="py-8 border-t border-black/10 dark:border-white/10 shrink-0">
        <RouterLink to="/settings" class="sidebar-link" :class="isExpanded ? 'gap-4' : 'gap-0'" active-class="sidebar-link-active">
          <Settings :size="20" class="shrink-0" />
          <span 
            class="text-xs font-bold uppercase tracking-widest transition-all duration-500 overflow-hidden whitespace-nowrap"
            :class="isExpanded ? 'w-32 opacity-100' : 'w-0 opacity-0 pointer-events-none'"
          >
            Settings
          </span>
        </RouterLink>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.sidebar-link {
  display: flex;
  align-items: center;
  padding: 0.75rem;
  border-radius: 0.75rem;
  transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
  color: #64748b;
}

.sidebar-link:hover {
  background: rgba(0, 0, 0, 0.05);
  color: #1e293b;
}

.dark .sidebar-link:hover {
  background: rgba(255, 255, 255, 0.05);
  color: white;
}

.sidebar-link-active {
  background: #0f172a !important;
  color: white !important;
  box-shadow: 0 10px 15px -3px rgba(0,0,0,0.2);
}

.dark .sidebar-link-active {
  background: #334155 !important;
}

.animate-spin-slow {
  animation: spin 8s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.no-scrollbar::-webkit-scrollbar {
  display: none;
}
</style>