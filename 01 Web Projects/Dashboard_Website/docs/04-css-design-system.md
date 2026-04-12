# CSS Design System — RetireAU Dashboard

## Overview

This document defines the complete visual design system for the RetireAU dashboard, extracted from the existing single-file HTML dashboard (`Retirement_Dashboard_v2.html`). Use this as the single source of truth when implementing the Tailwind CSS theme.

---

## Colour Palette

### CSS Custom Properties → Tailwind Config

| Token | Hex | RGB | Usage | Tailwind Extension |
|-------|-----|-----|-------|--------------------|
| `--bg` | `#0f172a` | `15, 23, 42` | Page background | `colors.dashboard.bg` |
| `--surface` | `#1e293b` | `30, 41, 59` | Card backgrounds, panels | `colors.dashboard.surface` |
| `--surface2` | `#334155` | `51, 65, 85` | Input backgrounds, secondary surfaces | `colors.dashboard.surface2` |
| `--text` | `#f1f5f9` | `241, 245, 249` | Primary text | `colors.dashboard.text` |
| `--muted` | `#94a3b8` | `148, 163, 184` | Secondary text, labels | `colors.dashboard.muted` |
| `--accent` | `#38bdf8` | `56, 189, 248` | Primary accent (sky blue) | `colors.dashboard.accent` |
| `--green` | `#4ade80` | `74, 222, 128` | Success, positive values | `colors.dashboard.green` |
| `--red` | `#f87171` | `248, 113, 113` | Warning, negative values, debt | `colors.dashboard.red` |
| `--orange` | `#fb923c` | `251, 146, 60` | Caution, alerts | `colors.dashboard.orange` |
| `--purple` | `#a78bfa` | `167, 139, 250` | Tertiary accent, inheritance | `colors.dashboard.purple` |
| `--teal` | `#2dd4bf` | `45, 212, 191` | Secondary accent, savings | `colors.dashboard.teal` |
| `--yellow` | `#fbbf24` | `251, 191, 36` | Quaternary accent | `colors.dashboard.yellow` |
| `--border` | `#475569` | `71, 85, 105` | Borders, dividers | `colors.dashboard.border` |

### Semantic Colour Usage

- **Positive financial values** (equity, surplus, gains): `--green` (`#4ade80`)
- **Negative financial values** (debt, deficit, loss): `--red` (`#f87171`)
- **Caution/alert** (warnings, outstanding loans): `--orange` (`#fb923c`)
- **Primary interactive** (active tabs, focus rings, links): `--accent` (`#38bdf8`)
- **Inheritance/projection** (future values, estimates): `--purple` (`#a78bfa`)
- **Savings/teal** (savings rate, cumulative rent): `--teal` (`#2dd4bf`)
- **Labels and secondary text**: `--muted` (`#94a3b8`)

### Alpha Variations (for Backgrounds)

Used extensively for subtle tinted backgrounds:

```
rgba(56, 189, 248, 0.04)   — hover highlight (accent)
rgba(56, 189, 248, 0.06)   — preservation age row
rgba(56, 189, 248, 0.08)   — highlight row, accent card bg, info alert bg
rgba(56, 189, 248, 0.1)    — chart fill (accent)
rgba(56, 189, 248, 0.15)   — badge-blue bg

rgba(74, 222, 128, 0.06)   — loans cleared row
rgba(74, 222, 128, 0.15)   — badge-green bg

rgba(248, 113, 113, 0.06)  — fixed expense row
rgba(248, 113, 113, 0.08)  — credit card row
rgba(248, 113, 113, 0.1)   — chart fill (red)
rgba(248, 113, 113, 0.15)  — badge-red bg

rgba(251, 146, 60, 0.1)    — warn alert bg
rgba(251, 146, 60, 0.15)   — badge-orange bg
rgba(251, 146, 60, 0.3)    — warn alert border

rgba(167, 139, 250, 0.12)  — chart fill (purple)
rgba(167, 139, 250, 0.15)  — badge-purple / net equity chart fill

rgba(45, 212, 191, 0.08)   — chart fill (teal)
```

---

## Typography

### Font Stack

```css
font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
```

In Tailwind: `font-sans` with custom fontFamily config.

### Type Scale

| Element | Size | Weight | Transform | Letter Spacing | Tailwind |
|---------|------|--------|-----------|----------------|----------|
| Page title (H1) | 1.8rem (28.8px) | 700 | — | — | `text-3xl font-bold` |
| Section title | 1.2rem (19.2px) | 700 | — | — | `text-xl font-bold` |
| Card heading (H2) | 1rem (16px) | 600 | — | — | `text-base font-semibold` |
| KPI value | 1.6rem (25.6px) | 700 | — | — | `text-2xl font-bold` |
| Scenario big number | 1.3rem (20.8px) | 700 | — | — | `text-xl font-bold` |
| Default body text | 0.8rem (12.8px) | 400 | — | — | `text-sm` |
| Input text | 0.85rem (13.6px) | 400 | — | — | `text-sm` |
| Alert text | 0.85rem (13.6px) | 400 | — | line-height 1.5 | `text-sm leading-relaxed` |
| Sub/detail text | 0.78rem (12.5px) | 400 | — | — | `text-xs` |
| Table header | 0.7rem (11.2px) | 600 | uppercase | 0.05em | `text-xs font-semibold uppercase tracking-wide` |
| Labels (KPI, control) | 0.7rem (11.2px) | 600 | uppercase | 0.05em | `text-xs font-semibold uppercase tracking-wide` |
| Badge text | 0.68rem (10.9px) | 600 | — | — | `text-[11px] font-semibold` |
| Table cell | 0.8rem (12.8px) | 400 | — | — | `text-sm` |
| Footer | 0.75rem (12px) | 400 | — | — | `text-xs` |

---

## Spacing & Layout

### Border Radius

- Cards, alerts, panels: `12px` (`rounded-xl`)
- Inputs: `8px` (`rounded-lg`)
- Badges, pills, progress bars: `999px` (`rounded-full`)
- Tab first-child: `8px 0 0 0` (custom, top-left only)
- Tab last-child: `0 8px 0 0` (custom, top-right only)

### Container

- Max width: `1500px` (`max-w-[1500px]`)
- Padding: `24px` (`p-6`)
- Centered: `margin: 0 auto` (`mx-auto`)

### Card Padding

- Standard card: `22px` (`p-5` or `p-[22px]`)
- KPI card: `18px` (`p-4` or `p-[18px]`)
- Alert: `16px 20px` (`px-5 py-4`)
- Controls panel: `20px` (`p-5`)

### Grid Gaps

- KPI grid: `14px` (`gap-3.5`)
- 2-col/3-col grids: `20px` (`gap-5`)
- Controls: `16px` (`gap-4`)
- Tab row: `0` (`gap-0`)

### Chart Heights

- Default chart: `300px` (`h-[300px]`)
- Table scroll container: max-height `500px` (`max-h-[500px] overflow-y-auto`)

---

## Component Patterns

### KPI Card

```
┌─────────────────────────────────┐
│ LABEL (xs, uppercase, muted)    │
│ $1.2M (2xl, bold, coloured)     │
│ Detail text (xs, muted)         │
│ ████████░░░ (progress bar)      │
└─────────────────────────────────┘
```

**Structure:**
- Background: `--surface`
- Border: `1px solid --border`
- Border-radius: `12px`
- Padding: `18px`

**Highlight variant:**
- Border-colour: `--accent`
- Background: gradient `linear-gradient(135deg, rgba(56,189,248,0.08), --surface)`

**Content:**
- Label: 0.7rem, weight 600, uppercase, colour `--muted`
- Value: 1.6rem, weight 700, colour semantic (green/red/accent)
- Detail: 0.78rem, weight 400, colour `--muted`
- Progress bar: 0.5rem height, `--surface2` track, semantic colour fill

### Card

```
┌─────────────────────────────────┐
│ 📊 Card Title                   │
│                                 │
│  [Chart or content area]        │
│                                 │
└─────────────────────────────────┘
```

**Structure:**
- Background: `--surface`
- Border: `1px solid --border`
- Border-radius: `12px`
- Padding: `22px`

**Title:**
- Font size: 1rem (16px)
- Font weight: 600
- Icon + text with 8px gap
- Flexbox layout

### Alert Box

```
┌─ ℹ️ ──────────────────────────────┐
│  Alert message text with         │
│  **bold highlights** and         │
│  detailed information.           │
└──────────────────────────────────┘
```

**Info variant:**
- Background: `rgba(56,189,248,0.08)`
- Border: `1px solid rgba(56,189,248,0.2)`
- Border-radius: `12px`

**Warn variant:**
- Background: `rgba(251,146,60,0.1)`
- Border: `1px solid rgba(251,146,60,0.3)`
- Border-radius: `12px`

**Content:**
- Icon: 1.3rem, flex-shrink-0
- Text: 0.85rem, weight 400, line-height 1.5
- Layout: flexbox, gap 12px, align-items flex-start
- Bold text within: weight 600

### Badge

- Shape: Pill (border-radius 999px)
- Padding: 2px 8px
- Font: 0.68rem (11px), weight 600
- Variants: green, orange, red, blue, purple
  - Green badge: `--green` text, `rgba(74,222,128,0.15)` bg
  - Red badge: `--red` text, `rgba(248,113,113,0.15)` bg
  - Orange badge: `--orange` text, `rgba(251,146,60,0.15)` bg
  - Blue badge: `--accent` text, `rgba(56,189,248,0.15)` bg
  - Purple badge: `--purple` text, `rgba(167,139,250,0.15)` bg

### Progress Bar

- Track: 0.5rem height, `--surface2` bg, border-radius 999px
- Fill: 0.5rem height, border-radius 999px, semantic colour
- Animation: `transition: width 0.5s ease`
- No easing bounce or overshooting

### Table

**Structure:**
- Width: 100%
- Border-collapse: collapse
- Overflow: auto (horizontal scroll on mobile)

**Header:**
- Background: `--surface`
- Colour: `--muted`
- Font size: 0.7rem
- Font weight: 600
- Text transform: uppercase
- Letter spacing: 0.05em
- Border-bottom: `1px solid --border`
- Padding: 0.5rem 0.625rem (8px 10px)
- Position: sticky top

**Cells:**
- Padding: 0.625rem (10px) horizontal, 0.5rem (8px) vertical
- Border-bottom: `1px solid rgba(71,85,105,0.3)`
- Font size: 0.8rem
- Font weight: 400

**Row hover:**
- Background: `rgba(56,189,248,0.04)`

**Highlight row:**
- Background: `rgba(56,189,248,0.08)`
- Font weight: 600

**Right-aligned cells:**
- Text-align: right

### Tabs

**Layout:**
- Flexbox row, gap 0, flex-wrap

**Individual tab:**
- Padding: 0.625rem 1.125rem (10px 18px)
- Background: `--surface2`
- Colour: `--muted`
- Font size: 0.8rem
- Font weight: 600
- Border: `1px solid --border` (all sides)
- Cursor: pointer
- Transition: all 0.2s

**Active tab:**
- Background: `--surface`
- Colour: `--accent`
- Border-bottom-colour: `--surface` (creates "connected" appearance)

**First-child tab:**
- Border-top-left-radius: 8px

**Last-child tab:**
- Border-top-right-radius: 8px

**Hover (inactive):**
- Background: slightly lighter (opacity shift on `--surface2`)

### Drop Zone (File Upload)

**Container:**
- Border: `2px dashed --border`
- Border-radius: 12px
- Padding: 2rem (32px)
- Background: `--surface`
- Text-align: center

**Hover/drag-over:**
- Border-colour: `--accent`
- Background: `rgba(56,189,248,0.06)`
- Transition: all 0.2s

**Icon:**
- Font size: 2.4rem
- Opacity: 0.5
- Colour: `--muted`

**Text:**
- Colour: `--muted`
- Font size: 0.85rem
- Strong text: colour `--accent`

### Section Title

- Font size: 1.2rem
- Font weight: 700
- Colour: `--text`
- Margin: 1.75rem 0 0.875rem (28px 0 14px)
- Padding-bottom: 0.5rem (8px)
- Border-bottom: `1px solid --border`

### Header

**Container:**
- Background: `linear-gradient(135deg, #1e293b, #0f172a)`
- Border-bottom: `1px solid --border`
- Padding: 1.5rem 2rem (24px 32px)

**Layout:**
- Flexbox row, space-between, align-items center, wrap
- Gap: 0.75rem (12px)

**Version badge:**
- Background: `--surface2`
- Colour: `--accent`
- Border: `1px solid --accent`
- Border-radius: 999px
- Padding: 0.375rem 0.75rem (6px 12px)
- Font size: 0.75rem
- Font weight: 600

### Footer

**Container:**
- Text-align: center
- Padding: 1.75rem (28px)
- Border-top: `1px solid --border`
- Margin-top: 2rem (32px)

**Text:**
- Colour: `--muted`
- Font size: 0.75rem
- Font weight: 400
- Line-height: 1.6

---

## Tailwind Config Extension

```javascript
// tailwind.config.ts (or .js)
module.exports = {
  theme: {
    extend: {
      colors: {
        dashboard: {
          bg: '#0f172a',
          surface: '#1e293b',
          surface2: '#334155',
          text: '#f1f5f9',
          muted: '#94a3b8',
          accent: '#38bdf8',
          green: '#4ade80',
          red: '#f87171',
          orange: '#fb923c',
          purple: '#a78bfa',
          teal: '#2dd4bf',
          yellow: '#fbbf24',
          border: '#475569',
        }
      },
      fontFamily: {
        sans: [
          'Segoe UI',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'sans-serif'
        ],
      },
      borderRadius: {
        'card': '12px',
        'input': '8px',
      },
      maxWidth: {
        'dashboard': '1500px',
      },
      spacing: {
        'card': '22px',
        'card-sm': '18px',
      }
    }
  }
}
```

---

## Chart.js Theme Constants

For use in `useChartTheme.ts` or equivalent chart configuration:

```typescript
export const CHART_THEME = {
  // Grid and tick styling
  gridColor: 'rgba(71, 85, 105, 0.3)',
  gridColorLight: 'rgba(71, 85, 105, 0.2)',
  tickColor: '#94a3b8',
  
  // Legend
  legendColor: '#94a3b8',
  legendFont: {
    size: 11,
    weight: 400,
    family: "'Segoe UI', system-ui, sans-serif"
  },
  
  // Axis
  tickFont: {
    size: 10,
    weight: 400,
    family: "'Segoe UI', system-ui, sans-serif"
  },
  
  // Tooltip
  tooltipBg: '#1e293b',
  tooltipBorder: '#475569',
  tooltipTitleColor: '#f1f5f9',
  tooltipBodyColor: '#94a3b8',
  tooltipFont: {
    size: 11,
    weight: 400
  },
  
  // Dataset colours (in order of use)
  series: {
    green: {
      line: '#4ade80',
      fill: 'rgba(74, 222, 128, 0.1)'
    },
    accent: {
      line: '#38bdf8',
      fill: 'rgba(56, 189, 248, 0.1)'
    },
    red: {
      line: '#f87171',
      fill: 'rgba(248, 113, 113, 0.08)'
    },
    teal: {
      line: '#2dd4bf',
      fill: 'rgba(45, 212, 191, 0.08)'
    },
    purple: {
      line: '#a78bfa',
      fill: 'rgba(167, 139, 250, 0.12)'
    },
    orange: {
      line: '#fb923c',
      fill: 'rgba(251, 146, 60, 0.1)'
    },
    yellow: {
      line: '#fbbf24',
      fill: 'rgba(251, 191, 36, 0.1)'
    }
  }
};
```

---

## Responsive Breakpoints

| Breakpoint | Width | Behaviour |
|------------|-------|-----------|
| Desktop | > 1000px | Full grid layouts (2-col, 3-col, scenario grids) |
| Tablet | 768–1000px | All grids collapse to single column |
| Mobile | < 768px | Stacked layout, horizontal scroll on tables |

**Primary responsive rule:**

```css
@media (max-width: 1000px) {
  .grid-2,
  .grid-3 {
    grid-template-columns: 1fr;
  }
}
```

**In Tailwind:**

```html
<div class="grid grid-cols-1 lg:grid-cols-2 gap-5">
  <!-- Content -->
</div>

<div class="grid grid-cols-1 lg:grid-cols-3 gap-5">
  <!-- Content -->
</div>
```

Use `lg:` prefix for breakpoints > 1024px (default Tailwind lg breakpoint). Adjust config if strict 1000px breakpoint is required:

```javascript
theme: {
  screens: {
    'sm': '640px',
    'md': '768px',
    'lg': '1000px',  // Override default 1024px
    'xl': '1280px',
  }
}
```

---

## Animation & Transitions

All animations maintain a professional, financial-dashboard aesthetic. No bouncing, parallax, or decorative motion.

### Transition Rules

- **Progress bar fill**: `transition: width 0.5s ease`
- **Controls panel toggle**: `transition: transform 0.3s ease`
- **Tab interactions**: `transition: all 0.2s ease`
- **Hover states**: `transition: all 0.2s ease`
- **Bar/line chart animation**: `transition: width 0.4s ease` (for data updates)

### Easing Functions

- Default: `ease` (equivalent to cubic-bezier(0.25, 0.46, 0.45, 0.94))
- No ease-out bounce or elastic easing
- No fade-in, zoom, or scale animations on initial load

### Example Tailwind Classes

```html
<!-- Progress bar -->
<div class="transition-all duration-500 ease-out"></div>

<!-- Tab hover -->
<button class="transition-all duration-200"></button>

<!-- Expandable panel toggle -->
<svg class="transition-transform duration-300"></svg>
```

---

## Summary Table: Quick Reference

| Item | Value | Tailwind |
|------|-------|----------|
| Background | `#0f172a` | `bg-dashboard-bg` |
| Surface | `#1e293b` | `bg-dashboard-surface` |
| Text primary | `#f1f5f9` | `text-dashboard-text` |
| Text secondary | `#94a3b8` | `text-dashboard-muted` |
| Accent | `#38bdf8` | `text-dashboard-accent` |
| Green (positive) | `#4ade80` | `text-dashboard-green` |
| Red (negative) | `#f87171` | `text-dashboard-red` |
| Card radius | 12px | `rounded-xl` |
| Container padding | 24px | `p-6` |
| Card padding | 22px | `p-[22px]` |
| KPI padding | 18px | `p-[18px]` |
| Grid gap | 20px | `gap-5` |
| Font family | Segoe UI, system | `font-sans` |
| H1 size | 28.8px | `text-3xl font-bold` |
| Body text | 12.8px | `text-sm` |
| Label text | 11.2px | `text-xs uppercase font-semibold` |

