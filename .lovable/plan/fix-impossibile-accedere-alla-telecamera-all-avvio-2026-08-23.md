# Fix "Impossibile accedere alla telecamera" all'avvio

## Cosa ho verificato nel codice

L'avvio della telecamera esiste in due punti separati e non protetti:

- `src/components/GestureSynth.tsx` (Night Sky) apre la camera in linea dentro `start()`.
- `src/hooks/useHandTracking.ts` + `src/core/tracking/provider.ts` (Seven Heavens) usano `openCamera()`.

In entrambi i casi ci sono tre problemi concreti che spiegano il blocco intermittente:

1. **Un solo messaggio per errori diversi.** Tutto (permesso negato, camera occupata, `video.play()` interrotto, download del modello di tracciamento dal CDN fallito) finisce nello stesso `catch` che scrive "Impossibile accedere alla fotocamera". Quindi a volte l'errore reale non è nemmeno la telecamera.
2. **Nessuna pulizia quando l'avvio fallisce a metà.** Se la camera si apre ma il passo successivo fallisce, lo stream resta aperto e non referenziato: il dispositivo rimane occupato e ogni tentativo successivo fallisce davvero, finché non si ricarica la pagina. Questo corrisponde esattamente al "si blocca".
3. **Nessuna protezione dal doppio avvio.** Toccare due volte "Inizia" (facile su mobile) lancia due richieste camera in parallelo; sui telefoni la seconda fallisce e spegne lo stato.

## Cosa farò

**Un unico avvio camera condiviso e robusto** (in `src/core/tracking/provider.ts`):

- richiesta con vincoli ideali e, se fallisce, ripiego automatico su una richiesta video semplice;
- se un passo qualsiasi fallisce, lo stream viene chiuso subito (niente camera rimasta occupata);
- `video.play()` interrotto non viene più trattato come errore fatale;
- piccolo ritardo + un secondo tentativo automatico quando il dispositivo risulta temporaneamente occupato.

**Messaggi chiari, in italiano, per l'utente** invece del messaggio unico:

- permesso negato → come riattivarlo dal browser;
- camera già in uso da un'altra app/scheda → chiudi l'altra app e riprova;
- nessuna camera trovata;
- caricamento del tracciamento fallito (rete/CDN) → riprova;
- avvio bloccato → pulsante **Riprova** sempre disponibile, senza ricaricare la pagina.

**Avvio più semplice e ottimizzato:**

- blocco anti doppio tap: se un avvio è già in corso, il secondo tocco viene ignorato;
- audio e camera avviati in parallelo invece che in sequenza (partenza più rapida);
- rilascio della camera quando si esce dalla pagina o l'app va in background, e riavvio pulito al ritorno;
- Night Sky usa lo stesso avvio condiviso di Seven Heavens, così un solo comportamento in tutta l'app.

## Dettagli tecnici

- `openCamera()` riscritta: fallback dei constraints, `try/catch` che chiama `stream.getTracks().forEach(t => t.stop())` su qualsiasi fallimento, gestione di `AbortError` da `play()`, mappatura di `NotAllowedError` / `NotReadableError` / `NotFoundError` / `OverconstrainedError` in codici d'errore tipizzati.
- Nuovo tipo `CameraError { code, message }` esportato dal core; hook e componenti mostrano `message`.
- `useHandTracking`: ref `startingRef` per l'anti-doppio-avvio, cleanup della camera nel `catch`, `stop()` idempotente, listener `visibilitychange` per rilasciare/riprendere.
- `GestureSynth.tsx`: rimozione del blocco `getUserMedia` + `HandLandmarker` inline e passaggio a `useHandTracking` (nessun cambiamento di grafica, audio o gesti); `Promise.all` per motore audio e camera.
- Nessuna modifica a design, layout, suoni, scale, preset o logica musicale.

## Verifica

Smoke test con browser headless su `/night` e `/studio`: avvio, doppio tap sul pulsante, negazione permesso simulata, e controllo che dopo un errore il pulsante "Riprova" riavvii correttamente senza reload.
