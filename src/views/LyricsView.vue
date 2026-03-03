<script setup lang="ts">
import { computed, ref, watch, nextTick, onMounted } from 'vue'
import { usePlayerStore } from '../stores/player'

const player = usePlayerStore()
const lyricContainer = ref<HTMLElement | null>(null)

// Mencari baris lirik mana yang aktif berdasarkan currentTime
const activeIndex = computed(() => {
  if (!player.parsedLyrics.length) return -1
  return player.parsedLyrics.findLastIndex(l => player.currentTime >= l.time)
})

// Logika reset scroll ke atas jika lagu diulang (currentTime mendekati 0)
watch(() => player.currentTime, (newTime) => {
  if (newTime < 1 && lyricContainer.value) {
    lyricContainer.value.scrollTo({ top: 0, behavior: 'smooth' })
  }
})

// Auto-scroll ke lirik yang aktif agar selalu di tengah layar
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
    } else if (lyricContainer.value) {
      lyricContainer.value.scrollTop = 0
    }
  }, 100)
})
</script>

<template>
  <div class="relative w-full h-full overflow-hidden bg-[#070709] transition-colors duration-1000">
    <div class="absolute inset-0 opacity-20 pointer-events-none select-none">
      <img v-if="player.coverUrl" :src="player.coverUrl" class="w-full h-full object-cover blur-[120px] scale-150" />
    </div>

    <div ref="lyricContainer" class="relative z-10 w-full h-full overflow-y-auto pl-24 pr-12 pt-[45vh] pb-[30vh] no-scrollbar scroll-smooth">
      <div v-if="player.parsedLyrics.length === 0" class="h-full flex flex-col items-center justify-center opacity-30 pr-12">
        <h2 class="text-3xl font-black uppercase tracking-tighter italic">No Lyrics Found</h2>
      </div>

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
</style>