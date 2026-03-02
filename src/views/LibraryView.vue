<template>
  <div class="relative h-full">
    <header class="mb-6">
      <h1 class="text-5xl font-black tracking-tighter italic uppercase text-black">Library</h1>
      <p class="text-black/60 font-semibold tracking-wide uppercase text-xs mt-1">
        EMP Player // Alice Blue Edition
      </p>
    </header>

    <div class="grid grid-cols-2 gap-4">
      <div v-for="n in 4" :key="n" 
           class="h-32 bg-slate-200/50 rounded-2xl border border-black/5 flex items-center justify-center font-bold italic hover:bg-slate-200 transition-colors cursor-pointer">
        RECORDS_0{{ n }}
      </div>
    </div>

    <div class="absolute bottom-0 right-0 text-[10px] font-mono opacity-30 text-right">
      SYSTEM: OPERATIONAL<br/>
      STORAGE: LOCAL_DISK
    </div>
  </div>
</template>