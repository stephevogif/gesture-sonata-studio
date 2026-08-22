# Ascolto microfono: scala e tonica automatiche

Nuova funzione "Ascolta" per le jam session: il microfono registra qualche secondo di musica dal vivo, ne stima la tonalità (nota fondamentale + scala) e imposta automaticamente i controlli musicali dello strumento.

## Esperienza utente

- Nel pannello **Scala** compare un pulsante **Ascolta** con un'icona microfono, insieme a un selettore della durata (3 / 6 / 10 secondi).
- Premendo il pulsante: richiesta permesso microfono, poi un indicatore circolare con conto alla rovescia e un piccolo livello audio in tempo reale.
- Al termine, l'app mostra il risultato (es. "Rilevato: Re minore — confidenza alta") e applica subito tonica e scala; se la confidenza è bassa lo segnala e propone di riprovare.
- Un pulsante **Annulla** interrompe l'ascolto; il microfono viene chiuso subito dopo l'analisi.
- Nel titolo dell'app resta "Steph Evo's Ether Strings — Hand gestures instrument".

## Come funziona la rilevazione

1. Cattura audio dal microfono con Web Audio (AnalyserNode) e accumula uno spettro medio su tutta la durata.
2. Ripiega lo spettro in un profilo a 12 classi di altezza (chroma), pesando le frequenze tra ~80 Hz e ~4 kHz e ignorando i frame troppo silenziosi.
3. Confronta il profilo con i modelli di tonalità (Krumhansl) per tutte le 12 toniche in maggiore e minore, scegliendo la correlazione più alta; la differenza tra il primo e il secondo risultato diventa il valore di confidenza.
4. Mappa il risultato sulle scale già disponibili nell'app (maggiore → pentatonica maggiore o ionica, minore → pentatonica minore o eolia, secondo la corrispondenza migliore delle note rilevate) e imposta tonica e scala.

## Dettagli tecnici

- Nuovo modulo `src/lib/keyDetect.ts`: `detectKey(durationMs, onProgress)` che apre `getUserMedia({ audio: ... })`, costruisce l'analyser, accumula il chroma, esegue il matching e restituisce `{ rootPc, mode, scaleId, confidence }`. Chiude stream e AudioContext al termine o su annullamento (AbortSignal).
- `src/components/GestureSynth.tsx`: nel pannello `scale` aggiunge stato (`listening`, `listenProgress`, `detectResult`), il pulsante Ascolta e la visualizzazione del risultato; al successo chiama i setter esistenti `setRootPc` / `setScale`, che già propagano a `engine.setScale(...)`.
- Nessuna modifica al motore audio: la scala rilevata passa attraverso il percorso esistente.
- Gestione errori: permesso negato o microfono assente mostrano un messaggio chiaro nel pannello, senza bloccare l'app.
