# Simple Score — note per Claude

- Il proprietario non è uno sviluppatore: spiegagli i passaggi in italiano, concreti, senza gergo.
- Codice web in `www/`: `index.html` (markup+CSS), `js/i18n.js` (testi in 14 lingue; nuova lingua = un dizionario con `_: {name, locale, dir}`; plurali con chiave.one/.few/.many; arabo da destra a sinistra), `js/native.js` (ponte con Android: schermo acceso, vibrazione, salvataggio/condivisione file, acquisti), `js/app.js` (tutto il resto).
- Dopo ogni modifica a `www/` va eseguito `npx cap sync android`. Dopo ogni modifica ai testi: `npm run check` (controlla che le 14 lingue abbiano gli stessi testi, segnaposto e plurali).
- Nuova versione: `version` in `package.json` (e `package-lock.json`), `versionCode`+1 e `versionName` in `android/app/build.gradle`, `VERSION` in `www/js/app.js`, `CACHE` in `www/sw.js`.
- Identificativo `it.simpleapps.score`, prodotto in-app `score_pro`, sviluppatore "Simple Apps". Non cambiarli dopo il primo caricamento su Google Play.
- NON cambiare mai le chiavi di salvataggio `sc.current`, `sc.games`, `sc.players`, `sc.settings`, `sc.pro`.
- Regole dei giochi in `app.js`: `handValues` (punti di una mano dal dettaglio inserito), `standings` (totali, eliminati con la mano in cui sono usciti, rientri di Scala 40, ricalcolati sempre da tutte le mani), `recompute` (Scala 40: ricalcola i punti di tutte le mani dopo ogni correzione, eliminazione o Annulla, perché dipendono da chi era già fuori), `ranking`/`positions` (classifica; a pari punti stessa posizione), `winners` (fine partita; a pari punti in testa si continua), `dealerOf` (mazziere: gira tra chi era in gioco mano per mano). Partita con `hold` = fine annullata dall'utente: non si richiude da sola finché le mani non cambiano. Fonti delle regole in `claude/idea-score.md`.
- Gratis: Libero (fino a 6 giocatori), Scopa, ultime 5 partite nello storico (le altre sono nascoste, non cancellate), backup/ripristino. Pro: Burraco, Scala 40, fino a 12 giocatori, storico completo e statistiche, esportazione CSV, dadi, colori.
- Dati (Impostazioni → I tuoi dati): CSV con una riga per mano (UTF-8 con BOM, ";" nelle lingue con virgola decimale); backup JSON `{app:'simple-score', version:1, games, current, players, settings}` senza il Pro; il ripristino controlla il file (`parseBackup`), chiede conferma e sostituisce i dati, con Annulla.
- Prova rapida: servi `www/` (`npm run serve`) e usa Playwright; in pagina c'è `window.__score` con `handValues`, `standings`, `ranking`, `positions`, `winners`, `dealerOf`, `recompute`, `buildCSV`, `buildBackup`, `parseBackup`.
- GitHub Actions compila un APK di prova a ogni push su `main` e per ogni Pull Request.
- Finché il repository si chiama `scorta-02` si lavora su `main`. Dopo la rinomina in `Simple-Score`: ramo `notturno` + Pull Request "Lavori notturni".
- Stato e decisioni: documento `claude/simple-score-stato.md` nel Progetto "App".
