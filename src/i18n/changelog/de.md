<!-- Versionshinweise auf Deutsch. -->
<!-- Released versions of CHANGELOG.md, translated at release time (ADR 0078). Keep the English
     headings and the same sections and bullet count; omit Internal. -->

## [2026.10.3] - 2026-10-12

### Added

- Ein ⋯-Menü in der oberen Leiste bündelt den Link zur Übung, „Über Guidonica“, Neuigkeiten, die Tastenkürzel, die Darstellung, GitHub, Datenschutz, die sozialen Netzwerke und Unterstützen (ADR 0097).
- Drücken Sie ? oder wählen Sie Tastenkürzel im ⋯-Menü, um alle Tastenkürzel zu sehen (ADR 0097).
- Chips in der oberen Leiste zeigen Schlüssel, Taktart und Bordunton; tippen Sie auf einen, um ihn zu ändern (ADR 0097).
- Stimmen Sie den Bordun auf a = 392 Hz für die französische Barockstimmung, unter Einstellungen → Klang (ADR 0094).
- Wenn der Stromsparmodus oder Energiesparmodus die Animation auf 30 Bilder pro Sekunde begrenzt, schlägt ein Hinweis vor, ihn für flüssiges Scrollen auszuschalten (ADR 0098).

### Changed

- Ein neues Layout gibt der Musik den ganzen Bildschirm: oben eine schmale Leiste, unten eine Leiste mit Start, Tempo, Schlägen und Stummschaltung, in Reichweite des Daumens. Die Einstellungen öffnen sich auf breiten Bildschirmen als Seitenleiste und auf kleineren als Blatt über dem Notensystem; Esc oder ein Tippen auf das Notensystem schließt das Blatt (ADR 0097).
- Auf quer gehaltenen Telefonen teilen sich die obere und die untere Leiste eine einzige Zeile am unteren Rand, sodass das Notensystem fast die ganze Höhe bekommt (ADR 0097).
- Während die Musik läuft, treten die obere Leiste und die Zoomknöpfe zurück, damit das Notensystem hervortritt; zeigen Sie mit der Maus darauf oder springen Sie mit Tab hin, um sie zurückzuholen (ADR 0097).
- Die Bestätigung „Link kopiert“ erscheint jetzt über dem Notensystem und verblasst nach einigen Sekunden (ADR 0097).
- Auf Telefonen öffnen sich „Über Guidonica“, Neuigkeiten und Tastenkürzel als Blätter vom unteren Bildschirmrand (ADR 0097).
- Die Einstellungen sind in fünf Reitern gruppiert: Notensystem, Rhythmus, Melodie, Klang und Anzeige. Klick, Lautstärke, Einzähler und Bordun stehen unter Klang; Sprache, Notennamen, Abspielposition, Tipps und Darstellung unter Anzeige (ADR 0097).

### Fixed

- Auf dem iPhone im Querformat sind die Beschriftungen der Einstellungsreiter nicht mehr abgeschnitten, bis Sie auf einen Reiter tippen (ADR 0099).
- Auf quer gehaltenen Telefonen wird die untere Leiste während der Wiedergabe nicht mehr zu einem harten grauen Block. Ihre Knöpfe blenden jetzt in einem weichen Verlauf aus, und das ⋯-Menü bleibt voll sichtbar (ADR 0099).
- Zweimal schnell Tippen auf einem Telefon zoomt die Seite nicht mehr (ADR 0100).

### Removed

- Die Fußzeile. Ihre Links und Tastenkürzel sind ins ⋯-Menü umgezogen (ADR 0097).

## [2026.10.2] - 2026-10-07

### Added

- Taktarten mit Halben als Schlag für Alte Musik. Der Schalter Halbe als Schlag unter Einstellungen → Notensystem und in der Begrüßung macht aus 4/4, 3/4, 2/4, 6/8, 9/8 und 12/8 die Taktarten 4/2, 3/2, 2/2 (alla breve), 6/4, 9/4 und 12/4, mit Klick auf jeder Halben, Breven und der Brevis-Pause (ADR 0090).
- Ein Bordun zum Dagegensingen: eine gehaltene Shruti-Box oder ein Pad auf jedem beliebigen Ton, mit eigener Lautstärke, unter Einstellungen → Übung. Stummschalten bringt auch ihn zum Schweigen, und er klingt schon im Einzähler, sodass Sie den Grundton vor der ersten Note hören. Links zu Übungen enthalten den Bordunton (ADR 0092).
- Zeichen für den Vierviertel- und den Alla-breve-Takt: Einstellungen → Notensystem kann 4/4 als C und 2/2 als ¢ schreiben (ADR 0093).
- Stimmen Sie den Bordun neben 440 auch auf a = 415, 430, 442 oder 466 Hz, für barocke, klassische oder Renaissance-Stimmung, unter Einstellungen → Übung. Links zu Übungen enthalten die Stimmung (ADR 0094).
- Mit D schalten Sie den Bordun ein und aus.

### Changed

- Die Einstellung Puls wirkt jetzt auch in Taktarten mit Halben als Schlag: Der Klick folgt dem Schlag oder jeder Unterteilung (ADR 0090).

### Fixed

- Die Noten laufen auf Bildschirmen mit hoher Bildwiederholrate und in Firefox flüssig, wo sie ruckeln konnten (ADR 0089).
- Das Scrollen stockt nicht mehr bei jedem Metronomklick oder wenn ein neuer Takt gezeichnet wird, auf Bildschirmen bis 144 Hz (ADR 0091).
- Guidonica startet mit den Standardeinstellungen, statt gar nicht zu starten, wenn Firefox oder Safari Website-Daten blockiert (ADR 0096).
- Auf breiten Bildschirmen öffnen sich die Einstellungen beim ersten Besuch jetzt neben dem Notensystem, egal wie schnell die Schriften laden (ADR 0096).
- Das Scrollen ist flüssig in Firefox mit aktivem Fingerprinting-Schutz sowie in Tor und Mullvad Browser (ADR 0096).

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
