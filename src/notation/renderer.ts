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
} from 'vexflow/core';
import './fonts'; // registers the music font and points VexFlow at it (ADR 0058)
import {
  CANVAS_PALETTE,
  Clef,
  DEFAULT_ZOOM,
  MAX_ZOOM,
  MEASURE_CANVAS_HEIGHT,
  METER,
  MIN_ZOOM,
  MeasureData,
  NOTE_START_OFFSET,
  NoteData,
  PINNED_HEADER_WIDTH,
  RenderedMeasure,
  STAVE_CANVAS_Y,
  ThemeMode,
  TimeSignature,
  isGrouped,
  resolveTheme,
} from './types';

const tieHeadOffsets = new Map<string, number>();

/**
 * Spells a duration with VexFlow's numeric code ('q' -> '4', 'hd' -> '2d', 'b' -> '1/2', the
 * breve; ADR 0090). Beam.generateBeams
 * splits beam groups at unbeamable notes via `parseInt(getDuration()) < 8`, which is NaN for
 * letter codes, so `16 16 q` would lose its beam (ADR 0064).
 */
const NUMERIC_DURATION: Record<string, string> = { b: '1/2', w: '1', h: '2', q: '4' };
function vexDuration(duration: string): string {
  return (NUMERIC_DURATION[duration[0]] ?? duration[0]) + duration.slice(1);
}

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

/** Beam ink and tuplet numbers stay at least this far inside the measure canvas (ADR 0057). */
export const NOTATION_CANVAS_MARGIN = 2;
/** Engraving cap on a beam's total slant: 2 staff spaces of rise, whatever its length (ADR 0057). */
export const MAX_BEAM_RISE = 20; // 2 × VexFlow's 10 px staff space
/** Ink height of a Bravura tuplet digit (U+E880–E889, kept in the ADR 0058 subset) at VexFlow's 30 px tuplet font: 11.2–11.5 px. */
export const TUPLET_NUMBER_HEIGHT = 12;

/** Vertical extent of a tuplet number drawn at `yPosition` on the given side (mirrors Tuplet.draw). */
export function tupletNumberBox(yPosition: number, location: number): { top: number; bottom: number } {
  const center = yPosition - location * Metrics.get('Tuplet.textYOffset');
  return { top: center - TUPLET_NUMBER_HEIGHT / 2, bottom: center + TUPLET_NUMBER_HEIGHT / 2 };
}

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

/** Label for a VexFlow key from a table indexed by c d e f g a b (the UI language's, ADR 0059). */
function labelFor(labels: readonly string[], key: string): string {
  const index = 'cdefgab'.indexOf(key.charAt(0).toLowerCase());
  return index < 0 ? '' : labels[index] ?? '';
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
    labels: readonly string[] | null = null
  ): RenderedMeasure {
    const dpr = this.dpr;
    const zoom = this.zoom;
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.floor(data.width * dpr * zoom));
    canvas.height = Math.max(1, Math.floor(MEASURE_CANVAS_HEIGHT * dpr * zoom));

    const palette = CANVAS_PALETTE[resolveTheme(theme)];
    const noteColor = palette.ink;
    const staffColor = palette.staff;
    const tupletColor = palette.tuplet;
    const solfegeColor = palette.solfege;

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
      /** True when one beam joins every member, which then replaces the bracket. */
      fullyBeamed: boolean;
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
            fullyBeamed: false,
          };
          tupletGroupsMap.set(noteData.tupletGroup, entry);
        }
        entry.notes.push(staveNote);
        tupletNotesSet.add(staveNote);
      }
    }

    // Build beams:
    // Inside a tuplet, each run of consecutive sounding 8ths/16ths gets its own beam with
    // autoStem enabled, so notes spanning a wide pitch range share one stem direction; a rest
    // or a longer member breaks the run (ADR 0065)
    const beams: Beam[] = [];
    const isBeamable = (n: StaveNote): boolean => !n.isRest() && parseInt(n.getDuration(), 10) >= 8;
    for (const entry of tupletGroupsMap.values()) {
      let run: StaveNote[] = [];
      const flush = (): void => {
        if (run.length > 1) {
          beams.push(new Beam(run, true));
          entry.fullyBeamed = run.length === entry.notes.length;
        }
        run = [];
      };
      for (const note of entry.notes) {
        if (isBeamable(note)) run.push(note);
        else flush();
      }
      flush();
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
        // Grouped quarter-beat meters break secondary beams at each quarter (Gould; ADR 0090)
        ...(METER[data.timeSignature].beatValue === 4 && isGrouped(data.timeSignature) ? { secondaryBreaks: '4' } : {}),
      });
      beams.push(...regularBeams);
    }

    for (const beam of beams) {
      beam.setStyle({ fillStyle: noteColor, strokeStyle: noteColor });
    }

    // Build tuplets
    const tuplets: Tuplet[] = [];
    // A group may merge members (3[q 8]), so the ratio comes from the generator, never from
    // the note count; a bracket is drawn unless one beam already shows the whole group
    for (const entry of tupletGroupsMap.values()) {
      const tuplet = new Tuplet(entry.notes, {
        numNotes: entry.numNotes,
        notesOccupied: entry.notesOccupied,
        location: Tuplet.LOCATION_TOP,
        bracketed: !entry.fullyBeamed,
        ratioed: false,
      });
      tuplet.setStyle({ fillStyle: tupletColor, strokeStyle: tupletColor });
      tuplets.push(tuplet);
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
      // A bar-long silence is one whole rest centred in the bar, whatever the meter (ADR 0065)
      const isBarRest = noteData.isRest && noteData.beatDuration === data.beatsPerMeasure;
      const targetLinearX = isBarRest
        ? (data.width - staveNotes[i].getGlyphWidth()) / 2
        : NOTE_START_OFFSET + noteData.beatOffset * beatWidth;
      staveNotes[i].getTickContext().setX(targetLinearX - stavePadding);
    }

    // Re-format beams after exact manual note positioning, slant-capped and canvas-bounded
    for (const beam of beams) {
      this.fitBeam(beam);
    }

    // A tuplet number with no room above the beam moves to the notehead side (ADR 0057)
    const tupletLocations = new Map<Tuplet, number>();
    for (const tuplet of tuplets) {
      let location = Tuplet.LOCATION_TOP;
      if (tupletNumberBox(tuplet.getYPosition(), location).top < NOTATION_CANVAS_MARGIN) {
        location = Tuplet.LOCATION_BOTTOM;
        tuplet.setTupletLocation(location);
      }
      tupletLocations.set(tuplet, location);
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
    if (labels) {
      const rawCtx = canvas.getContext('2d');
      if (rawCtx) {
        const tupletByNote = new Map<StaveNote, Tuplet>();
        for (const tuplet of tuplets) {
          for (const note of tuplet.getNotes()) {
            if (note instanceof StaveNote) tupletByNote.set(note, tuplet);
          }
        }
        this.drawSolfegeLabels(rawCtx, data, staveNotes, tupletByNote, tupletLocations, labels, solfegeColor);
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
   * canvas to pin at the left margin. A null clef or time signature is left out
   * (the intro's clef and meter icons draw one glyph alone).
   */
  public renderPinnedClef(clef: Clef | null, timeSignature: TimeSignature | null, theme: ThemeMode): HTMLCanvasElement {
    const dpr = this.dpr;
    const zoom = this.zoom;
    const width = PINNED_HEADER_WIDTH;
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.floor(width * dpr * zoom));
    canvas.height = Math.max(1, Math.floor(MEASURE_CANVAS_HEIGHT * dpr * zoom));

    const headerColor = CANVAS_PALETTE[resolveTheme(theme)].ink;

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

    if (clef) stave.addClef(clef);
    if (timeSignature) stave.addTimeSignature(timeSignature);
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
    tupletLocations: Map<Tuplet, number>,
    labels: readonly string[],
    color: string
  ): void {
    // Keep the context's current transform: it is exactly the one VexFlow drew the notes
    // with (our dpr·zoom), so notehead coordinates map 1:1. Never setTransform here —
    // labels must share whatever matrix the notes used (see ADR 0041, ADR 0042).
    rawCtx.save();
    rawCtx.fillStyle = color;
    rawCtx.font = `700 ${SOLFEGE_FONT_PX}px "Alegreya Sans", system-ui, sans-serif`;
    rawCtx.textAlign = 'center';
    rawCtx.textBaseline = 'middle';

    for (let i = 0; i < data.notes.length; i++) {
      const nData = data.notes[i];
      // Tie continuations are not re-articulated, so they get no syllable
      if (nData.isRest || nData.tieEnd || !nData.keys || nData.keys.length === 0) continue;
      const label = labelFor(labels, nData.keys[0]);
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
      if (tuplet) {
        // A label on the same side as its tuplet's bracket and number clears them (ADR 0041, 0057)
        const location = tupletLocations.get(tuplet) ?? Tuplet.LOCATION_TOP;
        const labelAbove = stemDir !== Stem.UP;
        if (labelAbove && location === Tuplet.LOCATION_TOP) {
          y = Math.min(y, tuplet.getYPosition() - SOLFEGE_LABEL_OFFSET);
        } else if (!labelAbove && location === Tuplet.LOCATION_BOTTOM) {
          y = Math.max(y, tuplet.getYPosition() + SOLFEGE_LABEL_OFFSET);
        }
      }
      y = Math.max(SOLFEGE_CANVAS_MARGIN, Math.min(MEASURE_CANVAS_HEIGHT - SOLFEGE_CANVAS_MARGIN, y));
      rawCtx.fillText(label, anchor.x, y);
    }
    rawCtx.restore();
  }

  /**
   * Post-formats a beam on the linear layout. VexFlow scores slope per pixel, so on our
   * long linear beams it would follow the contour; the slant is capped at MAX_BEAM_RISE
   * over the beam's span. If a stem tip still leaves the canvas, the beam is redone flat,
   * which seats it at the extreme note's minimum stem length (ADR 0057).
   */
  private fitBeam(beam: Beam): void {
    const notes = beam.getNotes();
    const preBeamExtensions = notes.map((note) => note.getStem()?.getExtension() ?? 0);
    const span = notes[notes.length - 1].getStemX() - notes[0].getStemX();
    if (span > 0) {
      const maxSlope = Math.min(beam.renderOptions.maxSlope, MAX_BEAM_RISE / span);
      beam.renderOptions.maxSlope = maxSlope;
      beam.renderOptions.minSlope = -maxSlope;
    }
    beam.postFormatted = false;
    beam.postFormat();

    const fits = notes.every((note) => {
      if (!note.hasStem()) return true;
      const tipY = note.getStemExtents().topY;
      return tipY >= NOTATION_CANVAS_MARGIN && tipY <= MEASURE_CANVAS_HEIGHT - NOTATION_CANVAS_MARGIN;
    });
    if (fits) return;

    // Restore the natural stems so the flat beam is measured from them, not the sloped tips
    notes.forEach((note, i) => note.getStem()?.setExtension(preBeamExtensions[i]));
    beam.renderOptions.flatBeams = true;
    beam.renderOptions.flatBeamOffset = undefined;
    beam.postFormatted = false;
    beam.postFormat();
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
    const duration = vexDuration(noteData.duration);
    const durationString = noteData.isRest ? `${duration}r` : duration;

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
