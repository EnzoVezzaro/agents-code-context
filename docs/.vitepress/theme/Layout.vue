<script setup>
import { computed } from 'vue'
import { useData } from 'vitepress'
import DefaultTheme from 'vitepress/theme'
import HomePage from './HomePage.vue'

const { page } = useData()

// The root page is the original ACC landing page (site/index.html design).
// Everything else renders with the VitePress default theme + ACC palette.
const isHome = computed(() => page.value.relativePath === 'index.md')
</script>

<template>
  <HomePage v-if="isHome" />
  <DefaultTheme.Layout v-else />
</template>
