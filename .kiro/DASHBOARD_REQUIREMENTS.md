# Dashboard Redesign - Requirements Specification

**Based on Mockup Provided**  
**Project:** PT Bumi Sarana Maju – Attendance System  
**Component:** Halaman Beranda (Home Dashboard) - Role User  
**Status:** Ready for Implementation

---

## 1. Visual Overview (from Mockup)

```
┌────────────────────────────────────────┐
│ Header: Logo, Company Name, Bell, Menu │
├────────────────────────────────────────┤
│ SELASA, 27 OKT 2026                    │
│ Selamat siang, Nufail                  │
│ IT - Support System                    │
├────────────────────────────────────────┤
│ ┌──── HERO CARD (Gradient Blue) ─────┐ │
│ │ WAKTU SERVER         ◯ Hadir       │ │
│ │ 14:28:09                           │ │
│ │                                    │ │
│ │ ┌─ Progress Ring ─┐                │ │
│ │ │ 83%  Jam kerja  │                │ │
│ │ │      6j 38m     │                │ │
│ │ │  dari target 8jam              │ │
│ │ └────────────────┘                │ │
│ │                                    │ │
│ │ ✓ CHECK-IN     ↩ CHECK-OUT         │ │
│ │ 07:49:48       Belum check-out    │ │
│ └────────────────────────────────────┘ │
│                                         │
│ [Check-out Sekarang] (Red, Full Width) │
│ 🔒 Waktu dicatat server...             │
│                                         │
│ Ringkasan bulan ini:                   │
│ 18 Hadir  |  1 Terlambat  |  2 Izin    │
│                                         │
│ 📊 Statistik        🕐 Cuti & Izin     │
│ Performa Anda       Pengajuan          │
│                                         │
├────────────────────────────────────────┤
│ Bottom Nav: Beranda | Riwayat | ...   │
└────────────────────────────────────────┘
```

---

## 2. Functional Requirements

### 2.1 Header Section
- **FR-001:** Display company logo (blue rounded square with calendar icon)
- **FR-002:** Display company name "PT Bumi Sarana Maju" + "Attendance System"
- **FR-003:** Display notification bell icon (right side)
- **FR-004:** Display menu icon (3 dots, right side)
- **FR-005:** Header sticky on scroll

### 2.2 Greeting Section
- **FR-006:** Display date: "SELASA, 27 OKT 2026" (uppercase, gray)
- **FR-007:** Display greeting: "Selamat siang, [Nama]" (name = blue #2563EB)
- **FR-008:** Display department: "IT - Support System" (gray, smaller)

### 2.3 Hero Card (Gradient Blue)
- **FR-009:** Background: gradient blue (#1D4ED8 → #2563EB)
- **FR-010:** Border radius: 24px
- **FR-011:** Padding: 20px
- **FR-012:** Display "WAKTU SERVER" label (white, smaller)
- **FR-013:** Display time in large digital font (32-40px, white, tabular)
- **FR-014:** Update time every 1 second from server
- **FR-015:** Display status badge "Hadir" (green background #DCFCE7, green text)

### 2.4 Progress Ring (Inside Hero Card)
- **FR-016:** Circular progress ring showing work hours percentage (0-100%)
- **FR-017:** Size: ~80-100px diameter
- **FR-018:** Stroke: 6-8px
- **FR-019:** Color: white (or light blue)
- **FR-020:** Background: darker blue
- **FR-021:** Center text: percentage (83%)
- **FR-022:** Below progress: "Jam kerja hari ini"
- **FR-023:** Below: "6j 38m" (bold, white)
- **FR-024:** Below: "dari target 8jam" (smaller, white)

### 2.5 Check-in / Check-out Cards (Inside Hero Card)
- **FR-025:** Two white cards side-by-side
- **FR-026:** Left card: ✓ CHECK-IN label + time (07:49:48)
- **FR-027:** Right card: ↩ CHECK-OUT label + status
- **FR-028:** If not checked out: "Belum check-out" (gray text)
- **FR-029:** If checked out: time + duration
- **FR-030:** Card padding: 12px
- **FR-031:** Card border radius: 12px

### 2.6 Action Button
- **FR-032:** Text: "Check-out Sekarang" (white text)
- **FR-033:** Background: red/orange gradient (#DC2626 or similar)
- **FR-034:** Icon: logout icon (white)
- **FR-035:** Height: 56px (full width)
- **FR-036:** Border radius: 12px
- **FR-037:** Below button: "🔒 Waktu dicatat server, tidak bisa diubah dari perangkat"

### 2.7 Weekly Summary
- **FR-038:** Title: "Ringkasan bulan ini" (or "Ringkasan minggu ini")
- **FR-039:** Three stat cards in a row:
  - Left: 18 | Hari hadir (green)
  - Middle: 1 | Terlambat (orange)
  - Right: 2 | Izin / Cuti (blue)
- **FR-040:** Large number (24-28px, bold)
- **FR-041:** Label below (12px, gray)

### 2.8 Quick Links
- **FR-042:** Two cards (or more on tablet) with icon badges
- **FR-043:** Statistik: blue icon (#3B82F6), text "Statistik", description "Performa Anda"
- **FR-044:** Cuti & Izin: teal/cyan icon (#06B6D4), text "Cuti & Izin", description "Pengajuan"
- **FR-045:** Cards background: white, shadow, rounded 12-16px
- **FR-046:** Cards responsive: 2 col on mobile, 4 col on tablet

### 2.9 Bottom Navigation
- **FR-047:** Active tab indicator: pill-shaped (rounded background)
- **FR-048:** Tabs: Beranda (active/blue), Riwayat, Statistik, Profil
- **FR-049:** Safe area padding on iOS/Android

---

## 3. Non-Functional Requirements

### 3.1 Styling & Design
- **NFR-001:** Use centralized design tokens (colors, spacing, radius)
- **NFR-002:** No new dependencies (use existing Tailwind, shadcn)
- **NFR-003:** Responsive: 360px mobile → 1024px+ desktop
- **NFR-004:** Light theme only (no dark mode)

### 3.2 Performance
- **NFR-005:** Real-time clock: update every 1 second (no jitter)
- **NFR-006:** Lazy load weekly summary & quick links (optional)
- **NFR-007:** Skeleton loading state while fetching data
- **NFR-008:** Time to Interactive: ≤ 3 seconds

### 3.3 Accessibility
- **NFR-009:** WCAG AA contrast (4.5:1 for text)
- **NFR-010:** Touch targets minimum 44×44px
- **NFR-011:** ARIA labels on icons & buttons
- **NFR-012:** Semantic HTML structure

### 3.4 Compatibility
- **NFR-013:** Support iOS 14+, Android 8+
- **NFR-014:** Respect safe-area-inset (notch, gesture bar)
- **NFR-015:** No JavaScript errors on load

---

## 4. Data Structure (No Changes)

**Keep existing:**
- `getTodaySummary()` API response
- `AttendanceCardData` interface
- `useServerClock()` hook

**Add if needed:**
- Weekly summary data (hadir, terlambat, izin count)
  - Check if already in `getTodaySummary()` or need new API call

---

## 5. Color Specifications

| Element | Color | Hex | Purpose |
|---------|-------|-----|---------|
| Hero card bg | Blue gradient | #1D4ED8 → #2563EB | Primary brand |
| Status badge | Green | #DCFCE7 (bg), #15803D (text) | Hadir |
| Terlambat | Orange | #FED7AA (bg), #C2410C (text) | Late |
| Action button | Red | #DC2626 or #EF4444 | Check-out |
| Quick link icons | Blue / Cyan | #3B82F6 / #06B6D4 | Actions |
| Text primary | Black | #111827 | Body text |
| Text muted | Gray | #6B7280 | Secondary text |
| Background | Light gray | #F9FAFB | Page bg |

---

## 6. Acceptance Criteria

- [ ] Hero card displays with correct blue gradient (top-left to bottom-right)
- [ ] Real-time clock updates every 1 second without flicker
- [ ] Progress ring shows correct percentage (work hours / 8)
- [ ] Check-in/Check-out cards display correctly (time or "Belum check-out")
- [ ] Action button full width, 56px height, red gradient
- [ ] Weekly summary shows 18 hadir, 1 terlambat, 2 izin
- [ ] Quick links display with icon badges (blue & cyan gradient)
- [ ] Bottom nav shows pill indicator on active tab
- [ ] Responsive on 360px, 430px, 640px, 1024px viewports
- [ ] No horizontal scroll on any viewport
- [ ] Lighthouse Performance ≥ 85, Accessibility ≥ 90
- [ ] WCAG AA contrast passed (≥ 4.5:1)
- [ ] Touch targets ≥ 44×44px
- [ ] Zero TypeScript errors
- [ ] Git commit with clear message

---

## 7. Technical Stack (No Changes)

- **Framework:** Next.js 16.4.2 + React 19
- **Styling:** Tailwind CSS v4
- **UI Library:** shadcn/ui components
- **Icons:** lucide-react
- **Design Tokens:** `src/lib/design/tokens.ts` (NEW)

---

## 8. Files to Create/Modify

**New:**
- `src/lib/design/tokens.ts` (Design tokens)
- `src/components/dashboard/hero-card.tsx`
- `src/components/dashboard/greeting-section.tsx`
- `src/components/dashboard/weekly-summary.tsx`

**Modify:**
- `src/app/(app)/dashboard/page.tsx` (Main layout)
- `src/components/attendance/attendance-card.tsx` (Extract hero logic)
- `src/components/layout/navigation.tsx` (Bottom nav pill)

---

## 9. Success Metrics

1. ✅ UI matches mockup pixel-perfect
2. ✅ All functional requirements met
3. ✅ Real-time clock stable (no jitter)
4. ✅ Responsive 360px → 1024px+
5. ✅ WCAG AA accessibility passed
6. ✅ Lighthouse scores: Perf ≥ 85, A11y ≥ 90
7. ✅ No breaking changes to API/data
8. ✅ Clean git history with clear commits

