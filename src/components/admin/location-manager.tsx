"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { useActionState, useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  createLocationAction,
  updateLocationAction,
  deleteLocationAction,
} from "@/app/actions/admin-settings";
import { INITIAL_ACTION_STATE, type ActionState } from "@/lib/action-state";
import { Chip } from "@/components/layout/badges";

/**
 * Geo-fence management.
 *
 * The admin marks the office on a map and drags the radius; latitude/longitude
 * stay editable as plain numbers underneath, because a coordinate is occasionally
 * copied from somewhere else and re-typing it is cheaper than zooming a map.
 */

export interface LocationFormValues {
  id: string;
  name: string;
  address: string | null;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  isActive: boolean;
}

const EMPTY: LocationFormValues = {
  id: "",
  name: "",
  address: null,
  latitude: -6.2,
  longitude: 106.816666,
  radiusMeters: 200,
  isActive: true,
};

/**
 * Leaflet touches `window` at import time, so it can only load in the browser.
 * Without `ssr: false` the module graph is evaluated during the server render
 * and the build fails.
 */
const LocationPicker = dynamic(() => import("./location-picker"), {
  ssr: false,
  loading: () => (
    <div className="grid h-64 w-full place-items-center rounded-lg border border-border bg-muted/40 sm:h-72">
      <Loader2 className="size-4 animate-spin text-muted-foreground" />
    </div>
  ),
});

/** Best-effort "use my current location" helper for the create form. */
function useCurrentPosition() {
  const [state, setState] = useState<{ status: string } | null>(null);
  const [pending, setPending] = useState(false);

  function locate(setField: (lat: number, lng: number) => void) {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setState({ status: "Perangkat tidak mendukung lokasi." });
      return;
    }
    setPending(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setField(position.coords.latitude, position.coords.longitude);
        setState({
          status: `Lokasi terisi otomatis (±${Math.round(position.coords.accuracy)} m).`,
        });
        setPending(false);
      },
      () => {
        setState({ status: "Gagal mengambil lokasi. Masukkan koordinat secara manual." });
        setPending(false);
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  return { locate, pending, state };
}

function LocationFields({
  values,
  onLocate,
  locatePending,
}: {
  values: LocationFormValues;
  onLocate: (setField: (lat: number, lng: number) => void) => void;
  locatePending: boolean;
}) {
const [latitude, setLatitude] = useState<number>(values.latitude);
  const [longitude, setLongitude] = useState<number>(values.longitude);
  // The radius field is uncontrolled so typing is not interrupted by a re-render;
  // mirroring it into state is what lets the map's circle track it live.
  const [radius, setRadius] = useState<number>(values.radiusMeters);

  return (
    <div className="grid gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="location-name">Nama lokasi</Label>
        <Input
          id="location-name"
          name="name"
          required
          defaultValue={values.name}
          placeholder="Kantor Pusat"
          className="min-h-10"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="location-address">Alamat (opsional)</Label>
        <Input
          id="location-address"
          name="address"
          defaultValue={values.address ?? ""}
          placeholder="Jl. Jenderal Sudirman No. 1"
          className="min-h-10"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="location-lat">Lintang (latitude)</Label>
          <Input
            id="location-lat"
            name="latitude"
            type="number"
            step="any"
            min={-90}
            max={90}
            required
            value={latitude}
            onChange={(event) => setLatitude(Number(event.target.value))}
            className="min-h-10"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="location-lng">Bujur (longitude)</Label>
          <Input
            id="location-lng"
            name="longitude"
            type="number"
            step="any"
            min={-180}
            max={180}
            required
            value={longitude}
            onChange={(event) => setLongitude(Number(event.target.value))}
            className="min-h-10"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
          <Label>Titik lokasi kerja</Label>
          <LocationPicker
            latitude={latitude}
            longitude={longitude}
            radiusMeters={Number.isFinite(radius) ? radius : values.radiusMeters}
            onMove={(lat, lng) => {
              setLatitude(lat);
              setLongitude(lng);
            }}
          />
          <p className="text-[11.5px] leading-relaxed text-muted-foreground">
            Ketuk peta untuk menandai lokasi, atau seret penanda untuk memindahkannya. Lingkaran biru
            menampilkan area yang diizinkan untuk check-in.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={locatePending}
          onClick={() => onLocate((lat, lng) => {
            setLatitude(lat);
            setLongitude(lng);
          })}
          className="gap-2"
        >
          {locatePending ? <Loader2 className="size-3.5 animate-spin" /> : <MapPin className="size-3.5" />}
          Gunakan lokasi saya
        </Button>
        <p className="text-[11.5px] text-muted-foreground">
          Diperlukan HTTPS atau localhost agar browser mengizinkan akses lokasi.
        </p>
      </div>

<div className="flex flex-col gap-1.5">
        <Label htmlFor="location-radius">Radius (meter)</Label>
        <Input
          id="location-radius"
          name="radiusMeters"
          type="number"
          min={25}
          max={10000}
          required
          value={radius}
          onChange={(event) => setRadius(Number(event.target.value))}
          className="min-h-10"
        />
        <p className="text-[11.5px] leading-relaxed text-muted-foreground">
          Karyawan yang berada di luar radius ini tidak dapat check-in selama validasi lokasi aktif.
          Rentang 150–300 m disarankan untuk accommodate sinyal GPS yang kurang akurat.
        </p>
      </div>

      <label className="flex items-center gap-2.5 rounded-lg border border-border px-3.5 py-3 text-[13px]">
        <input
          type="checkbox"
          name="isActive"
          value="true"
          defaultChecked={values.isActive}
          className="size-4 rounded border-input accent-[oklch(0.552_0.213_262.4)]"
        />
        Aktif — dipakai saat validasi lokasi
      </label>
    </div>
  );
}

function Feedback({ state }: { state: ActionState }) {
  if (state.error) {
    return (
      <p role="alert" className="flex items-start gap-2 text-[13px] text-destructive">
        <AlertCircle className="mt-0.5 size-4 shrink-0" />
        {state.error}
      </p>
    );
  }
  if (state.ok && state.message) {
    return (
      <p role="status" className="flex items-start gap-2 text-[13px] text-[oklch(0.34_0.08_163)]">
        <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
        {state.message}
      </p>
    );
  }
  return null;
}

function LocationDialog({
  open,
  onOpenChange,
  location,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  location?: LocationFormValues;
}) {
  const isEdit = Boolean(location?.id);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    isEdit ? updateLocationAction : createLocationAction,
    INITIAL_ACTION_STATE,
  );
  const { locate, pending: locatePending, state: locateState } = useCurrentPosition();

  useEffect(() => {
    if (state.ok) {
      const timer = setTimeout(() => onOpenChange(false), 700);
      return () => clearTimeout(timer);
    }
  }, [state.ok, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Ubah lokasi" : "Tambah lokasi absensi"}</DialogTitle>
          <DialogDescription>
            Titik acuan dan radius yang menentukan apakah check-in dianggap di lokasi kerja.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="flex flex-col gap-4">
          {location?.id ? <input type="hidden" name="id" value={location.id} /> : null}
          <LocationFields
            values={location ?? EMPTY}
            onLocate={locate}
            locatePending={locatePending}
          />

          {locateState?.status ? (
            <p className="text-[12px] text-muted-foreground">{locateState.status}</p>
          ) : null}

          {state.fieldErrors ? (
            <ul className="space-y-1 rounded-lg bg-destructive/10 px-3.5 py-3 text-[12.5px] text-destructive">
              {Object.entries(state.fieldErrors).map(([field, message]) => (
                <li key={field}>{message}</li>
              ))}
            </ul>
          ) : null}

          <Feedback state={state} />

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : null}
              {pending ? "Menyimpan…" : isEdit ? "Simpan perubahan" : "Tambah lokasi"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function LocationList({ locations }: { locations: LocationFormValues[] }) {
  const [creating, setCreating] = React.useState(false);
  const [editing, setEditing] = React.useState<LocationFormValues | null>(null);
  const [deleting, setDeleting] = React.useState<LocationFormValues | null>(null);

  const [deleteState, deleteAction, deletePending] = useActionState<ActionState, FormData>(
    deleteLocationAction,
    INITIAL_ACTION_STATE,
  );

  useEffect(() => {
    if (deleteState.ok) {
      const timer = setTimeout(() => setDeleting(null), 700);
      return () => clearTimeout(timer);
    }
  }, [deleteState.ok]);

  return (
    <div className="flex flex-col">
      {locations.length === 0 ? (
        <p className="px-5 py-10 text-center text-[13px] text-muted-foreground sm:px-6">
          Belum ada lokasi yang dikonfigurasi. Validasi lokasi GPS akan dilewati sampai lokasi
          pertama ditambahkan.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {locations.map((location) => (
            <li key={location.id} className="flex flex-wrap items-center gap-3 px-5 py-4 sm:px-6">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent text-primary">
                <MapPin className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <p className="truncate text-[13.5px] font-medium text-foreground">
                    {location.name}
                  </p>
                  {!location.isActive ? <Chip>Nonaktif</Chip> : null}
                </div>
                <p className="tabular mt-0.5 text-[12px] text-muted-foreground">
                  {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)} · radius{" "}
                  {location.radiusMeters} m
                </p>
                {location.address ? (
                  <p className="mt-0.5 truncate text-[11.5px] text-muted-foreground">
                    {location.address}
                  </p>
                ) : null}
              </div>

              <div className="flex items-center gap-1.5">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Ubah lokasi ${location.name}`}
                  onClick={() => setEditing(location)}
                  className="size-9"
                >
                  <Pencil className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Hapus lokasi ${location.name}`}
                  onClick={() => setDeleting(location)}
                  className="size-9 text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="flex justify-end border-t border-border px-5 py-3.5 sm:px-6">
        <Button onClick={() => setCreating(true)} className="gap-2">
          <Plus className="size-4" />
          Tambah lokasi
        </Button>
      </div>

      <LocationDialog open={creating} onOpenChange={setCreating} />
      <LocationDialog
        open={Boolean(editing)}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        location={editing ?? undefined}
      />

      <Dialog open={Boolean(deleting)} onOpenChange={(open) => {
        if (!open) setDeleting(null);
      }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Hapus lokasi</DialogTitle>
            <DialogDescription>
              Lokasi <strong>{deleting?.name}</strong> akan dihapus. Absensi yang tercatat di
              lokasi ini tetap tersimpan.
            </DialogDescription>
          </DialogHeader>
          <form action={deleteAction} className="flex flex-col gap-4">
            <input type="hidden" name="id" value={deleting?.id ?? ""} />
            <Feedback state={deleteState} />
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setDeleting(null)}>
                Batal
              </Button>
              <Button type="submit" variant="destructive" disabled={deletePending}>
                <Trash2 className="size-4" />
                {deletePending ? "Menghapus…" : "Hapus lokasi"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}