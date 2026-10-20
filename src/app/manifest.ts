import type { MetadataRoute } from "next";

/**
 * Web App Manifest.
 *
 * `start_url` points at `/dashboard` rather than `/` so launching the installed
 * app skips the proxy redirect hop and lands straight on the attendance screen.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Universal Attendance System",
    short_name: "Absensi",
    description:
      "Sistem absensi karyawan responsif dengan check-in berbasis waktu server, validasi lokasi, dan laporan.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    lang: "id",
    dir: "ltr",
    categories: ["business", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Check-in", short_name: "Check-in", url: "/dashboard" },
      { name: "Riwayat Absensi", short_name: "Riwayat", url: "/attendance" },
    ],
  };
}