'use client'

import dynamic from 'next/dynamic'

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

// Leaflet requires browser-only rendering — dynamic import with ssr: false
export const MapView = dynamic(() => import('./LeafletMapInner'), {
  ssr: false,
  loading: () => (
    <div className="rounded-lg border border-gray-700 bg-gray-800 p-4 min-h-[300px] flex items-center justify-center">
      <p className="text-sm text-gray-400">Dang tai ban do...</p>
    </div>
  ),
})
