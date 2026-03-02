<template>
  <div 
    class="h-screen w-full bg-outer-glass backdrop-blur-md p-outer flex flex-col relative overflow-hidden rounded-main border border-white/20 shadow-2xl transition-all duration-300"
  >
    <div class="flex-1 flex gap-gap overflow-hidden">
      <slot />
    </div>
  </div>
</template>