# Più strumenti elettronici, bassi e arpeggi migliori

## 1. Nuovi strumenti elettronici (gruppo "Elettronici / Bass")

Sei nuovi preset sintetizzati con lo stesso motore Web Audio:

- **Neuro Bass** — saw detunato + waveshaper doppio, filtro a formante che si muove con l'altezza della mano.
- **FM Bass** — modulazione FM profonda (ratio 2:1), attacco secco, sub sinusoidale.
- **808 Sub** — sinusoide con pitch drop iniziale e leggera saturazione; nota lunga e calda.
- **Hoover / Rave Stab** — saw a sciame con portamento e filtro urlante, perfetto per stab arpeggiati.
- **Supersaw Trance** — 7 saw detunati, pad brillante da usare con arp veloci.
- **Digital Pluck** — square + FM breve, pluck secco pensato per pattern a 16 note.

Ogni preset ottiene la propria trasposizione (`INSTRUMENT_SHIFT`) così i bassi restano nel registro giusto.

## 2. Arpeggiatore più espressivo

- Nuovi pattern: **Su/Giù x2**, **Terzine**, **Salti d'ottava**, **Scala completa (8 gradi)**, **Trance gate (16esimi)**.
- Slider **Gate/Lunghezza nota** (staccato ↔ legato) oltre alla velocità già presente.
- **Octave range** 1–3: l'arp ripete il pattern salendo di ottava.
- **Swing** 0–60% per un groove meno rigido.
- Velocità estesa fino a 16 note/s con snap ai valori musicali (1/8, 1/8T, 1/16, 1/16T).

## 3. Come l'avrei resa meglio (proposte)

- **Preset globali salvabili**: un pulsante "Salva scena" che memorizza strumento, scala, arp ed effetti (in locale), con 4–6 scene pronte tipo "Ambient Zen", "Deep Bass Jam", "Trance Arp".
- **Delay sincronizzato** al tempo dell'arp (ping-pong) invece del solo riverbero: sui pluck elettronici cambia tutto.
- **Compressore/limiter** in master per evitare clipping quando i bassi si sommano ai pad.
- **Latch/hold**: una mano "blocca" la nota mentre l'altra suona sopra, utile per jam da soli.
- **Legenda note più leggibile** e piccolo indicatore dell'accordo suonato.

## Dettagli tecnici

- `src/lib/synth.ts`: nuovi `InstrumentId`, rami in `buildVoice` (FM tramite oscillatore modulante su `frequency`, pitch-drop con `setTargetAtTime`), nuovi `ARP_PATTERNS`, campi `arpGate`, `arpOctaves`, `arpSwing` usati in `tickArp`.
- `src/components/GestureSynth.tsx`: nuovi controlli nel pannello Arp; gli strumenti compaiono automaticamente nei selettori raggruppati.
- Nessuna modifica al backend.
