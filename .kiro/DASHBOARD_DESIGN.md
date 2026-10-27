# Dashboard Redesign - Design Specification

**Based on Mockup**  
**Project:** PT Bumi Sarana Maju – Attendance System  
**Component:** Halaman Beranda (Home)

---

## 1. Page Layout Structure

```
┌─────────────────────────────────────────────────────┐
│ HEADER (56px height)                                │
│ - Logo (left, 40px x 40px, blue rounded square)   │
│ - Company name "PT Bumi Sarana Maju + subtitle    │
│ - Bell icon (notification, right)                  │
│ - Menu icon (3 dots, right)                        │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ GREETING SECTION (padding: 16px)                   │
│ - "SELASA, 27 OKT 2026" (12px, gray, uppercase)   │
│ - "Selamat siang, Nufail" (28px, bold, name=blue) │
│ - "IT - Support System" (14px, gray)              │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ HERO CARD (gradient blue, 24px radius, padding: 20) │
│ ─────────────────────────────────────────────────  │
│ Header: WAKTU SERVER (12px, white)  [◯ Hadir]     │
│ ─────────────────────────────────────────────────  │
│ Time: 14:28:09 (40px, bold, white, tabular)       │
│ ─────────────────────────────────────────────────  │
│ Progress Ring (80px) + text                        │
│ [83%]  Jam kerja hari ini                          │
│        6j 38m dari target 8jam                     │
│ ─────────────────────────────────────────────────  │
│ Check-in/Check-out Cards (2 columns)              │
│ [✓ CHECK-IN]     [↩ CHECK-OUT]                    │
│  07:49:48        Belum check-out                  │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ ACTION BUTTON (full width, 56px, red gradient)    │
│ [⬅ Check-out Sekarang]                           │
│                                                     │
│ 🔒 Waktu dicatat server, tidak bisa diubah...    │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ WEEKLY SUMMARY (padding: 16px)                     │
│ Title: "Ringkasan bulan ini"                       │
│                                                     │
│ [18]        [1]          [2]                       │
│ Hari hadir  Terlambat    Izin / Cuti              │
│ (green)     (orange)     (blue)                    │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ QUICK LINKS (2 columns, gap: 12px)               │
│ ┌──────────────┬──────────────┐                   │
│ │ 📊 Statistik │ 🕐 Cuti&Izin │                   │
│ │ Performa     │ Pengajuan    │                   │
│ └──────────────┴──────────────┘                   │
└─────────────────────────────────────────────────────┘

[Space for bottom nav]

┌─────────────────────────────────────────────────────┐
│ BOTTOM NAVIGATION (56px height + safe area)        │
│ [🏠 Beranda] [📋] [📊] [👤]                      │
└─────────────────────────────────────────────────────┘
```

---

## 2. Component Specifications

### 2.1 Header Component

**Dimensions:**
- Height: 56px
- Padding: 16px (mobile) / 24px (tablet)
- Background: white
- Border-bottom: 1px solid #E5E7EB

**Left Section:**
- Logo: 40×40px, blue rounded square (#2563EB), calendar icon (white)
- Text wrapper:
  - Company name: 14px, bold, #111827
  - Subtitle: 12px, gray, #6B7280
  - Gap: 4px

**Right Section:**
- Bell icon: 20px, #6B7280
- Menu icon (3 dots): 20px, #6B7280
- Gap between: 12px
- Each clickable area: 44×44px minimum

---

### 2.2 Greeting Section

**Layout:** Flex column
**Padding:** 16px top/bottom, 16px left/right
**Gap:** 8px

**Date:**
- Font: 12px, bold
- Text: uppercase "SELASA, 27 OKT 2026"
- Color: #6B7280
- Letter-spacing: 0.05em

**Greeting:**
- Font: 28px (mobile) / 32px (tablet), bold
- Format: "Selamat {waktu}, {nama}"
- Name color: #2563EB
- Rest: #111827

**Department:**
- Font: 14px, normal
- Color: #6B7280
- Format: "IT - Support System"

---

### 2.3 Hero Card (Main Attendance Component)

**Container:**
- Background: Gradient #1D4ED8 → #2563EB (135deg)
- Border-radius: 24px
- Padding: 20px
- Shadow: 0 10px 25px rgba(0,0,0,0.1)
- Margin: 16px

**Header Row:**
- Label "WAKTU SERVER": 12px, white, uppercase, letter-spacing 0.05em
- Status badge (right): 
  - Bg: #DCFCE7 (green light)
  - Text: #15803D (green dark)
  - Padding: 4px 8px
  - Border-radius: 12px
  - Font: 12px, semibold
  - Content: "◯ Hadir" or equivalent

**Time Display:**
- Font: 40px, bold, white
- Font-family: monospace (tabular numbers)
- Format: HH:MM:SS (24-hour)
- Update: every 1000ms from server
- Letter-spacing: -0.02em

**Progress Ring Section:**
- Layout: Flex row, gap 20px, items center
- Progress ring:
  - SVG or Canvas circle
  - Size: 80×80px
  - Stroke-width: 6px
  - Color: white (or light blue)
  - Background: rgba(255,255,255,0.2)
  - Start angle: -90°
  - Display: percentage (83%)
  - Font: 24px, bold, white, centered

**Progress Text:**
- Line 1: "Jam kerja hari ini" (14px, white)
- Line 2: "6j 38m" (20px, bold, white)
- Line 3: "dari target 8jam" (12px, rgba(255,255,255,0.9))

**Check-in/Check-out Cards:**
- Container: 2-column grid, gap 12px
- Each card:
  - Background: white
  - Padding: 12px
  - Border-radius: 12px
  - Font: 14px

**Left Card (Check-in):**
- Icon: ✓ (green circle, 20px)
- Label: "CHECK-IN" (11px, uppercase, gray)
- Time: "07:49:48" (18px, bold, black, monospace/tabular)

**Right Card (Check-out):**
- Icon: ↩ (gray circle, 20px)
- Label: "CHECK-OUT" (11px, uppercase, gray)
- Content:
  - If not checked out: "Belum check-out" (14px, gray)
  - If checked out: time (18px, bold, black) + duration (12px, gray)

---

### 2.4 Action Button

**Dimensions:**
- Width: 100% - 32px (16px margin each side)
- Height: 56px
- Border-radius: 12px
- Font: 16px, bold, white
- Margin: 16px 16px 0 16px

**Styling:**
- Background: red gradient #DC2626 → #991B1B (or linear-gradient(135deg, #EF4444 0%, #DC2626 100%))
- Shadow: 0 4px 12px rgba(220, 38, 38, 0.3)
- State:
  - Default: as above
  - Hover: brightness(1.1)
  - Active: scale(0.98)
  - Loading: opacity(0.7) + spinner icon
  - Disabled: opacity(0.5), cursor not-allowed

**Icon + Text:**
- Gap: 8px
- Icon: 20px (logout/arrow-left)
- Text: "Check-out Sekarang"

---

### 2.5 Security Note

**Layout:** Flex row, items center, justify center
**Margin:** 12px 16px 0 16px
**Gap:** 6px

- Icon: 🔒 (14px)
- Text: "Waktu dicatat server, tidak bisa diubah dari perangkat" (12px, gray #6B7280)
- Text-align: center

---

### 2.6 Weekly Summary

**Container:**
- Margin: 20px 16px 16px 16px
- Padding: 0

**Title:**
- Font: 14px, bold, #111827
- Margin-bottom: 12px
- Text: "Ringkasan bulan ini" or "Ringkasan minggu ini"

**Stats Grid:**
- Display: grid, 3 columns
- Gap: 16px
- Responsive: 3 col on all viewports (or 1 col on very small?)

**Each Stat Card:**
- Background: white
- Padding: 12px
- Border-radius: 12px
- Shadow: 0 1px 3px rgba(0,0,0,0.1)
- Text-align: center

**Stat Value:**
- Font: 24px, bold
- Color: semantic (green/orange/blue)

**Stat Label:**
- Font: 12px, gray
- Color: #6B7280
- Margin-top: 4px

**Cards:**
1. Green (Hadir): value=18, label="Hari hadir"
2. Orange (Terlambat): value=1, label="Terlambat"
3. Blue (Cuti): value=2, label="Izin / Cuti"

---

### 2.7 Quick Links

**Container:**
- Display: grid
- Grid-cols: 2 (mobile), 4 (tablet+)
- Gap: 12px
- Padding: 0 16px 16px 16px
- Margin-bottom: 80px (for bottom nav safe area)

**Each Card:**
- Background: white
- Padding: 16px
- Border-radius: 12px
- Shadow: 0 1px 3px rgba(0,0,0,0.05)
- State:
  - Default: shadow-sm
  - Hover: shadow-md, scale(1.02)
  - Active: scale(0.95)

**Icon Badge:**
- Size: 40×40px
- Border-radius: full (32px)
- Gradient background:
  - Statistik: #3B82F6 → #2563EB
  - Cuti & Izin: #06B6D4 → #0891B2
- Icon: white, 20px, centered

**Text:**
- Label: 14px, bold, #111827
- Description: 12px, gray, #6B7280
- Gap: 4px
- Margin-top: 8px

---

### 2.8 Bottom Navigation

**Container:**
- Position: fixed, bottom 0
- Width: 100vw
- Height: 56px + safe-area-inset-bottom
- Padding-bottom: env(safe-area-inset-bottom)
- Background: white
- Border-top: 1px solid #E5E7EB
- Shadow: 0 -2px 8px rgba(0,0,0,0.1)

**Nav Items:**
- Display: grid, 4 columns
- Each item: flex column, items center, justify center
- Height: 56px
- Clickable area: full cell (≥ 44×44px)

**Item States:**
- Default: icon gray (#6B7280), label hidden or 10px gray
- Active: 
  - Background: pill shape (rounded full, height 32px, width auto+16px padding)
  - Color: #2563EB
  - Background: #EFF6FF or rgba(37,99,235,0.1)

**Icons:**
- Size: 24px
- Spacing: 4px between icon and label

---

## 3. Colors & Gradients (from tokens.ts)

**Hero Card Gradient:**
```css
background: linear-gradient(135deg, #1D4ED8 0%, #2563EB 100%);
```

**Quick Link Gradients:**
- Statistik: `linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)`
- Cuti & Izin: `linear-gradient(135deg, #06B6D4 0%, #0891B2 100%)`

**Action Button Gradient:**
```css
background: linear-gradient(135deg, #EF4444 0%, #DC2626 100%);
```

**Status Colors:**
- Hadir: bg #DCFCE7, text #15803D
- Terlambat: bg #FED7AA, text #C2410C
- Izin: bg #E0E7FF, text #3730A3

---

## 4. Responsive Breakpoints

**Mobile (360px - 430px):**
- Hero card: full width - 32px margin
- Quick links: 2 columns
- Progress ring: 80px
- Time font: 40px

**Tablet (640px+):**
- Hero card: max-w-2xl (672px)
- Quick links: 4 columns (or responsive grid)
- Progress ring: 100px
- Time font: 48px
- Header padding: 24px

**Desktop (1024px+):**
- Same as tablet
- Centered layout with max-width

---

## 5. Typography Scale

| Element | Size | Weight | Line Height | Color |
|---------|------|--------|-------------|-------|
| Greeting | 28px (sm: 32px) | bold (700) | 1.2 | #111827 |
| Date | 12px | bold (600) | 1.5 | #6B7280 |
| Card title | 16px | semibold (600) | 1.5 | #111827 |
| Body | 14px | normal (400) | 1.5 | #111827 |
| Small/Label | 12px | medium (500) | 1.4 | #6B7280 |
| Tiny | 11px | medium (500) | 1.4 | #6B7280 |
| Time (server) | 40px (sm: 48px) | bold (700) | 1 | white |
| Stat value | 24px | bold (700) | 1 | semantic |

---

## 6. Spacing System (based on tokens.ts)

- xs: 4px
- sm: 8px
- md: 12px
- lg: 16px
- xl: 20px
- 2xl: 24px
- 3xl: 32px

---

## 7. Animation & Transitions

**Durations:**
- Fast: 150ms (micro-interactions)
- Normal: 200ms (hover effects)
- Slow: 300ms (page transitions)

**Easings:**
- ease-in-out: cubic-bezier(0.4, 0, 0.2, 1)

**Applied to:**
- Button hover/active: 150ms ease-in-out
- Card hover: 200ms ease-in-out
- Status update: 300ms fade transition
- Bottom nav pill: 200ms ease-in-out

---

## 8. Accessibility

**Contrast Requirements:**
- Text on white: ≥ 4.5:1 (WCAG AA)
- Text on colored backgrounds: ≥ 4.5:1

**Touch Targets:**
- Minimum 44×44px (button, icon, link)
- Padding for small elements

**ARIA & Semantic HTML:**
- `<header>` for header
- `<main>` for hero & content
- `<nav>` for bottom navigation
- `aria-label` on icons
- `aria-current="page"` on active nav item
- `role="status"` for real-time updates (clock)

**Keyboard Navigation:**
- All buttons focusable (tab order)
- Focus visible outline (2px ring)
- No focus trap

**prefers-reduced-motion:**
- Disable animations if user prefers reduced motion
- Keep functionality intact

---

## 9. Implementation Notes

**Reuse Components:**
- `StatusBadge` from `src/components/layout/badges.tsx`
- `Button` component for action buttons
- `ProgressMeter` or custom progress ring

**New Components:**
- `HeroCard` (main attendance display)
- `GreetingSection` (header + greeting)
- `WeeklySummary` (stat cards)
- `QuickLinks` (action links)
- Update `MobileNav` (bottom nav pill indicator)

**CSS Classes:**
- Use Tailwind utility classes
- Custom CSS for gradient fills (SVG progress ring)
- CSS variables for colors from globals.css

**Performance:**
- Real-time clock: update interval 1000ms (not 100ms)
- Memoize components (React.memo) to prevent unnecessary re-renders
- Lazy load weekly summary if needed

