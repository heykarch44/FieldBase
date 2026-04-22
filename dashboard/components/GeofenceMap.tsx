'use client'

import { useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Circle, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Fix default marker icon paths for bundlers
// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

function RecenterOnChange({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap()
  const prev = useRef<[number, number] | null>(null)
  useEffect(() => {
    if (!prev.current || prev.current[0] !== lat || prev.current[1] !== lng) {
      map.setView([lat, lng], map.getZoom())
      prev.current = [lat, lng]
    }
  }, [lat, lng, map])
  return null
}

export interface GeofenceMapProps {
  lat: number
  lng: number
  radius: number
  height?: number
}

export default function GeofenceMap({
  lat,
  lng,
  radius,
  height = 300,
}: GeofenceMapProps) {
  return (
    <div style={{ height, width: '100%' }} className="overflow-hidden rounded-lg border border-sand-200">
      <MapContainer
        center={[lat, lng]}
        zoom={17}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={[lat, lng]} />
        <Circle
          center={[lat, lng]}
          radius={radius}
          pathOptions={{
            color: '#0d9488',
            fillColor: '#14b8a6',
            fillOpacity: 0.15,
            weight: 2,
          }}
        />
        <RecenterOnChange lat={lat} lng={lng} />
      </MapContainer>
    </div>
  )
}
