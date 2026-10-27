# Dashboard Redesign - Implementation Tasks

**Status:** Ready for Phase 1  
**Estimated Duration:** 3-4 days (Phase 1)  
**Total Project:** 1-2 weeks (all phases)

---

## Phase 1: Core Hero Card Component (Priority: HIGH)

### Phase 1.1: Update Greeting Section

**Objective:** Create greeting component with dynamic sapaan, date, and department

**Tasks:**
- [ ] Create `src/components/dashboard/greeting-section.tsx`
- [ ] Import user data (name, department)
- [ ] Implement dynamic greeting based on time (pagi/siang/malam)
- [ ] Format date as "SELASA, 27 OKT 2026" (uppercase)
- [ ] Add typography with proper hierarchy
- [ ] Apply colors: date gray, name blue, dept gray
- [ ] Test responsive on 360px, 640px

**Acceptance Criteria:**
- [ ] "Selamat siang, Nufail" displays with name in blue
- [ ] Date uppercase with proper formatting
- [ ] Department gray text below
- [ ] Greeting changes based on time of day
- [ ] Responsive padding on mobile/tablet

**Files:**
- Create: `src/components/dashboard/greeting-section.tsx`

---

### Phase 1.2: Create Hero Card Container with Gradient

**Objective:** Build main hero card with blue gradient background

**Tasks:**
- [ ] Create `src/components/dashboard/hero-card-wrapper.tsx`
- [ ] Set up gradient: #1D4ED8 → #2563EB (135deg)
- [ ] Add border-radius: 24px
- [ ] Add padding: 20px
- [ ] Add shadow: 0 10px 25px rgba(0,0,0,0.1)
- [ ] Set responsive margin/width

**Acceptance Criteria:**
- [ ] Gradient displays correctly (top-left blue to bottom-right lighter blue)
- [ ] No color banding on gradient
- [ ] Shadow subtle and appropriate
- [ ] Margin responsive on different screen sizes

**Files:**
- Create: `src/components/dashboard/hero-card-wrapper.tsx`

---

### Phase 1.3: Implement Real-time Server Clock

**Objective:** Display HH:MM:SS updating every second from server

**Tasks:**
- [ ] Extract/update `useServerClock()` hook
- [ ] Display time with large 40-48px font
- [ ] Use monospace font with tabular numbers
- [ ] Update interval: 1000ms
- [ ] Format: 24-hour HH:MM:SS
- [ ] No jitter/flickering on updates
- [ ] Add "WAKTU SERVER" label above

**Acceptance Criteria:**
- [ ] Clock displays and updates every 1 second
- [ ] No layout shift when numbers change
- [ ] Time from server (not device)
- [ ] Clear "WAKTU SERVER" label above time
- [ ] White text on blue background

**Files:**
- Update: `src/components/dashboard/hero-card-wrapper.tsx`
- Reuse: `src/lib/attendance/use-server-clock.ts`

---

### Phase 1.4: Add Status Badge (Hadir/Terlambat)

**Objective:** Display status badge in top-right of hero card

**Tasks:**
- [ ] Create status badge component or use `StatusBadge`
- [ ] Display: "◯ Hadir" (green background #DCFCE7, green text #15803D)
- [ ] Padding: 4px 8px, border-radius: 12px
- [ ] Font: 12px, semibold
- [ ] Position: top-right of hero card

**Acceptance Criteria:**
- [ ] Badge displays with correct colors
- [ ] Badge on same line as "WAKTU SERVER" label
- [ ] Right-aligned position

**Files:**
- Update: `src/components/dashboard/hero-card-wrapper.tsx`
- Reuse: `src/components/layout/badges.tsx` (StatusBadge)

---

### Phase 1.5: Create Progress Ring Component

**Objective:** Display circular progress ring showing work hours percentage

**Tasks:**
- [ ] Create `src/components/dashboard/progress-ring.tsx`
- [ ] SVG or Canvas circle (80×80px)
- [ ] Stroke: 6px, white color
- [ ] Background: rgba(255,255,255,0.2) (light blue)
- [ ] Calculate percentage from work hours / 8 * 100
- [ ] Display percentage in center (83%)
- [ ] Add text below: "Jam kerja hari ini"
- [ ] Add text below: "6j 38m" (duration)
- [ ] Add text below: "dari target 8jam" (smaller)

**Acceptance Criteria:**
- [ ] Progress ring displays 83% fill
- [ ] Center text shows 83%
- [ ] Descriptive text below with proper sizing
- [ ] Colors: white text, light blue background
- [ ] Responsive sizing

**Files:**
- Create: `src/components/dashboard/progress-ring.tsx`

---

### Phase 1.6: Implement Check-in/Check-out Cards

**Objective:** Display 2 white cards side-by-side showing check-in and check-out

**Tasks:**
- [ ] Create `src/components/dashboard/checkin-checkout-cards.tsx`
- [ ] Left card: "✓ CHECK-IN", time "07:49:48"
- [ ] Right card: "↩ CHECK-OUT", status "Belum check-out" or time
- [ ] Card styling: white, padding 12px, border-radius 12px
- [ ] Layout: 2-column grid, gap 12px
- [ ] Icons: ✓ (green) for check-in, ↩ (gray) for check-out
- [ ] Font sizes: label 11px uppercase, time 18px bold monospace

**Acceptance Criteria:**
- [ ] Two cards display side-by-side on mobile
- [ ] Left card shows check-in time
- [ ] Right card shows "Belum check-out" if not checked out
- [ ] Proper icon colors (green and gray)
- [ ] Monospace font for time (no jitter)

**Files:**
- Create: `src/components/dashboard/checkin-checkout-cards.tsx`

---

## Phase 2: Action Buttons & Weekly Summary (Priority: HIGH)

### Phase 2.1: Create Action Button (Check-out)

**Objective:** Full-width red gradient button for check-out

**Tasks:**
- [ ] Create action button in hero card
- [ ] Background: red gradient #EF4444 → #DC2626
- [ ] Height: 56px, full width - 32px margin
- [ ] Border-radius: 12px
- [ ] Icon + text: logout icon + "Check-out Sekarang"
- [ ] States: default, hover (brightness), active (scale), loading, disabled
- [ ] Shadow: 0 4px 12px rgba(220,38,38,0.3)

**Acceptance Criteria:**
- [ ] Button displays full width with margins
- [ ] Red gradient correct
- [ ] Hover effect smooth (brightness increase)
- [ ] Active effect smooth (scale down 0.98)
- [ ] Loading state shows spinner
- [ ] Disabled state shows opacity 0.5

**Files:**
- Update: `src/components/dashboard/hero-card-wrapper.tsx`
- Create button in this component or separate file

---

### Phase 2.2: Add Security Note Below Button

**Objective:** Display lock icon + security message

**Tasks:**
- [ ] Add text: "🔒 Waktu dicatat server, tidak bisa diubah dari perangkat"
- [ ] Styling: 12px, gray color #6B7280
- [ ] Center aligned
- [ ] Flex row with icon, gap 6px

**Acceptance Criteria:**
- [ ] Lock icon visible
- [ ] Text matches mockup
- [ ] Centered alignment

**Files:**
- Update: `src/components/dashboard/hero-card-wrapper.tsx`

---

### Phase 2.3: Create Weekly Summary Component

**Objective:** Display 3 stat cards (hadir, terlambat, izin)

**Tasks:**
- [ ] Create `src/components/dashboard/weekly-summary.tsx`
- [ ] Title: "Ringkasan bulan ini" (14px, bold)
- [ ] 3-column grid: Hadir (18), Terlambat (1), Izin (2)
- [ ] Each stat: value (24px bold, semantic color) + label (12px gray)
- [ ] Colors: green (hadir), orange (terlambat), blue (izin)
- [ ] Card styling: white, padding 12px, border-radius 12px, shadow-sm
- [ ] Text-align: center

**Acceptance Criteria:**
- [ ] Three stat cards display
- [ ] Values display: 18, 1, 2
- [ ] Colors: green, orange, blue
- [ ] Responsive 3-column on all sizes

**Files:**
- Create: `src/components/dashboard/weekly-summary.tsx`

---

## Phase 3: Quick Links & Quick Links (Priority: HIGH)

### Phase 3.1: Create Quick Links Component

**Objective:** Display Statistik and Cuti & Izin action cards

**Tasks:**
- [ ] Create `src/components/dashboard/quick-links.tsx`
- [ ] 2-column grid on mobile, 4-column on tablet
- [ ] Card 1: Statistik (blue gradient icon, "Statistik", "Performa Anda")
- [ ] Card 2: Cuti & Izin (cyan gradient icon, "Cuti & Izin", "Pengajuan")
- [ ] Icon badges: 40×40px, gradient background, white icon
- [ ] Gradients: Statistik (#3B82F6 → #2563EB), Cuti (#06B6D4 → #0891B2)
- [ ] Card styling: white, padding 16px, border-radius 12px
- [ ] Hover: shadow increase, scale 1.02
- [ ] Active: scale 0.95

**Acceptance Criteria:**
- [ ] Two cards display correctly
- [ ] Icon badges with correct gradients
- [ ] Text labels and descriptions display
- [ ] Hover effect smooth
- [ ] Active effect smooth

**Files:**
- Create: `src/components/dashboard/quick-links.tsx`

---

## Phase 4: Integration & Layout (Priority: HIGH)

### Phase 4.1: Update Dashboard Page Layout

**Objective:** Integrate all components into dashboard page

**Tasks:**
- [ ] Update `src/app/(app)/dashboard/page.tsx`
- [ ] Import: GreetingSection, HeroCardWrapper, WeeklySummary, QuickLinks
- [ ] Layout order:
  1. Header (existing)
  2. Greeting section
  3. Hero card (with all sub-components)
  4. Action button
  5. Security note
  6. Weekly summary
  7. Quick links
- [ ] Padding and spacing using design tokens
- [ ] Margin-bottom for bottom nav safe area (80px)
- [ ] Responsive on 360px, 640px, 1024px

**Acceptance Criteria:**
- [ ] All components display in order
- [ ] Spacing matches mockup
- [ ] No horizontal scroll
- [ ] Responsive on all breakpoints
- [ ] Bottom nav not overlapping content

**Files:**
- Update: `src/app/(app)/dashboard/page.tsx`

---

### Phase 4.2: Update Bottom Navigation Styling

**Objective:** Update nav with pill indicator on active tab

**Tasks:**
- [ ] Update `src/components/layout/navigation.tsx` (MobileNav)
- [ ] Active indicator: pill-shaped with background
- [ ] Colors: active #2563EB, inactive #6B7280
- [ ] Pill background: rgba(37,99,235,0.1) or #EFF6FF
- [ ] Padding bottom: env(safe-area-inset-bottom)
- [ ] Icon size: 24px (slightly larger)
- [ ] Height: 56px + safe-area

**Acceptance Criteria:**
- [ ] Active tab shows pill background
- [ ] Pill color correct (#2563EB)
- [ ] Safe area padding applies
- [ ] No overlap with content

**Files:**
- Update: `src/components/layout/navigation.tsx`

---

## Phase 5: Testing & Polish (Priority: MEDIUM)

### Phase 5.1: Accessibility Audit

**Objective:** Ensure WCAG AA compliance

**Tasks:**
- [ ] Check color contrast (4.5:1 minimum)
- [ ] Add ARIA labels to icons
- [ ] Verify semantic HTML structure
- [ ] Test keyboard navigation
- [ ] Check focus indicators (2px ring)
- [ ] Test with screen reader (NVDA, JAWS)
- [ ] Verify touch targets ≥ 44×44px

**Acceptance Criteria:**
- [ ] Lighthouse Accessibility ≥ 90
- [ ] WCAG AA passed (WebAIM checker)
- [ ] All icons have aria-label
- [ ] Keyboard navigation works
- [ ] Focus visible on all interactive elements

**Files:**
- Update: all affected components

---

### Phase 5.2: Performance Optimization

**Objective:** Optimize for speed and smooth animations

**Tasks:**
- [ ] Run Lighthouse audit
- [ ] Check bundle size
- [ ] Memoize components (React.memo)
- [ ] Lazy load weekly summary if needed
- [ ] Optimize real-time clock updates (no excessive re-renders)
- [ ] Test animation smoothness (60fps)
- [ ] Verify prefers-reduced-motion support

**Acceptance Criteria:**
- [ ] Lighthouse Performance ≥ 85
- [ ] Lighthouse Speed Index < 3s
- [ ] No layout shifts (CLS < 0.1)
- [ ] Animations smooth 60fps

**Files:**
- Update: all components as needed

---

### Phase 5.3: Responsive Testing

**Objective:** Verify responsive design across devices

**Tasks:**
- [ ] Test on 360px (iPhone SE)
- [ ] Test on 430px (iPhone 15)
- [ ] Test on 640px (iPad mini)
- [ ] Test on 1024px+ (desktop)
- [ ] Check safe-area-inset on iOS/Android
- [ ] Test in Chrome, Safari, Firefox
- [ ] Test on real devices if possible
- [ ] Verify no horizontal scroll

**Acceptance Criteria:**
- [ ] No horizontal scroll on any viewport
- [ ] All components readable at 360px
- [ ] Safe area respected on iOS
- [ ] Gesture bar respected on Android
- [ ] Works on Chrome, Safari, Firefox

**Files:**
- Test: all components

---

### Phase 5.4: Final Code Review & Commit

**Objective:** Clean up code, add documentation, commit to git

**Tasks:**
- [ ] Add JSDoc comments to all components
- [ ] Ensure TypeScript strict mode passes
- [ ] No console warnings/errors
- [ ] Code formatting (prettier)
- [ ] Naming conventions consistent
- [ ] Remove unused imports
- [ ] Add unit tests for complex logic (optional)
- [ ] Create git commit with clear message

**Acceptance Criteria:**
- [ ] Zero TypeScript errors
- [ ] Zero console warnings
- [ ] Code formatted with prettier
- [ ] JSDoc comments on all exports
- [ ] Git history clean

**Files:**
- Update: all modified components

---

## Git Commit Strategy

```bash
# Phase 1
git commit -m "feat(dashboard): add design tokens for centralized styling"

git commit -m "feat(dashboard): create greeting section component"

git commit -m "feat(dashboard): implement hero card with gradient and real-time clock"

git commit -m "feat(dashboard): add progress ring for work hours visualization"

git commit -m "feat(dashboard): create check-in/check-out mini cards"

# Phase 2
git commit -m "feat(dashboard): add action button and security note"

git commit -m "feat(dashboard): create weekly summary stat cards"

# Phase 3
git commit -m "feat(dashboard): create quick links with gradient icons"

# Phase 4
git commit -m "feat(dashboard): integrate all components into dashboard layout"

git commit -m "feat(navigation): update bottom nav with pill indicator"

# Phase 5
git commit -m "fix(dashboard): accessibility audit and WCAG AA compliance"

git commit -m "perf(dashboard): optimize performance and animations"

git commit -m "test(dashboard): verify responsive design across devices"

git commit -m "docs(dashboard): add JSDoc comments and finalize code"
```

---

## Timeline & Priority

| Phase | Tasks | Priority | Days | Status |
|-------|-------|----------|------|--------|
| 1.1-1.6 | Hero card components | HIGH | 2 | Not started |
| 2.1-2.3 | Action button & summary | HIGH | 1.5 | Not started |
| 3.1 | Quick links | HIGH | 0.5 | Not started |
| 4.1-4.2 | Integration & nav | HIGH | 1 | Not started |
| 5.1-5.4 | Testing & polish | MEDIUM | 1 | Not started |
| **Total** | **All phases** | – | **6** | – |

---

## Success Metrics

- [x] Design tokens file created
- [x] Requirements.md complete
- [x] Design.md complete
- [x] Tasks.md complete
- [ ] All components built and tested
- [ ] Lighthouse Perf ≥ 85, A11y ≥ 90
- [ ] WCAG AA contrast passed
- [ ] Responsive on 360px → 1024px+
- [ ] Zero TypeScript errors
- [ ] Git history clean with clear commits
- [ ] UI matches mockup pixel-perfect

---

## Blocking Issues (To Confirm)

1. **Weekly Summary Data** - Is data available in `getTodaySummary()` or need new API?
2. **Check-out Confirmation** - Dialog/bottom sheet before check-out?
3. **Real-time Updates** - Server clock accurate? Timezone handling?

---

## Notes

- All components should use design tokens from `src/lib/design/tokens.ts`
- Reuse existing UI components from shadcn/ui
- Keep AttendanceCardData interface unchanged
- No API changes, only UI/styling
- Test on real devices if possible

