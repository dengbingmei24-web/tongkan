## Design System: Tongkan Cinema

### Pattern
- **Name:** Immersive/Interactive Experience
- **Conversion Focus:** 40% higher engagement. Performance trade-off. Provide skip option. Mobile fallback essential.
- **CTA Placement:** After interaction complete + Skip option for impatient users
- **Color Strategy:** Immersive experience colors. Dark background for focus. Highlight interactive elements.
- **Sections:** 1. Full-screen interactive element, 2. Guided product tour, 3. Key benefits revealed, 4. CTA after completion

### Style
- **Name:** Dark Mode (OLED)
- **Mode Support:** Light ✗ No | Dark ✓ Only
- **Keywords:** Dark theme, low light, high contrast, deep black, midnight blue, eye-friendly, OLED, night mode, power efficient
- **Best For:** Night-mode apps, coding platforms, entertainment, eye-strain prevention, OLED devices, low-light
- **Performance:** ⚡ Excellent | **Accessibility:** ✓ WCAG AAA

### Colors
| Role | Hex | CSS Variable |
|------|-----|--------------|
| Primary | `#1E1B4B` | `--color-primary` |
| On Primary | `#FFFFFF` | `--color-on-primary` |
| Secondary | `#312E81` | `--color-secondary` |
| Accent/CTA | `#CA8A04` | `--color-accent` |
| Background | `#0F0F23` | `--color-background` |
| Foreground | `#F8FAFC` | `--color-foreground` |
| Muted | `#27273B` | `--color-muted` |
| Border | `#4338CA` | `--color-border` |
| Destructive | `#EF4444` | `--color-destructive` |
| Ring | `#1E1B4B` | `--color-ring` |

*Notes: Dramatic dark + spotlight gold*

### Typography
- **Heading:** Inter
- **Body:** Inter
- **Mood:** dark, cinematic, technical, precision, clean, premium, developer, professional, high-end utility
- **Best For:** Developer tools, fintech/trading, AI dashboards, streaming platforms, high-end productivity apps
- **Google Fonts:** https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap
- **CSS Import:**
```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
```

### Key Effects
Minimal glow (text-shadow: 0 0 10px), dark-to-light transitions, low white emission, high readability, visible focus

### Avoid (Anti-patterns)
- Poor booking UX
- No trailers

### Pre-Delivery Checklist
- [ ] No emojis as icons (use SVG: Heroicons/Lucide)
- [ ] cursor-pointer on all clickable elements
- [ ] Hover states with smooth transitions (150-300ms)
- [ ] Light mode: text contrast 4.5:1 minimum
- [ ] Focus states visible for keyboard nav
- [ ] prefers-reduced-motion respected
- [ ] Responsive: 375px, 768px, 1024px, 1440px
