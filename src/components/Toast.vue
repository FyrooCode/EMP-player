<script setup lang="ts">
import { computed } from 'vue'
import { useToastStore } from '../stores/toast'
import { useSettingsStore } from '../stores/settings'
import { CheckCircle2, AlertCircle, Info, Loader2, X } from 'lucide-vue-next'

const toastStore = useToastStore()
const settings = useSettingsStore()

const isDarkMode = computed(() => settings.isDarkMode)
const bgColor = computed(() => isDarkMode.value ? 'rgba(7, 7, 9, 0.95)' : 'rgba(255, 255, 255, 0.9)')
const borderColor = computed(() => isDarkMode.value ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)')
const textPrimary = computed(() => isDarkMode.value ? '#ffffff' : '#0f172a')
const textSecondary = computed(() => isDarkMode.value ? 'rgba(255, 255, 255, 0.4)' : '#64748b')
const bgSecondary = computed(() => isDarkMode.value ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)')
</script>

<template>
  <div class="fixed top-6 left-1/2 -translate-x-1/2 z-[1000] flex flex-col gap-3 pointer-events-none w-96 items-center">
    <TransitionGroup name="toast-slide">
      <div 
        v-for="toast in toastStore.toasts" 
        :key="toast.id"
        class="pointer-events-auto w-full overflow-hidden rounded-xl shadow-2xl border transition-colors duration-500"
        :style="{ backgroundColor: bgColor, borderColor: borderColor }"
      >
        <div class="p-4 flex items-start gap-3">
          <CheckCircle2 v-if="toast.type === 'success'" class="text-green-500 shrink-0 mt-0.5" :size="20" />
          <AlertCircle v-if="toast.type === 'error'" class="text-red-500 shrink-0 mt-0.5" :size="20" />
          <Info v-if="toast.type === 'info'" class="text-blue-500 shrink-0 mt-0.5" :size="20" />
          
          <Loader2 v-if="toast.type === 'loading'" class="animate-spin shrink-0 mt-0.5 transition-colors" :size="20" :style="{ color: textSecondary }" />
          
          <div class="flex-grow">
            <p class="text-sm font-bold transition-colors" :style="{ color: textPrimary }">
              {{ toast.message }}
            </p>
            
            <div v-if="toast.type === 'loading'" class="mt-3 h-1 w-full rounded-full overflow-hidden relative transition-colors" :style="{ backgroundColor: bgSecondary }">
               <div class="absolute top-0 bottom-0 left-0 w-1/3 rounded-full animate-progress-indeterminate transition-colors" :style="{ backgroundColor: textPrimary }"></div>
            </div>
          </div>

          <button @click="toastStore.remove(toast.id)" class="transition-colors cursor-pointer shrink-0 hover:opacity-70 mt-0.5" :style="{ color: textSecondary }">
            <X :size="16" />
          </button>
        </div>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toast-slide-enter-active,
.toast-slide-leave-active {
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}
.toast-slide-enter-from {
  opacity: 0;
  transform: translateY(-40px) scale(0.9);
}
.toast-slide-leave-to {
  opacity: 0;
  transform: translateY(-20px) scale(0.9);
}

@keyframes progress-indeterminate {
  0% { left: -30%; width: 30%; }
  50% { left: 50%; width: 50%; }
  100% { left: 100%; width: 30%; }
}
.animate-progress-indeterminate {
  animation: progress-indeterminate 1.5s infinite ease-in-out;
}
</style>