# Design System Document: The Sovereign CRM

## 1. Overview & Creative North Star: "The Architectural Authority"
This design system moves beyond the "utility-first" look of standard CRMs to create an environment of **Architectural Authority**. For a law firm, the interface must mirror the physical office: quiet, high-end, and immaculately organized. 

Our Creative North Star is **Subtle Gravitas**. We reject the "boxed-in" feeling of traditional software. Instead of rigid grids and harsh borders, we use expansive white space, intentional asymmetry, and tonal layering. This creates a "Gallery-Lite" aesthetic—where the lead data is the art, and the interface is the sophisticated, silent curator. By utilizing deep navy accents against a multi-tiered grey scale, we convey an atmosphere of trust, precision, and relentless efficiency.

---

## 2. Colors: Tonal Depth & The "No-Line" Rule
The palette is rooted in a "Deep Navy and Slate" spectrum. We use Material Design token logic but apply it with an editorial touch.

### The "No-Line" Rule
**Explicit Instruction:** Designers are prohibited from using 1px solid borders for sectioning or containers. Structural integrity must be achieved through:
1.  **Background Color Shifts:** Placing a `surface_container_low` card on a `surface` background.
2.  **Tonal Transitions:** Using the `surface_container_highest` tier to draw the eye to critical interactive zones.

### Surface Hierarchy & Nesting
Treat the UI as a series of physical layers. Each "inner" container should represent a different level of importance through its surface tier:
- **Base Layer:** `surface` (#f8f9fa) – The foundation of the screen.
- **Section Layer:** `surface_container_low` (#f3f4f5) – Defines large functional areas (e.g., the Sidebar or Filter Pane).
- **Interactive Layer:** `surface_container_lowest` (#ffffff) – Used for primary content cards and data entry areas to make them "pop" against the grey base.

### The "Glass & Gradient" Rule
To elevate the CRM above a standard template, use **Glassmorphism** for floating overlays (Modals, Tooltips, and Dropdowns). Use a semi-transparent `surface_container_lowest` (80% opacity) with a `backdrop-filter: blur(12px)`. 

For Primary Actions, utilize a **Signature Texture**: A subtle linear gradient from `primary` (#000666) to `primary_container` (#1a237e) at a 135-degree angle. This adds "soul" and depth to an otherwise flat interface.

---

## 3. Typography: Editorial Precision
We utilize **Inter** for its neutral, highly legible characteristics, but we apply it with high-contrast scaling to establish a legal "Chain of Command."

*   **The Power Scale:** Use `display-md` (2.75rem) for high-level dashboard metrics (e.g., "Total Lead Value") to create an authoritative focal point.
*   **The Narrative:** `headline-sm` (1.5rem) should be used for Lead Names.
*   **The Data:** `body-md` (0.875rem) is the workhorse for CRM table data, optimized for long-form reading of legal notes.
*   **The Labels:** `label-sm` (0.6875rem) in `secondary` (#506169) should be used for metadata and timestamps, ensuring they are present but never distracting.

---

## 4. Elevation & Depth: Tonal Layering
We do not use shadows to create "lift"; we use them to create **Presence**.

*   **Layering Principle:** Instead of a shadow, place a `surface_container_highest` (#e1e3e4) element inside a `surface` area to indicate a "pressed" or "nested" functional zone.
*   **Ambient Shadows:** For floating elements (like a lead detail fly-out), use an extra-diffused shadow: `0 12px 32px rgba(25, 28, 29, 0.04)`. The shadow color is a tinted version of `on_surface`, preventing the "dirty grey" look of standard shadows.
*   **The "Ghost Border" Fallback:** If a divider is mandatory for accessibility, use the `outline_variant` (#c6c5d4) at **15% opacity**. It should be felt, not seen.

---

## 5. Components: Refined Utility

### Buttons
*   **Primary:** Gradient fill (`primary` to `primary_container`), `on_primary` text. No border. 8px (`DEFAULT`) corner radius.
*   **Secondary:** `surface_container_high` fill with `primary` text.
*   **Tertiary:** Transparent background, `primary` text, underlined only on hover.

### Lead Status Indicators (Custom Component)
Instead of standard "pills," use **Minimalist Tokens**:
*   A 4px vertical bar on the left edge of a card using `surface_tint` for "Active" and `error` for "Urgent/Lost."
*   Status text in `label-md`, all-caps with 0.05em letter spacing for a professional, legal-brief feel.

### Cards & Lists
*   **Rule:** Forbid 1px divider lines between list items.
*   **Execution:** Use 12px of vertical white space and a `surface_container_low` hover state to separate lead records. This keeps the data feeling airy and modern.

### Input Fields
*   **Styling:** Fields should not have a 4-sided border. Use a "Subtle Inset" look: a `surface_container_highest` background with a 2px bottom-border in `outline` (#767683). On focus, the bottom border transitions to `primary`.

### Legal Timeline Component
A custom vertical stepper for lead progression. Use `outline_variant` for the line and `primary_fixed` for completed steps. The current step should utilize a `primary` pulse to draw attention without being loud.

---

## 6. Do's and Don'ts

### Do
*   **DO** use whitespace as a functional tool. If a screen feels cluttered, increase the margin, don't add a border.
*   **DO** use `surface_container_lowest` for the main canvas of a lead's profile to emphasize the "Pure Paper" feel.
*   **DO** use `on_surface_variant` (#454652) for helper text to maintain a soft visual hierarchy.

### Don't
*   **DON'T** use pure black (#000000). Always use `on_surface` (#191c1d) to keep the contrast professional yet sophisticated.
*   **DON'T** use 100% opaque borders to separate table columns. Use 16px of padding (gutter) instead.
*   **DON'T** use vibrant, "SaaS-y" bright colors. Stick to the muted, authoritative tones of the `secondary` and `tertiary` palettes.