'use client'

import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import type { MapViewProps } from './MapView'

function getMarkerIcon(color: string) {
  return L.divIcon({
    className: '',
    html: `<div style="width:12px;height:12px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 0 4px rgba(0,0,0,0.3)"></div>`,
    iconSize: [12, 12],
    iconAnchor: [6, 6],
    popupAnchor: [0, -8],
  })
}

function getColorForQueries(count: number): string {
  if (count > 50) return '#22c55e'
  if (count >= 10) return '#eab308'
  if (count >= 1) return '#ef4444'
  return '#6b7280'
}

export default function LeafletMapInner({
  pins,
  center = [16.0, 106.0],
  zoom = 6,
  className,
}: MapViewProps) {
  return (
    <div
      className={className}
      style={{ height: '400px', width: '100%' }}
      aria-label="Ban do phong kham"
    >
      <MapContainer
        center={center}
        zoom={zoom}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={true}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />
        {pins.map((pin) => (
          <Marker
            key={pin.id}
            position={[pin.latitude, pin.longitude]}
            icon={getMarkerIcon(pin.color || getColorForQueries(0))}
          >
            <Popup>
              <div className="text-sm">
                <strong>{pin.label}</strong>
                {pin.popupContent && <p>{pin.popupContent}</p>}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  )
}
