'use client'

export interface MapPin {
  id: string
  latitude: number
  longitude: number
  label: string
  popupContent?: string
  color?: string
}

export interface MapViewProps {
  pins: MapPin[]
  center?: [number, number]
  zoom?: number
  className?: string
}

// Leaflet MUST use dynamic import with ssr: false to prevent SSR crashes
// The actual LeafletMap component will be created when react-leaflet is installed (Phase 3+)
function MapViewPlaceholder({ pins, className }: MapViewProps) {
  return (
    <div
      className={`rounded-lg border border-gray-700 bg-gray-800 p-4 min-h-[300px] flex items-center justify-center ${className ?? ''}`}
    >
      <div className="text-center">
        <p className="text-sm text-gray-400">
          MapView — {pins.length} pins configured
        </p>
        <p className="text-xs text-gray-500 mt-1">
          Leaflet map — wired in Phase 3+ (requires react-leaflet install)
        </p>
      </div>
    </div>
  )
}

// Export with dynamic wrapper pattern ready — swap placeholder for real component later
export const MapView = MapViewPlaceholder
