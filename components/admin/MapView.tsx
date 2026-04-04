'use client'

import dynamic from 'next/dynamic'

// Re-export MapHandle type for consumers
export type { MapHandle } from './LeafletMapInner'

export interface MapPin {
  id: string
  latitude: number
  longitude: number
  label: string
  popupContent?: string
  color?: string
  customerTypeCode?: string  // when set, use visual SVG icon for this customer type
}

export interface MapViewProps {
  pins: MapPin[]
  center?: [number, number]
  zoom?: number
  className?: string
  /** Callback that receives a handle with flyTo method once the map is ready */
  onMapReady?: (handle: { flyTo: (lat: number, lng: number, zoom?: number) => void }) => void
}

// Leaflet requires browser-only rendering — dynamic import with ssr: false
export const MapView = dynamic(() => import('./LeafletMapInner'), {
  ssr: false,
  loading: () => (
    <div className="rounded-lg border border-gray-700 bg-gray-800 p-4 min-h-[300px] flex items-center justify-center">
      <p className="text-sm text-gray-400">Dang tai ban do...</p>
    </div>
  ),
})
