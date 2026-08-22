# Microfono toggle, applicazione automatica della scala e nuovi strumenti zen

## 1. Icona microfono come play/stop

Oggi l'icona "Rileva" sopra lo schermo avvia l'ascolto e resta disabilitata finché non finisce; per fermarlo bisogna aprire il pannello Scala.

- La stessa icona diventa un interruttore: primo tocco avvia l'ascolto, secondo tocco lo ferma subito, un terzo tocco ne avvia uno nuovo pulito (nessuna sessione doppia o microfono lasciato aperto).
- Durante l'ascolto l'icona pulsa e mostra un piccolo quadrato di stop al posto del microfono, con il countdown accanto.
- Annullando, il messaggio in basso torna neutro ("Ascolto interrotto") e la scala precedente resta invariata.

## 2. Scala e tonica applicate automaticamente

Il rilevamento imposta già scala e tonica; il completamento va reso immediato e visibile anche mentre stai suonando.

- Applicazione istantanea al motore audio anche a note in corso, senza bisogno di riaprire un pannello.
- Il testo piccolo in basso mostra "Applicato: <nota> <scala>" per qualche secondo, poi resta come stato corrente.
- Se la confidenza è molto bassa, la scala viene comunque applicata ma il messaggio lo segnala, così puoi riprovare con un tocco.

## 3. Nuovi strumenti (selezione consigliata)

Agli attuali sei (Reese, Acid, Growl, Violino, Fiati, Pads) si aggiungono strumenti calmi e "zen", tutti sintetizzati con lo stesso motore (nessun campione da scaricare, resta leggero e istantaneo):

- **Arpa di cristallo** — pizzicato brillante con decadimento lungo, ideale con l'arpeggiatore.
- **Pianoforte notturno** — timbro morbido tipo feltro, attacco dolce e coda lunga.
- **Kalimba** — piccolo pizzicato legnoso e percussivo, molto meditativo.
- **Campane tibetane / bowl** — timbro metallico non armonico, note lunghissime, perfetto per drone.
- **Glockenspiel / celesta** — cristallino e acuto, bello sopra i pads.
- **Coro etereo** — voci sintetiche con vibrato lento e riverbero, molto ambient.
- **Ambient pluck (elettronico)** — pluck digitale con delay ritmico, stile downtempo.
- **Warm sub pad** — basso morbido e continuo che sostiene senza aggressività.

Gli strumenti melodici partono all'ottava giusta; il sub pad viene trasposto in basso. Il pannello Suono raggruppa la lista in "Zen / Calmi" ed "Elettronici / Bass" per non diventare un elenco infinito, e resta compatibile con la Modalità doppia (Lato A / Lato B) e con l'arpeggiatore per lato.

## Dettagli tecnici

- `src/lib/keyDetect.ts`: garantire il rilascio del MediaStream su abort per evitare che il microfono resti attivo.
- `src/components/GestureSynth.tsx`: `runListening` diventa toggle (`toggleListen`), riuso dell'`AbortController` esistente; icona superiore con stato stop; messaggio "Applicato" temporaneo.
- `src/lib/synth.ts`: estendere `InstrumentId`, `INSTRUMENTS` (con campo gruppo), `INSTRUMENT_SHIFT` e la creazione voci con inviluppi/timbri dedicati (pluck con decay esponenziale, FM leggera per campane e kalimba, coro con detune multiplo).
- Nessuna modifica al backend, tutto client-side.
