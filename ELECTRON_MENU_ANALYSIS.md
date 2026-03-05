# Electron System Menu - Gap Analysis

Data analisi: 2026-03-04

## Ambito

Confronto tra:

1. Funzioni disponibili nella UI RequestMaker.
2. Funzioni esposte nel menu di sistema Electron.

## Stato prima dell'intervento

- Menu applicativo custom: **assente** in `electron/main.cjs`.
- Electron mostrava solo il menu standard di piattaforma (ruoli base), senza comandi business (request/collection/workspace/OpenAPI).

## Matrice copertura funzionale

| Funzione | Presente prima | Stato dopo |
| --- | --- | --- |
| Nuova richiesta | No | Si (`File > Nuova richiesta`) |
| Nuova richiesta rapida | No | Si (`File > Nuova richiesta rapida`) |
| Nuova request nella collection selezionata | No | Si (`File > Nuova request nella collection selezionata`) |
| Nuova collection | No | Si (`File > Nuova collection`) |
| Nuovo workspace | No | Si (`File > Nuovo workspace`) |
| Import OpenAPI JSON | No | Si (`File > Importa OpenAPI JSON...`) |
| Salva richiesta | No | Si (`File > Salva richiesta`) |
| Invia richiesta | No | Si (`File > Invia richiesta`) |
| Duplica richiesta | No | Si (`File > Duplica richiesta`) |
| Elimina richiesta | No | Si (`File > Elimina richiesta`) |
| Rinomina collection selezionata | No | Si (`Collection > Rinomina collection selezionata`) |
| Elimina collection selezionata | No | Si (`Collection > Elimina collection selezionata`) |
| Naviga a Workspace | No | Si (`Vai > Workspace`) |
| Naviga a pagina Utente | No | Si (`Vai > Utente`) |
| Naviga a Impostazioni | No | Si (`Vai > Impostazioni`) |
| Toggle sidebar | No | Si (`Vista > Mostra/Nascondi sidebar`) |
| Tema Sistema/Chiaro/Scuro | No | Si (`Vista > Tema ...`) |
| Login/Logout | No | Si (`Account > Accedi/Esci`) |

## Funzioni standard già coperte (ruoli Electron)

- Modifica testo: Undo/Redo/Cut/Copy/Paste/SelectAll.
- Vista tecnica: Reload/Force Reload/DevTools/Zoom/Fullscreen.
- Azioni applicazione piattaforma (About, Quit, Hide su macOS).

## Gap residui (non ancora nel menu di sistema)

| Area | Gap residuo |
| --- | --- |
| Team | Crea team, invita membri, gestione membership non mappate nel menu |
| Secrets | CRUD segreti team/collection non mappato nel menu |
| Workspace avanzato | Selezione workspace esistente da menu non presente |
| Request editing | Rename request da menu non presente (solo da context menu) |
| Collection settings | Apertura tab specifici (overview/requests/secrets) non mappata |
| Transport | Cambio transport browser/electron/curl non mappato nel menu |

## File toccati per la copertura

- `electron/main.cjs`: menu applicativo + dispatch azioni al renderer.
- `electron/preload.cjs`: bridge sicuro `onMenuAction`.
- `src/types/electron.d.ts`: tipo `MenuActionId` + API bridge.
- `src/App.vue`: handler azioni menu e wiring lifecycle.
