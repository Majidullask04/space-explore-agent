import { useEffect, useState } from "react"
import { BODIES } from "../../data/bodies"
import { findBody } from "../../data/catalog"
import { formatDistance, lightTravelLabel } from "../../data/catalog/units"
import { fetchNasaImages } from "../../lib/api"
import type { NasaImage } from "../../data/types"
import { useLiveISS } from "../../hooks/useLiveISS"

interface Props {
  bodyId: string
  onClose: () => void
}

export default function FactCard({ bodyId, onClose }: Props) {
  const [images, setImages] = useState<NasaImage[]>([])
  const { iss, refreshIss } = useLiveISS()

  const catalogBody = findBody(bodyId)
  const legacyBody = BODIES.find((b) => b.id === bodyId)

  const name = catalogBody?.name || legacyBody?.name || bodyId
  const category = legacyBody?.kind || catalogBody?.marker || "Celestial Body"
  const subtitle = legacyBody?.subtitle || `${catalogBody?.regime.replaceAll("_", " ")} catalog target`
  const description = catalogBody?.description || legacyBody?.description || ""

  const isIss = bodyId === "iss"

  // Fetch live NASA images for this body
  useEffect(() => {
    let active = true
    const query = legacyBody?.mediaQuery || name
    fetchNasaImages(query, legacyBody?.fallbackImage)
      .then((imgs) => {
        if (active) setImages(imgs.slice(0, 2))
      })
      .catch(() => {
        if (active) setImages([])
      })
    return () => {
      active = false
    }
  }, [bodyId, name, legacyBody?.mediaQuery, legacyBody?.fallbackImage])

  // Refresh ISS telemetry if viewing ISS
  useEffect(() => {
    if (isIss) void refreshIss()
  }, [isIss, refreshIss])

  // Extract telemetry facts
  const p = catalogBody?.profile
  const factsList: Array<[string, string]> = []

  if (p) {
    if (p.radiusM > 0) factsList.push(["Radius", formatDistance(p.radiusM).raw])
    if (p.massKg > 0) factsList.push(["Mass", `${p.massKg.toExponential(2)} kg`])
    if (p.surfaceG > 0) factsList.push(["Gravity", `${p.surfaceG.toFixed(2)} m/s²`])
    if (p.meanTempK > 0) factsList.push(["Mean Temp", `${p.meanTempK} K`])
    if (p.rotationHours) factsList.push(["Rotation", `${Math.abs(p.rotationHours).toFixed(1)} h`])
    if (catalogBody.distFromEarthM > 0) {
      factsList.push(["Dist From Earth", formatDistance(catalogBody.distFromEarthM).raw])
      factsList.push(["Light Travel", lightTravelLabel(catalogBody.distFromEarthM)])
    }
  } else if (legacyBody?.facts) {
    factsList.push(...legacyBody.facts.slice(0, 6))
  }

  return (
    <div className="fact-card" role="dialog" aria-label={`${name} facts`}>
      <div className="fact-card-header">
        <span className="fact-card-category">{category}</span>
        <button className="fact-card-close" onClick={onClose} aria-label="Close fact card">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M1 1l10 10M11 1L1 11" />
          </svg>
        </button>
      </div>

      <h2 className="fact-card-title">{name}</h2>
      <div className="fact-card-subtitle">{subtitle}</div>

      {/* Live ISS banner if applicable */}
      {isIss && (
        <div className="fact-live-banner">
          <div className="fact-live-title">
            <span className="fact-live-pulse" />
            Live Orbital Telemetry
          </div>
          <div className="fact-live-text">
            Altitude: {iss.altitudeKm ? `${Math.round(iss.altitudeKm)} km` : "408 km"} · Velocity:{" "}
            {iss.velocityKmH ? `${Math.round(iss.velocityKmH).toLocaleString("en-US")} km/h` : "27,600 km/h"}
          </div>
          {iss.lat !== null && iss.lng !== null && (
            <div className="fact-live-text">
              Coords: {iss.lat >= 0 ? `${iss.lat.toFixed(2)}°N` : `${(-iss.lat).toFixed(2)}°S`},{" "}
              {iss.lng >= 0 ? `${iss.lng.toFixed(2)}°E` : `${(-iss.lng).toFixed(2)}°W`}
            </div>
          )}
        </div>
      )}

      {description && <p className="fact-card-desc">{description}</p>}

      {/* Telemetry Grid */}
      {factsList.length > 0 && (
        <div className="fact-card-grid">
          {factsList.map(([label, val]) => (
            <div key={label} className="fact-cell">
              <span className="fact-label">{label}</span>
              <span className="fact-val">{val}</span>
            </div>
          ))}
        </div>
      )}

      {/* NASA Imagery inside the card */}
      {images.length > 0 && (
        <div className="fact-card-imagery">
          <div className="fact-card-imagery-title">NASA Imagery Archives</div>
          <div className="fact-card-images">
            {images.map((img) => (
              <div key={img.id || img.thumb} className="fact-img-card">
                <img
                  src={img.thumb}
                  alt={img.title || name}
                  className="fact-img"
                  loading="lazy"
                  onError={(e) => {
                    // Hide broken thumbnail gracefully
                    ;(e.target as HTMLElement).style.display = "none"
                  }}
                />
                <div className="fact-img-meta">
                  <div className="fact-img-caption">{img.title}</div>
                  <div className="fact-img-credit">
                    {img.center || "NASA"} · {img.date ? img.date.slice(0, 4) : "Archive"}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
