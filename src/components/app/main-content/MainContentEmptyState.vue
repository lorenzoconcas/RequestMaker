<script setup lang="ts">
import { FolderKanban } from 'lucide-vue-next'

import { Card, CardContent } from '@/components/ui/card'
</script>

<template>
  <Card class="flex-1 border-dashed">
    <CardContent class="flex h-full flex-col items-center justify-center gap-2">
      <FolderKanban class="h-8 w-8 text-muted-foreground" />
      <p class="text-sm font-medium">Seleziona una request dalla tree view</p>
      <p class="text-xs text-muted-foreground">Oppure crea una nuova request dalla sidebar.</p>
    </CardContent>
  </Card>
</template>
