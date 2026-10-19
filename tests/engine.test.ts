import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  AppSettings,
  DEFAULT_APP_SETTINGS,
  FixedViewport,
  MeasureBuffer,
  MeasureRenderer,
  MetronomeEngine,
  MusicGenerator,
  NoteNames,
  ScrollerView,
  enabledValues,
  labelResolver,
  mulberry32,
  noteSpan,
  pitchPool,
  placementOf,
} from '../src/engine';
import { DEFAULT_APP_SETTINGS as STORAGE_DEFAULTS } from '../src/storage';
import * as generator from '../src/notation/generator';
import * as ties from '../src/notation/ties';
import en from '../src/i18n/locales/en';
import itMessages from '../src/i18n/locales/it';
import fr from '../src/i18n/locales/fr';
import de from '../src/i18n/locales/de';
import es from '../src/i18n/locales/es';

// The buffer waits for the music font, which happy-dom never loads
vi.mock('../src/notation/fonts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/notation/fonts')>()),
  isMusicFontReady: () => true,
}));

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');

/**
 * App modules an embedder must never load: they read localStorage, the UI language, the
 * location or the build constants that only this repo's vite.config.ts defines (ADR 0104).
 */
const APP_ONLY = [
  'main.ts',
  'state.ts',
  'storage.ts',
  'whatsNew.ts',
  'share.ts',
  'summary.ts',
  'i18n/index.ts',
  'utils/serviceWorker.ts',
  'env.d.ts',
];

/** Relative specifiers of every import and re-export, type-only ones included (tsc follows them). */
function relativeImports(source: string): string[] {
  const specs: string[] = [];
  const pattern = /(?:import|export)\s+(?:type\s+)?(?:[^'"]*?\s+from\s+)?'(\.{1,2}\/[^']+)'/g;
  for (const match of source.matchAll(pattern)) specs.push(match[1]);
  const reference = /\/\/\/\s*<reference\s+path="([^"]+)"/g;
  for (const match of source.matchAll(reference)) specs.push(match[1]);
  return specs;
}

/** Every source file reachable from `entry`, as paths relative to src/. */
function importGraph(entry: string): Set<string> {
  const seen = new Set<string>();
  const queue = [path.join(SRC, entry)];
  while (queue.length > 0) {
    const file = queue.pop() as string;
    const rel = path.relative(SRC, file);
    if (seen.has(rel)) continue;
    seen.add(rel);
    if (!file.endsWith('.ts')) continue; // an asset such as the music font (?url)
    for (const spec of relativeImports(fs.readFileSync(file, 'utf-8'))) {
      const target = path.resolve(path.dirname(file), spec.split('?')[0]);
      const resolved = [target, `${target}.ts`, path.join(target, 'index.ts')].find(
        (candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile()
      );
      expect(resolved, `${rel} imports ${spec}`).toBeDefined();
      queue.push(resolved as string);
    }
  }
  return seen;
}

function expectEmbeddable(graph: Set<string>): void {
  for (const rel of graph) {
    expect(APP_ONLY, `reaches ${rel}`).not.toContain(rel);
    if (rel.endsWith('.ts')) {
      expect(fs.readFileSync(path.join(SRC, rel), 'utf-8'), `${rel} reads a build constant`).not.toMatch(
        /__APP_/
      );
    }
  }
}

const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf-8')) as {
  exports: Record<string, string>;
};

describe('Engine entry point (ADR 0104)', () => {
  it('maps guidonica/engine and guidonica/locales/* to existing sources', () => {
    expect(pkg.exports['./engine']).toBe('./src/engine.ts');
    expect(pkg.exports['./locales/*']).toBe('./src/i18n/locales/*.ts');
    for (const lang of ['en', 'it', 'fr', 'de', 'es']) {
      expect(fs.existsSync(path.join(ROOT, pkg.exports['./locales/*'].replace('*', lang)))).toBe(true);
    }
  });

  it('only re-exports: the barrel holds no logic of its own', () => {
    const code = fs
      .readFileSync(path.join(SRC, 'engine.ts'), 'utf-8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '')
      .trim();
    for (const statement of code.split(';').map((s) => s.trim()).filter(Boolean)) {
      expect(statement).toMatch(/^export (type )?(\*|\{[^}]*\}) from '\.\/[^']+'$/);
    }
  });

  it('never reaches app modules, the UI language or build constants', () => {
    const graph = importGraph('engine.ts');
    expect(graph).toContain('scroller/scroller.ts');
    expect(graph).toContain('audio/metronome.ts');
    expectEmbeddable(graph);
    // Labels come from the caller, never from a locale the engine picks
    expect([...graph].filter((rel) => rel.startsWith('i18n/'))).toEqual([]);
  });

  it.each(['en', 'it', 'fr', 'de', 'es'])('loads the %s locale as pure data', (lang) => {
    expectEmbeddable(importGraph(`i18n/locales/${lang}.ts`));
  });

  it('keeps the defaults the app stores', () => {
    expect(STORAGE_DEFAULTS).toBe(DEFAULT_APP_SETTINGS);
  });

  it('resolves labels from a locale for each mode', () => {
    const locales: NoteNames[] = [en.noteNames, itMessages.noteNames, fr.noteNames, de.noteNames, es.noteNames];
    for (const names of locales) {
      const labels = labelResolver(names);
      expect(labels('none')).toBeNull();
      expect(labels('syllables')).toBe(names.syllables);
      expect(labels('letters')).toBe(names.letters);
    }
  });
});

describe('Engine round trip (ADR 0104)', () => {
  const originalGetContext = HTMLCanvasElement.prototype.getContext;
  let drawnText: string[] = [];
  let blits = 0;

  beforeEach(() => {
    drawnText = [];
    blits = 0;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, contextId: string) {
      if (contextId !== '2d') return null;
      const noop = (): void => {};
      return new Proxy(
        {
          canvas: this,
          getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
          measureText: () => ({ width: 10, actualBoundingBoxAscent: 6, actualBoundingBoxDescent: 4 }),
          createLinearGradient: () => ({ addColorStop: noop }),
          getLineDash: () => [],
          fillText: (text: string) => {
            if (text) drawnText.push(text);
          },
          drawImage: () => {
            blits++;
          },
        } as Record<string | symbol, unknown>,
        { get: (target, key) => (key in target ? target[key] : noop), set: () => true }
      ) as unknown as CanvasRenderingContext2D;
    } as unknown as typeof HTMLCanvasElement.prototype.getContext;
    vi.stubGlobal('requestIdleCallback', () => 0);
    vi.stubGlobal('cancelIdleCallback', () => {});
  });

  afterEach(() => {
    HTMLCanvasElement.prototype.getContext = originalGetContext;
    vi.unstubAllGlobals();
  });

  const metronome = {
    getVisualBeat: () => {
      throw new Error('renderAt must not read the metronome');
    },
  } as unknown as MetronomeEngine;
  const viewport: FixedViewport = { width: 900, height: 300, dpr: 1 };
  const settings: AppSettings = { ...structuredClone(DEFAULT_APP_SETTINGS), solfegeLabelMode: 'letters' };

  function frame(seed: number): { notes: string; labels: string[] } {
    const renderer = new MeasureRenderer({ dpr: viewport.dpr, zoom: settings.zoom });
    const buffer = new MeasureBuffer(new MusicGenerator(mulberry32(seed)), renderer, labelResolver(de.noteNames));
    const canvas = document.createElement('canvas');
    const scroller = new ScrollerView(canvas, buffer, metronome, renderer, () => settings, { viewport });
    drawnText = [];
    blits = 0;
    scroller.renderAt(0);
    expect(blits).toBeGreaterThan(0);
    const labels = drawnText.filter((text) => /^[A-H]$/.test(text));
    return { notes: JSON.stringify(buffer.getMeasures().map((m) => m.data.notes)), labels };
  }

  it('draws a seeded frame with the caller’s labels, through the entry point alone', () => {
    const first = frame(42);
    expect(first.labels.length).toBeGreaterThan(0);
    // German letters: B is H, so an English label would fail here
    for (const label of first.labels) expect(de.noteNames.letters).toContain(label);
    expect(frame(42)).toEqual(first);
  });
});

describe('Notation rule seams (ADR 0111)', () => {
  it('exports the generator’s own functions, not copies', () => {
    expect(enabledValues).toBe(generator.enabledValues);
    expect(pitchPool).toBe(generator.pitchPool);
    expect(noteSpan).toBe(ties.noteSpan);
    expect(placementOf).toBe(ties.placementOf);
  });

  it('every note of a seeded bar uses an allowed value, pitch and placement', () => {
    const settings: AppSettings = { ...structuredClone(DEFAULT_APP_SETTINGS), rests: true, ties: true };
    const values = enabledValues(settings.subdivisions);
    const pool = pitchPool(settings.clef, settings.ledgerLines, settings.pitchClasses);
    const gen = new MusicGenerator(mulberry32(7));
    for (let i = 0; i < 32; i++) {
      const bar = gen.generateMeasure(i, settings, i * 4);
      for (const note of bar.notes) {
        if (note.isTuplet) continue;
        expect(noteSpan(settings.timeSignature, note.duration)).toBeCloseTo(note.beatDuration, 9);
        if (note.isRest) continue;
        expect(values).toContain(note.duration);
        expect(pool).toContain(note.keys[0]);
        expect(placementOf(settings.timeSignature, note.beatOffset, note.beatDuration)).not.toBeNull();
      }
    }
  });

  it('spans and placements follow the meter', () => {
    expect(noteSpan('4/4', 'q')).toBe(1);
    expect(noteSpan('6/8', 'q')).toBe(2);
    expect(noteSpan('6/8', 'qd')).toBe(3);
    expect(placementOf('4/4', 0, 1)).toBe('canonical');
    expect(placementOf('4/4', 1, 2)).toBe('tolerated');
    expect(placementOf('4/4', 1.5, 1)).toBeNull();
    expect(placementOf('4/4', 3.5, 1)).toBeNull();
  });
});
