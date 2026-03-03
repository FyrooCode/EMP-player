<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import { getCurrentWindow } from '@tauri-apps/api/window'
import AppShell from './components/layout/AppShell.vue'
import Sidebar from './components/layout/Sidebar.vue'
import TitleBar from './components/layout/TitleBar.vue'
import PlayerBar from './components/PlayerBar.vue'
import Toast from './components/Toast.vue'
import { useSettingsStore } from './stores/settings'
import { usePlayerStore } from './stores/player'

const isMaximized = ref(false)
const isResizing = ref(false)
const appWindow = getCurrentWindow()
const settings = useSettingsStore()
const player = usePlayerStore()
const route = useRoute()

const isLyricsPage = computed(() => route.path === '/lyrics')

onMounted(async () => {
  await settings.loadSettingsFromDB()
  isMaximized.value = await appWindow.isMaximized()
  await appWindow.onResized(async () => {
    isMaximized.value = await appWindow.isMaximized()
    isResizing.value = true
    setTimeout(() => { isResizing.value = false }, 100)
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
      <TitleBar class="z-[60]" />
      
      <div class="relative flex-1 w-full">
        <div 
          class="absolute inset-0 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none'] transition-all duration-500"
          :class="[
            isLyricsPage ? 'p-0' : 'p-8 pt-12',
            player.currentSong && !isLyricsPage ? 'pb-32' : '' 
          ]"
        >
          <RouterView v-slot="{ Component }">
            <transition name="fade-view" mode="out-in">
              <component :is="Component" />
            </transition>
          </RouterView>
        </div>

        <Transition name="slide-up">
          <PlayerBar v-if="player.currentSong" class="absolute bottom-0 left-0 right-0 z-50" />
        </Transition>
      </div>
      
    </main>
    <Toast />
  </AppShell>
</template>

<style scoped>
.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
}
.slide-up-enter-from,
.slide-up-leave-to {
  opacity: 0;
  transform: translateY(100%);
}
.fade-view-enter-active,
.fade-view-leave-active {
  transition: opacity 0.3s ease;
}
.fade-view-enter-from,
.fade-view-leave-to {
  opacity: 0;
}
</style>