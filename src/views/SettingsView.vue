<script setup>
import { ref, onMounted } from 'vue'
import { Sun, Moon, FolderOpen } from 'lucide-vue-next'

const isDark = ref(false)

const toggleDarkMode = () => {
  isDark.value = !isDark.value
  
  const html = document.documentElement
  html.style.transition = 'none'
  
  if (isDark.value) {
    html.classList.add('dark')
  } else {
    html.classList.remove('dark')
  }
  
  void html.offsetHeight
  html.style.transition = ''
}

onMounted(() => {
  isDark.value = document.documentElement.classList.contains('dark')
})
</script>

<template>
  <div class="max-w-4xl mx-auto space-y-12 animate-fade-in py-4">
    <header>
      <h1 class="text-5xl font-black italic tracking-tighter uppercase text-slate-900 dark:text-white transition-colors duration-500">
        Settings
      </h1>
      <p class="text-xs font-bold uppercase tracking-[0.3em] text-slate-500 dark:text-white/60">
        System Configuration
      </p>
    </header>

    <div class="space-y-10">
      <section class="flex items-center justify-between border-b border-black/10 dark:border-white/10 pb-6">
        <div>
          <h3 class="font-bold uppercase tracking-widest text-sm text-slate-800 dark:text-white">Appearance</h3>
          <p class="text-xs opacity-60 text-slate-600 dark:text-white/40">Switch between dark and light themes</p>
        </div>
        
        <button 
          @click="toggleDarkMode"
          class="flex items-center gap-3 px-5 py-2 rounded-full shadow-lg transition-all duration-500 hover:scale-105 cursor-pointer bg-slate-900 text-white"
        >
          <component :is="isDark ? Sun : Moon" :size="16" />
          <span class="text-[10px] font-black uppercase tracking-widest">
            {{ isDark ? 'Light Mode' : 'Dark Mode' }}
          </span>
        </button>
      </section>

      <section class="flex items-center justify-between border-b border-black/10 dark:border-white/10 pb-6">
        <div>
          <h3 class="font-bold uppercase tracking-widest text-sm text-slate-800 dark:text-white">Library Directory</h3>
          <p class="text-xs font-mono text-slate-500 dark:text-white/40">C:/Users/Bell/Music</p>
        </div>
        <button class="flex items-center gap-3 px-5 py-2 rounded-full border transition-all cursor-pointer border-slate-300 text-slate-800 hover:bg-slate-100 dark:border-white/20 dark:text-white dark:hover:bg-white/5">
          <FolderOpen :size="16" />
          <span class="text-[10px] font-black uppercase tracking-widest">Change Path</span>
        </button>
      </section>
    </div>
  </div>
</template>

<style scoped>
.animate-fade-in {
  animation: fadeIn 0.8s cubic-bezier(0.4, 0, 0.2, 1) forwards;
}
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>