<script setup lang="ts">
import { computed, ref, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { usePlayerStore } from '../stores/player'
import { useSettingsStore } from '../stores/settings'
import { open } from '@tauri-apps/plugin-dialog'
import { invoke } from '@tauri-apps/api/core'
import { Plus } from 'lucide-vue-next'

const player = usePlayerStore()
const settings = useSettingsStore()
const lyricContainer = ref<HTMLElement | null>(null)

// State untuk mengontrol visibilitas tombol import
const isHoveringLyrics = ref(false)

// Fungsi untuk import lirik manual
const importLrcFile = async () => {
  if (!player.currentSong) return

  const selected = await open({
    multiple: false,
    filters: [{ name: 'Lyrics', extensions: ['lrc', 'txt'] }]
  })

  if (selected && typeof selected === 'string') {
    try {
      const content = await invoke<string>('read_lrc_file', { path: selected })
      await settings.updateSongLyrics(player.currentSong.path, content)
      player.currentSong.lyrics = content
      player.parseLyrics(content)
    } catch (err) {
      console.error("Gagal mengimpor lirik:", err)
    }
  }
}

const activeIndex = computed(() => {
  if (!player.parsedLyrics.length) return -1
  return player.parsedLyrics.findLastIndex(l => player.currentTime >= l.time)
})

// Auto-scroll logic
watch(activeIndex, (newIndex) => {
  if (newIndex === -1 && lyricContainer.value) {
     lyricContainer.value.scrollTo({ top: 0, behavior: 'smooth' })
     return
  }
  
  nextTick(() => {
    const activeEl = document.querySelector('.lyric-line-active')
    if (activeEl && lyricContainer.value) {
      activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  })
})

onMounted(() => {
  setTimeout(() => {
    const activeEl = document.querySelector('.lyric-line-active')
    if (activeEl) {
      activeEl.scrollIntoView({ block: 'center' })
    }
  }, 100)
})
</script>

<template>
  <div 
    class="relative w-full h-full overflow-hidden bg-[#070709] transition-colors duration-1000"
    @mouseenter="isHoveringLyrics = true"
    @mouseleave="isHoveringLyrics = false"
  >
    <div class="absolute inset-0 opacity-20 pointer-events-none select-none">
      <img v-if="player.coverUrl" :src="player.coverUrl" class="w-full h-full object-cover blur-[120px] scale-150" />
    </div>

    <div ref="lyricContainer" class="relative z-10 w-full h-full overflow-y-auto pl-24 pr-12 pt-[45vh] pb-[30vh] no-scrollbar scroll-smooth">
      
      <Transition name="fade-btn">
        <div 
          v-if="player.parsedLyrics.length === 0 && isHoveringLyrics" 
          class="h-full flex flex-col items-center justify-center pr-12"
        >
          <button 
            @click="importLrcFile"
            class="mt-32 flex items-center gap-2 px-6 py-2 bg-white/10 hover:bg-white text-white hover:text-black rounded-full font-bold transition-all duration-300 cursor-pointer shadow-2xl backdrop-blur-md border border-white/10"
          >
            <Plus :size="16" />
            <span class="text-[10px] uppercase tracking-widest">Import Lyrics File</span>
          </button>
        </div>
      </Transition>

      <div 
        v-for="(line, index) in player.parsedLyrics" 
        :key="index"
        class="lyric-line py-4 text-4xl font-black transition-all duration-700 cursor-pointer origin-left select-none leading-tight tracking-tighter"
        :class="activeIndex === index ? 'lyric-line-active text-white opacity-100' : 'text-white/10 opacity-100 hover:text-white/40'"
        @click="player.seek(line.time)"
      >
        {{ line.text }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.no-scrollbar::-webkit-scrollbar { display: none; }
.lyric-line { transform-origin: center left; }

.lyric-line-active {
  transform: scale(1.05);
  filter: drop-shadow(0 0 20px rgba(255,255,255,0.3));
}

/* Animasi Fade */
.fade-btn-enter-active,
.fade-btn-leave-active {
  transition: opacity 0.5s ease, transform 0.5s ease;
}

.fade-btn-enter-from,
.fade-btn-leave-to {
  opacity: 0;
  transform: translateY(20px);
}
</style>