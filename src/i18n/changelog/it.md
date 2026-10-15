<!-- Note di versione in italiano. -->
<!-- Released versions of CHANGELOG.md, translated at release time (ADR 0078). Keep the English
     headings and the same sections and bullet count; omit Internal. -->

## [2026.10.4] - 2026-10-15

### Added

- «Informazioni», il menu ⋯ e il suggerimento per seguirci portano a Guidonica su TikTok, dove puoi guardare il trailer (ADR 0101).
- «Informazioni», il menu ⋯ e il suggerimento per seguirci portano a Guidonica su YouTube, dove il trailer è disponibile come video e come Short (ADR 0102).

## [2026.10.3] - 2026-10-12

### Added

- Un menu ⋯ nella barra in alto raccoglie il link all'esercizio, «Informazioni», Novità, le scorciatoie da tastiera, il tema, GitHub, la Privacy, i social e Sostieni (ADR 0097).
- Premi ? o scegli Scorciatoie da tastiera nel menu ⋯ per vedere tutte le scorciatoie (ADR 0097).
- Le etichette nella barra in alto mostrano la chiave, il metro e la nota del bordone; toccane una per cambiarla (ADR 0097).
- Accorda il bordone con il La a 392 Hz per il diapason barocco francese, in Impostazioni → Suono (ADR 0094).
- Quando il Risparmio energetico o il risparmio batteria limita l'animazione a 30 fotogrammi al secondo, un avviso ti suggerisce di disattivarlo per uno scorrimento fluido (ADR 0098).

### Changed

- Un nuovo layout dà alla musica tutto lo schermo: una barra sottile in alto, e Avvia, tempo, pulsazioni e muto in una barra in basso, a portata di pollice. Le Impostazioni si aprono come pannello laterale sugli schermi larghi e come foglio sopra il pentagramma su quelli più piccoli; Esc o un tocco sul pentagramma chiude il foglio (ADR 0097).
- Sui telefoni tenuti in orizzontale, la barra in alto e quella in basso condividono un'unica riga in fondo, così il pentagramma ha quasi tutta l'altezza (ADR 0097).
- Mentre la musica suona, la barra in alto e i pulsanti dello zoom si attenuano perché il pentagramma risalti; punta il mouse o spostati con Tab su di essi per farli riapparire (ADR 0097).
- La conferma «Link copiato» ora compare sopra il pentagramma e svanisce dopo qualche secondo (ADR 0097).
- Sui telefoni, «Informazioni», Novità e Scorciatoie da tastiera si aprono come fogli dal basso dello schermo (ADR 0097).
- Le impostazioni sono raggruppate in cinque schede: Pentagramma, Ritmo, Melodia, Suono e Aspetto. Clic, volume, preconteggio e bordone sono in Suono; lingua, nomi delle note, testina, suggerimenti e tema in Aspetto (ADR 0097).

### Fixed

- Su iPhone in orizzontale, le etichette delle schede delle impostazioni non sono più tagliate finché non tocchi una scheda (ADR 0099).
- Sui telefoni tenuti in orizzontale, la barra in basso non diventa più un blocco grigio pieno mentre la musica suona. I suoi pulsanti ora sfumano in un gradiente morbido, e il menu ⋯ resta pienamente visibile (ADR 0099).
- Due tocchi rapidi su un telefono non ingrandiscono più la pagina (ADR 0100).

### Removed

- Il piè di pagina. I suoi link e le sue scorciatoie sono passati nel menu ⋯ (ADR 0097).

## [2026.10.2] - 2026-10-07

### Added

- Tempi in minime per la musica antica. L'interruttore Movimento di minima in Impostazioni → Pentagramma e nei passaggi di benvenuto trasforma 4/4, 3/4, 2/4, 6/8, 9/8 e 12/8 in 4/2, 3/2, 2/2 (alla breve), 6/4, 9/4 e 12/4, con il clic sulla minima, le brevi e la pausa di breve (ADR 0090).
- Un bordone su cui cantare: una shruti box o un pad tenuti su qualsiasi nota, con un volume proprio, in Impostazioni → Esercizio. Anche il muto lo silenzia, e suona già durante il preconteggio, così senti la tonica prima della prima nota. I link agli esercizi includono la nota del bordone (ADR 0092).
- Segni del tempo ordinario e dell'alla breve: Impostazioni → Pentagramma può scrivere 4/4 come C e 2/2 come ¢ (ADR 0093).
- Accorda il bordone con il La a 415, 430, 442 o 466 Hz oltre che a 440, per il diapason barocco, classico o rinascimentale, in Impostazioni → Esercizio. I link agli esercizi lo includono (ADR 0094).
- Premi D per accendere e spegnere il bordone.

### Changed

- L'impostazione Pulsazione ora vale anche nei tempi in minime: il clic segue il movimento o ogni suddivisione (ADR 0090).

### Fixed

- La notazione scorre fluida sugli schermi ad alta frequenza di aggiornamento e in Firefox, dove poteva scattare (ADR 0089).
- Lo scorrimento non si inceppa più a ogni clic del metronomo né quando viene disegnata una nuova battuta, sugli schermi fino a 144 Hz (ADR 0091).
- Guidonica si apre con le impostazioni predefinite invece di non avviarsi quando Firefox o Safari bloccano i dati dei siti (ADR 0096).
- Su uno schermo largo, le Impostazioni ora si aprono accanto al pentagramma alla prima visita, per quanto veloci si carichino i font (ADR 0096).
- Lo scorrimento è fluido in Firefox con la protezione dal fingerprinting attiva, e in Tor e Mullvad Browser (ADR 0096).

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
