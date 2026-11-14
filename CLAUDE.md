# Simple Score — note per Claude

- Il proprietario non è uno sviluppatore: spiegagli i passaggi in italiano, concreti, senza gergo.
- Codice web in `www/`: `index.html` (markup+CSS), `js/i18n.js` (testi in 14 lingue; nuova lingua = un dizionario con `_: {name, locale, dir}`; plurali con chiave.one/.few/.many; arabo da destra a sinistra), `js/native.js` (ponte con Android: schermo acceso, vibrazione, acquisti), `js/app.js` (tutto il resto).
- Dopo ogni modifica a `www/` va eseguito `npx cap sync android`.
- Identificativo `it.simpleapps.score`, prodotto in-app `score_pro`, sviluppatore "Simple Apps". Non cambiarli dopo il primo caricamento su Google Play.
- NON cambiare mai le chiavi di salvataggio `sc.current`, `sc.games`, `sc.players`, `sc.settings`, `sc.pro`.
- Regole dei giochi in `app.js`: `handValues` (punti di una mano dal dettaglio inserito), `standings` (totali, eliminati e rientri di Scala 40, ricalcolati sempre da tutte le mani, così correggere una mano vecchia aggiorna tutto), `winners` (fine partita). Fonti delle regole in `claude/idea-score.md`.
- Gratis: Libero (fino a 6 giocatori), Scopa, ultime 5 partite nello storico. Pro: Burraco, Scala 40, fino a 12 giocatori, storico completo e statistiche, dadi, colori.
- Prova rapida: servi `www/` (`npm run serve`) e usa Playwright; in pagina c'è `window.__score` con `handValues`, `standings`, `ranking`, `winners`.
- GitHub Actions compila un APK di prova a ogni push su `main` e per ogni Pull Request.
- Finché il repository si chiama `scorta-02` si lavora su `main`. Dopo la rinomina in `Simple-Score`: ramo `notturno` + Pull Request "Lavori notturni".
- Stato e decisioni: documento `claude/simple-score-stato.md` nel Progetto "App".
