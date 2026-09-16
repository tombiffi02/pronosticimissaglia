# Roadmap

## Fase 2 — Campionato, squadre, giornate, partite
- [ ] Migrazione: tabella matchdays, matches.matchday_id, unique external_id, validazione risultati, helper is_reference_team_match, RLS teams admin
- [ ] Pagina /matches (calendario per giornata, "la nostra partita")
- [ ] Admin: campionato, squadre, giornate, partite (+ import CSV base)
- [ ] Home: campionato, prossima giornata, nostra partita
- [ ] Navigazione Home / Partite / Admin / Profilo

## Fase 3 — Prediction engine
- [ ] RPC upsert_prediction con lock server-side (league_settings.lock_minutes_before), blocco partita squadra di riferimento, risultati validi
- [ ] RLS predictions: no modifiche dopo lock, no points/locked_at dal client, storico immutabile
- [ ] UI: schermata pronostico (6 pulsanti), countdown, stato bloccato, storico
- [ ] Home con partite giornata corrente + pronostico utente (query unica)
- [ ] Test scenari A-E
