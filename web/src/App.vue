<script setup>
import RandomPicker from './components/RandomPicker.vue'
</script>

<template>
  <div class="app-container">
    <RandomPicker />
  </div>
</template>

<style>
html, body {
  margin: 0;
  padding: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background-color: oklch(98% 0.012 248);
}

.app-container {
  width: 100%;
  height: 100%;
  overflow: hidden;
}
</style>
