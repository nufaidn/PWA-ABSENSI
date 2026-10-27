# Redesign Halaman Beranda - Design Specification

**Proyek:** PT Bumi Sarana Maju – Attendance System  
**Komponen Utama:** Dashboard Home Page  
**Design Language:** Modern, Clean, Professional (Fintech/HR reference)  
**Theme:** Light Only (OKLCH Color System)

---

## 1. Design Tokens (Foundation)

### 1.1 Color Palette (dari globals.css)

**Primary Brand:**
- `--primary`: oklch(0.545 0.222 260) → Biru brand (#4F7BCC approx)
- `--primary-foreground`: oklch(0.99 0.005 250) → Putih

**Semantic Status:**
- `--success`: oklch(0.565 0.145 163) → Hijau (hadir, on-time)
- `--warning`: oklch(0.665 0.17 74) → Oranye (terlambat, late)
- `--destructive`: oklch(0.565 0.235 27) → Merah (error, aksi check-out)

**Neutrals:**
- `--background`: oklch(0.974 0.014 252) → Putih soft
- `--foreground`: oklch(0.21 0.035 264) → Hitam/Abu tua
- `--muted-foreground`: oklch(0.52 0.045 258) → Abu-abu
- `--border`: oklch(0.902 0.019 256) → Abu-abu sangat light

**Muted Variants:**
- `--success-muted`: oklch(0.945 0.04 163) → Light hijau (background)
- `--warning-muted`: oklch(0.955 0.05 82) → Light oranye (background)
- `--info-muted`: oklch(0.945 0.035 234) → Light biru

**Secondary:**
- `--accent`: oklch(0.936 0.038 257) → Very light blue
- `--muted`: oklch(0.955 0.016 254) → Sangat light abu

### 1.2 Typography

**Font Family:**
- Sans: Geist Sans (via next/font/google)
- Mono: Geist Mono (via next/font/google)
- Feature: `font-feature-settings: "cv11", "ss01"`

**Scale:**
- H1 (Greeting): 28px (sm: 32px), font-bold, gradient text
- H2 (Card title): 15px, font-semibold
- Body (Regular): 13–14px
- Label (Small): 11–12px, uppercase, tracking-wide
- Tabular (Time): 32px+, .tabular class untuk alignment

### 1.3 Spacing

- **4px:** xs
- **8px:** sm
- **12px:** md (gutter standard)
- **16px:** lg
- **24px:** xl
- **32px:** 2xl
- **48px:** 3xl

**Container Padding:**
- Mobile: px-4 (16px)
- Tablet+: px-6 (24px)
- Max-width: max-w-2xl (672px)

### 1.4 Border Radius

- `--radius-sm`: 0.45rem (6px)
- `--radius-md`: 0.6rem (9px)
- `--radius-lg`: 0.75rem (12px) [default]
- `--radius-xl`: 1.05rem (16px)
- `--radius-2xl`: 1.35rem (18px)
- `--radius-3xl`: 1.65rem (24px)
- `--radius-4xl`: 1.95rem (32px)

### 1.5 Shadows & Elevation

```css
.surface-elevated {
  box-shadow:
    0 1px 2px 0 oklch(0.35 0.06 262 / 0.06),
    0 2px 6px 0 oklch(0.35 0.06 262 / 0.07),
    0 8px 24px -12px oklch(0.35 0.08 262 / 0.14);
}
```

- **Subtle:** `shadow-sm`
- **Medium:** default `.surface-elevated`
- **Strong:** untuk hover/focus states (increase shadow)

---

## 2. Page Layout Structure

```
┌─────────────────────────────────────────┐
│  Status Bar (time, signal, battery)     │  [iOS only]
├─────────────────────────────────────────┤
│  HEADER                                 │
│  ┌─────────────────────────────────────┐│
│  │ Logo + Menu (3-dot) + Avatar + Bell ││
│  └─────────────────────────────────────┘│
├─────────────────────────────────────────┤
│  GREETING + METADATA                    │
│  "Selamat siang, Nufail"                │
│  "27 OKT 2026 • IT - Support System"    │
├─────────────────────────────────────────┤
│  HERO CARD (Attendance Status)          │
│  ┌─────────────────────────────────────┐│
│  │ [Status] [Location]                 ││
│  │ ⏱️ 08:35:47 (HH:MM:SS)             ││
│  │                                     ││
│  │ ⭕ Progress Ring (jam kerja)         ││
│  │ 5 jam 42 menit / 8 jam target      ││
│  │                                     ││
│  │ Check-in: 07:49:48 | Check-out: —  ││
│  │                                     ││
│  │ [ACTION BUTTON - CHECK-OUT]         ││
│  │ 🔒 Waktu dicatat server             ││
│  └─────────────────────────────────────┘│
├─────────────────────────────────────────┤
│  WEEKLY SUMMARY (Optional)              │
│  ┌─────────────────────────────────────┐│
│  │ ✓ Hadir: 5 | ⚠ Terlambat: 1       ││
│  │ ⏱ Total: 42.5 jam | ⬆ Lembur: 2.5 jam││
│  └─────────────────────────────────────┘│
├─────────────────────────────────────────┤
│  QUICK LINKS                            │
│  ┌──────────────┬──────────────┐        │
│  │ 📊 Statistik │ 🗓 Cuti&Izin│        │
│  │ Performa Anda│ Pengajuan    │        │
│  └──────────────┴──────────────┘        │
├─────────────────────────────────────────┤
│  [SAFE AREA BOTTOM]                     │
└─────────────────────────────────────────┘
┌─────────────────────────────────────────┐
│  BOTTOM NAVIGATION                      │
│  [🏠 Beranda] [📋 Riwayat] [📈 Stat]   │
│  [👤 Profil]                            │
│  [SAFE AREA PADDING BOTTOM]             │
└─────────────────────────────────────────┘
```

---

## 3. Component Design Details

### 3.1 Header Bar (Top Navigation)

**Layout:** Flex row, space-between
- **Left:** Logo + Company name (wordmark)
- **Center:** (empty)
- **Right:** Avatar (monogram, 32px) + Notification bell (icon) + Menu (3-dot)

**Styling:**
- Background: transparent (inherit page background)
- Height: 56px (safe touch target)
- Border-bottom: 1px solid `--border`
- Padding: px-4 sm:px-6

**Avatar:**
- Size: 32px (sm: 40px)
- Border-radius: rounded-full
- Background: `--accent` (light blue)
- Color: `--primary`
- Font: font-semibold, text-sm

**Bell Icon:**
- Size: 20px
- Color: `--muted-foreground`
- Hover: `--foreground`

### 3.2 Greeting Section

**Content:**
```
Selamat siang, Nufail
27 OKT 2026 • IT - Support System
```

**Styling:**
- Heading: H1, 28px (sm: 32px), font-bold, tracking-tight
  - Optional: gradient text `from-slate-900 via-blue-800 to-slate-900`
- Date: text-xs (12px), uppercase, tracking-wide, muted-foreground
- Divider: "•" (center-aligned)
- Department: text-sm (14px), muted-foreground, font-medium

**Interaction:** Static, no animation

---

### 3.3 Hero Card (Attendance Status)

**Container:**
- Background: white (--card)
- Border-radius: 1.5rem (24px)
- Padding: 24px (6 spacing units)
- Shadow: `.surface-elevated`
- Border: 1px solid `--border` (optional, subtle)

**Status Row (Top):**
```
[✓ Hadir Badge] [📍 Lokasi Valid]
```
- StatusBadge: font-medium, 12px, pill-shaped
  - Hadir: bg-success/10, text-success-foreground, border success/30
  - Terlambat: bg-warning/10, text-warning-foreground, border warning/30
  - Belum: bg-muted, text-muted-foreground
- Location chip (if available): ikon + text, muted styling

**Jam Server (Center):**
```
08:35:47
WAKTU SERVER
```
- Time: font-bold, 48px (sm: 56px), `.tabular` class
- Label: text-xs, uppercase, muted-foreground
- Update: setiap 1 detik dari server
- No jitter: gunakan .tabular untuk alignment

**Progress Ring/Bar (Middle):**
- Visual: Circular progress ring (180–240 degrees) atau horizontal bar
- Diameter: 120px (ring) atau full-width (bar)
- Color: --primary (blue)
- Muted background: --muted
- Stroke-width: 6px
- Label (center): "5 jam 42 menit" (bold, 16px)
- Subtitle: "/ 8 jam target" (12px, muted)

**Check-in / Check-out (Bottom):**
- Layout: 2 kolom equal width
- Border-top: 1px solid `--border`
- Padding-top: 16px, Padding-bottom: 16px

**Left Column (Check-in):**
```
🔵 CHECK-IN
07:49:48
```
- Icon: blue circle (20px) dengan check mark
- Label: text-xs, uppercase, muted-foreground
- Time: text-sm, font-bold, foreground, `.tabular`

**Right Column (Check-out):**
```
⭕ CHECK-OUT
Belum check-out   (jika belum)
atau
16:27:35          (jika sudah)
5 jam 37 menit    (durasi, jika sudah)
```
- Icon: outline circle (20px) atau X jika belum
- Label: text-xs, uppercase, muted-foreground
- Time: text-sm, font-bold
  - Jika belum: "Belum check-out" (muted, font-medium)
  - Jika sudah: waktu (foreground, font-bold)
- Duration: text-xs, muted-foreground (hanya jika check-out)

**Action Button (Full Width):**
- Height: 56px (min-h-14)
- Border-radius: `--radius-lg` (12px)
- Font: font-semibold, 16px
- Gap: 8px (ikon + text)
- State:
  - Default: gradient (biru atau merah), shadow, white text
  - Hover: brightness +5%
  - Active: scale(0.98), brightness -5%
  - Loading: spinner icon, disabled
  - Disabled: opacity-50, cursor-not-allowed

**Check-in Button:**
- Background: `from-blue-600 to-blue-700`
- Icon: LogIn (size 20px)
- Text: "Check-in Sekarang"

**Check-out Button:**
- Background: `from-destructive to-orange-600`
- Icon: LogOut (size 20px)
- Text: "Check-out Sekarang"
- Optional: bottom sheet dialog untuk konfirmasi sebelum submit

**Completed Button (Baik check-in maupun check-out sudah selesai):**
- Background: `--muted`
- Icon: CheckCircle2
- Text: "Absensi hari ini selesai"
- Disabled: true

**Security Note (Di bawah button):**
```
🔒 Waktu dicatat server, tidak bisa diubah dari perangkat
```
- Layout: flex, items-center, gap-2
- Icon: Lock (14px), muted-foreground
- Text: text-xs, muted-foreground, text-center
- Styling: center-aligned, no background

---

### 3.4 Weekly Summary Card (Optional, Under Hero)

**Optional:** Bisa jadi separate card atau integrated di dalam hero (perlu konfirmasi)

**Container:**
- Background: white
- Border-radius: 1rem (16px)
- Padding: 16px
- Shadow: subtle (`shadow-sm`)

**Grid (2 baris × 2 kolom):**
```
┌─────────────────────────────────┐
│ ✓ Hadir: 5      │ ⚠ Terlambat: 1 │
├─────────────────┼─────────────────┤
│ ⏱ Total: 42.5   │ ⬆ Lembur: 2.5  │
│    jam           │    jam          │
└─────────────────────────────────┘
```

**Each Stat Cell:**
- Text-center
- Icon (28px) + Value (24px, bold) + Unit (12px, muted)
- Colors: icon sesuai semantik (hijau, oranye, biru)

---

### 3.5 Quick Links Section

**Layout:** Grid, 2 kolom (sm: 4 kolom, tapi dashboard mungkin 2 kolom utama)

**Each Card:**
- Background: white
- Border-radius: `--radius-2xl` (18px)
- Padding: 16px
- Shadow: `shadow-sm` → hover: `shadow-md`
- Transition: smooth, 300ms

**Content:**
```
┌──────────────────┐
│ 🔵 Ikon (round)  │
├──────────────────┤
│ Statistik        │  [Label, 14px bold]
│ Performa Anda    │  [Description, 12px muted]
│                  │
│              →   │  [Chevron, right]
└──────────────────┘
```

**Icon Badge:**
- Size: 40px
- Border-radius: full
- Background: gradient (Statistik: blue, Cuti & Izin: cyan)
- Icon: white, 20px

**Label:** text-sm (14px), font-semibold, foreground
**Description:** text-xs (12px), muted-foreground
**Chevron:** size-4, muted-foreground, hover: primary (smooth transition)

**Hover Effect:**
- Shadow meningkat
- Chevron slide-right +2px
- Background: very subtle overlay

---

## 4. Micro-interactions & Animations

### 4.1 Entry Animation
- Fade-in + slide-in-from-top pada page load
- Duration: 300ms
- Stagger: 100ms per elemen

### 4.2 Button Press
- Scale: 0.98
- Duration: 100ms
- Easing: cubic-bezier(0.4, 0, 0.6, 1)

### 4.3 Loading State
- Spinner icon rotate, infinite
- Button text fade → loading text
- Duration: 200ms transition

### 4.4 Status Change
- Fade transition saat status update (check-in → check-out)
- Duration: 300ms

### 4.5 Hover Effects
- Card shadow increase (subtle)
- Icon color transition (muted → primary)
- Duration: 200ms

### 4.6 Skeleton Loading (optional)
- Placeholder gradient pulse (pulsing shimmer)
- Until real-time data arrives

### 4.7 prefers-reduced-motion
```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 5. Responsive Breakpoints

**Mobile (360–430px):**
- Header: height 56px, horizontal padding 16px
- Greeting: H1 28px, subtitle stacked
- Hero card: 2-column layout (Check-in, Check-out side-by-side)
- Quick links: 2 columns
- Progress ring: 100px diameter

**Tablet (640px+):**
- Header: height 64px, horizontal padding 24px
- Greeting: H1 32px
- Hero card: 3-column layout (Check-in, Progress, Check-out)
- Quick links: 4 columns
- Progress ring: 140px diameter

**Desktop (1024px+):**
- Max-width: 672px (max-w-2xl) centered
- Hero card: full-width dengan centered content

**Safe Areas:**
```css
padding-bottom: env(safe-area-inset-bottom);
padding-left: env(safe-area-inset-left);
padding-right: env(safe-area-inset-right);
```

---

## 6. Accessibility (WCAG AA)

### 6.1 Color Contrast
- Text on white: minimum 4.5:1 (AA large)
- Badge text: 7:1+ (AAA)
- Icon + text always present (no color-only signal)

### 6.2 Interactive Elements
- Minimum touch target: 44×44px
- Buttons: min-h-14 (56px)
- Links: clear visual indicator

### 6.3 Semantic HTML
```html
<main role="main">
  <header>
  <section id="greeting">
  <section id="attendance">
  <section id="summary">
  <section id="quick-links">
</main>
```

### 6.4 ARIA Labels
- `aria-label` pada ikon
- `aria-current="page"` pada active nav item
- `aria-busy="true"` saat loading

### 6.5 Form & Input
- Label sebelum input
- Error messages dengan role="alert"
- Success toast dengan role="status"

### 6.6 Motion
- Respect `prefers-reduced-motion`
- No animated GIF yang berkilau >3x/detik

---

## 7. Dark Mode (Future, Not in Scope)

Saat ini hanya light mode. Jika dark mode ditambah nanti:
- Gunakan CSS `@media (prefers-color-scheme: dark)`
- Override warna di `:root.dark` atau `.dark` class
- Maintain contrast ratios

---

## 8. Design System Consistency

### 8.1 Reusable Patterns

**Status Badge:**
```tsx
<StatusBadge
  label="Hadir"
  className="bg-success/10 text-success ring-success/30"
  dotClassName="bg-success"
/>
```

**Stat Card (Weekly Summary):**
```tsx
<Stat
  label="Hadir"
  value="5"
  icon={CheckCircle2}
  tone="success"
/>
```

**Quick Link Card:**
```tsx
<QuickLink
  href="/statistics"
  icon={TrendingUp}
  label="Statistik"
  description="Performa Anda"
  gradient="from-blue-500 to-blue-600"
/>
```

### 8.2 Token Usage
- Selalu gunakan CSS variables dari `:root`
- Tidak hardcode color values
- Use semantic class names: `text-success`, `bg-warning/10`, dll

---

## 9. Deviations & Confirmations Needed

**Perlu Konfirmasi User:**
1. Konfirmasi dialog sebelum check-out? (Bottom sheet modal atau slide-to-confirm)
2. Haptic feedback support? (vibration API)
3. Pull-to-refresh? (Jika user mau refresh jam server)
4. Weekly summary card terpisah atau integrated di hero?
5. Avatar di header (optional feature)?
6. Notification bell di header (optional feature)?

---

## 10. File Structure (Output)

Komponen yang akan dibuat/diubah:
```
src/
├── app/(app)/dashboard/page.tsx          [MAIN - redesign]
├── components/attendance/
│   ├── attendance-card.tsx               [UPDATE - styling]
│   ├── hero-card.tsx                     [NEW - extracted]
│   └── weekly-summary.tsx                [NEW - optional]
├── components/dashboard/
│   ├── greeting-section.tsx              [NEW]
│   └── quick-links.tsx                   [NEW]
└── lib/attendance/
    └── use-server-clock.ts               [EXISTING - reuse]
```

---

## 11. Performance Checklist

- [ ] Lazy load weekly summary (if not critical)
- [ ] Skeleton loading state untuk attendance data
- [ ] Real-time clock dengan debounce/interval
- [ ] Memoize components yang tidak perlu re-render
- [ ] Optimize images (logo, icon SVG)
- [ ] CSS-in-JS minimal (Tailwind static)

