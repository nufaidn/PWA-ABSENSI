# Dashboard Redesign - Executive Summary

**Project:** PT Bumi Sarana Maju – Attendance System  
**Component:** Halaman Beranda (Home Dashboard) - Role User  
**Approach:** Modern UI redesign without API/logic changes  
**Status:** ✅ Spec Complete - Ready for Implementation

---

## 🎯 What We're Solving

**Current State (Problems):**
- Hierarki visual datar dengan elemen dalam satu card
- Durasi kerja di tempat yang salah (di bawah check-out padahal belum checkout)
- Ruang kosong yang tidak terpakai
- Quick links terlalu kecil dan tidak menarik
- Tombol aksi tidak menonjol dengan cukup
- Tidak ada animasi atau micro-interactions

**Target State (Design Goals):**
- Modern, hidup, dan professional feel (Fintech/HR reference)
- Jelas visual hierarchy dengan spacing, color, typography
- Progress ring/bar untuk jam kerja yang meaningful
- Besar check-in/check-out cards dengan status jelas
- Ringkasan minggu untuk context dan space utilization
- Smooth micro-interactions dan animations
- Full accessibility (WCAG AA, responsive, safe-area)

---

## 📐 Design System Approach

**Color Palette:** Semantic (dari globals.css OKLCH tokens)
- Primary Brand: Biru (`oklch(0.545 0.222 260)`)
- Status Success: Hijau (`oklch(0.565 0.145 163)`)
- Status Warning: Oranye (`oklch(0.665 0.17 74)`)
- Status Destructive: Merah (`oklch(0.565 0.235 27)`)

**Typography:** Geist Sans + Geist Mono (existing)
- H1: 28px (sm: 32px), bold, optional gradient
- Body: 13–14px
- Label: 11–12px, uppercase
- Time: 32px+, `.tabular` class for alignment

**Components:** Reuse existing (Surface, Stat, Monogram, StatusBadge)
- No new dependencies
- Tailwind v4 + CSS variables

---

## 🏗️ Page Layout Structure

```
HEADER (logo, avatar, bell, menu)
    ↓
GREETING SECTION ("Selamat siang, Nufail" + date + dept)
    ↓
HERO CARD - Attendance Status
├─ Status badges (Hadir/Terlambat/Belum)
├─ Real-time clock (HH:MM:SS, tabular)
├─ Progress ring/bar (jam kerja: X/8 jam)
├─ Check-in | Check-out mini-cards
├─ Action button (Check-in atau Check-out)
└─ Security note (🔒 Waktu dari server)
    ↓
WEEKLY SUMMARY (optional)
├─ ✓ Hadir: 5  |  ⚠ Terlambat: 1
└─ ⏱ Total: 42.5 jam  |  ⬆ Lembur: 2.5 jam
    ↓
QUICK LINKS (2 kolom)
├─ 📊 Statistik
└─ 🗓 Cuti & Izin
    ↓
[SAFE AREA BOTTOM]
    ↓
BOTTOM NAV (pill indicator, larger icons)
[SAFE AREA PADDING]
```

---

## 🎨 Key Changes Per Component

### 1. Hero Card (Attendance Status)
- **Before:** Everything in one flat card, "—" for no checkout
- **After:** Gradient container, clear sections, "Belum check-out" text, progress ring
- **New Elements:** Progress ring/bar, status badges, check-in/out mini-cards
- **Styling:** Rounded-3xl (24px), shadow-elevated, white card

### 2. Greeting Section
- **Before:** Simple "Halo, {name}" text
- **After:** Dynamic sapaan ("Selamat pagi/siang/malam"), date + dept subtitle
- **Styling:** H1 gradient text (optional), proper hierarchy

### 3. Quick Links
- **Before:** Small flat cards with just icon + text
- **After:** Larger cards with icon badge (gradient circle), chevron, hover effects
- **Styling:** White, rounded-2xl, shadow-sm → shadow-md on hover

### 4. New: Weekly Summary
- **What:** Horizontal grid (hadir, terlambat, total jam, lembur)
- **Why:** Fill white space + provide useful context
- **Data:** TBD - confirm if available in getTodaySummary()

### 5. Bottom Navigation
- **Before:** Underline indicator, normal icon size (19px)
- **After:** Pill-shaped indicator, larger icons (22px)
- **Styling:** Smooth transitions, safe-area-inset-bottom

---

## ⚡ Micro-interactions

| Element | Animation | Duration | Easing |
|---------|-----------|----------|--------|
| Page Load | Fade-in + slide-from-top (staggered) | 300ms | ease-out |
| Button Press | Scale 0.98 | 100ms | cubic-bezier |
| Hover Effects | Shadow increase, color transition | 200ms | ease |
| Status Change | Fade transition | 300ms | ease |
| Loading State | Spinner rotate (infinite) | – | linear |
| Respects | prefers-reduced-motion: reduce | – | – |

---

## 📱 Responsive Strategy

- **Mobile (360–430px):** 2-column layout, smaller progress ring
- **Tablet (640px+):** 4-column quick links, larger spacing
- **Desktop (1024px+):** Centered max-w-2xl container
- **Safe Areas:** Respect env(safe-area-inset-*) for notch/gesture bar

---

## ♿ Accessibility Features

✅ **WCAG AA Compliance:**
- Color contrast ≥ 4.5:1 for text, 7:1 for AAA
- Touch targets ≥ 44×44px
- ARIA labels on icons
- Semantic HTML (main, section, header)
- prefers-reduced-motion support
- Color + text (no color-only signals)

---

## 📊 Implementation Strategy

### Phase 1: Core Components (High Priority)
- [ ] Hero Card with progress ring
- [ ] Greeting Section with dynamic sapaan
- [ ] Update Quick Links styling
- [ ] Layout integration
- **Timeline:** 3–4 days

### Phase 2: Layout & Polish (High Priority)
- [ ] Dashboard page layout
- [ ] Bottom nav pill indicator
- [ ] Weekly summary card (TBD)
- **Timeline:** 2 days

### Phase 3: Interactions (Medium Priority)
- [ ] Entry animations
- [ ] Hover/press effects
- [ ] Loading states
- **Timeline:** 2 days

### Phase 4: Accessibility & Testing (Medium Priority)
- [ ] WCAG AA audit
- [ ] ARIA labels
- [ ] Responsive testing (360–430px)
- **Timeline:** 2 days

### Phase 5: Optimization & Deploy (Low Priority)
- [ ] Performance optimization
- [ ] Code review
- [ ] Deploy to production
- **Timeline:** 1 day

**Total Estimated:** 10–14 days (2 sprint weeks)

---

## 🔧 Technical Approach

**No Breaking Changes:**
- Keep `AttendanceCardData` interface unchanged
- Reuse existing hooks: `getTodaySummary()`, `useServerClock()`
- No new API endpoints required
- Styling only (Tailwind + CSS variables)

**Reuse Components:**
- `StatusBadge`, `ProgressMeter`, `Monogram` from badges.tsx
- `Surface`, `Stat`, `EmptyState` from primitives.tsx
- `Button` component variants

**New Components:**
- `GreetingSection` (greeting-section.tsx)
- `WeeklySummary` (weekly-summary.tsx) - optional
- Updates to existing: AttendanceCard, QuickLink, dashboard page

**Stack:**
- Framework: Next.js 16.4.2 + React 19
- Styling: Tailwind v4 + globals.css tokens
- Icons: lucide-react
- Animations: tw-animate-css
- No new dependencies

---

## ✅ Acceptance Criteria (Overall)

- [ ] UI looks modern, engaging, professional
- [ ] All functional requirements met (FR-001 to FR-031)
- [ ] All non-functional requirements met (NFR-001 to NFR-016)
- [ ] Lighthouse scores: Accessibility ≥ 90, Performance ≥ 85
- [ ] WCAG AA contrast passed (WebAIM/WAVE verified)
- [ ] Responsive 360–430px + safe-area-inset
- [ ] No API or data structure changes
- [ ] Zero critical bugs
- [ ] All components documented
- [ ] Git history clean with clear commits

---

## 🚨 Confirmation Points (Blockers)

Before full implementation, need user confirmation on:

1. **Weekly Summary Data:**
   - Does `getTodaySummary()` include weekly stats (hadir, terlambat, jam, lembur)?
   - Or need new API call? Or use placeholder?

2. **Progress Ring Design:**
   - Prefer circular ring (180–240°) or horizontal bar?

3. **Check-out Confirmation:**
   - Add dialog/bottom sheet modal for check-out? Or direct submit?

4. **Header Features (Optional):**
   - Include avatar in header? Notification bell?
   - Or skip for Phase 1?

5. **Weekly Summary Position:**
   - Separate card? Or integrated into hero? Or skip for MVP?

6. **Haptic Feedback:**
   - Support vibration API on button press?

7. **Pull-to-Refresh:**
   - Gesture support for refreshing clock? Or leave as-is?

---

## 📁 Files to Create/Modify

**New Files:**
```
src/components/dashboard/greeting-section.tsx
src/components/dashboard/weekly-summary.tsx       (optional)
src/components/attendance/progress-ring.tsx       (optional, if not in hero-card)
```

**Modified Files:**
```
src/app/(app)/dashboard/page.tsx                 (main redesign)
src/components/attendance/attendance-card.tsx    (styling + structure)
src/components/layout/navigation.tsx             (bottom nav pill indicator)
```

**No Changes:**
```
src/app/globals.css                              (design tokens already good)
src/lib/attendance/use-server-clock.ts           (reuse as-is)
src/components/layout/primitives.tsx             (reuse Surface, Stat)
src/components/layout/badges.tsx                 (reuse StatusBadge, etc.)
```

---

## 📈 Success Metrics

1. **User Satisfaction:** ≥ 80% find UI more modern/engaging
2. **Performance:** Lighthouse scores ≥ 85 (Perf), ≥ 90 (A11y)
3. **Accessibility:** WCAG AA passed, 100% touch targets ≥ 44px
4. **Responsiveness:** Bekerja sempurna di 360–430px + safe-area
5. **Code Quality:** Zero TypeScript errors, clear documentation
6. **Deployment:** Zero critical bugs, smooth rollout

---

## 📝 Next Steps

1. **Review & Confirm:** User review spec, confirm blockers (section 🚨)
2. **Start Phase 1:** Create Hero Card + Greeting Section
3. **Iterate:** Daily progress, blocking issues resolved immediately
4. **Phase 2–5:** Follow task priority in tasks.md
5. **Deploy:** Merge to main, deploy to staging, then production

---

## 📚 References

- Design System: `src/app/globals.css` (OKLCH tokens, shadows, radius)
- Existing Components: `src/components/layout/primitives.tsx`, `badges.tsx`
- Current Dashboard: `src/app/(app)/dashboard/page.tsx`
- AttendanceCard Logic: `src/components/attendance/attendance-card.tsx`
- Design References: Wise, Square, Paperccut (modern fintech/HR apps)
- A11y: WCAG 2.1 AA, WebAIM contrast checker

---

**Created:** 27 Oktober 2026  
**Spec Version:** 1.0 (Ready for Review)  
**Prepared By:** Senior Mobile UI/UX Engineer

