# Roadmap

## Fase 2 — Campionato, squadre, giornate, partite

- [x] Migrazione: tabella matchdays, matches.matchday_id, unique external_id, validazione risultati, helper is_reference_team_match, RLS teams admin
- [x] Pagina /matches (calendario per giornata, "la nostra partita")
- [x] Admin: campionato, squadre, giornate, partite (+ import CSV base)
- [x] Home: campionato, prossima giornata, nostra partita
- [x] Navigazione Home / Partite / Admin / Profilo

## Fase 3 — Prediction engine

- [x] RPC submit_prediction con lock server-side (league_settings.lock_minutes_before), blocco partita squadra di riferimento, risultati validi
- [x] RLS predictions: no scrittura diretta dal client, storico immutabile
- [x] UI: schermata pronostico (6 pulsanti), countdown, stato bloccato, storico
- [x] Home con partite giornata corrente + pronostico utente (query unica match_board)
- [x] Test scenari A-E su dati demo temporanei (rollback)

## Fase 4 (da fare)

- [ ] Calcolo punti, classifica, statistiche, notifiche

## Fase 4A — Importazione calendario FIPAV

- [x] Sorgente JSON ufficiale FIPAV (calendario per stagione/serie/genere/girone)
- [x] Server function syncFipavCalendar (solo admin lega, verifica lato DB)
- [x] Upsert squadre/giornate/partite idempotente, campi manuali protetti
- [x] Sezione Admin "Calendario FIPAV" con riepilogo e log sincronizzazioni
- [x] Import CSV mantenuto come fallback
- [x] Test: prima e seconda importazione, aggiornamento orario, risultato manuale preservato, 0 duplicati
