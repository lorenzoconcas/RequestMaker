<script setup lang="ts">
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        outline: 'text-foreground',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

type BadgeVariant = VariantProps<typeof badgeVariants>['variant']

interface Props {
  variant?: BadgeVariant
  class?: string
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'default',
  class: '',
})
</script>

<template>
  <div :class="cn(badgeVariants({ variant: props.variant }), props.class)">
    <slot />
  </div>
</template>
