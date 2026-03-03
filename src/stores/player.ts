import { defineStore } from 'pinia'
import { ref, watch } from 'vue' // Tambahkan watch
import { convertFileSrc } from '@tauri-apps/api/core'
import { readFile, BaseDirectory } from '@tauri-apps/plugin-fs'

export const usePlayerStore = defineStore('player', () => {
  // --- STATE ---
  const currentSong = ref<any>(null)
  const isPlaying = ref(false)
  const isShuffle = ref(false)
  const repeatMode = ref(0) // 0: Off, 1: All, 2: One
  
  const currentTime = ref(0)
  const duration = ref(0)
  
  // Baca dari localStorage dulu. Kalau kosong, pakai default 0.3 (30%)
  const savedVolume = localStorage.getItem('emp-volume')
  const volume = ref(savedVolume ? parseFloat(savedVolume) : 0.3) 
  
  const coverUrl = ref<string | null>(null)

  // Antrean lagu
  const queue = ref<any[]>([])
  const currentIndex = ref(-1)

  // Mesin Audio HTML5
  const audio = new Audio()
  audio.volume = volume.value

  // --- AUDIO EVENT LISTENERS ---
  audio.addEventListener('timeupdate', () => {
    currentTime.value = audio.currentTime
  })

  audio.addEventListener('loadedmetadata', () => {
    duration.value = audio.duration
  })

  audio.addEventListener('ended', () => {
    if (repeatMode.value === 2) {
      // Repeat One
      audio.currentTime = 0
      audio.play()
    } else {
      nextTrack()
    }
  })

  // --- ACTIONS ---
  
  // Fungsi internal untuk mengambil gambar cover lagu
  const loadCover = async (path: string | null) => {
    if (!path) {
      coverUrl.value = null
      return
    }
    try {
      const filename = path.split(/[\\/]/).pop();
      const relativePath = `covers/${filename}`;
      const contents = await readFile(relativePath, { baseDir: BaseDirectory.AppLocalData });
      const blob = new Blob([contents], { type: 'image/jpeg' });
      // Bersihkan URL lama untuk mencegah memory leak
      if (coverUrl.value) URL.revokeObjectURL(coverUrl.value);
      coverUrl.value = URL.createObjectURL(blob);
    } catch (err) {
      console.error("Gagal load cover untuk player:", err);
      coverUrl.value = null
    }
  }

  // ==========================================
  // FUNGSI BARU: UPDATE MEDIA SESSION (WINDOWS OS)
  // ==========================================
  const updateMediaSession = () => {
    if ('mediaSession' in navigator && currentSong.value) {
      // Kirim metadata ke Windows (Judul, Artis, Cover)
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentSong.value.title || 'Unknown Title',
        artist: currentSong.value.artist || 'Unknown Artist',
        album: currentSong.value.album || 'Unknown Album',
        artwork: coverUrl.value ? [
          { src: coverUrl.value, sizes: '512x512', type: 'image/jpeg' }
        ] : []
      })
    }
  }

  // --- BAGIAN YANG DIUBAH: playTrack ---
  const playTrack = async (song: any, contextQueue: any[]) => {
    queue.value = contextQueue
    currentIndex.value = queue.value.findIndex(s => s.id === song.id)
    
    currentSong.value = song
    
    // Load cover duluan supaya UI Player langsung update
    await loadCover(song.cover_path)
    
    // Update Media Session OS setelah cover selesai dimuat
    updateMediaSession()
    
    // Convert local Windows path ke asset protocol Tauri v2
    const playableUrl = convertFileSrc(song.path)
    audio.src = playableUrl
    
    // Gunakan try-catch agar tidak merusak aplikasi jika lagu gagal di-load
    try {
      await audio.play()
      isPlaying.value = true
    } catch (err) {
      console.error("Gagal memutar audio:", err)
      isPlaying.value = false
    }
  }

  const togglePlay = () => {
    if (!currentSong.value) return
    
    if (isPlaying.value) {
      audio.pause()
    } else {
      audio.play()
    }
    isPlaying.value = !isPlaying.value
  }

  const nextTrack = () => {
    if (queue.value.length === 0) return

    let nextIdx = currentIndex.value + 1
    
    if (isShuffle.value) {
       // Random index sederhana
       nextIdx = Math.floor(Math.random() * queue.value.length)
    } else if (nextIdx >= queue.value.length) {
       // Kembali ke awal kalau Repeat All (1), atau stop kalau off (0)
       if (repeatMode.value === 1) {
           nextIdx = 0
       } else {
           isPlaying.value = false
           audio.pause()
           audio.currentTime = 0
           return
       }
    }
    
    playTrack(queue.value[nextIdx], queue.value)
  }

  const prevTrack = () => {
    if (queue.value.length === 0) return
    // Jika lagu sudah jalan > 3 detik, ulang lagu dari awal saja
    if (audio.currentTime > 3) {
      audio.currentTime = 0
      return
    }
    
    let prevIdx = currentIndex.value - 1
    if (prevIdx < 0) {
      prevIdx = repeatMode.value === 1 ? queue.value.length - 1 : 0
    }
    
    playTrack(queue.value[prevIdx], queue.value)
  }

  const seek = (time: number) => {
    audio.currentTime = time
  }

  const setVolume = (val: number) => {
    volume.value = val
    audio.volume = val
    // Simpan ke localStorage setiap kali digeser
    localStorage.setItem('emp-volume', val.toString())
  }

  // ==========================================
  // FUNGSI BARU: MENANGKAP TOMBOL KEYBOARD HARDWARE
  // ==========================================
  if ('mediaSession' in navigator) {
    navigator.mediaSession.setActionHandler('play', () => {
      audio.play()
      isPlaying.value = true
    });
    navigator.mediaSession.setActionHandler('pause', () => {
      audio.pause()
      isPlaying.value = false
    });
    navigator.mediaSession.setActionHandler('previoustrack', () => prevTrack());
    navigator.mediaSession.setActionHandler('nexttrack', () => nextTrack());
  }

  // Sync state isPlaying ke OS
  watch(isPlaying, (newVal) => {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = newVal ? 'playing' : 'paused'
    }
  })

  return { 
    currentSong, isPlaying, isShuffle, repeatMode, 
    currentTime, duration, volume, coverUrl, queue,
    playTrack, togglePlay, nextTrack, prevTrack, seek, setVolume 
  }
})