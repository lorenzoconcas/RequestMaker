<script setup lang="ts">
import { cn } from '@/lib/utils'

interface Props {
  modelValue?: string
  class?: string
  rows?: number
  placeholder?: string
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  class: '',
  rows: 6,
  placeholder: '',
  disabled: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()
</script>

<template>
  <textarea
    :value="props.modelValue"
    :rows="props.rows"
    :disabled="props.disabled"
    :placeholder="props.placeholder"
    :class="cn('flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50', props.class)"
    @input="emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
  />
</template>
