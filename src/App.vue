<script setup>
import { ref, onMounted } from 'vue'
import { RouterView } from 'vue-router'
import { getCurrentWindow } from '@tauri-apps/api/window'
import AppShell from './components/layout/AppShell.vue'
import Sidebar from './components/layout/Sidebar.vue'
import TitleBar from './components/layout/TitleBar.vue'

const isMaximized = ref(false)
const isResizing = ref(false)
const appWindow = getCurrentWindow()

onMounted(async () => {
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
      class="flex-1 h-full bg-alice shadow-xl relative overflow-hidden rounded-main border border-white/40"
      :class="[
        { 'border-none shadow-none': isMaximized },
        isResizing ? 'transition-none' : 'transition-all duration-300'
      ]"
    >
      <TitleBar />
      <div class="h-full w-full p-8 pt-12 overflow-y-auto">
        <RouterView />
      </div>
    </main>
  </AppShell>
</template>