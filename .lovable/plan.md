# Pianificazione: App Windows e smartphone per Steph Evo's Crazy Theramin

## Obiettivo
Rendere **STEPH EVO'S CRAZY THERAMIN — GESTURE MUSIC** installabile su Windows e utilizzabile come app sullo smartphone, senza rompere la preview Lovable.

## Decisioni prese
- **Windows**: pacchettizzazione con Electron, output come cartella `.zip` con `.exe` pronto all'uso (gli installer richiedono tool non disponibili in questa sandbox).
- **Android / smartphone**: supporto PWA installabile (manifest + service worker offline). Questo è il modo più diretto per un'app web e permette "Aggiungi alla schermata home" e funzionamento offline. Un **vero APK nativo** richiede Capacitor ed è un passo separato; possiamo affrontarlo in un secondo momento se serve.

## Cosa costruire

### 1. PWA installabile e offline
- Creare `public/manifest.webmanifest` con nome, icone, colori, `display: "standalone"`, `start_url`, `scope`.
- Aggiungere icone PWA in `public/` (almeno 192x192, 512x512).
- Aggiungere tag `<link rel="manifest">`, `<meta name="theme-color">`, `apple-touch-icon` nel head in `src/routes/__root.tsx`.
- Installare `vite-plugin-pwa` e configurarlo in `vite.config.ts`:
  - `registerType: "autoUpdate"`
  - `injectRegister: null`
  - `devOptions: { enabled: false }`
  - `filename: "sw.js"`
  - strategia `NetworkFirst` per navigazioni HTML
  - strategia `CacheFirst` solo per asset hashati stesso-origin
  - escludere `/~oauth` dal fallback
- Creare un wrapper `src/lib/pwa-register.ts` che registra il service worker solo in produzione, solo quando non è in iframe, e non sui domini Lovable preview (`id-preview--`, `lovableproject.com`, `lovableproject-dev.com`, `beta.lovable.dev`). Se il contesto è vietato, cancella eventuali registrazioni `/sw.js` esistenti.
- Importare e chiamare il wrapper in `src/routes/__root.tsx` in modo sicuro per SSR.

### 2. Pacchetto Windows con Electron
- Modificare `vite.config.ts` impostando `base: "./"` per supportare il caricamento `file://`.
- Creare `electron/main.cjs` (CommonJS) con `BrowserWindow` che carica `dist/index.html`, `contextIsolation: true`, `nodeIntegration: false`.
- Aggiungere `