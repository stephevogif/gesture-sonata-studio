# Scale Mode / Cover Mode + One Hand redesign

## Idea

Ogni modalità (Seven Heavens e One Hand) avrà due modi chiaramente separati:

- **SCALE** — si suona liberamente la scala scelta (tonica + modo), senza canzone.
- **COVER** — si suona la progressione di una canzone della libreria.

Un unico interruttore a due voci, sempre visibile, decide quale dei due è attivo.

## Seven Heavens

- Nuovo toggle **SCALE / COVER** nella barra in alto.
- In **SCALE**: numeri con le due mani (1–7) = gradi della scala scelta, esattamente come prima. L'HUD della canzone è nascosto e nessuna song resta attiva.
- In **COVER**: comportamento attuale con HUD della canzone, sezioni, loop, auto-advance. Entrare in Cover senza canzone selezionata porta alla libreria songs.
- Passare a SCALE chiude la sessione song; tornare a COVER la ripristina (ultima canzone usata).

## One Hand

- Stesso toggle **SCALE / COVER**.
- **COVER**: come funziona oggi — gli accordi della canzone si mappano automaticamente sulle 5 dita in ordine, gli slot sono in sola lettura (indicati come "auto").
- **SCALE**: gli slot sono liberi — per ogni dito si sceglie qualsiasi grado/accordo della scala corrente, senza canzone. Le assegnazioni restano salvate in locale e non vengono sovrascritte dalla canzone.

## Nuovo UX One Hand

Impostazione moderna e pulita; la maiolica resta solo come accento.

```text
┌────────────────────────────────┐
│ ‹   ONE HAND        [SCALE|COVER]│
├────────────────────────────────┤
│  ┌──────────────────────────┐  │
│  │  LIVE TRACKING           │  │
│  │  (video + landmark mano) │  │
│  └──────────────────────────┘  │
│  Accordo corrente: Am  (VI)    │
├────────────────────────────────┤
│  ① ② ③ ④ ⑤   slot dita        │
├────────────────────────────────┤
│  Song / assegnazione accordi   │
│  Mano: any | left | right      │
└────────────────────────────────┘
```

- **Schermo di tracking in cima**: anteprima video reale con i landmark della mano disegnati e le dita alzate evidenziate, così si vede subito se la mano è letta bene. Sostituisce l'attuale riquadro di testo "Fotocamera e tracciamento" (che resta solo come messaggio quando il permesso manca).
- **Superficie**: fondo scuro notturno con pannelli in vetro leggero, tipografia pulita, spaziatura ampia, niente texture a piastrelle a tutto schermo.
- **Accenti maiolica**: piccoli motivi negli angoli del frame principale, bordo dorato sottile sui pulsanti primari e sullo slot attivo, filetto decorativo sotto il titolo. Nient'altro.
- **Slot dita**: cinque pastiglie orizzontali con numero dito, grado romano e nome accordo; lo slot attivo si illumina in tempo reale. In SCALE ogni slot è toccabile per cambiare grado.

## Note tecniche

- Nuovo campo `playMode: "scale" | "cover"` persistito insieme alla config One Hand e usato anche da Seven Heavens; in `scale` si salta l'auto-mapping da song (`slotsFromSong`) e `useSongMode.observe` non viene chiamato.
- Il video di tracking già presente in `HeavenSynth` viene condiviso con `OneHandScreen` (stesso stream, nessuna seconda camera) tramite un canvas/overlay passato come prop.
- `OneHandScreen.tsx` riscritto per il nuovo layout; i token maiolica in `src/styles.css` vengono ridotti a classi di accento (angoli, bordi pulsanti) invece di sfondi pieni.
- Nessuna modifica al motore audio o al riconoscimento delle dita.
