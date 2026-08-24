# HEAVEN SONGS — Song Library per Seven Heavens

Aggiunge una libreria di canzoni basata sui **gradi armonici (1–7)** che riusa integralmente il Seven Heavens attuale: stesso audio engine, stesso tracking, stessa regola "dita totali = grado". Nessuna modifica al comportamento di gioco esistente.

## 1. Dove vive la Song Library

- Nuova route `/songs` (`src/routes/songs.tsx`) con lo stesso stile celestiale, header `HEAVEN SONGS` + sottotitolo `Play songs with your hands`.
- Accesso da Seven Heavens: una nuova icona "Songs" nella barra dei controlli in basso (accanto agli altri pannelli), e ritorno a `/studio` dopo la scelta.
- Seven Heavens riceve la canzone scelta da uno store leggero (nessun secondo synth, nessun secondo motore): `src/core/songs/session.ts` (stato in memoria + `localStorage` per riprendere l'ultima song).

## 2. Data model (separato dal componente)

`src/core/songs/types.ts`
```
Song { id, title, artist, keyPc, scale (ModeId), bpm, timeSignature,
       difficulty, genre, year?, artworkRef?, origin: "demo" | "user",
       sections: SongSection[] }
SongSection { id, name: "Intro"|"Verse"|"Pre-Chorus"|"Chorus"|"Bridge"|"Outro"|string,
              degrees: number[] (1..7), beatsPerChord?, repetitions? }
```
- `src/core/songs/catalog.ts` — registry con caricamento dai file dati, ricerca e filtri (Easy / Pop / 4 Chords / 6 Chords / Major / Minor). Progettato per 40 → 1000+ song senza toccare i componenti.
- `src/core/songs/demo.ts` — ~12 progressioni **originali/placeholder**, marcate `origin: "demo"`, nessuna trascrizione di brani commerciali.
- `src/core/songs/userSongs.ts` — CRUD su `localStorage` già pronto per la futura funzione **CREATE SONG** (stesso tipo `Song`, `origin: "user"`).

## 3. Song → Root / Scale

Alla selezione: la sessione salva `songId` + `transposePc`. Seven Heavens, al mount o al cambio sessione, applica `setRootPc(song.keyPc + transpose)` e `setMode(song.scale)` con gli stessi setter già esistenti — l'utente non imposta niente a mano.

## 4. Degree sequence → gesture 1–7

I gradi restano numeri: `degrees[i]` è direttamente il numero di dita da fare. Il grado rilevato è già in `hud.heavens.degree` (0-based); il confronto è `detected + 1 === expected`. Gli accordi mostrati (G, D, Em…) sono generati al volo da `buildChord` con il root/scala correnti — quindi la **trasposizione è gratuita**: cambio tonalità, i numeri non cambiano.

## 5. Manual Follow (default)

- HUD Song Mode: numero **CURRENT** grande, **NEXT** più piccolo, sotto il nome accordo in piccolo; timeline della sezione `1 — 5 — 6 — 4` con marker sul corrente.
- Avanzamento: quando il grado rilevato coincide con quello atteso e resta stabile, il nodo fa un glow morbido e l'indice avanza al prossimo. Grado diverso = nessun errore, nessun "WRONG": la UI resta ferma sull'atteso.
- Cambio sezione: etichetta discreta in dissolvenza (`CHORUS`), audio mai interrotto.
- **Loop section**: toggle `LOOP CHORUS` per ripetere una sezione all'infinito.
- **Auto/Tempo mode**: predisposta nell'hook (avanzamento su BPM/`beatsPerChord`) ma di default off in questa versione.

## 6. Nuovi componenti / file

- `src/core/songs/{types,catalog,demo,userSongs,session}.ts`
- `src/hooks/useSongMode.ts` — sequenza, avanzamento manual/auto, loop, sezione corrente
- `src/components/songs/SongLibrary.tsx` — griglia card + ricerca + filtri
- `src/components/songs/SongCard.tsx`
- `src/components/songs/SongModeHud.tsx` — CURRENT / NEXT / timeline (montato dentro Seven Heavens)
- `src/routes/songs.tsx` — route con head() SEO dedicato
- `src/components/HeavenSynth.tsx` — solo aggiunte: icona Songs, applicazione root/scala dalla sessione, render dell'HUD Song Mode, selettore di trasposizione

## Note tecniche

- Nessun duplicato del music/audio engine: tutto passa da `src/core/music/*` e `HeavenAudioEngine`.
- Il confronto grado usa lo stato HUD già stabilizzato dal `Debouncer`, quindi nessun tocco alla pipeline di tracking.
- Stile: tokens celestiali esistenti (`heaven-*`, glass-morphism, oro su blu notte), zero look karaoke.
