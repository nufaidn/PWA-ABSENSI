"use client";

import { LogOut } from "lucide-react";
import { checkOutAction } from "@/app/actions/attendance";

interface CheckoutButtonProps {
  isCheckedIn: boolean;
  isCheckedOut: boolean;
}

export function CheckoutButton({
  isCheckedIn,
  isCheckedOut,
}: CheckoutButtonProps) {
  const handleCheckout = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    await checkOutAction({ ok: false }, formData);
  };

  if (isCheckedIn && !isCheckedOut) {
    // Check-out button
    return (
      <form onSubmit={handleCheckout} style={{ width: "100%" }}>
        <button
          type="submit"
          style={{
            width: "100%",
            height: "56px",
            background: "linear-gradient(135deg, #EF4444 0%, #DC2626 100%)",
            color: "white",
            fontSize: "16px",
            fontWeight: 600,
            borderRadius: "12px",
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            boxShadow: "0 4px 12px rgba(220, 38, 38, 0.3)",
            transition: "all 200ms ease-in-out",
          }}
        >
          <LogOut className="w-5 h-5" />
          Check-out Sekarang
        </button>
      </form>
    );
  }

  // Check-in complete or not checked in
  return (
    <button
      type="button"
      style={{
        width: "100%",
        height: "56px",
        background: isCheckedIn ? "#D1D5DB" : "linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)",
        color: "white",
        fontSize: "16px",
        fontWeight: 600,
        borderRadius: "12px",
        border: "none",
        cursor: isCheckedIn ? "not-allowed" : "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "8px",
        boxShadow: isCheckedIn ? "none" : "0 4px 12px rgba(37, 99, 235, 0.3)",
        opacity: isCheckedIn ? 0.6 : 1,
        transition: "all 200ms ease-in-out",
      }}
      disabled={isCheckedIn}
    >
      Absensi hari ini selesai
    </button>
  );
}
