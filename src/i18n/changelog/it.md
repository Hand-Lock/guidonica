<!-- Note di versione in italiano. -->
<!-- Released versions of CHANGELOG.md, translated at release time (ADR 0078). Keep the English
     headings and the same sections and bullet count; omit Internal. -->

## [2026.10.1] - 2026-10-06

### Added

- «Informazioni» e il piè di pagina portano a Guidonica su Bluesky e Mastodon (ADR 0082).
- «Informazioni» e il piè di pagina portano anche a Guidonica su Instagram, dove puoi guardare il trailer (ADR 0084).
- Invia un esercizio come link: Impostazioni → Esercizio → Link all'esercizio copia un link con chiave, metro, tempo, valori e note, e chi lo apre si esercita con le stesse impostazioni (ADR 0085).
- Guidonica ha un indirizzo per ogni lingua: guidonica.it/it/, /fr/, /de/ ed /es/ si aprono in italiano, francese, tedesco e spagnolo, così le ricerche in queste lingue la trovano (ADR 0086).
- Quando apri Guidonica, un breve suggerimento indica funzioni che potresti non aver notato, come i livelli predefiniti, i nomi delle note e i link agli esercizi, e ogni tanto le nostre pagine social e Ko-fi. Disattiva i suggerimenti in Impostazioni → Esercizio → Suggerimenti. (ADR 0087)
- Un'informativa sulla privacy, in inglese e in italiano, raggiungibile da «Informazioni» e dal piè di pagina (ADR 0088).

### Changed

- La riga sulla privacy in «Informazioni» ora dice che le tue impostazioni restano sul tuo dispositivo. Visitare il sito comporta comunque una richiesta al suo host, GitHub Pages, come spiega l'informativa sulla privacy (ADR 0088).

### Fixed

- In Instagram, Facebook e Threads, che non ruotano, il suggerimento sull'orizzontale ora spiega come aprire Guidonica nel browser (ADR 0083).
- I pulsanti Novità e Informazioni non escono più dalla finestra sui telefoni stretti: le etichette lunghe vanno a capo.

## [2026.10.0] - 2026-10-05

### Added

- Esercitati in 9/8 e 12/8: tempi composti ternari e quaternari, con la stessa scelta della pulsazione del 6/8 (ADR 0076).
- Scegli quali note leggere: ogni nota si può attivare o disattivare nelle Impostazioni, e il livello Principiante parte con poche note (ADR 0070).
- I passaggi di benvenuto ora chiedono anche il metro, dopo il livello e la chiave (ADR 0071).
- Guidonica funziona offline: dopo una visita si apre e suona anche senza connessione (ADR 0063).
- Novità: dopo un aggiornamento, Guidonica elenca che cosa è cambiato dalla tua ultima visita. «Informazioni» mostra la versione e l'elenco completo (ADR 0078).
- Un link a Ko-fi in «Informazioni» e a piè di pagina, per mance volontarie (ADR 0074).
- «Informazioni» spiega come nasce Guidonica, compreso l'assistente di programmazione IA usato per scriverla (ADR 0075).

### Changed

- Le luci dei tempi e il clic hanno ora tre livelli di accento: il primo tempo, la pulsazione centrale della battuta (il 3° tempo del 4/4, il 4° del 6/8) e gli altri tempi (ADR 0072).
- I livelli progrediscono in modo più graduale in velocità, intervalli e valori delle note (ADR 0070).
- Il pulsante del livello mostra un manubrio, così non sembra più un indicatore di segnale (ADR 0073).
- I ritmi nascono da un nuovo generatore: ogni figura che può stare in una battuta ora può davvero comparire, e le pause sono scritte come le scriverebbe un copista (ADRs 0064, 0065).
- Le pause possono occupare tempi interi e battute intere, e i gruppi irregolari possono mescolare valori diversi, come una semiminima e una croma sotto una terzina (ADRs 0065, 0066).
- Le melodie fatte solo di salti, come terze o quinte, ora raggiungono ogni nota dell'estensione (ADR 0066).

## [1.0.0] - 2026-10-03

### Added

- Prima versione pubblica.
