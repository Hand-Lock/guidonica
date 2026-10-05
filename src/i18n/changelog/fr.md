<!-- Notes de version en français. -->
<!-- Released versions of CHANGELOG.md, translated at release time (ADR 0078). Keep the English
     headings and the same sections and bullet count; omit Internal. -->

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
