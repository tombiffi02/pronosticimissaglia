# BetMissaglia

PROMPT 01 — FONDAMENTA TECNICHE + SUPABASE

Voglio costruire una web app mobile-first privata per una prediction league dedicata alla Serie B Maschile di pallavolo.

Il progetto è descritto in questo prompt. In questa prima fase NON voglio che tu costruisca tutte le funzionalità dell'app e NON voglio ancora concentrarti sul design completo.

Il tuo obiettivo è creare una base tecnica solida, scalabile e sicura sulla quale costruiremo successivamente il resto dell'app.

1. CONCEPT

L'app è una prediction league privata.

Gli utenti possono pronosticare il risultato esatto delle partite di pallavolo del proprio girone.

Non esistono:

denaro reale

scommesse

quote

pagamenti

premi economici

È esclusivamente un gioco a punti tra utenti appartenenti a una lega privata.

La prima lega sarà relativa alla:

Serie B Maschile

stagione 2026/2027

girone configurabile

squadra di riferimento configurabile

2. STACK TECNOLOGICO

Utilizza:

Lovable per il frontend e la logica applicativa

Supabase come backend

PostgreSQL come database

Supabase Auth per autenticazione

Row Level Security (RLS) per la sicurezza

L'app deve essere progettata mobile-first, ma deve funzionare correttamente anche su desktop.

Non creare ancora un'app nativa iOS/Android.

L'obiettivo iniziale è una PWA/web app.

3. PRINCIPIO ARCHITETTURALE

Non collegare direttamente il frontend al sito FIPAV per recuperare i dati.

L'architettura futura dovrà essere:

FIPAV
↓
DATA SYNC / IMPORT SERVICE
↓
SUPABASE
↓
APP

Per questa prima fase crea solamente la struttura database necessaria a ricevere successivamente questi dati.

Il sistema deve poter funzionare anche con importazione manuale delle partite.

4. AUTENTICAZIONE

Utilizza Supabase Auth.

L'utente deve poter creare un account tramite email.

Per ora prevedi:

email

password

nome visualizzato

Non implementare ancora login social se non necessario.

Dopo la registrazione, crea automaticamente il relativo record nella tabella profiles.

5. TABELLA PROFILES

Crea una tabella:

profiles

Campi:

id UUID PRIMARY KEY

display_name TEXT NOT NULL

avatar_url TEXT NULL

created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()

updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()

Il campo id deve essere collegato a auth.users(id).

Quando un nuovo utente si registra, deve essere creato automaticamente il relativo profilo.

6. TABELLA LEAGUES

Crea:

leagues

Campi:

id UUID PRIMARY KEY

name TEXT NOT NULL

season TEXT NOT NULL

championship TEXT NOT NULL

group_name TEXT NULL

reference_team_id UUID NULL

invite_code TEXT UNIQUE NOT NULL

admin_id UUID NOT NULL

created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()

updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()

La lega rappresenta una competizione privata.

Esempio:

Cisano Prediction League

Serie B Maschile
2026/27

7. TABELLA LEAGUE_MEMBERS

Crea:

league_members

Campi:

id UUID PRIMARY KEY

league_id UUID NOT NULL

user_id UUID NOT NULL

role TEXT NOT NULL DEFAULT 'member'

joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()

Valori consentiti per role:

admin

member

Crea un vincolo UNIQUE su:

league_id + user_id

Un utente non deve poter essere aggiunto due volte alla stessa lega.

8. TABELLA TEAMS

Crea:

teams

Campi:

id UUID PRIMARY KEY

name TEXT NOT NULL

short_name TEXT NULL

group_name TEXT NULL

season TEXT NOT NULL

championship TEXT NOT NULL

logo_url TEXT NULL

external_id TEXT NULL

created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()

updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()

external_id servirà successivamente per collegare la squadra alla fonte dati esterna.

9. TABELLA MATCHES

Crea:

matches

Campi:

id UUID PRIMARY KEY

external_id TEXT NULL

league_id UUID NOT NULL

matchday INTEGER NOT NULL

match_date DATE NOT NULL

match_time TIME NULL

home_team_id UUID NOT NULL

away_team_id UUID NOT NULL

home_sets INTEGER NULL

away_sets INTEGER NULL

status TEXT NOT NULL DEFAULT 'upcoming'

source TEXT NULL

created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()

updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()

Valori consentiti per status:

upcoming

open

locked

finished

postponed

cancelled

Non permettere che una squadra giochi contro se stessa.

10. TABELLA LEAGUE_SETTINGS

Crea:

league_settings

Campi:

league_id UUID PRIMARY KEY

exact_score_points INTEGER NOT NULL DEFAULT 3

correct_winner_points INTEGER NOT NULL DEFAULT 1

wrong_winner_points INTEGER NOT NULL DEFAULT -2

lock_minutes_before INTEGER NOT NULL DEFAULT 30

notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE

updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()

Questi valori NON devono essere hard-coded nel frontend.

Devono essere recuperati dal database.

In futuro l'Admin potrà modificarli.

11. TABELLA PREDICTIONS

Predisponi anche la struttura:

predictions

Campi:

id UUID PRIMARY KEY

user_id UUID NOT NULL

match_id UUID NOT NULL

home_sets INTEGER NOT NULL

away_sets INTEGER NOT NULL

points INTEGER NULL

locked_at TIMESTAMP WITH TIME ZONE NULL

created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()

updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()

Crea un vincolo UNIQUE su:

user_id + match_id

Ogni utente può quindi avere un solo pronostico attivo per ogni partita.

12. VALIDAZIONE DEI PRONOSTICI

Il database deve impedire risultati non validi.

Sono consentiti esclusivamente:

3-0
3-1
3-2
0-3
1-3
2-3

Non sono validi:

2-2
1-1
0-0
3-3
4-0
4-1
ecc.

Implementa questa validazione anche a livello database, non soltanto nell'interfaccia.

13. PREDICTION HISTORY

Crea anche:

prediction_history

Campi:

id UUID PRIMARY KEY

prediction_id UUID NOT NULL

user_id UUID NOT NULL

match_id UUID NOT NULL

home_sets INTEGER NOT NULL

away_sets INTEGER NOT NULL

created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()

Questa tabella servirà a conservare lo storico delle modifiche al pronostico.

Lo storico non deve essere necessariamente mostrato nell'MVP.

14. RELAZIONI

Imposta correttamente le foreign key.

Relazioni principali:

profiles
→ auth.users

leagues
→ admin profile

league_members
→ leagues
→ profiles

leagues
→ reference team

matches
→ leagues
→ home team
→ away team

predictions
→ profiles
→ matches

prediction_history
→ predictions
→ profiles
→ matches

league_settings
→ leagues

Utilizza ON DELETE appropriati per evitare dati orfani.

15. ROW LEVEL SECURITY

Attiva RLS sulle tabelle.

Regole fondamentali:

Profiles

Ogni utente può:

leggere il proprio profilo

modificare il proprio profilo

Gli altri profili potranno essere resi visibili successivamente solo nelle informazioni necessarie alla classifica.

Leagues

Un utente può leggere una lega solamente se ne è membro.

Solo l'admin può modificare le impostazioni della propria lega.

League members

Un membro può vedere gli altri membri della propria lega.

Solo l'admin può:

aggiungere/rimuovere membri manualmente

modificare i ruoli

Teams

Le squadre possono essere lette dagli utenti appartenenti alla relativa lega.

Le modifiche devono essere riservate all'admin o al sistema di importazione.

Matches

I membri della lega possono leggere le partite della propria lega.

Solo admin/import service può modificarle.

League settings

I membri possono leggere le impostazioni della propria lega.

Solo l'admin può modificarle.

Predictions

Un utente può:

creare i propri pronostici

leggere i propri pronostici

modificare i propri pronostici

Non può modificare quelli degli altri utenti.

La sicurezza definitiva del lock temporale verrà implementata nella fase dedicata al sistema pronostici.

Prediction history

Un utente può leggere solamente il proprio storico.

Il sistema deve poter scrivere lo storico automaticamente.

16. ADMIN

Il ruolo admin deve essere associato all'utente attraverso league_members.role.

NON creare una semplice variabile frontend tipo:

isAdmin = true

Il controllo dei permessi deve avvenire anche lato database/RLS.

17. INVITE CODE

Ogni lega deve avere un codice di invito univoco.

Esempio:

CISANO26

Il sistema deve impedire duplicati.

In futuro l'utente potrà entrare nella lega inserendo questo codice.

Prevedi anche la possibilità futura di utilizzare un invite link.

18. DATABASE TRIGGERS

Crea i trigger necessari per:

creazione automatica del profilo dopo signup

aggiornamento automatico di updated_at

Utilizza funzioni PostgreSQL sicure.

Evita trigger inutili.

19. INDICI

Crea gli indici necessari per le query principali.

In particolare:

league_members(league_id)
league_members(user_id)
matches(league_id)
matches(matchday)
matches(match_date)
predictions(user_id)
predictions(match_id)
prediction_history(prediction_id)

Valuta anche indici composti dove utili.

20. SEED INIZIALE

Non inserire dati inventati sulle squadre o sulle partite reali.

Crea solamente, se utile, una struttura di test chiaramente identificata come demo/test.

NON usare squadre o risultati reali inventati.

21. FRONTEND IN QUESTA FASE

Crea solamente le schermate minime necessarie per verificare che il backend funzioni:

/login

Login

/register

Registrazione

/profile

Profilo utente minimale

/setup

Schermata temporanea per entrare in una lega tramite codice

/home

Placeholder minimale che mostri:

nome utente

nome lega

stato appartenenza

Non costruire ancora:

Home definitiva

classifica definitiva

statistiche

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://pronosticimissaglia.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/60c125c7-18c7-4dae-88d1-22c3238fdc1d).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
