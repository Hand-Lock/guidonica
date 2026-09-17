# The Guidonica Design Manifesto
## Aero-Guidonica: Liquid Glass, Skeuomorphic Tactility & Suckless Engineering

> *"Music is the movement of sound to reach the soul for the education of its virtue."*  
> — Guido d'Arezzo (c. 991–1050)

---

### 1. Vision & Core Philosophy

**Aero-Guidonica** unites two seemingly disparate worlds:
1. **Historical Humanist Musical Pedagogy**: Inspired by Guido d'Arezzo's 11th-century revolutionary sight-singing mnemonic (*Manus Guidonica*), solfège tradition, and classical music engraving.
2. **The Golden Age of Digital Tactility (2000–2010)**: The optimistic, sensory, and refractive aesthetics of **Frutiger Aero**, **macOS Aqua**, **Windows Aero**, and **Liquid Glass** skeuomorphism.
3. **The Suckless Web Philosophy**: Absolute refusal of the slow, bloated "modern web". Zero megabyte-heavy frameworks, zero sluggish CSS libraries, zero sprite sheet downloads, zero layout jank.

#### The Suckless Aero Axiom
> **"Sensory richness through mathematical frugality."**  
> We achieve luminous glass, tactile buttons, refractive specular highlights, and physical feedback **entirely through pure, hardware-accelerated CSS3 and SVG vector math**. Not a single kilobyte of external JavaScript UI runtime or heavy raster textures is tolerated.

---

### 2. Typographic Architecture

Guidonica uses two complementary typefaces designed by Huerta Tipográfica, marrying calligraphic craft with crystalline digital legibility:

#### A. Title & Brand Display: *Alegreya*
- **Classification**: Contemporary humanist serif with deep calligraphic roots.
- **Role**: Brand heading (`Guidonica`), modal headers, section titles, and key pedagogical accents.
- **Rationale**: Its energetic, human-cut serifs evoke the medieval manuscript inkstrokes of Guido d'Arezzo while providing authoritative presence.
- **Font Stack**:
  ```css
  --font-title: 'Alegreya', Georgia, 'Palatino Linotype', 'Book Antiqua', Palatino, serif;
  ```
- **Styling Rules**:
  - Headings feature subtle glass text emboss:
    - *Light Mode*: `text-shadow: 0 1px 0 rgba(255, 255, 255, 0.8), 0 0 12px rgba(37, 99, 235, 0.15);`
    - *Dark Mode*: `text-shadow: 0 1px 2px rgba(0, 0, 0, 0.9), 0 0 16px rgba(56, 189, 248, 0.35);`

#### B. Interface & Body Text: *Alegreya Sans*
- **Classification**: Humanist sans-serif counterpart to Alegreya.
- **Role**: All interactive controls, button labels, dropdowns, tooltips, hints, and tabular data.
- **Rationale**: Retains the warmth and humanist proportion of the serif companion, ensuring prolonged sight-reading without visual fatigue.
- **Font Stack**:
  ```css
  --font-family: 'Alegreya Sans', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  ```

#### C. Numeric & Monospace Data
- **Classification**: Monospace humanist font designed by Dalton Maag.
- **Role**: Tempo display (BPM), number inputs, keyboard shortcuts (`<kbd>`), metric ratio badges, and technical values.
- **Rationale**: Features distinct numeral shapes and comfortable horizontal rhythm that ensure rapid legibility at both high tempos and small badge dimensions.
- **Font Stack**:
  ```css
  --font-mono: 'Ubuntu Mono', 'SF Mono', 'Cascadia Code', Consolas, Menlo, Monaco, monospace;
  ```

---

### 3. Lighting & Skeuomorphic Physics Model

Every interactive element in Guidonica exists in a coherent simulated physical lighting environment:

1. **Light Source**: Fixed at **45° Top-Left**.
2. **Surface Highlight (Top Inset)**: Every elevated surface features a crisp 1px specular reflection on its upper perimeter:
   ```css
   box-shadow: inset 0 1px 0 rgba(255, 255, 255, var(--sheen-opacity));
   ```
3. **Beveled Edge**: Borders are translucent and tinted to enhance dimensional thickness:
   ```css
   border: 1px solid rgba(255, 255, 255, 0.4);
   ```
4. **Sub-surface Specular Sheen (The Gel/Aqua Gloss)**:
   A linear gradient with a sharp reflection line across the upper half of buttons:
   ```css
   background: linear-gradient(
     180deg,
     rgba(255, 255, 255, 0.35) 0%,
     rgba(255, 255, 255, 0.08) 49%,
     rgba(0, 0, 0, 0.05) 50%,
     rgba(0, 0, 0, 0) 100%
   );
   ```
5. **Tactile Depress (Active Physics)**:
   When pressed, physical buttons must move downwards by 1px and trade their outer drop shadow for an internal ambient cavity shadow:
   ```css
   .btn:active {
     transform: translateY(1px);
     box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.35);
   }
   ```

---

### 4. Color Palettes & Material Systems

#### Light Mode: *Liquid Crystal & Aqua*
- **Mood**: High-clarity optical glass, luminous clear water, crisp alpine sky.
- **Background**: Subtle cool iridescent gradient (`#ebf4fc` to `#f7faff`).
- **Glass Ribbon (Header)**: `rgba(255, 255, 255, 0.75)` with `backdrop-filter: blur(16px) saturate(180%)`.
- **Primary Accent (Aqua Gel)**: Luminous azure gel (`#2563eb` through `#3b82f6` with specular cap).
- **Secondary Surfaces**: Frosted crystal acrylic (`linear-gradient(180deg, #ffffff 0%, #f1f5f9 100%)`).
- **Canvas Base**: Pure optical white (`#ffffff`) preserving optimal sheet music contrast.

#### Dark Mode: *Obsidian Aero & Quartz*
- **Mood**: Sleek tinted smoked acrylic, deep space cobalt, incandescent neon glows.
- **Background**: Deep obsidian blue gradient (`#080c16` to `#0d1527`).
- **Glass Ribbon (Header)**: `rgba(15, 23, 42, 0.75)` with `backdrop-filter: blur(16px) saturate(190%)`.
- **Primary Accent (Cyan Neon Gel)**: Electric sky blue (`#0ea5e9` to `#38bdf8` with glowing specular edge).
- **Secondary Surfaces**: Smoked midnight glass (`linear-gradient(180deg, #1e293b 0%, #0f172a 100%)`).
- **Canvas Base**: Midnight slate (`#0f172a`) with cool steel staves.

---

### 5. Component Archetypes & Construction Rules

#### A. The Primary Gel Button (`#btn-play-pause`)
- **Structure**: Rounded pill button ($R=6\text{px}$), high tactile presence.
- **States**:
  - *Rest*: Multi-layer gradient with top specular gloss arc, outer drop shadow.
  - *Hover*: Luminescent halo (`box-shadow: 0 0 14px var(--accent-glow), 0 3px 6px rgba(0,0,0,0.2)`).
  - *Active / Pressed*: `transform: translateY(1px)`, inset shadow.
  - *Playing (State Shift)*: Transforms into a radiant Amber/Topaz gel button (`#f59e0b` to `#d97706`).

#### B. Secondary Acrylic Buttons & Icon Controls
- Crisp beveled border with frosted sub-surface reflection.
- Icon controls (`#btn-theme-toggle`, `#btn-fullscreen-toggle`, etc.) are square glass gems with centered micro-glyphs.

#### C. Skeuomorphic Sliders (Tempo & Volume)
- **Track**: Sunken groove well (`box-shadow: inset 0 2px 4px rgba(0,0,0,0.25)`).
- **Thumb**: Polished 3D glass bead or capsule with radial specular reflection hotspot at top-left:
  ```css
  radial-gradient(circle at 35% 35%, #ffffff 0%, var(--accent) 55%, var(--accent-hover) 100%)
  ```

#### D. Luminous LED Beat Indicators
- Encased in a frosted glass capsule pill.
- **Inactive Beads**: Softly recessed smoked pearls.
- **Active Downbeat (Beat 1)**: Radiant ruby/coral laser gem with multi-stage radial bloom.
- **Active Sub-beats (2, 3, 4, etc.)**: Luminous aqua/cyan glowing sphere.

#### E. Floating Glass Sheets (Tuplets Popover & Modals)
- Deep glass depth: `backdrop-filter: blur(20px)`, `border: 1px solid var(--panel-border-glass)`.
- Smooth float-in animation with cubic-bezier spring curve.
- Alternating frosted table rows with crisp hairline dividers.

#### F. Mechanical Keycaps (`<kbd>`)
- Styled as 3D injection-molded or acrylic keyboard keys:
  ```css
  kbd {
    background: linear-gradient(180deg, #ffffff 0%, #e2e8f0 100%);
    border: 1px solid #cbd5e1;
    border-bottom: 2px solid #94a3b8;
    box-shadow: 0 1px 2px rgba(0,0,0,0.1), inset 0 1px 0 #ffffff;
  }
  ```

---

### 6. Strict Engineering Constraints (The Anti-Bloat Pact)

When introducing any future UI element, every developer and AI agent **MUST** verify compliance with these laws:

1. **No External CSS Frameworks**: Absolutely no Tailwind, Bootstrap, Sass runtime, or CSS-in-JS libraries.
2. **No Image Assets for UI Chrome**: Gradients, glass reflections, bevels, and shadows must be 100% vector CSS/SVG. No PNG/WebP background textures.
3. **GPU Compositing Cleanliness**: Use `transform` and `opacity` for animations. Avoid animating layout-triggering properties (`width`, `height`, `margin`, `top`).
4. **Frame Rate Inviolability**: The Web Audio clock and HTML5 Canvas notation scroller must maintain rock-solid 60 FPS / 120 FPS. CSS visual effects must not induce main-thread paint stalls.
5. **Mobile-First Ergonomics**: All interactive elements must maintain a minimum touch target of $36\text{px} \times 36\text{px}$ (preferably $40\text{px}$ or larger on phones).

---

### 7. Historical Context & Pedagogical Respect

Guidonica's design is not merely retro nostalgia—it is a functional reflection of Guido d'Arezzo's ethos: **making the invisible, abstract rules of music visible, tangible, and intuitive.** The tactile warmth of Aero skeuomorphism makes digital practice feel like engaging with a finely tuned acoustic instrument.
