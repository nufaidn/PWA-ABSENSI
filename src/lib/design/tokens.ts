/**
 * Centralized Design Tokens for Dashboard Redesign
 * Based on mockup: PT Bumi Sarana Maju Attendance System
 * 
 * These tokens are reused across all dashboard components.
 */

export const DESIGN_TOKENS = {
  // ==================== COLORS ====================
  colors: {
    // Brand Blue (Primary)
    blue: {
      50: '#F0F4FF',
      100: '#E0E7FF',
      200: '#C7D2FE',
      300: '#A5B4FC',
      400: '#818CF8',
      500: '#6366F1',
      600: '#4F46E5',
      700: '#4338CA',
      800: '#3730A3',
      900: '#312E81',
    },

    // Status Green (Hadir)
    green: {
      50: '#F0FDF4',
      100: '#DCFCE7',
      200: '#BBEF63',
      300: '#86EFAC',
      400: '#4ADE80',
      500: '#22C55E',
      600: '#16A34A',
      700: '#15803D',
      800: '#166534',
      900: '#145231',
    },

    // Status Orange (Terlambat)
    orange: {
      50: '#FFF7ED',
      100: '#FFEDD5',
      200: '#FED7AA',
      300: '#FDBA74',
      400: '#FB923C',
      500: '#F97316',
      600: '#EA580C',
      700: '#C2410C',
      800: '#9A3412',
      900: '#7C2D12',
    },

    // Status Red (Action, Error)
    red: {
      50: '#FEF2F2',
      100: '#FEE2E2',
      200: '#FECACA',
      300: '#FCA5A5',
      400: '#F87171',
      500: '#EF4444',
      600: '#DC2626',
      700: '#B91C1C',
      800: '#991B1B',
      900: '#7F1D1D',
    },

    // Neutral (Gray)
    gray: {
      50: '#F9FAFB',
      100: '#F3F4F6',
      200: '#E5E7EB',
      300: '#D1D5DB',
      400: '#9CA3AF',
      500: '#6B7280',
      600: '#4B5563',
      700: '#374151',
      800: '#1F2937',
      900: '#111827',
    },

    // Whites
    white: '#FFFFFF',
    black: '#000000',
  },

  // ==================== TYPOGRAPHY ====================
  typography: {
    // Font families
    fontFamily: {
      sans: 'system-ui, -apple-system, sans-serif',
      mono: '"Fira Code", monospace',
    },

    // Font sizes (px)
    fontSize: {
      xs: '12px',
      sm: '13px',
      base: '14px',
      lg: '16px',
      xl: '18px',
      '2xl': '20px',
      '3xl': '24px',
      '4xl': '28px',
      '5xl': '32px',
      '6xl': '36px',
      '7xl': '40px',
    },

    // Font weights
    fontWeight: {
      light: 300,
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
      extrabold: 800,
    },

    // Line heights (multiplier)
    lineHeight: {
      tight: 1.2,
      normal: 1.5,
      relaxed: 1.75,
      loose: 2,
    },

    // Letter spacing (em)
    letterSpacing: {
      tight: '-0.02em',
      normal: '0em',
      wide: '0.02em',
      wider: '0.05em',
      widest: '0.1em',
    },
  },

  // ==================== SPACING ====================
  spacing: {
    0: '0px',
    1: '4px',
    2: '8px',
    3: '12px',
    4: '16px',
    5: '20px',
    6: '24px',
    7: '28px',
    8: '32px',
    10: '40px',
    12: '48px',
    16: '64px',
    20: '80px',
    24: '96px',
  },

  // ==================== BORDER RADIUS ====================
  borderRadius: {
    none: '0px',
    sm: '4px',
    md: '6px',
    lg: '8px',
    xl: '12px',
    '2xl': '16px',
    '3xl': '20px',
    '4xl': '24px',
    full: '9999px',
  },

  // ==================== SHADOWS ====================
  shadows: {
    none: 'none',
    sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    md: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
    lg: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
    xl: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
    '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.1)',
    inner: 'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)',
  },

  // ==================== GRADIENTS ====================
  gradients: {
    // Hero card gradient (biru gelap ke biru terang)
    heroCard: 'linear-gradient(135deg, #1D4ED8 0%, #2563EB 100%)',

    // Quick link gradients
    statistik: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)',
    cutiIzin: 'linear-gradient(135deg, #06B6D4 0%, #0891B2 100%)',

    // Progress ring gradient
    progress: 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)',

    // Subtle background
    background: 'linear-gradient(135deg, #F8FAFC 0%, #EFF6FF 100%)',
  },

  // ==================== COMPONENT SIZES ====================
  componentSizes: {
    // Header
    headerHeight: 56,

    // Card
    cardPadding: 16,
    cardBorderRadius: 16,

    // Hero card
    heroCardPadding: 20,
    heroCardBorderRadius: 24,

    // Button
    buttonHeight: 48,
    buttonHeightLarge: 56,
    buttonBorderRadius: 12,

    // Progress ring
    progressRingSize: 80,
    progressRingStrokeWidth: 6,

    // Icon sizes
    iconSm: 16,
    iconMd: 20,
    iconLg: 24,
    iconXl: 32,

    // Safe area adjustments
    safeAreaBottomPadding: 20,
  },

  // ==================== ANIMATION ====================
  animations: {
    // Transitions
    transitionFast: '150ms ease-in-out',
    transitionBase: '200ms ease-in-out',
    transitionSlow: '300ms ease-in-out',

    // Easings
    easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
    easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
    easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
  },

  // ==================== BREAKPOINTS ====================
  breakpoints: {
    mobile: 360,
    mobileLarge: 430,
    tablet: 640,
    desktop: 1024,
  },
} as const;

// ==================== HELPER FUNCTIONS ====================

/**
 * Get color by semantic meaning (status, action, etc.)
 */
export function getStatusColor(status: 'hadir' | 'terlambat' | 'belum' | 'error') {
  const statusColors = {
    hadir: DESIGN_TOKENS.colors.green[600],
    terlambat: DESIGN_TOKENS.colors.orange[600],
    belum: DESIGN_TOKENS.colors.gray[400],
    error: DESIGN_TOKENS.colors.red[600],
  };
  return statusColors[status];
}

/**
 * Get status color with background
 */
export function getStatusColorWithBg(status: 'hadir' | 'terlambat' | 'belum') {
  const colors = {
    hadir: {
      bg: DESIGN_TOKENS.colors.green[50],
      text: DESIGN_TOKENS.colors.green[700],
      border: DESIGN_TOKENS.colors.green[200],
    },
    terlambat: {
      bg: DESIGN_TOKENS.colors.orange[50],
      text: DESIGN_TOKENS.colors.orange[700],
      border: DESIGN_TOKENS.colors.orange[200],
    },
    belum: {
      bg: DESIGN_TOKENS.colors.gray[100],
      text: DESIGN_TOKENS.colors.gray[600],
      border: DESIGN_TOKENS.colors.gray[300],
    },
  };
  return colors[status];
}

/**
 * Generate Tailwind classes for responsive spacing
 */
export function getResponsiveSpacing(
  mobile: keyof typeof DESIGN_TOKENS.spacing,
  tablet: keyof typeof DESIGN_TOKENS.spacing,
  desktop: keyof typeof DESIGN_TOKENS.spacing
) {
  return `p-${mobile} sm:p-${tablet} lg:p-${desktop}`;
}

export default DESIGN_TOKENS;
