// SPDX-License-Identifier: AGPL-3.0-or-later
// Guidonica - Per-language landing page metadata (ADR 0086)
// Copyright (C) 2026 A. C. Lo Cascio

// Read at build time only, by the localePages() plugin in vite.config.ts, so these strings
// never ship in the locale chunks. The page title is each locale's docTitle.

import { Language } from '../notation/types';

export interface LandingMeta {
  /** Meta, Open Graph and Twitter description. */
  description: string;
  /** Alt text of the social preview image. */
  imageAlt: string;
  /** Open Graph locale, language_TERRITORY. */
  ogLocale: string;
}

export const SITE_URL = 'https://guidonica.it/';

/** The landing URL of each language: English is the site root, the others a subdirectory. */
export function landingUrl(lang: Language): string {
  return lang === 'en' ? SITE_URL : `${SITE_URL}${lang}/`;
}

export const LANDING: Record<Language, LandingMeta> = {
  en: {
    description:
      'Free sight-reading and solfège practice: endless fresh sheet music scrolls past a playhead in time with a metronome. No sign-up, works on any device.',
    imageAlt: 'Guidonica: a treble staff of generated notes scrolling past a playhead, with the Guidonian Hand logo.',
    ogLocale: 'en_US',
  },
  it: {
    description:
      'Esercizi gratuiti di lettura a prima vista e solfeggio: musica sempre nuova scorre sotto una testina a tempo di metronomo. Senza registrazione, su qualsiasi dispositivo.',
    imageAlt: 'Guidonica: un pentagramma in chiave di violino con note generate che scorrono sotto una testina, con il logo della Mano guidoniana.',
    ogLocale: 'it_IT',
  },
  fr: {
    description:
      'Exercices gratuits de lecture à vue et de solfège : une partition toujours nouvelle défile sous une tête de lecture au rythme du métronome. Sans inscription, sur tous les appareils.',
    imageAlt: 'Guidonica : une portée en clé de sol dont les notes générées défilent sous une tête de lecture, avec le logo de la Main guidonienne.',
    ogLocale: 'fr_FR',
  },
  de: {
    description:
      'Kostenlos Blattlesen und Solfège üben: immer neue Noten ziehen im Takt des Metronoms an einer Abspielposition vorbei. Ohne Anmeldung, auf jedem Gerät.',
    imageAlt: 'Guidonica: ein Notensystem im Violinschlüssel mit erzeugten Noten, die an einer Abspielposition vorbeiziehen, mit dem Logo der Guidonischen Hand.',
    ogLocale: 'de_DE',
  },
  es: {
    description:
      'Ejercicios gratuitos de lectura a primera vista y solfeo: partituras siempre nuevas desfilan bajo un cabezal al ritmo del metrónomo. Sin registro, en cualquier dispositivo.',
    imageAlt: 'Guidonica: un pentagrama en clave de sol con notas generadas que desfilan bajo un cabezal, con el logotipo de la Mano guidoniana.',
    ogLocale: 'es_ES',
  },
};
