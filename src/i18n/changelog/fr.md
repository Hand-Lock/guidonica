<!-- Notes de version en français. -->
<!-- Released versions of CHANGELOG.md, translated at release time (ADR 0078). Keep the English
     headings and the same sections and bullet count; omit Internal. -->

## [2026.10.1] - 2026-10-06

### Added

- « À propos » et le bas de page mènent à Guidonica sur Bluesky et Mastodon (ADR 0082).
- « À propos » et le bas de page mènent aussi à Guidonica sur Instagram, où vous pouvez regarder la bande-annonce (ADR 0084).
- Envoyez un exercice sous forme de lien : Réglages → Pratique → Lien vers l'exercice copie un lien avec votre clé, votre mesure, votre tempo, vos valeurs de notes et vos notes, et la personne qui l'ouvre travaille avec les mêmes réglages (ADR 0085).
- Guidonica a une adresse dans chaque langue : guidonica.it/it/, /fr/, /de/ et /es/ s'ouvrent en italien, en français, en allemand et en espagnol, pour que les recherches dans ces langues la trouvent (ADR 0086).
- À l'ouverture de Guidonica, une courte astuce signale des fonctions que vous avez peut-être manquées, comme les niveaux prédéfinis, les noms des notes et les liens d'exercice, et de temps en temps nos réseaux sociaux et Ko-fi. Désactivez les astuces dans Réglages → Pratique → Astuces. (ADR 0087)
- Une politique de confidentialité, en anglais et en italien, accessible depuis « À propos » et le bas de page (ADR 0088).

### Changed

- La ligne sur la confidentialité dans « À propos » indique désormais que vos réglages restent sur votre appareil. Visiter le site contacte tout de même son hébergeur, GitHub Pages, comme l'explique la politique de confidentialité (ADR 0088).

### Fixed

- Dans Instagram, Facebook et Threads, qui ne pivotent pas, l'astuce sur le mode paysage explique désormais comment ouvrir Guidonica dans votre navigateur (ADR 0083).
- Les boutons Nouveautés et À propos ne débordent plus de la fenêtre sur les téléphones étroits : les libellés longs passent à la ligne.

## [2026.10.0] - 2026-10-05

### Added

- Travaillez le 9/8 et le 12/8 : mesures composées ternaires et quaternaires, avec le même choix de pulsation qu'en 6/8 (ADR 0076).
- Choisissez les notes à lire : chaque note s'active ou se désactive dans les Réglages, et le niveau Débutant commence avec quelques notes seulement (ADR 0070).
- L'accueil demande désormais aussi la mesure, après le niveau et la clé (ADR 0071).
- Guidonica fonctionne hors ligne : après une visite, l'application s'ouvre et joue sans connexion (ADR 0063).
- Nouveautés : après une mise à jour, Guidonica liste ce qui a changé depuis votre dernière visite. « À propos » affiche la version et la liste complète (ADR 0078).
- Un lien Ko-fi dans « À propos » et en bas de page, pour des pourboires volontaires (ADR 0074).
- « À propos » explique la fabrication de Guidonica, y compris l'assistant de programmation IA utilisé pour l'écrire (ADR 0075).

### Changed

- Les voyants de temps et le clic ont désormais trois niveaux d'accent : le premier temps, la pulsation centrale de la mesure (3ᵉ temps en 4/4, 4ᵉ en 6/8) et les autres temps (ADR 0072).
- Les niveaux progressent plus régulièrement en tempo, en intervalles et en valeurs de notes (ADR 0070).
- Le bouton de niveau affiche un haltère, pour ne plus ressembler à un indicateur de réseau (ADR 0073).
- Les rythmes viennent d'un nouveau générateur : toute figure possible dans une mesure peut désormais apparaître, et les silences sont écrits comme le ferait un copiste (ADRs 0064, 0065).
- Les silences peuvent occuper des temps entiers et des mesures entières, et les n-olets peuvent mêler des valeurs, comme une noire et une croche sous un crochet de triolet (ADRs 0065, 0066).
- Les mélodies faites uniquement de sauts, comme des tierces ou des quintes, atteignent désormais toutes les notes de l'ambitus (ADR 0066).

## [1.0.0] - 2026-10-03

### Added

- Première version publique.
