# Refactor Analysis

## Obiettivo
Ridurre la complessità dei file monolitici e separare responsabilità UI/logica/store.

## Stato dopo il refactor

### Split UI
- `src/components/app/AppMainContent.vue` -> orchestratore leggero.
- Nuovi componenti in `src/components/app/main-content/`:
  - `MainContentRequestTabs.vue`
  - `MainContentSettingsPage.vue`
  - `MainContentCollectionSettingsPage.vue`
  - `MainContentRequestEditor.vue`
  - `MainContentEmptyState.vue`

### Split Store
- `src/stores/app-store.ts` alleggerito.
- Nuovi moduli helper:
  - `src/stores/app-store/core-helpers.ts`
  - `src/stores/app-store/request-utils.ts`

### Split Controller
- `src/composables/useAppController.ts` alleggerito con estrazione costanti/helper.
- Nuovi moduli:
  - `src/composables/app-controller/options.ts`
  - `src/composables/app-controller/helpers.ts`

## File più grandi (attuali)
1. `src/stores/app-store.ts` (2467 linee)
2. `src/composables/useAppController.ts` (2005 linee)
3. `src/components/app/main-content/MainContentRequestEditor.vue` (608 linee)
4. `src/stores/app-store/core-helpers.ts` (443 linee)

## Prossimi split consigliati
1. `app-store.ts`: separare in moduli action-oriented (`workspace-actions`, `collection-actions`, `request-actions`, `sync-actions`).
2. `useAppController.ts`: separare drag/drop, context-menu, menu-electron, workspace/team actions in composable dedicati.
3. `MainContentRequestEditor.vue`: separare tab editor in componenti (`headers-tab`, `body-tab`, `auth-tab`, `response-panel`).
4. `core-helpers.ts`: separare normalizers da template/base64 helpers.
