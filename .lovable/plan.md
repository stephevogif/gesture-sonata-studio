# Redesign Workspace — Floating Windows + Sound Constellation

Evoluzione di Seven Heavens in una workspace modulare celestiale. Tracking, Song Mode,
Music Theory Engine e gesture 1–7 restano intatti: cambia **come suona** e **come si naviga**,
non **cosa** viene suonato.

## 1. Bottom Navigation stabile

Nuova nav a 5 posizioni fisse: `SONGS · SOUND · PLAY/STOP · ARP · SCALE`.
FX spariscono dalla barra (vivono dentro Sound Constellation).

- Play/Stop è sempre l'orb centrale (grid a 5 colonne, non flex justify-between),
  quindi non si sposta mai quando apro finestre o Song Mode.
- Orb: glow pale gold, breathing leggero solo quando il synth è attivo, Play/Stop icon.
- La nav espone la sua altezza reale via CSS var `--heaven-nav-h` + `env(safe-area-inset-bottom)`.
  Il contenitore di pagina e ogni floating window usano
  `padding-bottom: calc(var(--heaven-nav-h) + env(safe-area-inset-bottom) + 12px)`,
  così nessun contenuto interattivo finisce dietro la barra.

## 2. Sistema Floating Window

Nuovo componente riutilizzabile `FloatingWindow`:
titolo + `X` (close) + `—` (minimize), glass/blur celestiale, bordo sottile, glow morbido,
scroll **interno** (`overflow-y-auto`, max-height calcolata sulla safe area).
Su mobile è una bottom sheet responsive; da `sm:` diventa un pannello flottante centrato.
La performance (cielo, sole, mani) resta visibile dietro.

Songs, Sound Constellation, Arp, Scale, Help usano tutti questo contenitore.

## 3. Songs come finestra + Song Mode chiudibile

- `SONGS` non naviga più su `/songs`: apre la Song Library dentro una floating window
  (la route `/songs` resta funzionante per link diretti).
- Selezione song → la finestra si chiude → Seven Heavens entra in Song Mode.
- L'header di Song Mode HUD ha `X / EXIT SONG`: rimuove la song, ripristina i nodi I–VII,
  **non** ferma il synth, mantiene key/scala correnti.

## 4. Sound Constellation (SOUND + FX unificati)

Un'unica finestra `SOUND CONSTELLATION` con:

```text
              VIOLIN ◉
      PAD ◉      ☀ MASTER      ◉ 808
              ◉ PIANO
```

- **MASTER SUN** centrale: alone radiale caldo, orbite sottilissime, breathing lieve,
  reazione leggera al livello audio (dall'analyser esistente).
- Fino a **4 instrument nodes** trascinabili (`+ ADD SOUND` apre una mini-library;
  a 4 il pulsante si disabilita e mostra `4 / 4 SOUNDS`).
- Distanza dal Master = volume: `nearIsHigh` (centro 100%, bordo 0%), con smoothing del gain.
- Ogni strumento ha `+ FX`: FX node satellite con mapping `farIsHigh`
  (sopra lo strumento = 0%, raggio massimo = 100%), e i parametri come satelliti minori.
- Il Master accetta i propri FX, applicati a tutto il mix.
- Tap su un nodo → floating inspector compatto: NAME / PRESET / BYPASS / REMOVE.
  Nessuna rimozione accidentale con tap singolo.
- Focus mode: nodo selezionato in evidenza, gli altri leggermente attenuati.

## 5. Audio: multi-strumento e routing

Estensione clean-room di `src/core/audio`:

- Nuovo `InstrumentChannel`: catena `voices → instrument FX chain → instrument gain → master bus`.
- `MasterRack` diventa master bus con `master FX chain → EQ → limiter → analyser → out`.
- `LayerRouter` nel motore: l'accordo calcolato una sola volta dal Music Theory Engine
  viene inviato a tutti i canali attivi (voice-id namespaced per canale), niente duplicazione teorica.
- FX esposti = solo quelli realmente implementati: **Reverb, Delay, Chorus, Filter, Distortion,
  Tremolo, Gate** (Distortion/Tremolo/Gate nuovi come nodi per-canale riusabili).
- Rimozione di uno strumento o di un FX: `dispose()` esplicito, disconnessione e stop delle voci —
  nessun nodo audio orfano.
- Il grafo non viene ricostruito durante il drag: si aggiornano solo gli AudioParam con
  `setTargetAtTime`.

## 6. Gate DSP + 8 preset

Nuovo `GateEffect` (LFO/pattern-driven gain con shape, attack, release, mix, depth, rate,
sync al BPM esistente). Preset dichiarativi in un file dati:
`PULSE · EIGHTH · SIXTEENTH · OFFBEAT · TRANCE · STUTTER · BREATH · RANDOM STARS`,
con mini-visualizzazione del pattern sul nodo (`● — ● — ●`).

## 7. Preset della costellazione

Serializzazione completa dello stato mix (strumenti, posizioni, volumi, FX, parametri FX,
Master FX) in localStorage, riutilizzando lo schema preset già esistente. Preset di fabbrica
inclusi: `CELESTIAL TRAP`, `HEAVEN PIANO`.

## Dettagli tecnici

- Nuovi file: `src/components/ui/FloatingWindow.tsx`, `src/components/sound/SoundConstellation.tsx`,
  `src/components/sound/NodeInspector.tsx`, `src/core/audio/channel.ts`, `src/core/audio/gate.ts`,
  `src/core/audio/gatePresets.ts`, `src/core/audio/fxCatalog.ts`, `src/core/sound/constellation.ts`
  (stato + mapping posizione→parametro), `src/core/sound/presets.ts`.
- Modificati: `engine.ts` (layer router, API multi-canale), `effects.ts` (master bus + master FX),
  `HeavenSynth.tsx` (nav, floating windows, wiring), `SongModeHud.tsx` (exit),
  `FxConstellation.tsx` (nodi aggiungibili/rimovibili), `styles.css` (nav var, safe area, glass window).
- Drag con pointer events + refs + rAF; nessun setState per pixel.
- Nessun DSP nei componenti React: la UI produce solo coordinate, il mapping layer le traduce.
- Night Sky continua a funzionare con la FX Constellation attuale (nessuna regressione).

## Verifica

Typecheck + production build, e check via browser su viewport mobile e desktop:
nav sempre centrata e non sovrapposta, Songs→Song Mode→X, 4 strumenti in layering,
distanza→volume, FX per strumento e su Master, 8 preset del Gate, limite 4 strumenti,
rimozione pulita di strumenti e FX.
