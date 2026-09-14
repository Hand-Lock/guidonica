import {
  Beam,
  Dot,
  Formatter,
  Renderer,
  Stave,
  StaveNote,
  Tuplet,
  Voice,
} from 'vexflow';
import {
  BEAT_WIDTH,
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
  public renderMeasure(data: MeasureData, dpr: number = window.devicePixelRatio || 1): RenderedMeasure {
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(data.width * dpr);
    canvas.height = Math.ceil(MEASURE_CANVAS_HEIGHT * dpr);
    canvas.style.width = `${data.width}px`;
    canvas.style.height = `${MEASURE_CANVAS_HEIGHT}px`;

    const renderer = new Renderer(canvas, Renderer.Backends.CANVAS);
    renderer.resize(data.width, MEASURE_CANVAS_HEIGHT);
    const ctx = renderer.getContext();

    // Create stave without left barline, but with right barline separating measures
    const stave = new Stave(0, STAVE_CANVAS_Y, data.width, {
      leftBar: false,
      rightBar: true,
      lineConfig: [
        { visible: true },
        { visible: true },
        { visible: true },
        { visible: true },
        { visible: true },
      ],
    });

    stave.setStyle({ strokeStyle: '#4f4f4f', fillStyle: '#4f4f4f' });
    stave.setDefaultLedgerLineStyle({ strokeStyle: '#707070', fillStyle: '#707070' });

    // Construct StaveNotes
    const staveNotes: StaveNote[] = [];
    const tupletGroupsMap: Map<number, StaveNote[]> = new Map();

    for (let i = 0; i < data.notes.length; i++) {
      const noteData = data.notes[i];
      const staveNote = this.createStaveNote(noteData, data.clef);
      staveNotes.push(staveNote);

      if (noteData.isTuplet && noteData.tupletGroup !== undefined) {
        if (!tupletGroupsMap.has(noteData.tupletGroup)) {
          tupletGroupsMap.set(noteData.tupletGroup, []);
        }
        tupletGroupsMap.get(noteData.tupletGroup)!.push(staveNote);
      }
    }

    // Build tuplets
    const tuplets: Tuplet[] = [];
    for (const group of tupletGroupsMap.values()) {
      if (group.length === 3) {
        const tuplet = new Tuplet(group, {
          numNotes: 3,
          notesOccupied: 2,
          location: Tuplet.LOCATION_TOP,
        });
        tuplet.setStyle({ fillStyle: '#cccccc', strokeStyle: '#cccccc' });
        tuplets.push(tuplet);
      }
    }

    // Build beams
    const beams = Beam.generateBeams(staveNotes, {
      beamRests: false,
    });
    for (const beam of beams) {
      beam.setStyle({ fillStyle: '#ffffff', strokeStyle: '#ffffff' });
    }

    // Voice setup
    const voice = new Voice({
      numBeats: data.beatsPerMeasure,
      beatValue: data.beatValue,
    });
    voice.setMode(Voice.Mode.SOFT);
    voice.addTickables(staveNotes);

    // Initial VexFlow format
    const formatter = new Formatter();
    formatter.joinVoices([voice]).format([voice], data.width);

    // Enforce strict spatial linearity: note positions proportional to metric beat
    for (let i = 0; i < staveNotes.length; i++) {
      const noteData = data.notes[i];
      const targetLinearX = NOTE_START_OFFSET + noteData.beatOffset * BEAT_WIDTH;
      staveNotes[i].getTickContext().setX(targetLinearX);
    }

    // Re-format beams after exact manual note positioning
    for (const beam of beams) {
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
  public renderPinnedClef(clef: Clef, dpr: number = window.devicePixelRatio || 1): HTMLCanvasElement {
    const width = 80;
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(width * dpr);
    canvas.height = Math.ceil(MEASURE_CANVAS_HEIGHT * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${MEASURE_CANVAS_HEIGHT}px`;

    const renderer = new Renderer(canvas, Renderer.Backends.CANVAS);
    renderer.resize(width, MEASURE_CANVAS_HEIGHT);
    const ctx = renderer.getContext();

    // The pinned clef is drawn with hidden lines so it cleanly overlays stationary staff lines
    const stave = new Stave(10, STAVE_CANVAS_Y, width - 10, {
      leftBar: false,
      rightBar: false,
      lineConfig: [
        { visible: false },
        { visible: false },
        { visible: false },
        { visible: false },
        { visible: false },
      ],
    });

    stave.addClef(clef);
    stave.setStyle({ strokeStyle: '#00ffcc', fillStyle: '#00ffcc' });
    stave.setContext(ctx).draw();

    return canvas;
  }

  private createStaveNote(noteData: NoteData, clef: Clef): StaveNote {
    let durationString = noteData.duration;
    let isDotted = false;

    if (durationString.endsWith('d')) {
      isDotted = true;
      durationString = durationString.slice(0, -1);
    }

    if (noteData.isRest) {
      durationString += 'r';
    }

    const staveNote = new StaveNote({
      keys: noteData.keys,
      duration: durationString,
      clef,
      autoStem: true,
    });

    if (isDotted) {
      Dot.buildAndAttach([staveNote], { all: true });
    }

    staveNote.setStyle({ fillStyle: '#f0f0f0', strokeStyle: '#f0f0f0' });
    return staveNote;
  }
}
