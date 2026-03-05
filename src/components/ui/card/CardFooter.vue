<script setup lang="ts">
import { cn } from '@/lib/utils'

interface Props {
  class?: string
}

const props = withDefaults(defineProps<Props>(), {
  class: '',
})
</script>

<template>
  <footer :class="cn('flex items-center p-4 pt-0', props.class)">
    <slot />
  </footer>
</template>
