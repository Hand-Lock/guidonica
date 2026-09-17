import {
  Beam,
  Dot,
  Formatter,
  Metrics,
  Renderer,
  Stave,
  StaveNote,
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
    const solfegeColor = isDark ? '#38bdf8' : '#2563eb';

    const renderer = new Renderer(canvas, Renderer.Backends.CANVAS);
    renderer.resize(canvas.width, canvas.height);
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

    // Render elements onto the offscreen canvas
    stave.setContext(ctx).draw();
    voice.draw(ctx, stave);

    for (const beam of beams) {
      beam.setContext(ctx).draw();
    }

    for (const tuplet of tuplets) {
      tuplet.setContext(ctx).draw();
    }

    // Draw pedagogical Solfège syllables or note names beneath notes
    if (solfegeMode !== 'none') {
      const rawCtx = canvas.getContext('2d');
      if (rawCtx) {
        rawCtx.save();
        // Reset transform to logical units scaled to device pixel ratio and zoom
        rawCtx.setTransform(dpr * zoom, 0, 0, dpr * zoom, 0, 0);
        rawCtx.fillStyle = solfegeColor;
        rawCtx.font = 'bold 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        rawCtx.textAlign = 'center';
        rawCtx.textBaseline = 'middle';

        for (let i = 0; i < data.notes.length; i++) {
          const nData = data.notes[i];
          if (nData.isRest || !nData.keys || nData.keys.length === 0) continue;
          const pitchLetter = nData.keys[0].split('/')[0].toLowerCase();
          const label =
            solfegeMode === 'solfege'
              ? SOLFEGE_SYLLABLES[pitchLetter] || ''
              : solfegeMode === 'italian'
              ? ITALIAN_SOLFEGE_SYLLABLES[pitchLetter] || ''
              : NOTE_LETTER_NAMES[pitchLetter] || '';
          if (!label) continue;

          const noteLinearX = NOTE_START_OFFSET + nData.beatOffset * beatWidth;
          const staveNote = staveNotes[i];
          const noteY = staveNote.getYs()?.[0] ?? 120;
          // Position solfege syllables along a uniform baseline below the staff (148),
          // while stepping down to clear lower ledger lines (e.g. C4 down to E3)
          const baselineY = 148;
          const labelY = Math.min(MEASURE_CANVAS_HEIGHT - 12, Math.max(baselineY, noteY + 20));
          rawCtx.fillText(label, noteLinearX, labelY);
        }
        rawCtx.restore();
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
  public renderPinnedClef(clef: Clef, theme?: ThemeMode): HTMLCanvasElement;
  public renderPinnedClef(clef: Clef, timeSignature: TimeSignature, theme?: ThemeMode): HTMLCanvasElement;
  public renderPinnedClef(
    clef: Clef,
    timeSignatureOrTheme: TimeSignature | ThemeMode = '4/4',
    maybeTheme: ThemeMode = 'auto'
  ): HTMLCanvasElement {
    let timeSignature: TimeSignature = '4/4';
    let theme: ThemeMode = 'auto';

    if (
      timeSignatureOrTheme === 'auto' ||
      timeSignatureOrTheme === 'light' ||
      timeSignatureOrTheme === 'dark'
    ) {
      theme = timeSignatureOrTheme;
    } else {
      timeSignature = timeSignatureOrTheme;
      theme = maybeTheme;
    }

    const dpr = this.dpr;
    const zoom = this.zoom;
    const width = PINNED_HEADER_WIDTH;
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.floor(width * dpr * zoom));
    canvas.height = Math.max(1, Math.floor(MEASURE_CANVAS_HEIGHT * dpr * zoom));

    const isDark = resolveTheme(theme) === 'dark';
    const headerColor = isDark ? '#f8fafc' : '#000000';

    const renderer = new Renderer(canvas, Renderer.Backends.CANVAS);
    renderer.resize(canvas.width, canvas.height);
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

  public renderPinnedHeader(
    clef: Clef,
    timeSignature: TimeSignature,
    theme: ThemeMode = 'auto'
  ): HTMLCanvasElement {
    return this.renderPinnedClef(clef, timeSignature, theme);
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
