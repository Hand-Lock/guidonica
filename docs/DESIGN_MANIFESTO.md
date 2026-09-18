# The Guidonica Design Manifesto
## Aero-Guidonica: Liquid Glass, Skeuomorphic Tactility & Suckless Engineering

> *"Music is the movement of sound to reach the soul for the education of its virtue."*  
> — Guido d'Arezzo (c. 991–1050)

---

### 1. Vision & Core Philosophy

**Aero-Guidonica** unites three fundamental pillars:
1. **Historical Humanist Musical Pedagogy**: Inspired by Guido d'Arezzo's 11th-century revolutionary sight-singing mnemonic (*Manus Guidonica*), solfège tradition, and classical music engraving.
2. **The Golden Age of Digital Tactility (2000–2010)**: The optimistic, sensory, and refractive aesthetics of **Frutiger Aero**, **macOS Aqua**, **Windows Aero**, and **Liquid Glass** skeuomorphism.
3. **The Suckless Web Philosophy**: Absolute refusal of the slow, bloated "modern web". Zero megabyte-heavy frameworks, zero sluggish CSS libraries, zero sprite sheet downloads, zero layout jank.

#### The Suckless Aero Axiom
> **"Sensory richness through mathematical frugality."**  
> We achieve luminous glass, tactile buttons, refractive specular highlights, and physical feedback **entirely through pure, hardware-accelerated CSS3 and SVG vector math**. Not a single kilobyte of external JavaScript UI runtime or heavy raster textures is tolerated.

#### The Chromatic Principle of Olo: LMS (0, 1, 0) & Perceptual Extremes
> **"Guido unlocked the ear; Olo illuminates the eye."**  
> In 2025, vision scientists at UC Berkeley isolated retinal stimulation of the human eye's M-cones (medium-wavelength / green cones) at coordinate $(0, 1, 0)$ in LMS color space—a state never activated in isolation by natural broadband light. They called this hypothetical perceptual color **"Olo"** (from $0-1-0$). On standard digital sRGB displays, the closest attainable approximation is **`#00FFCC`** (an ultra-saturated, electric spring-turquoise / cyan-green).
>
> In Guidonica, Olo is elevated into a core **design principle**:
> - **Pedagogical Parallels**: Just as Guido d'Arezzo made the invisible acoustics of pitch visible and structured through the Guidonian Hand, four-line staff, and solfège syllables, Olo makes the extreme theoretical boundaries of human retinal perception tangible on a digital screen.
> - **Aero Material Resonance**: Within Frutiger Aero and Aqua skeuomorphism, `#00FFCC` is the quintessential luminous liquid crystal hue—radiant, aquatic, optimistic, and hyper-tactile.
> - **Dual-Tier Contrast Architecture**: Because pure `#00FFCC` has high relative luminance ($Y \approx 0.76$), it shines with unmatched brilliance ($>13.5:1$ contrast) in Dark Mode, while in Light Mode it pairs with **Deep Olo / Olo Viridian** (`#008269` / `#007a62`, $>4.6:1$ contrast) for text and staves, using pure `#00FFCC` for specular highlights, glass beads, and radiant hover halos.

#### The Ergodic Principle: State-Space Completeness & Transparent Generation
> **"Every path through the hand must be walked."**  
> Guido d'Arezzo designed the *Manus Guidonica* as an exhaustive, all-encompassing cognitive map of medieval solmization—no legitimate gamut transition was absent. In Guidonica, this manifests as the **Ergodic Generation Principle**: the procedural engine is mathematically guaranteed to explore the complete state space of the user's chosen settings.
> 
> - **Zero Pedagogical Blind Spots**: No valid rhythmic figure (such as `q 8` or `8 q` in 6/8, or `q h` and `h q` in 3/4) or interval leap is suppressed, hijacked, or obscured.
> - **The Infinite Monkey Heuristic**: Given sufficient practice time, every mathematically and grammatically valid musical combination within the chosen configuration will eventually appear with non-zero probability ($P(\omega) > 0$).
> - **Transparent Control**: The generator never hides rules or heuristics behind magic constants. Modifiers such as dotted notes and ties are explicitly exposed as user controls.

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
    - *Light Mode*: `text-shadow: 0 1px 0 rgba(255, 255, 255, 0.8), 0 0 12px rgba(0, 130, 105, 0.18);`
    - *Dark Mode*: `text-shadow: 0 1px 2px rgba(0, 0, 0, 0.9), 0 0 16px rgba(0, 255, 204, 0.35);`

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

#### Light Mode: *Liquid Crystal & Olo Viridian*
- **Mood**: High-clarity optical glass, luminous clear water, crisp alpine sky with vibrant seafoam reflection.
- **Background**: Subtle cool iridescent gradient (`#e3effb` to `#e8f2fc`).
- **Glass Ribbon (Header)**: `rgba(255, 255, 255, 0.76)` with `backdrop-filter: blur(16px) saturate(180%)`.
- **Primary Accent (Aqua-Olo Liquid Gel)**: Luminous spring-turquoise gel (`#00ffcc` specular cap down to `#00b894` and `#00705a` base).
- **High-Contrast Accent (Deep Olo Viridian)**: Deep chromatic Olo (`#008269`, $4.6:1$ contrast) for text, interactive borders, and focus rings.
- **Secondary Surfaces**: Frosted crystal acrylic (`linear-gradient(180deg, #ffffff 0%, #f1f5f9 100%)`).
- **Canvas Base**: Pure optical white (`#ffffff`) preserving optimal sheet music contrast, with Solfège labels in Deep Olo Viridian (`#007a62`).

#### Dark Mode: *Obsidian Aero & Olo Neon*
- **Mood**: Sleek tinted smoked acrylic, deep space cobalt, incandescent neon Olo luminescence.
- **Background**: Deep obsidian blue gradient (`#070b14` to `#0d1628`).
- **Glass Ribbon (Header)**: `rgba(13, 22, 40, 0.78)` with `backdrop-filter: blur(16px) saturate(190%)` and subtle Olo refraction edge (`rgba(0, 255, 204, 0.22)`).
- **Primary Accent (Olo Neon Gel)**: Pure electric Olo (`#00ffcc` specular cap to `#00bfa5` body and `#005a4e` base, $>13.5:1$ contrast).
- **Secondary Surfaces**: Smoked midnight glass (`linear-gradient(180deg, #1e293b 0%, #0f172a 100%)`).
- **Canvas Base**: Midnight slate (`#0f172a`) with cool steel staves and Solfège labels glowing in radiant pure Olo (`#00ffcc`).

---

### 5. Component Archetypes & Construction Rules

#### A. The Primary Gel Button (`#btn-play-pause`)
- **Structure**: Rounded pill button ($R=6\text{px}$), high tactile presence.
- **States**:
  - *Rest*: Multi-layer gradient with top specular gloss arc reflecting `#00ffcc`, rich turquoise/teal body, and outer drop shadow.
  - *Hover*: Luminescent Olo halo (`box-shadow: var(--btn-primary-sheen), 0 0 16px var(--accent-glow), 0 4px 10px rgba(0, 184, 148, 0.4)`).
  - *Active / Pressed*: `transform: translateY(1px)`, inset cavity shadow.
  - *Playing (State Shift)*: Transforms into a radiant Amber/Topaz gel button (`#fbbf24` to `#d97706`).

#### B. Secondary Acrylic Buttons & Icon Controls
- Crisp beveled border with frosted sub-surface reflection. Hover state highlights border in `var(--accent)` with a subtle Olo glow halo.
- Icon controls (`#btn-theme-toggle`, `#btn-fullscreen-toggle`, etc.) are square glass gems with centered micro-glyphs.

#### C. Skeuomorphic Sliders (Tempo & Volume)
- **Track**: Sunken groove well (`box-shadow: inset 0 2px 4px rgba(0,0,0,0.25)`).
- **Thumb**: Polished 3D glass bead or capsule with radial specular reflection hotspot at top-left:
  - *Light Mode*: `radial-gradient(circle at 35% 35%, #ffffff 0%, #00ffcc 30%, #009e80 75%, #006652 100%)`
  - *Dark Mode*: `radial-gradient(circle at 35% 35%, #ffffff 0%, #33ffdb 30%, #00bfa5 75%, #006954 100%)`

#### D. Luminous LED Beat Indicators
- Encased in a frosted glass capsule pill.
- **Inactive Beads**: Softly recessed smoked pearls.
- **Active Downbeat (Beat 1)**: Radiant ruby/coral laser gem with multi-stage radial bloom (`#f43f5e`), forming a complementary Teal & Ruby aesthetic with Olo.
- **Active Sub-beats (2, 3, 4, etc.)**: Luminous Olo glowing sphere (`radial-gradient(...)` with `0 0 12px #00ffcc, 0 0 22px rgba(0, 255, 204, 0.65)`).

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
