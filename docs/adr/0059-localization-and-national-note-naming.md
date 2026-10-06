# 0059. Localization (en · it · fr · de · es) & National Note Naming

- **Status**: Accepted; amended by [0086](0086-language-landing-pages.md)
- **Date**: 2026-10-03
- **Author**: Claude & A. C. Lo Cascio
- **Amends**: [0015](0015-italian-solfege-and-cross-platform-auto-night-mode.md) (label modes), [0044](0044-user-selectable-ledger-lines.md) (range hint text), [0049](0049-level-presets-onboarding-intro.md) (preset names, intro language step)

## Context & Problem Statement

Guidonica was English-only. The UI text was spread across three places:

- static English in `index.html`;
- a few dozen strings in `main.ts`;
- preset names and descriptions in `presets.ts`, plus the range hint in `generator.ts`.

Note labels offered two hard-coded syllable sets ('solfege' with Ti, 'italian' with Si) and English letters. Both were independent of any notion of language.

The project needed four things:

- support Italian, French, German and Spanish, with room for more;
- let the user pick a language at onboarding and change it later;
- have the language drive the national note-naming conventions, not only the UI text;
- stay dependency-free, within the suckless budget (app JS was 23.9 kB gz).

## Decisions & Implementation Methods

### 1. Typed dictionaries, English as reference (`src/i18n/locales/*.ts`)

- `en.ts` is the reference and the fallback, and `type Messages = typeof en`. Every other locale is declared `const it: Messages = {…}`, so a missing, extra or mistyped key is a **compile error**.
- Keys are flat camelCase. Interpolated messages are plain functions, e.g. `zoomAuto: (pct) => …` and `tupletCell(name, notes, values, inTimeOf)`.
- There is no ICU and no library. `t()` returns the active dictionary object, so a lookup is a property read.

### 2. Lazy locale chunks (`src/i18n/index.ts`)

`en` is bundled. The other four sit behind an explicit `import()` map (`LOADERS`), so Vite emits one ~3.6 kB gz chunk per language, and a visitor downloads at most one of them.

`loadLocale(lang)` uses a request token: a superseded call resolves `false`, so quick switches never end on a stale locale. A failed chunk rejects, and the caller keeps the active language.

### 3. `index.html` stays the English pre-JS shell

Translatable nodes carry these attributes:

- `data-i18n` (text);
- `data-i18n-html` (three About paragraphs with markup, from bundled dictionaries only);
- `data-i18n-title`, `data-i18n-aria-label` and `data-i18n-placeholder`.

`applyDom(root)` walks them. For elements that also hold icons or `<kbd>`, it replaces only the last non-blank text node. On a `Document` it also sets `<html lang>` and `document.title`.

`tests/i18n.test.ts` asserts that every HTML text and attribute equals `en`, so the shell and the dictionary cannot drift.

Labels with live state are written by their updaters and not by attributes. These are:

- the play label;
- the level button;
- the theme and fullscreen buttons;
- the zoom pill;
- the tuplet row headers and cell titles;
- the range hint;
- the intro title and Skip button.

### 4. No English flash, no timers

The inline head script already reads stored settings for the theme. It now also resolves the language: the stored `language`, else the first `navigator.languages` primary subtag that is supported, else `en`.

It sets `<html lang>`. For a language other than English, it also sets `data-i18n-pending`, and `html[data-i18n-pending] body { visibility: hidden }` hides the page.

`bootstrap()` then works like this:

1. It awaits `loadLocale(settings.language)`.
2. It runs `applyDom(document)` and builds the app.
3. It clears the flag in a `finally` block. If the chunk failed to load, the English shell is shown.

### 5. Language-driven note labels

`SolfegeLabelMode` is now `'none' | 'syllables' | 'letters'`. Each locale supplies the spelling as data (`noteNames`, indexed c d e f g a b):

| | Syllables (fixed Do) | Letters |
|---|---|---|
| en | Do Re Mi Fa Sol La **Ti** (tonic sol-fa spelling, as before) | C D E F G A B |
| it, es | Do Re Mi Fa Sol La **Si** | C D E F G A B |
| fr | Do **Ré** Mi Fa Sol La Si | C D E F G A B |
| de | Do Re Mi Fa **So** La **Ti** (Tonika-Do spelling) | C D E F G A **H** |

- The generator has no accidentals, so German H vs B is never ambiguous.
- The renderer stays i18n-agnostic: `renderMeasure(data, theme, labels: readonly string[] | null)`. The ring buffer and the intro previews pass `noteLabels(mode)`. A language change re-renders the buffered measures through the existing `rerender` path, without regenerating them.
- In `loadStoredSettings`, the legacy values `'solfege'` and `'italian'` migrate to `'syllables'`. The Beginner preset uses `'syllables'` in every language, so `matchLevel` is language-independent.

### 6. Range hint in each country's octave convention

`clefRangeLabel` is gone. `main.ts` takes the step bounds (`pitchBounds`, step = octave·7 + index) and formats them with `formatRange(low, high)` in the locale's `pitchNotation`:

| Notation | Locales | Middle C | Treble, 3 ledger lines each side |
|---|---|---|---|
| Scientific | en | C4 | E3 – F6 |
| Franco-Belgian (octave − 1) | it, fr, es | Do3 | Mi2 – Fa5 |
| Helmholtz (C₁ · C · c · c¹ …) | de | c¹ | e – f³ |

Italian and French conservatories use Do3 = middle C. Spain follows the same index, while Latin America varies. To keep the convention unambiguous, the hint's `title` names middle C in every locale ("Do3 = Do centrale", "c¹ = eingestrichenes c").

### 7. Language selection

- **Onboarding.** On the first visit only, the welcome step shows a radiogroup of endonym chips (English · Italiano · Français · Deutsch · Español). It is preselected from the detected language, and picking a chip re-translates the dialog live, including the level and clef cards. The roving-tabindex logic moved from `buildIntroOptions` to `src/utils/radioGroup.ts` (`setRadioSelection` and `bindRovingKeys`), which the chips share.
- **Settings.** Settings → Practice starts with a Language select. Each option carries its own `lang` attribute.
- **Storage.** `settings.language` is validated with `pickEnum` and defaults to `detectLanguage()`. It is not a preset key, so the generator, Ω and level matching are untouched (the Ergodic Principle holds trivially).
- **Switching.** `changeLanguage` loads the locale, persists it and calls `applyTranslations()`. That runs `applyDom` plus every dynamic updater, including `syncLevelButton(settings, true)`; the force flag bypasses its settings-identity skip.

### 8. Generated tuplet titles

The 18 hand-written cell titles are gone. `tupletShape(ts, name, value)` in `types.ts` gives the note count, the "in the time of" count and the span in beats. The locale template turns that into, for example:

- en: "Triplet · 3 eighths in the time of 2 (1 beat)";
- it: "Terzina · 3 crome al posto di 2 (1 movimento)".

The beat suffix is shown only on the half-beat grid. `applyTupletAvailability` takes the base title from the dictionary and no longer caches it in a DOM attribute, so re-translation works.

### 9. Untranslated by design

- Tempo terms (Grave … Prestissimo) are universal Italian.
- "BPM" stays, though its aria labels are translated.
- The license name, the web manifest and the meta description stay English. `document.title` is translated.

### 10. Header fit

A headless audit (scratchpad only) checked the header for overflow, overlap and clipped labels across:

- every locale;
- widths 280–1920 px;
- touch and mouse;
- 4/4 and 6/8;
- every play label and level name, with the count-in badge shown.

The only regressions were at 1141–1439 px, where the labelled Level button fits. At 1280 px, "Zurücksetzen", "Impostazioni" and "Personalizzato" need up to 63 px more than English.

`.primary-bar:not(:lang(en))` in that range takes the 961–1140 tier's 12 px gaps and 160 px tempo floor. The English layout is pixel-identical, and the audit now reports zero issues in all locales.

## Terminology Glossary

French uses a narrow no-break space (U+202F) before `: ; ! ?`, before `%` and inside « ».

| Concept | it | fr | de | es |
|---|---|---|---|---|
| Start / Pause / Resume / Reset | Avvia / Pausa / Riprendi / Azzera | Démarrer / Pause / Reprendre / Réinitialiser | Start / Pause / Weiter / Zurücksetzen | Iniciar / Pausa / Reanudar / Reiniciar |
| Settings / Level / Custom | Impostazioni / Livello / Personalizzato | Réglages / Niveau / Personnalisé | Einstellungen / Niveau / Eigene | Ajustes / Nivel / Personalizado |
| Levels | Principiante, Elementare, Intermedio, Avanzato, Virtuoso | Débutant, Élémentaire, Intermédiaire, Avancé, Virtuose | Anfänger, Grundstufe, Mittelstufe, Fortgeschritten, Virtuose | Principiante, Elemental, Intermedio, Avanzado, Virtuoso |
| Clefs | Violino (Sol), Soprano (Do 1ª) … Basso (Fa 4ª) | Sol, Ut 1re (soprano) … Fa 4e (basse) | Violin (G), Sopran (C1) … Bass (F) | Sol, Do en 1.ª (soprano) … Fa en 4.ª (bajo) |
| Note values | Semibreve, Minima, Semiminima, Croma, Semicroma, Biscroma | Ronde, Blanche, Noire, Croche, Double, Triple | Ganze, Halbe, Viertel, Achtel, 16tel, 32tel | Redonda, Blanca, Negra, Corchea, Semicorchea, Fusa |
| Dotted / Rests / Ties | Puntate / Pause / Legature | Pointées / Silences / Liaisons | Punktiert / Pausen / Haltebögen | Con puntillo / Silencios / Ligaduras |
| Tuplets (2–7) | duina, terzina, quartina, quintina, sestina, settimina | duolet, triolet, quartolet, quintolet, sextolet, septolet | Duole, Triole, Quartole, Quintole, Sextole, Septole | dosillo, tresillo, cuatrillo, quintillo, seisillo, septillo |
| Tuplets heading | Gruppi irregolari | Valeurs irrégulières | N-tolen | Grupos de valoración especial |
| Intervals | Unisono, 2ª … 8ª, 9ª+ | Unisson, 2de, 3ce, 4te, 5te, 6te, 7e, 8ve, 9e+ | Prime, Sek., Terz … Oktave, None+ | Unísono, 2.ª … 8.ª, 9.ª+ |
| Meter / 6/8 pulse | Metro / 2 o 6 movimenti | Mesure / 2 ou 6 temps | Taktart / 2 oder 6 Zählzeiten | Compás / 2 o 6 pulsos |
| Ledger lines | Tagli addizionali | Lignes supplémentaires | Hilfslinien | Líneas adicionales |
| Count-in | Preconteggio | Décompte | Einzähler | Cuenta previa |
| Playhead | Testina | Tête de lecture | Abspielposition | Cabezal |
| Click: Electronic / Woodblock | Elettronico / Blocco di legno | Électronique / Wood-block | Elektronisch / Holzblock | Electrónico / Caja china |
| Brand badge | SOLFEGGIO | SOLFÈGE | SOLFÈGE | SOLFEO |
| Language | Lingua | Langue | Sprache | Idioma |

Sources and choices behind the less obvious terms:

- The count-in terms follow the Roland and Apple Logic localized manuals.
- German "Abspielposition" follows Logic DE.
- Spanish "Caja china" is the standard percussion name for the woodblock.
- The French chips use the short forms "Double" and "Triple"; titles and the tuplet table use the full "double croche".
- The German chips use the short forms "16tel" and "32tel", and the full "Sechzehntel" in tuplet titles.

## Consequences

**Size**

| Chunk | gz |
|---|---|
| App JS before | 23.9 kB |
| App JS after | 29.3 kB |

- App JS grows by about 5.4 kB gz: the English dictionary (~3.4 kB) plus the runtime, the updaters and Vite's preload helper.
- Each other language costs one extra request of ~3.6 kB gz.
- CSS grows by ~0.15 kB gz.

**Adding a language**

1. Add the code to `LANGUAGES`, `ENDONYMS` and `LOADERS`.
2. Add it to the head script's `langs` list and to the Settings `<option>` list.
3. Write a `Messages` file; the compiler lists every missing key.

**Adding UI text** requires a key in every locale. Static HTML text also needs the matching `data-i18n*` attribute; the parity test fails otherwise.

**What did not change**

- The generator, the presets' musical content and the configuration space Ω are unchanged.
- Labels re-render on a language switch without reshuffling the music under the playhead.
