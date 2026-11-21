import { AU_KM, C_KM_S, GLY_KM, LY_KM, MLY_KM } from "./astro"
import type { Distance } from "../data/types"

const nf = new Intl.NumberFormat("en-US")

export function formatInt(value: number): string {
  return nf.format(Math.round(value))
}

export function formatFixed(value: number, digits = 2): string {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

export function formatUtc(date: Date): string {
  return `${String(date.getUTCHours()).padStart(2, "0")}:${String(date.getUTCMinutes()).padStart(2, "0")}:${String(date.getUTCSeconds()).padStart(2, "0")}`
}

export function formatUtcDate(date: Date): string {
  const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]
  return `${String(date.getUTCDate()).padStart(2, "0")} ${months[date.getUTCMonth()]} ${date.getUTCFullYear()}`
}

export function formatLat(lat: number): string {
  return `${Math.abs(lat).toFixed(4)}${lat >= 0 ? "N" : "S"}`
}

export function formatLng(lng: number): string {
  return `${Math.abs(lng).toFixed(4)}${lng >= 0 ? "E" : "W"}`
}

export function formatCoordPair(lat: number, lng: number): string {
  return `${formatLat(lat)}  ${formatLng(lng)}`
}

export function distanceToKm(distance: Distance): number {
  switch (distance.unit) {
    case "km":
      return distance.value
    case "au":
      return distance.value * AU_KM
    case "ly":
      return distance.value * LY_KM
    case "mly":
      return distance.value * MLY_KM
    case "gly":
      return distance.value * GLY_KM
  }
}

export function formatDistanceKm(km: number): string {
  if (!Number.isFinite(km)) return "—"
  if (km < 100_000) return `${formatInt(km)} km`
  if (km < AU_KM * 0.05) return `${formatInt(km / 1000)} thousand km`
  if (km < AU_KM * 1000) return `${formatFixed(km / AU_KM, km / AU_KM < 10 ? 3 : 1)} AU`
  const ly = km / LY_KM
  if (ly < 1000) return `${formatFixed(ly, ly < 10 ? 3 : 1)} ly`
  const mly = km / MLY_KM
  if (mly < 1000) return `${formatFixed(mly, 2)} Mly`
  return `${formatFixed(km / GLY_KM, 2)} Gly`
}

export function formatDistanceCompact(km: number): { value: string; unit: string } {
  if (km < 100_000) return { value: formatInt(km), unit: "km" }
  if (km < AU_KM * 0.1) return { value: formatInt(km / 1000), unit: "thousand km" }
  if (km < AU_KM * 1000) {
    const au = km / AU_KM
    return { value: formatFixed(au, au < 10 ? 3 : 1), unit: "AU" }
  }
  const ly = km / LY_KM
  if (ly < 1000) return { value: formatFixed(ly, ly < 10 ? 3 : 1), unit: "ly" }
  const mly = km / MLY_KM
  if (mly < 1000) return { value: formatFixed(mly, 2), unit: "Mly" }
  return { value: formatFixed(km / GLY_KM, 2), unit: "Gly" }
}

export function formatLightDelay(km: number): string {
  return formatDuration(km / C_KM_S)
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds)) return "—"
  if (seconds < 1) return `${(seconds * 1000).toFixed(0)} ms`
  if (seconds < 60) return `${seconds.toFixed(2)} s`
  if (seconds < 3600) {
    const m = Math.floor(seconds / 60)
    const s = Math.round(seconds % 60)
    return `${m}m ${String(s).padStart(2, "0")}s`
  }
  if (seconds < 86400) {
    const h = Math.floor(seconds / 3600)
    const m = Math.round((seconds % 3600) / 60)
    return `${h}h ${String(m).padStart(2, "0")}m`
  }
  const days = seconds / 86400
  if (days < 365.25) return `${days.toFixed(1)} days`
  const years = days / 365.25
  if (years < 1e6) return `${formatFixed(years, years < 10 ? 2 : 0)} years`
  return `${formatFixed(years / 1e6, 1)} million years`
}

export function formatMass(kg: number): string {
  if (kg >= 1e30) return `${formatFixed(kg / 1e30, 3)} x 10^30 kg`
  if (kg >= 1e27) return `${formatFixed(kg / 1e27, 3)} x 10^27 kg`
  if (kg >= 1e24) return `${formatFixed(kg / 1e24, 3)} x 10^24 kg`
  if (kg >= 1e21) return `${formatFixed(kg / 1e21, 3)} x 10^21 kg`
  return `${formatInt(kg)} kg`
}

export function formatAltitude(km: number): string {
  if (km < 1) return `${formatInt(km * 1000)} m`
  return `${formatFixed(km, km < 100 ? 1 : 0)} km`
}

export function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`
}

export function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function shortAgo(ms: number): string {
  const s = Math.max(0, (Date.now() - ms) / 1000)
  if (s < 5) return "just now"
  if (s < 60) return `${Math.floor(s)}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}
