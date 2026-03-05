<script setup lang="ts">
import { ref } from 'vue'

import { Copy, ShieldAlert, X } from 'lucide-vue-next'

import type { AppController } from '@/composables/useAppController'
import { Button } from '@/components/ui/button'

interface CommandItem {
  command: string
  key: string
  label: string
}

const { controller } = defineProps<{ controller: AppController }>()

const { showCorsBypassDialog, closeCorsBypassDialog } = controller
const copiedKey = ref<string | null>(null)

const commandItems: CommandItem[] = [
  {
    key: 'windows-powershell',
    label: 'Windows (PowerShell)',
    command:
      '$chrome="$env:ProgramFiles\\Google\\Chrome\\Application\\chrome.exe"; if (-not (Test-Path $chrome)) { $chrome="$env:ProgramFiles(x86)\\Google\\Chrome\\Application\\chrome.exe" }; Start-Process -FilePath $chrome -ArgumentList \'--disable-web-security\', "--user-data-dir=$env:TEMP\\requestmaker-chrome"',
  },
  {
    key: 'windows-cmd',
    label: 'Windows (CMD)',
    command:
      'start "" "%ProgramFiles%\\Google\\Chrome\\Application\\chrome.exe" --disable-web-security --user-data-dir="%TEMP%\\requestmaker-chrome"',
  },
  {
    key: 'linux',
    label: 'Linux',
    command: 'google-chrome --disable-web-security --user-data-dir=/tmp/requestmaker-chrome',
  },
  {
    key: 'macos',
    label: 'macOS',
    command: 'open -na "Google Chrome" --args --disable-web-security --user-data-dir="/tmp/requestmaker-chrome"',
  },
]

async function copyCommand(item: CommandItem) {
  if (typeof navigator === 'undefined' || !navigator.clipboard) {
    return
  }

  try {
    await navigator.clipboard.writeText(item.command)
    copiedKey.value = item.key

    window.setTimeout(() => {
      if (copiedKey.value === item.key) {
        copiedKey.value = null
      }
    }, 1500)
  } catch {
    copiedKey.value = null
  }
}
</script>

<template>
  <div
    v-if="showCorsBypassDialog"
    class="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4"
    @click.self="closeCorsBypassDialog"
  >
    <div class="w-full max-w-[900px] rounded-lg border border-border bg-background shadow-2xl">
      <div class="flex items-center justify-between border-b border-border/70 px-4 py-3">
        <div class="flex items-center gap-2">
          <div class="rounded-md bg-amber-100 p-2 text-amber-700 dark:bg-amber-950/30 dark:text-amber-200">
            <ShieldAlert class="h-4 w-4" />
          </div>
          <div>
            <p class="text-sm font-semibold">Chrome bypass CORS</p>
          </div>
        </div>

        <Button variant="ghost" size="icon" @click="closeCorsBypassDialog">
          <X class="h-4 w-4" />
        </Button>
      </div>

      <div class="space-y-4 p-4">
        <div class="rounded-md border border-amber-300/70 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
          Usa questi comandi solo per test locale: il flag <code>--disable-web-security</code> riduce la sicurezza del browser.
        </div>

        <div class="space-y-3">
          <div
            v-for="item in commandItems"
            :key="item.key"
            class="rounded-md border border-border/70 bg-muted/10 p-3"
          >
            <div class="mb-2 flex items-center justify-between gap-2">
              <p class="text-sm font-medium">{{ item.label }}</p>
              <Button variant="outline" size="sm" @click="void copyCommand(item)">
                <Copy class="mr-2 h-4 w-4" />
                {{ copiedKey === item.key ? 'Copiato' : 'Copia' }}
              </Button>
            </div>

            <pre class="overflow-x-auto rounded border border-border/70 bg-background px-3 py-2 text-xs"><code>{{ item.command }}</code></pre>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
