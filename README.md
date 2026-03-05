# RequestMaker

Client API in stile Postman costruito con `Vue 3 + TypeScript + Vite + shadcn-vue`, con:

- Import di file `openapi.json` (OpenAPI 3.x e Swagger 2.0)
- Esecuzione richieste HTTP (metodo, URL, header, body)
- Trasporti multipli: Browser fetch, Electron fetch nativo, `curl` nativo
- Workspace e collection
- Segreti condivisi a livello team e a livello collection (override)
- Sincronizzazione realtime con Firebase (Auth + Firestore)
- Condivisione con team (member management e inviti email)

## Stack

- Vue 3
- Vite
- TypeScript
- Pinia
- Tailwind CSS
- shadcn-vue (component pattern)
- Electron
- Firebase Auth + Firestore

## Avvio locale

1. Installa dipendenze:

```bash
npm install
```

2. Copia `.env.example` in `.env` e configura Firebase:

```bash
cp .env.example .env
```

3. Avvia in dev:

```bash
npm run dev
```

4. Build produzione:

```bash
npm run build
```

## Avvio desktop Electron

- Dev desktop (renderer Vite + shell Electron):

```bash
npm run electron:dev
```

- Preview desktop su build Vite:

```bash
npm run electron:preview
```

- Build app desktop:

```bash
npm run electron:build
```

Nel request editor puoi scegliere il trasporto:

- `Browser (CORS)`: fetch del browser, soggetto a CORS.
- `Electron Fetch (native)`: fetch in main process Electron, bypass CORS del browser.
- `cURL nativo`: esecuzione di `curl` locale via IPC.

## Nome e icona app Electron

- Nome app runtime: `electron/main.cjs` (`APP_NAME`).
- Nome app in build: `package.json` -> `build.productName`.
- Icona app: `build/icon.png` (usata in dev e come base per electron-builder).
- Per cambiare branding, sostituisci `build/icon.png` con la tua icona (consigliata 1024x1024 PNG).

## Configurazione Firebase

Variabili richieste in `.env`:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

Se le variabili non sono valorizzate, l'app funziona in **modalita locale** con persistenza su `localStorage`.

## Data model Firestore

- `users/{uid}`
  - `email`, `displayName`, `photoURL`
- `teams/{teamId}`
  - `name`, `ownerId`, `memberIds[]`
  - subcollection `secrets/{secretId}`: `key`, `value`
- `teamInvites/{inviteId}`
  - `teamId`, `teamName`, `invitedEmailNormalized`, `status`, `expiresAt`, `invitedByUid`
- `workspaces/{workspaceId}`
  - `name`, `ownerId`, `teamId|null`, `memberIds[]`
- `workspaces/{workspaceId}/collections/{collectionId}`
  - `name`, `createdBy`
- `workspaces/{workspaceId}/requests/{requestId}`
  - `collectionId`, `name`, `method`, `url`, `headers[]`, `body`, `description`
- `workspaces/{workspaceId}/collectionSecrets/{secretId}`
  - `collectionId`, `key`, `value`

## OpenAPI import

Flusso import:

1. Apri il **Menu progetto** e carica un file `.json` da pulsante **Import OpenAPI JSON**.
2. Il parser legge `paths` e crea:
   - una collection importata
   - una request per endpoint/metodo
3. Vengono importati in automatico:
   - nome endpoint (`summary`/`operationId`)
   - metodo HTTP
   - URL (con base URL da `servers[0].url` o `host/basePath`)
   - body di esempio (quando presente)

## Note operative

- In modalità browser valgono le regole CORS.
- In modalità Electron (`Electron Fetch` o `cURL`) le richieste sono native e non bloccate da CORS browser.
- I segreti supportano template `{{SECRET_KEY}}` in URL, headers e body.
- Priorità segreti: `collection secret` > `team secret`.
- Gli inviti team sono a **accettazione esplicita** da parte dell'utente invitato.
- Gli inviti scadono dopo **7 giorni**.
- Per invio email automatico è supportata la collection `mail` (Firebase Extension Trigger Email).
  - Configurazione web: `Firebase Console > Extensions > Trigger Email` con collection `mail`.
- Per produzione conviene aggiungere audit log, versioning richieste e gestione ruoli (owner/editor/viewer).
