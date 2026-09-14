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
  MEASURE_CANVAS_HEIGHT,
  MeasureData,
  NOTE_START_OFFSET,
  NoteData,
  RenderedMeasure,
  STAVE_CANVAS_Y,
} from './types';

export class MeasureRenderer {
  /**
   * Renders a single measure onto an offscreen canvas using VexFlow and GPU blitting principles.
   */
  public renderMeasure(data: MeasureData): RenderedMeasure {
    const canvas = document.createElement('canvas');
    const renderer = new Renderer(canvas, Renderer.Backends.CANVAS);
    renderer.resize(data.width, MEASURE_CANVAS_HEIGHT);
    const ctx = renderer.getContext();
    ctx.setFillStyle('#000000');
    ctx.setStrokeStyle('#000000');

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

    stave.setStyle({ strokeStyle: '#64748b', fillStyle: '#64748b' });
    stave.setDefaultLedgerLineStyle({ strokeStyle: '#64748b', fillStyle: '#64748b' });
    stave.getModifiers().forEach((mod) => {
      mod.setStyle({ fillStyle: '#475569', strokeStyle: '#475569' });
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
      const staveNote = this.createStaveNote(noteData, data.clef, stave);
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
        tuplet.setStyle({ fillStyle: '#334155', strokeStyle: '#334155' });
        tuplets.push(tuplet);
      }
    }

    // Build beams:
    // Tuplet groups of 8ths or 16ths receive dedicated unified beams spanning the tuplet
    const beams: Beam[] = [];
    for (const entry of tupletGroupsMap.values()) {
      const isBeamable = entry.notes.every((n) => {
        const d = n.getDuration();
        return (d === '8' || d === '16') && !n.isRest();
      });
      if (isBeamable && entry.notes.length > 1) {
        const tupletBeam = new Beam(entry.notes);
        beams.push(tupletBeam);
      }
    }

    // Non-tuplet notes receive meter-aware automatic beam groups
    const nonTupletNotes = staveNotes.filter((n) => !tupletNotesSet.has(n));
    if (nonTupletNotes.length > 0) {
      const regularBeams = Beam.generateBeams(nonTupletNotes, {
        groups: Beam.getDefaultBeamGroups(data.timeSignature),
        beamRests: false,
      });
      beams.push(...regularBeams);
    }

    for (const beam of beams) {
      beam.setStyle({ fillStyle: '#000000', strokeStyle: '#000000' });
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

    return {
      data,
      canvas,
      width: data.width,
      height: MEASURE_CANVAS_HEIGHT,
    };
  }

  /**
   * Renders the stationary clef glyph onto an offscreen canvas to pin at the left margin.
   */
  public renderPinnedClef(clef: Clef): HTMLCanvasElement {
    const width = 80;
    const canvas = document.createElement('canvas');
    const renderer = new Renderer(canvas, Renderer.Backends.CANVAS);
    renderer.resize(width, MEASURE_CANVAS_HEIGHT);
    const ctx = renderer.getContext();
    ctx.setFillStyle('#000000');
    ctx.setStrokeStyle('#000000');

    // The pinned clef is drawn with hidden lines so it cleanly overlays stationary staff lines
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
    stave.setStyle({ strokeStyle: '#000000', fillStyle: '#000000' });
    for (const mod of stave.getModifiers()) {
      mod.setStyle({ fillStyle: '#000000', strokeStyle: '#000000' });
    }
    stave.setContext(ctx).draw();

    return canvas;
  }

  private createStaveNote(noteData: NoteData, clef: Clef, stave: Stave): StaveNote {
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

    staveNote.setStyle({ fillStyle: '#000000', strokeStyle: '#000000' });
    for (const mod of staveNote.getModifiers()) {
      mod.setStyle({ fillStyle: '#000000', strokeStyle: '#000000' });
    }
    return staveNote;
  }
}
