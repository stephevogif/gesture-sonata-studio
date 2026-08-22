# Particelle più brevi + stile "carta celeste"

## 1. Particelle
- Dimensioni ridotte circa alla metà (sia le scintille del tocco che quelle emesse dalle mani).
- Vita molto più corta: durata iniziale ridotta e decadimento più rapido, così scompaiono in una frazione di secondo lasciando solo una scia leggera.
- Lo spread resta ampio: sciami fitti di puntini minuscoli che si spengono subito, invece di scie lunghe.

## 2. Stile dell'app come l'immagine
Direzione visiva: mappa astronomica vintage, blu notte profondo con oro antico.

- Palette: sfondo blu navy scuro, superfici leggermente più chiare, accento oro/ottone, testo crema.
- Tipografia: titolo in serif elegante (già Fraunces) con maiuscoletto spaziato; etichette piccole, spaziate, in tono "cartografico".
- Cornice decorativa sottile in oro attorno allo schermo live e ai pannelli, con angoli a doppia linea come nella stampa.
- Pannelli e barra icone: superfici scure trasparenti, bordi oro sottili, angoli meno arrotondati per un look da stampa antica.
- Pulsanti: contorno oro, riempimento oro solo per lo stato attivo.
- Sfondo pagina: campo stellato tenue oro/bianco già presente, con cerchi orbitali sottili in oro come filigrana dietro l'interfaccia.
- Le particelle e i bagliori del tocco passano da arcobaleno psichedelico a una gamma oro/ambra con leggere variazioni, coerente con la stampa (mantenendo un tocco di brillantezza).

## Note tecniche
- `src/styles.css`: nuovi token colore oklch (navy, oro, crema), utility per la cornice dorata e i bordi dei pannelli.
- `src/components/GestureSynth.tsx`: parametri particelle (size, life, decay), palette hue dei glow, classi UI aggiornate.
- Nessuna modifica al motore audio (`src/lib/synth.ts`) né alla logica di tracciamento.
