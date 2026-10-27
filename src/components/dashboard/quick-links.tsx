"use client";

import Link from "next/link";
import { TrendingUp, Clock } from "lucide-react";
import { DESIGN_TOKENS } from "@/lib/design/tokens";
import { cn } from "@/lib/utils";

interface QuickLink {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  description: string;
  gradient: string; // Tailwind gradient class (e.g., "from-blue-500 to-blue-600")
}

interface QuickLinksProps {
  links?: QuickLink[];
}

/**
 * Quick links section with icon badges and gradient backgrounds
 * Default: Statistik and Cuti & Izin
 */
export function QuickLinks({ links }: QuickLinksProps) {
  const defaultLinks: QuickLink[] = [
    {
      href: "/statistics",
      icon: TrendingUp,
      label: "Statistik",
      description: "Performa Anda",
      gradient: "from-blue-500 to-blue-600",
    },
    {
      href: "/cuti-izin",
      icon: Clock,
      label: "Cuti & Izin",
      description: "Pengajuan",
      gradient: "from-cyan-500 to-blue-500",
    },
  ];

  const finalLinks = links || defaultLinks;

  const LinkCard = ({
    href,
    icon: Icon,
    label,
    description,
    gradient,
  }: QuickLink) => {
    // Extract gradient colors for styling
    const getGradientColors = (gradClass: string) => {
      const gradients: Record<string, { start: string; end: string }> = {
        "from-blue-500 to-blue-600": {
          start: "#3B82F6",
          end: "#2563EB",
        },
        "from-cyan-500 to-blue-500": {
          start: "#06B6D4",
          end: "#3B82F6",
        },
      };
      return gradients[gradClass] || { start: "#3B82F6", end: "#2563EB" };
    };

    const colors = getGradientColors(gradient);

    return (
      <Link
        href={href}
        className="group relative overflow-hidden rounded-2xl transition-all hover:scale-102 active:scale-95"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: DESIGN_TOKENS.spacing[3],
          background: "white",
          padding: DESIGN_TOKENS.spacing[4],
          borderRadius: DESIGN_TOKENS.borderRadius["2xl"],
          boxShadow: DESIGN_TOKENS.shadows.sm,
          textDecoration: "none",
          color: "inherit",
          transition: "all 200ms ease-in-out",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.boxShadow = DESIGN_TOKENS.shadows.md;
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.boxShadow = DESIGN_TOKENS.shadows.sm;
        }}
      >
        {/* Icon Badge */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "40px",
            height: "40px",
            borderRadius: DESIGN_TOKENS.borderRadius.full,
            background: `linear-gradient(135deg, ${colors.start} 0%, ${colors.end} 100%)`,
          }}
        >
          <div
            style={{
              width: "20px",
              height: "20px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon className="w-5 h-5 text-white" />
          </div>
        </div>

        {/* Text Content */}
        <div>
          <p
            style={{
              fontSize: DESIGN_TOKENS.typography.fontSize.base,
              fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
              color: DESIGN_TOKENS.colors.black,
              margin: 0,
            }}
          >
            {label}
          </p>
          <p
            style={{
              fontSize: DESIGN_TOKENS.typography.fontSize.xs,
              color: DESIGN_TOKENS.colors.gray[500],
              margin: `${DESIGN_TOKENS.spacing[1]}px 0 0 0`,
            }}
          >
            {description}
          </p>
        </div>
      </Link>
    );
  };

  return (
    <div
      style={{
        padding: `0 ${DESIGN_TOKENS.spacing[4]}px ${DESIGN_TOKENS.spacing[4]}px`,
        marginBottom: DESIGN_TOKENS.spacing[10], // Extra space for bottom nav
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, 1fr)",
          gap: DESIGN_TOKENS.spacing[3],
          // Responsive: 2 cols on mobile, 4 cols on tablet+
        }}
      >
        {finalLinks.map((link) => (
          <LinkCard key={link.href} {...link} />
        ))}
      </div>
    </div>
  );
}
