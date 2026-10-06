<!-- Versionshinweise auf Deutsch. -->
<!-- Released versions of CHANGELOG.md, translated at release time (ADR 0078). Keep the English
     headings and the same sections and bullet count; omit Internal. -->

## [2026.10.1] - 2026-10-06

### Added

- „Über Guidonica“ und die Fußzeile verlinken Guidonica auf Bluesky und Mastodon (ADR 0082).
- „Über Guidonica“ und die Fußzeile verlinken Guidonica auch auf Instagram, wo Sie den Trailer ansehen können (ADR 0084).
- Senden Sie eine Übung als Link: Einstellungen → Übung → Link zur Übung kopiert einen Link mit Schlüssel, Taktart, Tempo, Notenwerten und Tönen, und wer ihn öffnet, übt mit denselben Einstellungen (ADR 0085).
- Guidonica hat eine Adresse für jede Sprache: guidonica.it/it/, /fr/, /de/ und /es/ öffnen sich auf Italienisch, Französisch, Deutsch und Spanisch, damit Suchen in diesen Sprachen es finden (ADR 0086).
- Beim Öffnen von Guidonica weist ein kurzer Tipp auf Funktionen hin, die Sie vielleicht übersehen haben, etwa Niveau-Voreinstellungen, Notennamen und Links zu Übungen, und ab und zu auf unsere Social-Media-Seiten und Ko-fi. Tipps lassen sich unter Einstellungen → Übung → Tipps ausschalten. (ADR 0087)
- Eine Datenschutzerklärung auf Englisch und Italienisch, verlinkt in „Über Guidonica“ und in der Fußzeile (ADR 0088).

### Changed

- Der Datenschutzhinweis in „Über Guidonica“ sagt jetzt, dass Ihre Einstellungen auf Ihrem Gerät bleiben. Der Besuch der Website erreicht dennoch deren Host, GitHub Pages, wie die Datenschutzerklärung erklärt (ADR 0088).

### Fixed

- In Instagram, Facebook und Threads, die sich nicht drehen lassen, erklärt der Querformat-Hinweis jetzt, wie Sie Guidonica im Browser öffnen (ADR 0083).
- Die Schaltflächen Neuigkeiten und Über Guidonica ragen auf schmalen Handys nicht mehr aus dem Dialog; lange Beschriftungen brechen um.

## [2026.10.0] - 2026-10-05

### Added

- Üben Sie 9/8 und 12/8: zusammengesetzte Dreier- und Vierertakte, mit derselben Wahl des Grundschlags wie im 6/8-Takt (ADR 0076).
- Wählen Sie, welche Töne Sie lesen: Jeder Ton lässt sich in den Einstellungen ein- und ausschalten, und das Niveau Anfänger beginnt mit nur wenigen Tönen (ADR 0070).
- Die Begrüßung fragt jetzt im Anschluss an Niveau und Schlüssel auch nach der Taktart (ADR 0071).
- Guidonica funktioniert offline: Nach einem Besuch öffnet und spielt es auch ohne Verbindung (ADR 0063).
- Neuigkeiten: Nach einem Update zeigt Guidonica, was sich seit Ihrem letzten Besuch geändert hat. „Über Guidonica“ zeigt die Version und die vollständige Liste (ADR 0078).
- Ein Ko-fi-Link in „Über Guidonica“ und in der Fußzeile, für freiwillige Trinkgelder (ADR 0074).
- „Über Guidonica“ erklärt, wie Guidonica entsteht, einschließlich des KI-Programmierassistenten, mit dem es geschrieben wird (ADR 0075).

### Changed

- Die Taktleuchten und der Klick haben jetzt drei Akzentstufen: die Eins, den mittleren Schlag des Takts (Schlag 3 im 4/4-, Schlag 4 im 6/8-Takt) und die übrigen Schläge (ADR 0072).
- Die Niveaus steigern sich gleichmäßiger in Tempo, Intervallen und Notenwerten (ADR 0070).
- Die Niveau-Schaltfläche zeigt eine Hantel und sieht so nicht mehr wie eine Signalstärkeanzeige aus (ADR 0073).
- Die Rhythmen stammen aus einem neuen Generator: Jede Figur, die in einem Takt stehen kann, kommt jetzt auch vor, und Pausen werden so notiert, wie ein Kopist sie schreiben würde (ADRs 0064, 0065).
- Pausen können ganze Schläge und ganze Takte füllen, und N-tolen können Notenwerte mischen, etwa eine Viertel und eine Achtel unter einer Triolenklammer (ADRs 0065, 0066).
- Melodien nur aus Sprüngen, etwa Terzen oder Quinten, erreichen jetzt jeden Ton des Tonumfangs (ADR 0066).

## [1.0.0] - 2026-10-03

### Added

- Erste öffentliche Version.
