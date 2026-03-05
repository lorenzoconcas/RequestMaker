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
  <header :class="cn('flex flex-col space-y-1.5 p-4', props.class)">
    <slot />
  </header>
</template>
