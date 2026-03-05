# Release Checklist

## 1. Quality gate

- [ ] `npm install`
- [ ] `npm run typecheck`
- [ ] `npm run build`
- [ ] smoke test web (`npm run preview`)
- [ ] smoke test electron (`npm run electron:preview`)

## 2. Sicurezza e configurazione

- [ ] verifica `.env.example` allineato alle variabili richieste
- [ ] verifica che `.env` non sia committato
- [ ] revisione dipendenze (`npm audit`) e triage vulnerabilita
- [ ] controllo Firestore rules aggiornate

## 3. Documentazione

- [ ] aggiorna `README.md` (feature e breaking changes)
- [ ] aggiorna changelog/release notes
- [ ] verifica `SECURITY.md`, `CONTRIBUTING.md`, `LICENSE`

## 4. Versioning

- [ ] aggiorna versione in `package.json`
- [ ] crea tag Git (`vX.Y.Z`)
- [ ] prepara draft release con note

## 5. Build artifacts

- [ ] build Electron macOS (`npm run electron:build:mac`)
- [ ] build Electron Linux (`npm run electron:build:linux`)
- [ ] build Electron Windows (`npm run electron:build:win`)

## 6. Post release

- [ ] verifica install/avvio pacchetti rilasciati
- [ ] monitora issue critiche nelle prime 48 ore
