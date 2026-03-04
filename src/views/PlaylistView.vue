<script setup lang="ts">
import { ref, onMounted, computed, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getDB } from '../services/db'
import { useSettingsStore } from '../stores/settings'
import { usePlayerStore } from '../stores/player' 
import { useContextMenuStore } from '../stores/contextMenu'
import { useToastStore } from '../stores/toast'
import { open } from '@tauri-apps/plugin-dialog'
import { readFile, writeFile, mkdir, BaseDirectory } from '@tauri-apps/plugin-fs'
import { listen } from '@tauri-apps/api/event'
import { 
  ArrowLeft, Play, Clock, Music, Edit2, Trash2, Camera, AlertTriangle, X 
} from 'lucide-vue-next'

const route = useRoute()
const router = useRouter()
const settings = useSettingsStore()
const player = usePlayerStore() 
const contextMenu = useContextMenuStore()
const toast = useToastStore()

const playlistId = route.params.id
const playlist = ref({ name: '', cover_path: '' })
const songs = ref<any[]>([])
const isEditingName = ref(false)
const newName = ref('')
const coverUrl = ref<string | null>(null)
const showDeleteModal = ref(false)

const isDarkMode = computed(() => settings.isDarkMode)
const textColor = computed(() => isDarkMode.value ? '#ffffff' : '#0f172a')
const secondaryTextColor = computed(() => isDarkMode.value ? 'rgba(255, 255, 255, 0.6)' : '#64748b')
const tertiaryTextColor = computed(() => isDarkMode.value ? 'rgba(160, 174, 192, 1)' : '#a0aeb8')

const fetchPlaylistData = async () => {
  try {
    const db = await getDB()
    const data = await db.select<any[]>("SELECT * FROM playlists WHERE id = $1", [playlistId])
    if (data.length > 0) {
      playlist.value = data[0]
      newName.value = data[0].name
      
      if (playlist.value.cover_path) {
        try {
          const filename = playlist.value.cover_path.split(/[\\/]/).pop()
          const contents = await readFile(`playlist_covers/${filename}`, { baseDir: BaseDirectory.AppLocalData })
          const blob = new Blob([contents], { type: 'image/jpeg' })
          coverUrl.value = URL.createObjectURL(blob)
        } catch (e) {
          console.error("Failed to load local cover file:", e)
        }
      }

      const playlistSongs = await db.select<any[]>(`
        SELECT s.* FROM songs s
        JOIN playlist_songs ps ON s.id = ps.song_id
        WHERE ps.playlist_id = $1
      `, [playlistId])
      songs.value = playlistSongs
    }
  } catch (err) {
    console.error("Failed to load playlist:", err)
  }
}

const uploadCover = async () => {
  try {
    const selected = await open({
      multiple: false,
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg'] }]
    })

    if (selected && typeof selected === 'string') {
      const imageContent = await readFile(selected)
      await mkdir('playlist_covers', { baseDir: BaseDirectory.AppLocalData, recursive: true })
      
      const extension = selected.split('.').pop()
      const newFilename = `playlist_${playlistId}_${Date.now()}.${extension}`
      const targetPath = `playlist_covers/${newFilename}`
      
      await writeFile(targetPath, imageContent, { baseDir: BaseDirectory.AppLocalData })

      const db = await getDB()
      await db.execute("UPDATE playlists SET cover_path = $1 WHERE id = $2", [targetPath, playlistId])
      
      fetchPlaylistData()
      toast.show('success', 'Playlist cover updated')
    }
  } catch (err) {
    console.error("Upload failed:", err)
  }
}

const updateName = async () => {
  if (!newName.value.trim()) return
  const db = await getDB()
  await db.execute("UPDATE playlists SET name = $1 WHERE id = $2", [newName.value, playlistId])
  playlist.value.name = newName.value
  isEditingName.value = false
  toast.show('success', 'Playlist renamed')
}

const confirmDeletePlaylist = async () => {
  try {
    const db = await getDB()
    await db.execute("DELETE FROM playlists WHERE id = $1", [playlistId])
    showDeleteModal.value = false
    toast.show('success', `Playlist "${playlist.value.name}" deleted`)
    router.push('/collections')
  } catch (err) {
    console.error("Failed to delete playlist:", err)
    toast.show('error', 'Failed to delete playlist')
  }
}

const formatTime = (seconds: number) => {
  if (!seconds) return "0:00"
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

let unlistenLibrary: any;

onMounted(async () => {
  await fetchPlaylistData()
  unlistenLibrary = await listen('library-updated', () => {
    fetchPlaylistData()
  })
})

onUnmounted(() => {
  if (unlistenLibrary) unlistenLibrary()
})
</script>

<template>
  <div class="relative h-full overflow-y-auto pb-20 no-scrollbar">
    
    <div class="flex items-center justify-between mb-8 pr-4">
      <button @click="router.back()" class="flex items-center gap-2 transition-colors group cursor-pointer" :style="{ color: secondaryTextColor }">
        <ArrowLeft :size="20" class="group-hover:-translate-x-1 transition-transform" />
        <span class="text-xs font-bold uppercase tracking-widest">Back</span>
      </button>

      <button @click="showDeleteModal = true" class="flex items-center gap-2 opacity-40 hover:opacity-100 hover:text-red-500 transition-all cursor-pointer group">
        <Trash2 :size="18" />
        <span class="text-[10px] font-bold uppercase tracking-widest">Delete Playlist</span>
      </button>
    </div>

    <div class="flex flex-col md:flex-row gap-8 mb-12 items-end px-2">
      <div 
        @click="uploadCover"
        class="group relative w-48 h-48 rounded-2xl overflow-hidden shadow-2xl flex-shrink-0 border flex items-center justify-center transition-all cursor-pointer" 
        :class="isDarkMode ? 'bg-slate-800/50 border-white/10' : 'bg-slate-200/50 border-black/5'"
      >
        <img v-if="coverUrl" :src="coverUrl" class="w-full h-full object-cover transition-transform group-hover:scale-110" />
        <Music v-else :size="48" :class="isDarkMode ? 'text-white/20' : 'text-black/20'" />
        
        <div class="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center transition-opacity text-white">
          <Camera :size="32" />
          <span class="text-[10px] font-bold uppercase mt-2 tracking-widest">Change Cover</span>
        </div>
      </div>

      <div class="flex-grow space-y-2">
        <p class="font-bold tracking-[0.3em] uppercase text-[10px]" :style="{ color: secondaryTextColor }">Playlist</p>
        
        <div v-if="!isEditingName" @click="isEditingName = true" class="group cursor-pointer flex items-center gap-4">
          <h1 class="text-5xl md:text-6xl font-black tracking-tighter italic uppercase leading-tight transition-colors" :style="{ color: textColor }">
            {{ playlist.name }}
          </h1>
          <Edit2 :size="20" class="opacity-0 group-hover:opacity-50 transition-opacity" :style="{ color: textColor }" />
        </div>
        <input 
          v-else 
          v-model="newName" 
          @blur="updateName" 
          @keyup.enter="updateName"
          class="bg-transparent border-b-2 border-current text-5xl md:text-6xl font-black tracking-tighter italic uppercase outline-none w-full"
          :style="{ color: textColor }"
          autoFocus
        />

        <p class="font-bold tracking-[0.2em] uppercase text-xs" :style="{ color: secondaryTextColor }">
          {{ songs.length }} TRACKS
        </p>
      </div>
    </div>

    <div class="space-y-2">
      <div class="flex items-center px-4 pb-2 border-b text-[10px] font-bold tracking-widest uppercase"
           :class="isDarkMode ? 'border-white/10' : 'border-black/5'"
           :style="{ color: tertiaryTextColor }">
        <div class="w-12 text-center">#</div>
        <div class="flex-grow">Title</div>
        <div class="w-20 text-right"><Clock :size="14" class="inline" /></div>
      </div>

      <div v-for="(song, index) in songs" :key="song.id" 
           @click="player.playTrack(song, songs)"
           @contextmenu.prevent="contextMenu.openMenu($event, song)"
           class="flex items-center px-4 py-3 rounded-xl transition-colors group cursor-pointer"
           :class="[
             isDarkMode ? 'hover:bg-white/5' : 'hover:bg-slate-200/50',
             player.currentSong?.id === song.id ? (isDarkMode ? 'bg-white/10' : 'bg-slate-200/80') : ''
           ]">
        <div class="w-12 text-center text-xs font-bold relative transition-colors" :style="{ color: tertiaryTextColor }">
          <span :class="{'opacity-0': player.currentSong?.id === song.id}" class="group-hover:opacity-0 transition-opacity">
            {{ index + 1 }}
          </span>
          <Play v-if="player.currentSong?.id !== song.id" :size="14" class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity fill-current" 
                :style="{ color: textColor }" />
        </div>

        <div class="flex-grow text-sm font-bold transition-colors" :style="{ color: player.currentSong?.id === song.id ? '#3b82f6' : textColor }">
          {{ song.title }}
          <span class="block text-[10px] opacity-50 uppercase tracking-widest mt-0.5">{{ song.artist }}</span>
        </div>

        <div class="w-20 text-right text-xs font-mono transition-colors" :style="{ color: secondaryTextColor }">
          {{ formatTime(song.duration) }}
        </div>
      </div>
    </div>

    <Teleport to="body">
      <Transition name="fade">
        <div v-if="showDeleteModal" class="fixed inset-0 z-[2000] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm">
          <div 
            class="w-full max-w-sm rounded-3xl p-8 border shadow-2xl animate-in zoom-in duration-300 transition-colors"
            :class="isDarkMode ? 'bg-slate-900 border-white/10' : 'bg-white border-black/5'"
          >
            <div class="flex flex-col items-center text-center">
              <div class="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 mb-6">
                <AlertTriangle :size="32" />
              </div>
              
              <h3 class="text-xl font-black italic uppercase tracking-tighter mb-2" :style="{ color: textColor }">
                Delete Playlist?
              </h3>
              <p class="text-sm font-bold mb-8 leading-relaxed" :style="{ color: secondaryTextColor }">
                Are you sure you want to delete <span :style="{ color: textColor }">"{{ playlist.name }}"</span>? This action cannot be undone.
              </p>

              <div class="flex flex-col w-full gap-3">
                <button 
                  @click="confirmDeletePlaylist"
                  class="w-full py-4 rounded-2xl bg-red-500 hover:bg-red-600 text-white text-xs font-black uppercase tracking-widest transition-all active:scale-95"
                >
                  Delete Playlist
                </button>
                <button 
                  @click="showDeleteModal = false"
                  class="w-full py-4 rounded-2xl text-xs font-black uppercase tracking-widest transition-all hover:bg-black/5 dark:hover:bg-white/5 active:scale-95"
                  :style="{ color: secondaryTextColor }"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

  </div>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}
</style>