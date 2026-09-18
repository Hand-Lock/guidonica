# ADR 0032: Olo (#00FFCC) Chromatic Accent, Perceptual Color Principle, and Liquid Gel Palette Architecture

## Status
Accepted

## Date
2026-09-18

## Context & Design Objectives
Guidonica's visual identity is governed by **Aero-Guidonica** (`docs/DESIGN_MANIFESTO.md`), which synthesizes 11th-century Guidonian musical pedagogy with the optimistic, sensory, and refractive aesthetics of early 2000s skeuomorphism (Frutiger Aero, macOS Aqua, Windows Aero, and Liquid Glass).

Previously, Guidonica utilized standard blue/sky-blue tones (`#2563eb` in Light Mode, `#38bdf8` in Dark Mode) as primary accent colors. While functional, these hues are ubiquitous across modern web applications and lack a distinctive philosophical connection to Guidonica's mission.

The user proposed introducing **"Olo"**—the closest digital sRGB approximation being **`#00FFCC`**—as the primary accent color, and establishing Olo as an authoritative design principle across Guidonica.

### Background on "Olo"
In April 2025, vision researchers at the University of California, Berkeley, achieved isolated stimulation of the human retina's **M-cones** (medium-wavelength / green cones) at coordinate $(0, 1, 0)$ in LMS color space—a perceptual state never activated in isolation under natural broadband sunlight. They named this hypothetical perceptual color **"Olo"** (from $0-1-0$). On standard digital displays, `#00FFCC` represents the closest displayable approximation: an ultra-vivid, hyper-saturated, electric spring-turquoise / cyan-green.

### The Pedagogical Parallel: Guido d'Arezzo and Olo
Guidonica is named in honor of Guido d'Arezzo (c. 991–1050), the Benedictine monk and music theorist who revolutionized Western musical notation:
- Guido invented the Guidonian Hand (*Manus Guidonica*), solfège syllables (*Ut-Re-Mi-Fa-Sol-La*), and the four-line musical staff—transforming the invisible, abstract physics of acoustic pitch into a tangible, visible, and navigable mental model.
- **Olo serves as the exact visual counterpart to Guido's auditory revolution**: it represents human vision science exploring the outer frontier of sensory perception, making the extreme limits of retinal reception visible on screen.

## Decision & Implementation Details

### 1. The Dual-Tier Olo Spectrum (Optical Contrast Engineering)
Pure `#00FFCC` has a high relative luminance ($Y \approx 0.76$ in standard sRGB linear space):
- **Dark Mode (`#070b14` / `#0f172a`)**: `#00FFCC` achieves an extraordinary contrast ratio of $> 13.5:1$, far surpassing WCAG AAA requirements ($7:1$). On midnight obsidian glass, it produces an incandescent, electric liquid glow.
- **Light Mode (`#ffffff` / `#ebf4fc`)**: Against pure white or light pastel backgrounds, pure `#00FFCC` yields a contrast ratio of only $\approx 1.30:1$, which fails WCAG AA ($4.5:1$ for normal text, $3.0:1$ for UI components).

To solve this physical challenge while remaining strictly within the Olo chromatic family ($168^\circ$ hue angle), we engineered the **Dual-Tier Olo Spectrum**:
1. **Olo Core / Neon (`#00FFCC`)**: Used in Dark Mode for accents, borders, and solfège syllables, and across both modes for top specular arcs, radial bead hotspots, glowing halos, and active beat pulses.
2. **Deep Olo / Olo Viridian (`#008269` / `#007a62`)**: A darkened, deeply saturated counterpart in the exact same hue family ($H \approx 168^\circ, S \approx 100\%, L \approx 25\text{--}30\%$), achieving a contrast ratio of **$4.6:1$ to $4.9:1$** against pure white, fully satisfying WCAG AA for text, button borders, focus rings, and canvas solfège syllables.

### 2. Component Architecture & Skeuomorphic Formulations

1. **Primary Gel Button (`#btn-play-pause`)**:
   - *Light Mode*: Styled as an Aqua-Olo Liquid Gel pill. A radiant `#00ffcc` specular cap transitions through lush oceanic teal (`#00b894`) into a deep viridian base (`#00705a`), providing rich tactile depth and ensuring crisp legibility for `#ffffff` text with a subtle deep-teal shadow. On hover, it radiates an electric Olo halo (`box-shadow: 0 0 16px rgba(0, 255, 204, 0.5)`).
   - *Dark Mode*: Styled with an electric Olo neon gloss (`#00ffcc` cap to `#00bfa5` body and `#005a4e` base) with a luminescent border (`rgba(0, 255, 204, 0.65)`).
   - *Playing State*: Seamlessly shifts into an Amber/Topaz gel (`#fbbf24` to `#d97706`), establishing clear cognitive state distinction.

2. **Skeuomorphic Sliders (Tempo, Volume, Zoom)**:
   - Slider thumbs are rendered as 3D polished glass beads with a top-left radial specular highlight:
     - Light Mode: `radial-gradient(circle at 35% 35%, #ffffff 0%, #00ffcc 30%, #009e80 75%, #006652 100%)` with a deep Olo rim (`#00705a`).
     - Dark Mode: `radial-gradient(circle at 35% 35%, #ffffff 0%, #33ffdb 30%, #00bfa5 75%, #006954 100%)` with an electric Olo rim (`#00ffcc`).

3. **Luminous Beat Indicators & The Teal & Ruby Aesthetic**:
   - Active sub-beats (Beats 2, 3, 4, etc.) illuminate as glowing Olo spheres with radial bloom (`0 0 12px #00ffcc, 0 0 22px rgba(0, 255, 204, 0.65)`).
   - The downbeat (Beat 1) and stationary notation playhead line retain their high-visibility Ruby/Coral hue (`#dc2626` / `#f43f5e`).
   - In color theory, Teal/Turquoise and Ruby/Coral are complementary hues. Retaining Ruby for temporal tracking while using Olo for interface chrome creates the quintessential **Teal & Ruby** harmony characteristic of early 2000s Aqua design, ensuring the playhead never gets lost against sheet music staves.

4. **Notation Canvas Solfège Labels (`src/notation/renderer.ts`)**:
   - `solfegeColor` is dynamically mapped:
     - Dark Mode: `#00ffcc` (glowing electric Olo syllables beneath notes on the midnight slate canvas).
     - Light Mode: `#007a62` (Deep Olo Viridian, ensuring $4.9:1$ optical contrast on pure white canvas).

## Consequences

- **Unmistakable Brand Identity**: Guidonica is established with a unique, scientifically inspired visual identity rooted in retinal vision science and humanist music pedagogy.
- **Flawless Contrast & Accessibility**: By implementing the dual-tier spectrum, Guidonica maintains strict WCAG AA/AAA compliance across both Light and Dark themes without sacrificing sensory vibrancy.
- **Suckless Performance Retained**: All glass, gel, glow, and bead effects are executed purely in hardware-accelerated CSS3 and HTML5 Canvas bitwise transfers. Zero additional JavaScript or runtime overhead is introduced.
