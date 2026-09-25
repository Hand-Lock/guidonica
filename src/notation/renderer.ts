import {
  Beam,
  Dot,
  Formatter,
  Metrics,
  ModifierContext,
  Renderer,
  Stave,
  StaveNote,
  StaveTie,
  Stem,
  Tuplet,
  Voice,
} from 'vexflow';
import {
  Clef,
  DEFAULT_ZOOM,
  ITALIAN_SOLFEGE_SYLLABLES,
  MAX_ZOOM,
  MEASURE_CANVAS_HEIGHT,
  MIN_ZOOM,
  MeasureData,
  NOTE_LETTER_NAMES,
  NOTE_START_OFFSET,
  NoteData,
  PINNED_HEADER_WIDTH,
  RenderedMeasure,
  SOLFEGE_SYLLABLES,
  STAVE_CANVAS_Y,
  SolfegeLabelMode,
  ThemeMode,
  TimeSignature,
  resolveTheme,
} from './types';

const tieHeadOffsets = new Map<string, number>();

/**
 * Distance from a note's linear x to where its outgoing tie starts: notehead glyph width
 * plus the dot's right shift (what StaveNote.getTieRightX adds). It depends only on the
 * duration, so it is measured once per duration on a detached note and memoized.
 */
function tieHeadOffset(duration: string): number {
  const cached = tieHeadOffsets.get(duration);
  if (cached !== undefined) return cached;
  const note = new StaveNote({ keys: ['b/4'], duration });
  if (duration.endsWith('d')) {
    Dot.buildAndAttach([note], { all: true });
  }
  const mc = new ModifierContext();
  note.addToModifierContext(mc);
  mc.preFormat();
  const offset = note.getGlyphWidth() + mc.getRightShift();
  tieHeadOffsets.set(duration, offset);
  return offset;
}

/**
 * X where a tie leaves a sounding note placed at `beatOffset` on the linear layout.
 * Both halves of a cross-barline tie use this, so they compute the identical curve.
 */
export function tieAnchorRightX(beatOffset: number, duration: string, beatWidth: number): number {
  return NOTE_START_OFFSET + beatOffset * beatWidth + tieHeadOffset(duration);
}

/** X where a tie arrives at a bar's first note (beat 0 of the linear layout). */
const TIE_ANCHOR_LEFT_X = NOTE_START_OFFSET;

/** Tie direction for a lone note: matches VexFlow's single-note auto stem (1 = below). */
function tieDirection(note: StaveNote): number {
  return note.getKeyProps()[0].line >= 3 ? -1 : 1;
}

/** Distance from notehead center to label center: half head (5) + gap (~4) + half text height (~6). */
export const SOLFEGE_LABEL_OFFSET = 15;
const SOLFEGE_FONT_PX = 11;
/** Labels stay at least this far from the measure canvas's top and bottom edges. */
const SOLFEGE_CANVAS_MARGIN = 8;

/**
 * Where a note's solfège label is centered: on the notehead's x center, a fixed distance
 * from the head on the side opposite the stem (stem up → below, stem down → above).
 */
export function solfegeLabelAnchor(
  headBeginX: number,
  headEndX: number,
  headY: number,
  stemDir: number
): { x: number; y: number } {
  return {
    x: (headBeginX + headEndX) / 2,
    y: headY + SOLFEGE_LABEL_OFFSET * (stemDir === Stem.UP ? 1 : -1),
  };
}

function labelFor(mode: SolfegeLabelMode, key: string): string {
  const pitchLetter = key.split('/')[0].toLowerCase();
  const table =
    mode === 'solfege' ? SOLFEGE_SYLLABLES : mode === 'italian' ? ITALIAN_SOLFEGE_SYLLABLES : NOTE_LETTER_NAMES;
  return table[pitchLetter] || '';
}

export class MeasureRenderer {
  private dpr: number = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
  private zoom: number = DEFAULT_ZOOM;

  public setDpr(dpr: number): void {
    this.dpr = Math.max(1, dpr);
  }

  public getDpr(): number {
    return this.dpr;
  }

  public setZoom(zoom: number): void {
    this.zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));
  }

  public getZoom(): number {
    return this.zoom;
  }

  /**
   * Renders a single measure onto an offscreen canvas using VexFlow and GPU blitting principles.
   */
  public renderMeasure(
    data: MeasureData,
    theme: ThemeMode = 'auto',
    solfegeMode: SolfegeLabelMode = 'none'
  ): RenderedMeasure {
    const dpr = this.dpr;
    const zoom = this.zoom;
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.floor(data.width * dpr * zoom));
    canvas.height = Math.max(1, Math.floor(MEASURE_CANVAS_HEIGHT * dpr * zoom));

    const isDark = resolveTheme(theme) === 'dark';
    const noteColor = isDark ? '#f8fafc' : '#000000';
    const staffColor = isDark ? '#94a3b8' : '#64748b';
    const tupletColor = isDark ? '#cbd5e1' : '#334155';
    const solfegeColor = isDark ? '#00ffcc' : '#007a62';

    const renderer = new Renderer(canvas, Renderer.Backends.CANVAS);
    // No renderer.resize(): VexFlow re-applies devicePixelRatio on top of our sizing (dpr²).
    const ctx = renderer.getContext();
    ctx.scale(dpr * zoom, dpr * zoom);
    ctx.setFillStyle(noteColor);
    ctx.setStrokeStyle(noteColor);

    // Create stave with left barline separating measures, but with invisible horizontal lines
    // so notes, ledger lines, and barlines blit seamlessly over the stationary staff lines
    const stave = new Stave(0, STAVE_CANVAS_Y, data.width, {
      leftBar: true,
      rightBar: false,
    });
    stave.setConfigForLines([
      { visible: false },
      { visible: false },
      { visible: false },
      { visible: false },
      { visible: false },
    ]);

    stave.setStyle({ strokeStyle: staffColor, fillStyle: staffColor });
    stave.setDefaultLedgerLineStyle({ strokeStyle: staffColor, fillStyle: staffColor });
    stave.getModifiers().forEach((mod) => {
      mod.setStyle({ fillStyle: staffColor, strokeStyle: staffColor });
    });

    // Construct StaveNotes
    const staveNotes: StaveNote[] = [];
    interface TupletGroupEntry {
      notes: StaveNote[];
      numNotes: number;
      notesOccupied: number;
      bracketed?: boolean;
      ratioed?: boolean;
    }
    const tupletGroupsMap: Map<number, TupletGroupEntry> = new Map();
    const tupletNotesSet = new Set<StaveNote>();

    for (let i = 0; i < data.notes.length; i++) {
      const noteData = data.notes[i];
      const staveNote = this.createStaveNote(noteData, data.clef, stave, noteColor);
      staveNotes.push(staveNote);

      if (noteData.isTuplet && noteData.tupletGroup !== undefined) {
        let entry = tupletGroupsMap.get(noteData.tupletGroup);
        if (!entry) {
          entry = {
            notes: [],
            numNotes: noteData.tupletNumNotes ?? 3,
            notesOccupied: noteData.tupletNotesOccupied ?? 2,
            bracketed: noteData.tupletBracketed,
            ratioed: noteData.tupletRatioed,
          };
          tupletGroupsMap.set(noteData.tupletGroup, entry);
        }
        entry.notes.push(staveNote);
        tupletNotesSet.add(staveNote);
      }
    }

    // Build beams:
    // Tuplet groups of 8ths or 16ths receive dedicated unified beams spanning the tuplet with autoStem enabled
    // so notes spanning a wide pitch range share a single unified stem direction towards the beam
    const beams: Beam[] = [];
    for (const entry of tupletGroupsMap.values()) {
      const isBeamable = entry.notes.every((n) => {
        const d = n.getDuration();
        return (d === '8' || d === '16') && !n.isRest();
      });
      if (isBeamable && entry.notes.length > 1) {
        const tupletBeam = new Beam(entry.notes, true);
        beams.push(tupletBeam);
      }
    }

    // Non-tuplet notes receive meter-aware automatic beam groups chunked by contiguous runs
    // so beams never span across intervening tuplet groups
    const nonTupletRuns: StaveNote[][] = [];
    let currentRun: StaveNote[] = [];
    for (const note of staveNotes) {
      if (!tupletNotesSet.has(note)) {
        currentRun.push(note);
      } else {
        if (currentRun.length > 0) {
          nonTupletRuns.push(currentRun);
          currentRun = [];
        }
      }
    }
    if (currentRun.length > 0) {
      nonTupletRuns.push(currentRun);
    }

    for (const run of nonTupletRuns) {
      const regularBeams = Beam.generateBeams(run, {
        groups: Beam.getDefaultBeamGroups(data.timeSignature),
        beamRests: false,
      });
      beams.push(...regularBeams);
    }

    for (const beam of beams) {
      beam.setStyle({ fillStyle: noteColor, strokeStyle: noteColor });
    }

    // Build tuplets
    const tuplets: Tuplet[] = [];
    for (const entry of tupletGroupsMap.values()) {
      if (entry.notes.length === entry.numNotes) {
        const isQuarter = entry.notes[0].getDuration() === 'q';
        const tuplet = new Tuplet(entry.notes, {
          numNotes: entry.numNotes,
          notesOccupied: entry.notesOccupied,
          location: Tuplet.LOCATION_TOP,
          bracketed: entry.bracketed ?? isQuarter,
          ratioed: entry.ratioed ?? false,
        });
        tuplet.setStyle({ fillStyle: tupletColor, strokeStyle: tupletColor });
        tuplets.push(tuplet);
      }
    }

    // Voice setup
    const voice = new Voice({
      numBeats: data.beatsPerMeasure,
      beatValue: data.beatValue,
    });
    voice.setMode(Voice.Mode.SOFT);
    voice.setStave(stave);
    voice.addTickables(staveNotes);

    // Initial VexFlow format
    const formatter = new Formatter();
    formatter.joinVoices([voice]).format([voice], data.width);

    // Enforce strict spatial linearity: note positions proportional to metric beat.
    // In VexFlow 5, note.getAbsoluteX() adds stave.getNoteStartX() + Metrics.get('Stave.padding')
    // to the tickContext X coordinate. We subtract this internal stave padding so that
    // note.getAbsoluteX() lands precisely at targetLinearX.
    const stavePadding = (stave.getNoteStartX ? stave.getNoteStartX() : 0) + Metrics.get('Stave.padding', 0);
    const beatWidth = data.beatWidth;

    for (let i = 0; i < staveNotes.length; i++) {
      const noteData = data.notes[i];
      const targetLinearX = NOTE_START_OFFSET + noteData.beatOffset * beatWidth;
      staveNotes[i].getTickContext().setX(targetLinearX - stavePadding);
    }

    // Re-format beams after exact manual note positioning
    for (const beam of beams) {
      beam.postFormatted = false;
      beam.postFormat();
    }

    // Build ties: connect consecutive notes where note[i].tieStart is true and note[i+1].tieEnd is true
    const ties: StaveTie[] = [];
    for (let i = 0; i < data.notes.length - 1; i++) {
      if (data.notes[i].tieStart && data.notes[i + 1].tieEnd) {
        const tie = new StaveTie({
          firstNote: staveNotes[i],
          lastNote: staveNotes[i + 1],
          firstIndexes: [0],
          lastIndexes: [0],
        });
        tie.setStyle({ fillStyle: noteColor, strokeStyle: noteColor });
        ties.push(tie);
      }
    }

    // Render elements onto the offscreen canvas
    stave.setContext(ctx).draw();
    voice.draw(ctx, stave);

    for (const beam of beams) {
      beam.setContext(ctx).draw();
    }

    for (const tuplet of tuplets) {
      tuplet.setContext(ctx).draw();
    }

    for (const tie of ties) {
      tie.setContext(ctx).draw();
    }

    // Cross-barline ties: each measure draws the whole arc in its own coordinates and
    // its canvas clips its half, so contiguous blitting joins one seamless tie over the barline
    const lastIndex = data.notes.length - 1;
    const lastData = data.notes[lastIndex];
    if (lastData.tieStart && !lastData.isRest) {
      const note = staveNotes[lastIndex];
      this.drawBarlineTie(ctx, note, noteColor, {
        firstX: tieAnchorRightX(lastData.beatOffset, lastData.duration, beatWidth),
        lastX: data.width + TIE_ANCHOR_LEFT_X,
      });
    }
    const firstData = data.notes[0];
    if (data.tieIn && firstData.tieEnd && !firstData.isRest) {
      const { beatOffset, duration, beatWidth: prevBeatWidth, measureWidth } = data.tieIn;
      this.drawBarlineTie(ctx, staveNotes[0], noteColor, {
        firstX: tieAnchorRightX(beatOffset, duration, prevBeatWidth) - measureWidth,
        lastX: TIE_ANCHOR_LEFT_X,
      });
    }

    // Draw pedagogical Solfège syllables or note names beside noteheads
    if (solfegeMode !== 'none') {
      const rawCtx = canvas.getContext('2d');
      if (rawCtx) {
        const tupletByNote = new Map<StaveNote, Tuplet>();
        for (const tuplet of tuplets) {
          for (const note of tuplet.getNotes()) {
            if (note instanceof StaveNote) tupletByNote.set(note, tuplet);
          }
        }
        this.drawSolfegeLabels(rawCtx, data, staveNotes, tupletByNote, solfegeMode, solfegeColor);
      }
    }

    return {
      data,
      canvas,
      width: data.width * zoom,
      height: MEASURE_CANVAS_HEIGHT * zoom,
    };
  }

  /**
   * Renders the stationary clef and selected time signature glyphs onto an offscreen
   * canvas to pin at the left margin.
   */
  public renderPinnedClef(clef: Clef, timeSignature: TimeSignature, theme: ThemeMode): HTMLCanvasElement {
    const dpr = this.dpr;
    const zoom = this.zoom;
    const width = PINNED_HEADER_WIDTH;
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.floor(width * dpr * zoom));
    canvas.height = Math.max(1, Math.floor(MEASURE_CANVAS_HEIGHT * dpr * zoom));

    const isDark = resolveTheme(theme) === 'dark';
    const headerColor = isDark ? '#f8fafc' : '#000000';

    const renderer = new Renderer(canvas, Renderer.Backends.CANVAS);
    // No renderer.resize(): VexFlow re-applies devicePixelRatio on top of our sizing (dpr²).
    const ctx = renderer.getContext();
    ctx.scale(dpr * zoom, dpr * zoom);
    ctx.setFillStyle(headerColor);
    ctx.setStrokeStyle(headerColor);

    // The pinned clef + time signature is drawn with hidden lines so it cleanly overlays stationary staff lines
    const stave = new Stave(10, STAVE_CANVAS_Y, width - 10, {
      leftBar: false,
      rightBar: false,
    });
    stave.setConfigForLines([
      { visible: false },
      { visible: false },
      { visible: false },
      { visible: false },
      { visible: false },
    ]);

    stave.addClef(clef);
    stave.addTimeSignature(timeSignature);
    stave.setStyle({ strokeStyle: headerColor, fillStyle: headerColor });
    for (const mod of stave.getModifiers()) {
      mod.setStyle({ fillStyle: headerColor, strokeStyle: headerColor });
    }
    stave.setContext(ctx).draw();

    return canvas;
  }

  private drawSolfegeLabels(
    rawCtx: CanvasRenderingContext2D,
    data: MeasureData,
    staveNotes: StaveNote[],
    tupletByNote: Map<StaveNote, Tuplet>,
    mode: SolfegeLabelMode,
    color: string
  ): void {
    // Keep the context's current transform: it is exactly the one VexFlow drew the notes
    // with (our dpr·zoom), so notehead coordinates map 1:1. Never setTransform here —
    // labels must share whatever matrix the notes used (see ADR 0041, ADR 0042).
    rawCtx.save();
    rawCtx.fillStyle = color;
    rawCtx.font = `bold ${SOLFEGE_FONT_PX}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    rawCtx.textAlign = 'center';
    rawCtx.textBaseline = 'middle';

    for (let i = 0; i < data.notes.length; i++) {
      const nData = data.notes[i];
      // Tie continuations are not re-articulated, so they get no syllable
      if (nData.isRest || nData.tieEnd || !nData.keys || nData.keys.length === 0) continue;
      const label = labelFor(mode, nData.keys[0]);
      if (!label) continue;

      const staveNote = staveNotes[i];
      // Stem direction is read after beaming, since Beam may have flipped it
      const stemDir = staveNote.getStemDirection();
      const anchor = solfegeLabelAnchor(
        staveNote.getNoteHeadBeginX(),
        staveNote.getNoteHeadEndX(),
        staveNote.getYs()[0],
        stemDir
      );
      let y = anchor.y;
      const tuplet = tupletByNote.get(staveNote);
      if (tuplet && stemDir !== Stem.UP) {
        // Labels above a tuplet note clear its top bracket and number
        y = Math.min(y, tuplet.getYPosition() - SOLFEGE_LABEL_OFFSET);
      }
      y = Math.max(SOLFEGE_CANVAS_MARGIN, Math.min(MEASURE_CANVAS_HEIGHT - SOLFEGE_CANVAS_MARGIN, y));
      rawCtx.fillText(label, anchor.x, y);
    }
    rawCtx.restore();
  }

  private drawBarlineTie(
    ctx: ReturnType<Renderer['getContext']>,
    note: StaveNote,
    noteColor: string,
    span: { firstX: number; lastX: number }
  ): void {
    // Both ends share pitch and clef, so the note's own Ys serve both ends
    const tie = new StaveTie({ firstNote: note, firstIndexes: [0], lastIndexes: [0] });
    tie.setStyle({ fillStyle: noteColor, strokeStyle: noteColor });
    tie.setContext(ctx);
    ctx.save();
    ctx.setFillStyle(noteColor);
    tie.renderTie({
      firstX: span.firstX,
      lastX: span.lastX,
      firstYs: note.getYs(),
      lastYs: note.getYs(),
      direction: tieDirection(note),
    });
    ctx.restore();
  }

  private createStaveNote(
    noteData: NoteData,
    clef: Clef,
    stave: Stave,
    noteColor: string = '#000000'
  ): StaveNote {
    const isDotted = noteData.duration.endsWith('d');
    const durationString = noteData.isRest ? `${noteData.duration}r` : noteData.duration;

    const staveNote = new StaveNote({
      keys: noteData.keys,
      duration: durationString,
      clef,
      autoStem: true,
    });

    staveNote.setStave(stave);

    if (isDotted) {
      Dot.buildAndAttach([staveNote], { all: true });
    }

    staveNote.setStyle({ fillStyle: noteColor, strokeStyle: noteColor });
    for (const mod of staveNote.getModifiers()) {
      mod.setStyle({ fillStyle: noteColor, strokeStyle: noteColor });
    }
    return staveNote;
  }
}
