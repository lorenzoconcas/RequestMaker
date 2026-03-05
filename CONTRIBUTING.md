# Contributing

Grazie per il contributo a RequestMaker.

## Prerequisiti

- Node.js 20+
- npm 10+

## Setup locale

```bash
npm install
cp .env.example .env
npm run dev
```

## Flusso consigliato

1. Crea un branch dedicato.
2. Mantieni il cambio focalizzato su un singolo obiettivo.
3. Esegui i controlli prima di aprire una PR:

```bash
npm run typecheck
npm run build
```

## Pull Request

- Descrivi il problema e la soluzione.
- Includi eventuali screenshot/GIF per modifiche UI.
- Indica eventuali impatti su Firebase rules/configurazione.

## Scope dei contributi

Sono benvenuti contributi su:

- UX del request editor
- stabilita cloud sync
- supporto OpenAPI
- sicurezza Electron/Firebase
- documentazione e onboarding
