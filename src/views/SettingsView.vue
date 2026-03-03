<script setup lang="ts">
import { ref, computed } from 'vue' 
import { Sun, Moon, FolderOpen, Loader2 } from 'lucide-vue-next'
import { open } from '@tauri-apps/plugin-dialog'
import { invoke } from '@tauri-apps/api/core' 
import { useSettingsStore } from '../stores/settings'
import { useToastStore } from '../stores/toast'

const settings = useSettingsStore()
const toast = useToastStore() 
const isScanning = ref(false)

// COMPUTED UNTUK WARNA SLIDER (Sama persis dengan PlayerBar)
const isDarkMode = computed(() => settings.isDarkMode)
const textPrimary = computed(() => isDarkMode.value ? '#ffffff' : '#0f172a')
const bgSecondary = computed(() => isDarkMode.value ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)')

const handleSelectFolder = async () => {
  const selected = await open({
    directory: true,
    multiple: false,
    title: 'Select Music Folder'
  })

  if (selected && typeof selected === 'string') {
    isScanning.value = true
    
    const toastId = toast.show('loading', `Scanning folder: ${selected}`, false)
    
    try {
      await settings.updateMusicPath(selected)
      
      const songsData = await invoke<any[]>('scan_music_folder', { folderPath: selected })
      
      await settings.saveScannedSongs(songsData)
      
      toast.updateStatus(toastId, 'success', `Successfully scanned ${songsData.length} tracks!`)
      console.log(`Berhasil memindai dan menyimpan ${songsData.length} lagu beserta metadatanya.`)
      
    } catch (err) {
      console.error("Gagal memindai folder:", err)
      toast.updateStatus(toastId, 'error', 'Failed to scan the music folder.')
    } finally {
      isScanning.value = false
    }
  }
}
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
          @click="settings.toggleTheme"
          class="flex items-center gap-3 px-5 py-2 rounded-full shadow-lg transition-all duration-500 hover:scale-105 cursor-pointer bg-slate-900 text-white dark:bg-white dark:text-slate-900"
        >
          <component :is="settings.isDarkMode ? Sun : Moon" :size="16" />
          <span class="text-[10px] font-black uppercase tracking-widest">
            {{ settings.isDarkMode ? 'Light Mode' : 'Dark Mode' }}
          </span>
        </button>
      </section>

      <section class="flex items-center justify-between border-b border-black/10 dark:border-white/10 pb-6">
        <div>
          <h3 class="font-bold uppercase tracking-widest text-sm text-slate-800 dark:text-white">Library Directory</h3>
          <p class="text-xs font-mono text-slate-500 dark:text-white/40 italic">
            {{ settings.musicPath || 'No folder selected' }}
          </p>
        </div>

        <button 
          @click="handleSelectFolder"
          :disabled="isScanning"
          class="flex items-center gap-3 px-5 py-2 rounded-full shadow-lg transition-all duration-500 hover:scale-105 cursor-pointer bg-slate-900 text-white dark:bg-white dark:text-slate-900 disabled:opacity-50"
        >
          <component :is="isScanning ? Loader2 : FolderOpen" :size="16" :class="{'animate-spin': isScanning}" />
          <span class="text-[10px] font-black uppercase tracking-widest">
            {{ isScanning ? 'Scanning...' : 'Change Path' }}
          </span>
        </button>
      </section>

      <section class="flex items-center justify-between border-b border-black/10 dark:border-white/10 pb-6">
        <div>
          <h3 class="font-bold uppercase tracking-widest text-sm text-slate-800 dark:text-white">Audio Crossfade</h3>
          <p class="text-xs opacity-60 text-slate-600 dark:text-white/40">Overlap transition between songs</p>
        </div>
        
        <div class="flex items-center gap-4 w-64 justify-end">
          
          <div class="relative w-32 h-6 flex items-center group">
            
            <div class="absolute w-full h-1.5 rounded-full transition-colors duration-500" 
                 :style="{ backgroundColor: bgSecondary }">
            </div>
            
            <div class="absolute h-1.5 rounded-full transition-colors duration-500 pointer-events-none"
                 :style="{ backgroundColor: textPrimary, width: `${(settings.crossfade / 12) * 100}%` }">
            </div>

            <div class="absolute w-3 h-3 rounded-full shadow-md pointer-events-none scale-95 opacity-0 group-hover:scale-100 group-hover:opacity-100"
                 :style="{ backgroundColor: textPrimary, left: `calc(${(settings.crossfade / 12) * 100}% - 6px)` }">
            </div>

            <input 
              type="range" 
              min="0" 
              max="12" 
              step="1" 
              :value="settings.crossfade"
              @input="(e) => settings.updateCrossfade(parseInt((e.target as HTMLInputElement).value))"
              class="absolute w-full h-full opacity-0 cursor-pointer z-10"
            />
          </div>

          <span class="text-sm font-black transition-colors duration-500 w-8 text-right" :style="{ color: textPrimary }">
            {{ settings.crossfade === 0 ? 'Off' : `${settings.crossfade}s` }}
          </span>
        </div>
      </section>
      
    </div>
  </div>
</template>