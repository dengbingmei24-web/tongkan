# Design — 同看 Web

A locked design system for the Tongkan Web app. Every Web page reads this system before visual changes. Do not regenerate a separate theme per page; extend this file when the shared product language grows.

## Product Character

- Genre: modern-minimal utility app
- Tone: quiet, trustworthy, close to a focused viewing tool rather than a marketing landing page
- Relationship to Android: Web and Android share the same neutral light-first visual language, radii and state semantics
- Brand color rule: green is reserved for online and success; it is never a page background or primary action color

## Macrostructure Family

- Entry and join pages: open two-column utility workspace; explanation and action stay visually balanced
- Room pages: media-first workstation; the video stage owns the page and the session rail remains compact
- Diagnostic pages: dense instrument panel using the same tokens, typography and interaction states

## Theme

### Light (default)

- Paper: `#F3F3F0`
- Surface: `#FFFFFF`
- Ink: `#171817`
- Rule: `#D9D9D2`
- Raised neutral: `#E5E5DF`

### Dark

- Paper: `#0B0C0D`
- Surface: `#171819`
- Ink: `#F4F4F1`
- Rule: `#303236`
- Raised neutral: `#282A2D`

Theme choice is stored in `localStorage` under `tongkan:theme`. With no stored preference, light mode is used.

## Typography

- Display and body: Geist Variable
- Mono data: JetBrains Mono
- Display weight: 650–720, never oversized beyond the task hierarchy
- Body line height: 1.55
- Tight headings, neutral body copy, no decorative italic or gradient text

## Shape

- Buttons and inputs: 12px radius
- Cards and media containers: 16px radius
- Pills only for compact status badges
- Surfaces are separated by whitespace and 1px rules, not decorative shadows

## Layout

- Main content width: 1120px entry pages, 1280px room pages
- Desktop room layout: flexible media stage plus 320px session rail
- Mobile: one column, media first, then session controls
- Minimum touch target: 44px
- Safe-area padding is included on mobile navigation and page edges

## Interaction

- Every button has default, hover, focus, pressed, disabled and loading/success/error treatments where applicable
- Pressed state uses a small color change and 1px downward movement
- Focus ring is visible and independent from success green
- Loading buttons keep readable text and prevent duplicate submission
- Motion is restrained; no ornamental entrance choreography
- Reduced-motion mode disables translation and long transitions

## Page Rules

### Home

- Compact top bar with brand, environment status, useful links and theme switch
- Title stays between 42–56px on desktop and 36–44px on mobile
- Creation form is the primary surface; the right preview explains synchronization without pretending to be interactive
- No radial gradients, orange controls, glass blur cards or floating capsule navigation

### Join

- Uses the same open surface language as Home
- Validation exposes `aria-invalid`, `aria-describedby` and alert text
- Invitation failure and nickname failure remain actionable and visible

### Room

- Media stage dominates width and hierarchy
- Room state and participants are compact metadata, not a second hero
- Session rail contains media loading, invite and chat in clear blocks
- When Bilibili is loaded without the extension, the media stage uses a centered no-extension sharing card instead of a passive local-only warning
- The sharing card has one graphite primary action, a quiet “open Bilibili tab” secondary action and a three-step browser-tab/audio checklist; it uses borders and surface contrast rather than decorative shadow
- During no-extension sharing, unavailable room playback controls are hidden and copy states that the sharer controls playback in the Bilibili tab
- Voice remains visibly unavailable until implemented and must not behave like an active button
- Status notices use polite live regions

## README Showcase

- Use one composed product board instead of independently sized screenshots
- Board ratio: approximately 16:10
- Entry, light viewing, dark viewing and landscape states share one grid, baseline and label system
- Landscape is supporting evidence, not a full-width image that overwhelms the mobile screens
