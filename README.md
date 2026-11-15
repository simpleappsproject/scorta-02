# Simple Score

App Android di **Simple Apps**: segnapunti per giochi di carte e da tavolo, con i giochi italiani già pronti.

- **Libero** (qualsiasi gioco, obiettivo opzionale, "vince chi ha meno" per i giochi a penalità), **Scopa** (carte, denari, settebello, primiera, scope) e **Briscola** (si scrivono i punti di uno, l'altro si calcola da solo; mani vinte e punti, 60 a 60 pari, secca, 2 su 3 o 3 su 5; in 2, in 3 o a coppie) gratis.
- **Burraco** (puliti/sporchi, carte in tavola e in mano, chiusura, pozzetto) e **Scala 40** (penalità, eliminazione a 101/151/201, rientro e raddoppio facoltativi) con **Simple Score Pro** (acquisto unico).
- Tabellone grande, mazziere che gira da solo, correzione di qualsiasi mano, grafico dell'andamento, rivincita, storico.
- Salvataggio automatico dopo ogni mano: chiudendo l'app non si perde nulla. Schermo sempre acceso durante la partita.
- Backup su file di tutti i dati e ripristino (anche su un altro telefono); con Pro, storico in CSV per Excel o Fogli Google (una riga per mano).
- Offline, nessun account, nessuna pubblicità. Tema chiaro/scuro, 14 lingue.

## Come provarla
- **Nel browser del computer:** scarica il repository e apri `www/index.html` (oppure `npm run serve` e vai su http://localhost:8766).
- **Sul telefono Android:** pagina **Actions** del repository → ultima esecuzione "Android" → in fondo, **Artifacts** → `simple-score-…-apk-prova`, estrai lo zip e installa l'APK.

## Controlli
- `npm run check`: verifica che tutte le lingue abbiano gli stessi testi dell'italiano.

## Identità
| Cosa | Valore |
|---|---|
| Identificativo | `it.simpleapps.score` |
| Prodotto in-app | `score_pro` |
| Sviluppatore | Simple Apps |

Scheda dell'app e regole dei giochi con le fonti: documento `claude/idea-score.md` nel Progetto "App".
