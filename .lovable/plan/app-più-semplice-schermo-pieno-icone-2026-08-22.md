# App più semplice: schermo pieno + icone

## Obiettivo
La prima schermata mostra solo la vista live (il "track") con il pulsante di avvio. Tutti i controlli spariscono dalla pagina e vivono dentro pannelli che si aprono da una barra di icone sotto lo schermo.

## Nuova schermata

```text
+--------------------------------------+
|                                      |
|         VISTA LIVE (camera)          |
|        [ Inizia a suonare ]          |
|                                      |
+--------------------------------------+
|  [♪]   [FX]   [scala]  [arp]  [◼]    |
+--------------------------------------+
```

- Titolo compatto in alto (STEPH EVO'S CRAZY THERAMIN), niente paragrafo descrittivo.
- Sotto lo schermo, 4 icone + stop:
  - Suono: modalità di gioco e scelta strumenti (incluso split A/B)
  - Effetti: riverbero, tipo filtro, cutoff
  - Scala: scala musicale e tonica
  - Arp: on/off per lato, pattern, velocità
- Toccando un'icona si apre un pannello a scomparsa sotto la barra (uno alla volta, richiudibile). Nessun controllo visibile finché non si apre un pannello.
- Layout ottimizzato per telefono: schermo alto, icone grandi tappabili, pannelli scrollabili.

## Testi
Rimossi tutti i riferimenti scritti a mani/gesti:
- Sezione finale con le 3 spiegazioni ("Sinistra/destra", "Alto/basso", "Apri/chiudi"): eliminata.
- "Pinch (gesturesynth)" → "Tocco note"; "Split: pad + bass" → "Doppio strumento"; "Strumento singolo" resta.
- "Mano sinistra" / "Mano destra" → "Lato A" / "Lato B" (anche nell'arpeggiatore e nelle etichette a schermo durante l'esecuzione).
- "Apri la mano per produrre suono" → "Pronto".
- Sottotitolo header e descrizioni delle modalità riscritti senza parole come mano, gesto, pinch.
- Aggiornati anche titolo/descrizione SEO della pagina se contengono quei termini.

## Note tecniche
- Modifiche solo in `src/components/GestureSynth.tsx` (nuova struttura UI + stato `openPanel`), più eventuali stili in `src/styles.css` per la barra icone e il pannello.
- Nessun cambiamento al motore audio (`src/lib/synth.ts`) né alla logica di tracciamento: stessi parametri, solo riorganizzazione dell'interfaccia e dei testi.
- Icone da `lucide-react` (già disponibile), con `aria-label` per accessibilità.
