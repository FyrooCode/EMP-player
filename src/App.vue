<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { RouterView } from 'vue-router'
import { getCurrentWindow } from '@tauri-apps/api/window'
import AppShell from './components/layout/AppShell.vue'
import Sidebar from './components/layout/Sidebar.vue'
import TitleBar from './components/layout/TitleBar.vue'
import PlayerBar from './components/PlayerBar.vue'
import Toast from './components/Toast.vue'
import { useSettingsStore } from './stores/settings'


// 1. Import Player Store di sini
import { usePlayerStore } from './stores/player'

const isMaximized = ref(false)
const isResizing = ref(false)
const appWindow = getCurrentWindow()
const settings = useSettingsStore()

// 2. Inisialisasi Player Store
const player = usePlayerStore()

onMounted(async () => {
  await settings.loadSettingsFromDB()
  
  isMaximized.value = await appWindow.isMaximized()

  await appWindow.onResized(async () => {
    isMaximized.value = await appWindow.isMaximized()
    
    isResizing.value = true
    setTimeout(() => {
      isResizing.value = false
    }, 100)
  })
})
</script>

<template>
  <AppShell 
    :class="[
      { 'p-gap !rounded-none !shadow-none': isMaximized },
      isResizing ? 'transition-none' : 'transition-all duration-300'
    ]"
  >
    <Sidebar :class="{ 'rounded-main': isMaximized }" />
    
    <main 
      class="flex-1 h-full flex flex-col bg-alice shadow-xl relative overflow-hidden rounded-main border border-white/40"
      :class="[
        { 'border-none shadow-none': isMaximized },
        isResizing ? 'transition-none' : 'transition-all duration-300'
      ]"
    >
      <TitleBar />
      
      <div class="flex-1 w-full p-8 pt-12 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
        <RouterView />
      </div>

      <Transition name="slide-up">
        <PlayerBar v-if="player.currentSong" />
      </Transition>
      
    </main>
    <Toast />
  </AppShell>
</template>

<style scoped>
/* 4. CSS untuk efek animasi meluncur dari bawah */
.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
}

.slide-up-enter-from,
.slide-up-leave-to {
  opacity: 0;
  transform: translateY(100%);
}
</style>