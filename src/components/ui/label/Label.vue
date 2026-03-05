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
  <label :class="cn('text-sm font-medium leading-none', props.class)">
    <slot />
  </label>
</template>
