<script setup>
import { ref, onMounted, computed } from 'vue'
import { X, Minus, Square, Copy } from 'lucide-vue-next'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { useSettingsStore } from '../../stores/settings'

const appWindow = getCurrentWindow()
const settings = useSettingsStore()
const isMaximized = ref(false)

// Computed properties for theming
const isDarkMode = computed(() => settings.isDarkMode)
const buttonBgColor = computed(() => isDarkMode.value ? '#0f172a' : '#1e293b')
const buttonTextColor = computed(() => '#ffffff')
const buttonHoverBgColor = computed(() => isDarkMode.value ? '#1e293b' : '#334155')

onMounted(async () => {
  isMaximized.value = await appWindow.isMaximized()
  await appWindow.onResized(async () => {
    isMaximized.value = await appWindow.isMaximized()
  })
})

const handleDrag = async (e) => {
  if (e.buttons === 1 && e.target === e.currentTarget && !isMaximized.value) {
    await appWindow.startDragging()
  }
}

const minimize = (e) => {
  e.stopPropagation() 
  appWindow.minimize()
}

const toggleMaximize = (e) => {
  e.stopPropagation()
  appWindow.toggleMaximize()
}

const close = (e) => {
  e.stopPropagation()
  appWindow.close()
}
</script>

<template>
  <div 
    @mousedown="handleDrag" 
    class="w-full h-12 flex justify-end items-center px-4 absolute top-0 right-0 z-50 select-none transition-all"
    :class="isMaximized ? 'cursor-default' : 'cursor-move'"
  >
    <div class="flex items-center gap-2 no-drag">
      <button 
        @click="minimize"
        class="w-8 h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer"
        :style="{ 
          backgroundColor: buttonBgColor,
          color: buttonTextColor
        }"
        @mouseenter="$event.currentTarget.style.backgroundColor = buttonHoverBgColor"
        @mouseleave="$event.currentTarget.style.backgroundColor = buttonBgColor"
      >
        <Minus :size="14" />
      </button>

      <button 
        @click="toggleMaximize"
        class="w-8 h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer"
        :style="{ 
          backgroundColor: buttonBgColor,
          color: buttonTextColor
        }"
        @mouseenter="$event.currentTarget.style.backgroundColor = buttonHoverBgColor"
        @mouseleave="$event.currentTarget.style.backgroundColor = buttonBgColor"
      >
        <component :is="isMaximized ? Copy : Square" :size="isMaximized ? 10 : 12" />
      </button>
      
      <button 
        @click="close"
        class="w-8 h-8 rounded-full flex items-center justify-center transition-all shadow-md cursor-pointer"
        :style="{ 
          backgroundColor: buttonBgColor,
          color: buttonTextColor
        }"
        @mouseenter="$event.currentTarget.style.backgroundColor = '#ef4444'"
        @mouseleave="$event.currentTarget.style.backgroundColor = buttonBgColor"
      >
        <X :size="14" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.no-drag {
  -webkit-app-region: no-drag;
}
</style>