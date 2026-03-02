<script setup>
import { ref } from 'vue'
import { 
  Library, Settings, Disc3, ChevronRight, LayoutGrid, Search 
} from 'lucide-vue-next'
import { RouterLink, useRoute } from 'vue-router'

const isExpanded = ref(false)
const route = useRoute()
const toggleSidebar = () => isExpanded.value = !isExpanded.value
</script>

<template>
  <aside 
    class="h-full bg-alice rounded-main flex flex-col shadow-2xl border border-white/10 relative transition-[width] duration-500 ease-in-out group shrink-0"
    :class="isExpanded ? 'w-64' : 'w-20'"
  >
    
    <button 
      @click="toggleSidebar"
      class="absolute -right-3 top-20 w-6 h-6 bg-slate-800 dark:bg-slate-600 text-white rounded-full flex items-center justify-center shadow-lg cursor-pointer hover:scale-110 transition-transform z-50"
    >
      <ChevronRight 
        :size="14" 
        :style="{ 
          transition: 'transform 500ms cubic-bezier(0.4, 0, 0.2, 1)',
          transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)'
        }"
      />
    </button>

    <div class="w-full h-full flex flex-col overflow-hidden px-4">
      
      <div 
        class="py-8 flex items-center mb-6 shrink-0 h-28 transition-all duration-500 ease-in-out"
        :class="isExpanded ? 'gap-4' : 'gap-0'"
      >
        <div class="min-w-12 h-12 bg-slate-800 dark:bg-slate-700 rounded-2xl flex items-center justify-center text-white dark:text-white shadow-lg shrink-0">
          <Disc3 :size="28" class="animate-spin-slow" />
        </div>
        
        <div 
          class="transition-all duration-500 ease-in-out whitespace-nowrap overflow-hidden flex flex-col justify-center"
          :class="isExpanded ? 'w-32 opacity-100' : 'w-0 opacity-0 pointer-events-none'"
        >
          <h2 class="font-black text-xl tracking-tighter italic">EMP</h2>
          <p class="text-[8px] font-bold opacity-40 uppercase tracking-[0.2em]">System v1.0</p>
        </div>
      </div>

      <nav class="flex flex-col gap-2 flex-1">
        <div 
          class="flex items-center gap-4 p-3 rounded-xl transition-colors duration-300 hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
        >
          <Search :size="20" class="text-slate-600 dark:text-slate-400 shrink-0" />
          <span 
            class="text-xs font-bold uppercase tracking-widest text-slate-600 transition-all duration-500 overflow-hidden"
            :class="isExpanded ? 'w-auto opacity-100 ml-0' : 'w-0 opacity-0 ml-[-20px] absolute'"
          >Search</span>
        </div>

        <hr class="border-black/10 dark:border-white/10 my-2" />

        <RouterLink 
          to="/" 
          class="flex items-center gap-4 p-3 rounded-xl transition-[background-color,color] duration-300 group/link"
          active-class="bg-slate-800 dark:bg-slate-700 text-white shadow-lg !hover:bg-slate-800 dark:!hover:bg-slate-700"
          :class="route.path !== '/' && 'hover:bg-black/5 dark:hover:bg-white/5'"
        >
          <Library :size="20" class="shrink-0" />
          <span 
            class="text-xs font-bold uppercase tracking-widest transition-all duration-500 overflow-hidden"
            :class="isExpanded ? 'w-auto opacity-100 ml-0' : 'w-0 opacity-0 ml-[-20px] absolute'"
          >Library</span>
        </RouterLink>

        <div 
          class="flex items-center gap-4 p-3 rounded-xl transition-colors duration-300 hover:bg-slate-800 dark:hover:bg-slate-700 hover:text-white cursor-pointer group/link"
        >
          <LayoutGrid :size="20" class="shrink-0" />
          <span 
            class="text-xs font-bold uppercase tracking-widest transition-all duration-500 overflow-hidden"
            :class="isExpanded ? 'w-auto opacity-100 ml-0' : 'w-0 opacity-0 ml-[-20px] absolute'"
          >Collections</span>
        </div>
      </nav>

      <div class="py-8 border-t border-black/10 dark:border-white/10 shrink-0">
        <RouterLink 
          to="/settings" 
          class="flex items-center gap-4 p-3 rounded-xl transition-[background-color,color] duration-300 group/link"
          active-class="bg-slate-800 dark:bg-slate-700 text-white shadow-lg !hover:bg-slate-800 dark:!hover:bg-slate-700"
          :class="route.path !== '/settings' && 'hover:bg-black/5 dark:hover:bg-white/5'"
        >
          <Settings :size="20" class="shrink-0" />
          <span 
            class="text-xs font-bold uppercase tracking-widest transition-all duration-500 overflow-hidden"
            :class="isExpanded ? 'w-auto opacity-100 ml-0' : 'w-0 opacity-0 ml-[-20px] absolute'"
          >Settings</span>
        </RouterLink>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.animate-spin-slow {
  animation: spin 8s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.overflow-hidden {
  white-space: nowrap;
}
</style>