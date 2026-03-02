<script setup lang="ts">
import { ref } from 'vue' 
import { Sun, Moon, FolderOpen, Loader2 } from 'lucide-vue-next'
import { open } from '@tauri-apps/plugin-dialog'
import { invoke } from '@tauri-apps/api/core' 
import { useSettingsStore } from '../stores/settings'

const settings = useSettingsStore()
const isScanning = ref(false)

const handleSelectFolder = async () => {
  const selected = await open({
    directory: true,
    multiple: false,
    title: 'Select Music Folder'
  })

  if (selected && typeof selected === 'string') {
    isScanning.value = true
    try {
      // 1. Simpan path folder ke DB
      await settings.updateMusicPath(selected)
      
      // 2. Panggil Scanner Rust
      const files = await invoke<string[]>('scan_music_folder', { folderPath: selected })
      
      // 3. Simpan daftar file ke tabel 'songs'
      await settings.saveScannedSongs(files)
      
      console.log(`Berhasil memindai ${files.length} lagu.`)
    } catch (err) {
      console.error("Gagal memindai folder:", err)
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
    </div>
  </div>
</template>