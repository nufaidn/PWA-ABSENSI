"use client";

import { useActionState, useState, useTransition } from "react";
import { LogOut, Check, AlertCircle } from "lucide-react";
import { checkInAction, checkOutAction } from "@/app/actions/attendance";

interface CheckoutButtonProps {
  isCheckedIn: boolean;
  isCheckedOut: boolean;
}

export function CheckoutButton({
  isCheckedIn,
  isCheckedOut,
}: CheckoutButtonProps) {
  const [checkoutState, checkoutDispatch] = useActionState(
    checkOutAction,
    { ok: false }
  );
  const [checkinState, checkinDispatch] = useActionState(
    checkInAction,
    { ok: false }
  );
  const [checkoutPending, startCheckoutTransition] = useTransition();
  const [checkinPending, startCheckinTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleCheckIn = async () => {
    setError(null);
    try {
      const formData = new FormData();
      
      // Try to get geolocation synchronously or use null
      if (navigator.geolocation) {
        const geoPromise = new Promise<void>((resolve) => {
          const timeout = setTimeout(() => {
            console.warn("Geolocation timeout");
            startCheckinTransition(() => checkinDispatch(formData));
            resolve();
          }, 5000); // 5 second timeout

          navigator.geolocation.getCurrentPosition(
            (position) => {
              clearTimeout(timeout);
              formData.set("latitude", position.coords.latitude.toString());
              formData.set("longitude", position.coords.longitude.toString());
              startCheckinTransition(() => checkinDispatch(formData));
              resolve();
            },
            (error) => {
              clearTimeout(timeout);
              console.warn("Geolocation error:", error);
              // Still proceed without location
              startCheckinTransition(() => checkinDispatch(formData));
              resolve();
            }
          );
        });
        await geoPromise;
      } else {
        startCheckinTransition(() => checkinDispatch(formData));
      }
    } catch (err) {
      console.error("Check-in error:", err);
      setError(err instanceof Error ? err.message : "Terjadi kesalahan");
    }
  };

  const handleCheckOut = async () => {
    setError(null);
    try {
      const formData = new FormData();
      
      if (navigator.geolocation) {
        const geoPromise = new Promise<void>((resolve) => {
          const timeout = setTimeout(() => {
            console.warn("Geolocation timeout");
            startCheckoutTransition(() => checkoutDispatch(formData));
            resolve();
          }, 5000);

          navigator.geolocation.getCurrentPosition(
            (position) => {
              clearTimeout(timeout);
              formData.set("latitude", position.coords.latitude.toString());
              formData.set("longitude", position.coords.longitude.toString());
              startCheckoutTransition(() => checkoutDispatch(formData));
              resolve();
            },
            (error) => {
              clearTimeout(timeout);
              console.warn("Geolocation error:", error);
              startCheckoutTransition(() => checkoutDispatch(formData));
              resolve();
            }
          );
        });
        await geoPromise;
      } else {
        startCheckoutTransition(() => checkoutDispatch(formData));
      }
    } catch (err) {
      console.error("Check-out error:", err);
      setError(err instanceof Error ? err.message : "Terjadi kesalahan");
    }
  };

  if (isCheckedIn && !isCheckedOut) {
    // Check-out button
    return (
      <>
        {(checkoutState.error || error) && (
          <div
            style={{
              width: "100%",
              background: "#FEE2E2",
              border: "1px solid #FECACA",
              borderRadius: "8px",
              padding: "12px",
              marginBottom: "12px",
              display: "flex",
              gap: "8px",
              alignItems: "center",
            }}
          >
            <AlertCircle size={16} style={{ color: "#DC2626", flexShrink: 0 }} />
            <span style={{ color: "#991B1B", fontSize: "14px" }}>
              {checkoutState.error || error}
            </span>
          </div>
        )}
        <button
          onClick={handleCheckOut}
          disabled={checkoutPending}
          style={{
            width: "100%",
            height: "48px",
            background: checkoutPending
              ? "#9CA3AF"
              : "linear-gradient(135deg, #EF4444 0%, #DC2626 100%)",
            color: "white",
            fontSize: "16px",
            fontWeight: 600,
            borderRadius: "12px",
            border: "none",
            cursor: checkoutPending ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            boxShadow: "0 4px 12px rgba(220, 38, 38, 0.3)",
            transition: "all 200ms ease-in-out",
            opacity: checkoutPending ? 0.7 : 1,
          }}
        >
          <LogOut className="w-5 h-5" />
          {checkoutPending ? "Sedang..." : "Check-out Sekarang"}
        </button>
        {checkoutState.ok && checkoutState.message && (
          <div
            style={{
              width: "100%",
              background: "#DCFCE7",
              border: "1px solid #BBEF63",
              borderRadius: "8px",
              padding: "12px",
              marginTop: "12px",
              color: "#166534",
              fontSize: "14px",
            }}
          >
            {checkoutState.message}
          </div>
        )}
      </>
    );
  }

  // Check-in button - when not checked in
  if (!isCheckedIn && !isCheckedOut) {
    return (
      <>
        {(checkinState.error || error) && (
          <div
            style={{
              width: "100%",
              background: "#FEE2E2",
              border: "1px solid #FECACA",
              borderRadius: "8px",
              padding: "12px",
              marginBottom: "12px",
              display: "flex",
              gap: "8px",
              alignItems: "center",
            }}
          >
            <AlertCircle size={16} style={{ color: "#DC2626", flexShrink: 0 }} />
            <span style={{ color: "#991B1B", fontSize: "14px" }}>
              {checkinState.error || error}
            </span>
          </div>
        )}
        <button
          onClick={handleCheckIn}
          disabled={checkinPending}
          style={{
            width: "100%",
            height: "48px",
            background: checkinPending
              ? "#9CA3AF"
              : "linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)",
            color: "white",
            fontSize: "16px",
            fontWeight: 600,
            borderRadius: "12px",
            border: "none",
            cursor: checkinPending ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            boxShadow: "0 4px 12px rgba(37, 99, 235, 0.3)",
            transition: "all 200ms ease-in-out",
            opacity: checkinPending ? 0.7 : 1,
          }}
        >
          <Check className="w-5 h-5" />
          {checkinPending ? "Sedang..." : "Absen Sekarang"}
        </button>
        {checkinState.ok && checkinState.message && (
          <div
            style={{
              width: "100%",
              background: "#DCFCE7",
              border: "1px solid #BBEF63",
              borderRadius: "8px",
              padding: "12px",
              marginTop: "12px",
              color: "#166534",
              fontSize: "14px",
            }}
          >
            {checkinState.message}
          </div>
        )}
      </>
    );
  }

  // Check-in complete or already checked out
  return (
    <button
      type="button"
      style={{
        width: "100%",
        height: "48px",
        background: "#D1D5DB",
        color: "#6B7280",
        fontSize: "16px",
        fontWeight: 600,
        borderRadius: "12px",
        border: "none",
        cursor: "not-allowed",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "8px",
        opacity: 0.6,
      }}
      disabled={true}
    >
      Absensi hari ini selesai
    </button>
  );
}
