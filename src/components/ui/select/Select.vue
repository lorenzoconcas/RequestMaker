<script setup lang="ts">
import { cn } from '@/lib/utils'

interface Option {
  label: string
  value: string
}

interface OptionGroup {
  label: string
  options: Option[]
}

type SelectItem = Option | OptionGroup

interface Props {
  modelValue?: string | null
  options: SelectItem[]
  class?: string
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  class: '',
  disabled: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

function isOptionGroup(item: SelectItem): item is OptionGroup {
  return typeof item === 'object' && item !== null && Array.isArray((item as OptionGroup).options)
}
</script>

<template>
  <select
    :value="props.modelValue ?? ''"
    :disabled="props.disabled"
    :class="cn('flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50', props.class)"
    @change="emit('update:modelValue', ($event.target as HTMLSelectElement).value)"
  >
    <template v-for="(item, index) in props.options" :key="`select-item-${index}`">
      <optgroup v-if="isOptionGroup(item)" :label="item.label">
        <option v-for="option in item.options" :key="`${item.label}-${option.value}`" :value="option.value">
          {{ option.label }}
        </option>
      </optgroup>
      <option v-else :value="item.value">
        {{ item.label }}
      </option>
    </template>
  </select>
</template>
