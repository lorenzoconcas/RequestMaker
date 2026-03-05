<script setup lang="ts">
import { LogIn, LogOut, Plus, User, X } from 'lucide-vue-next'

import type { AppController } from '@/composables/useAppController'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'

const { controller } = defineProps<{ controller: AppController }>()

const {
  store,
  showUserDialog,
  userTabs,
  userPageTab,
  closeUserDialog,
  newTeamName,
  handleCreateTeam,
  inviteTeamId,
  inviteTeamOptions,
  inviteEmail,
  handleInviteMember,
  handleAcceptTeamInvite,
  handleDeclineTeamInvite,
  formatTeamInviteExpiresAt,
  handleDeleteOwnAccount,
} = controller
</script>

<template>
  <div
    v-if="showUserDialog"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    @click.self="closeUserDialog"
  >
    <div class="w-full max-w-[760px] rounded-lg border border-border bg-background shadow-2xl">
      <div class="flex items-center justify-between border-b border-border/70 px-4 py-3">
        <div class="flex items-center gap-2">
          <div class="rounded-md bg-primary/10 p-2 text-primary">
            <User class="h-4 w-4" />
          </div>
          <div>
            <p class="text-sm font-semibold">Pagina Utente</p>
          </div>
        </div>

        <Button variant="ghost" size="icon" @click="closeUserDialog">
          <X class="h-4 w-4" />
        </Button>
      </div>

      <div class="space-y-4 p-4">
        <div class="flex flex-wrap items-center gap-1 border-b border-border/70">
          <button
            v-for="tab in userTabs"
            :key="tab.value"
            type="button"
            class="border-b-2 px-3 py-2 text-xs font-medium transition-colors"
            :class="
              userPageTab === tab.value
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            "
            @click="userPageTab = tab.value as 'profile' | 'team'"
          >
            {{ tab.label }}
          </button>
        </div>

        <div v-if="userPageTab === 'profile'" class="space-y-4">
          <div v-if="store.user" class="rounded-md border border-border/70 p-3">
            <p class="text-sm font-semibold">{{ store.user.displayName || 'Utente autenticato' }}</p>
            <p class="text-xs text-muted-foreground">{{ store.user.email || 'Email non disponibile' }}</p>
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <Badge v-if="store.isRemoteMode" variant="secondary">Firebase Sync ON</Badge>
            <p v-else class="text-xs text-muted-foreground">Sync Firebase disattiva. Effettua login per abilitarla.</p>

            <Button v-if="store.user" variant="outline" @click="store.logout">
              <LogOut class="mr-2 h-4 w-4" />
              Logout
            </Button>

            <Button v-else @click="store.loginWithGoogle">
              <LogIn class="mr-2 h-4 w-4" />
              Login con Google
            </Button>

            <Button
              v-if="store.user"
              variant="ghost"
              class="ml-auto text-red-600 hover:text-red-700 dark:text-red-300 dark:hover:text-red-200"
              @click="handleDeleteOwnAccount"
            >
              Elimina account
            </Button>
          </div>
        </div>

        <div v-else class="space-y-4">
          <div class="space-y-2">
            <Label>Inviti ricevuti</Label>
            <div v-if="store.pendingTeamInvites.length > 0" class="space-y-2">
              <div
                v-for="invite in store.pendingTeamInvites"
                :key="invite.id"
                class="rounded-md border border-border/70 px-3 py-2"
              >
                <p class="text-sm font-medium">{{ invite.teamName }}</p>
                <p class="text-xs text-muted-foreground">
                  Invitato da {{ invite.invitedByEmail || 'utente team' }} · scade {{ formatTeamInviteExpiresAt(invite.expiresAt) }}
                </p>
                <div class="mt-2 flex items-center gap-2">
                  <Button size="sm" variant="secondary" @click="handleAcceptTeamInvite(invite.id)">Accetta</Button>
                  <Button size="sm" variant="outline" @click="handleDeclineTeamInvite(invite.id)">Rifiuta</Button>
                </div>
              </div>
            </div>
            <p v-else class="text-xs text-muted-foreground">Nessun invito in attesa.</p>
          </div>

          <Separator />

          <div class="space-y-2">
            <Label>Nuovo team</Label>
            <div class="flex gap-2">
              <Input v-model="newTeamName" placeholder="Es. Platform Team" />
              <Button variant="secondary" size="icon" @click="handleCreateTeam">
                <Plus class="h-4 w-4" />
              </Button>
            </div>
          </div>

          <Separator />

          <div class="space-y-2">
            <Label>Invita membro</Label>
            <Select v-model="inviteTeamId" :options="inviteTeamOptions" />
            <div class="flex gap-2">
              <Input v-model="inviteEmail" placeholder="email@azienda.com" />
              <Button variant="outline" @click="handleInviteMember">Invita</Button>
            </div>
          </div>

          <p class="text-xs text-muted-foreground">Team disponibili: {{ store.teams.length }}</p>
        </div>
      </div>
    </div>
  </div>
</template>
