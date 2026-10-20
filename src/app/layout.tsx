import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { ServiceWorkerRegistrar } from "@/components/pwa/service-worker-registrar";
import { InstallPrompt } from "@/components/pwa/install-prompt";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Universal Attendance",
    template: "%s · Universal Attendance",
  },
  description:
    "Sistem absensi karyawan responsif dengan check-in berbasis waktu server dan validasi lokasi.",
  applicationName: "Universal Attendance",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Absensi",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Zoom is left enabled: pinch-to-zoom is an accessibility requirement and
  // the layout does not depend on `user-scalable=no`.
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="id"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      style={{ fontFamily: "var(--font-geist-sans), system-ui, sans-serif" }}
    >
      <body className="flex min-h-full flex-col bg-background">
        <ServiceWorkerRegistrar />
        {children}
        <InstallPrompt />
        <Toaster position="top-center" richColors closeButton />
      </body>
    </html>
  );
}