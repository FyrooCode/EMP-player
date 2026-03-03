<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { Music, ListMusic, Loader2 } from 'lucide-vue-next'
import { useSettingsStore } from '../stores/settings'

const router = useRouter()
const settings = useSettingsStore()
const isLoading = ref(true)

const isDarkMode = computed(() => settings.isDarkMode)

// Data Collections
const collections = ref([
  {
    id: 'all-songs',
    title: 'All Songs',
    description: 'Every track in your library',
    icon: Music,
    color: 'bg-blue-500'
  }
])

onMounted(() => {
  // Simulasi loading sebentar agar transisi terasa smooth
  setTimeout(() => {
    isLoading.value = false
  }, 300)
})

const goToCollection = (id: string) => {
  if (id === 'all-songs') {
    // Navigasi ke halaman All Songs yang baru kita buat
    router.push('/collection/all-songs')
  }
}
</script>

<template>
  <div class="relative h-full overflow-y-auto pb-20 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
    <header class="mb-8">
      <h1 class="text-5xl font-black tracking-tighter italic uppercase text-slate-900 dark:text-white">Collections</h1>
    </header>

    <div v-if="isLoading" class="flex flex-col items-center justify-center h-64 gap-4">
      <Loader2 class="w-8 h-8 animate-spin text-slate-400 dark:text-slate-500" />
      <span class="text-xs font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">Preparing Collections</span>
    </div>

    <div v-else class="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-8 animate-fade-in">
      <div v-for="item in collections" :key="item.id" 
           @click="goToCollection(item.id)"
           class="group cursor-pointer flex flex-col">
        
        <div class="relative aspect-square bg-slate-200/50 dark:bg-slate-800/50 rounded-2xl border border-black/5 dark:border-white/10 overflow-hidden flex flex-col items-center justify-center mb-3 shadow-sm hover:shadow-xl transition-all duration-300">
          
          <div class="absolute inset-0 opacity-10 group-hover:opacity-20 transition-opacity duration-500" :class="item.color"></div>
          
          <div class="z-10 flex flex-col items-center gap-3 transition-transform duration-500 group-hover:scale-110">
            <div class="w-16 h-16 rounded-2xl bg-white dark:bg-white/10 flex items-center justify-center shadow-lg">
                <component :is="item.icon" :size="32" class="text-slate-900 dark:text-white" />
            </div>
          </div>

          <div class="absolute top-4 right-4 bg-black/10 dark:bg-white/10 px-2 py-1 rounded-md">
            <ListMusic :size="12" class="text-slate-900 dark:text-white opacity-50" />
          </div>
        </div>

        <div class="space-y-0.5 px-1">
          <p class="font-bold text-sm truncate uppercase tracking-tight"
             :style="{ color: 'var(--text-primary)' }">
            {{ item.title }}
          </p>
          <p class="text-[10px] font-bold tracking-widest uppercase truncate"
             :style="{ color: 'var(--text-primary)', opacity: 0.4 }">
            {{ item.description }}
          </p>
        </div>

      </div>
    </div>
  </div>
</template>

<style scoped>
.animate-fade-in {
  animation: fadeIn 0.4s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>