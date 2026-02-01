import { useEffect, useRef, useMemo } from 'react'
import { MapContainer, TileLayer, Polyline, Marker, CircleMarker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet-polylineoffset'
import './TripMap.css'

// Constants
const STATION_MARKER_COLOR = '#808080' // Grey color for all station circle markers

// Fix Leaflet default icon issue
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

// Component for station popup content
function StationPopupContent({ stop, trips }) {
  return (
    <div className="stop-popup">
      <strong>{stop.stop_name}</strong>
      {stop.stop_country && <div>Country: {stop.stop_country}</div>}
      {trips && trips.length > 0 && (
        <div style={{ marginTop: '0.5rem', color: '#666' }}>
          {trips.map((tripInfo, index) => (
            <div key={tripInfo.trip.trip_id} style={{ marginTop: index > 0 ? '0.5rem' : 0 }}>
              <strong>{tripInfo.trip.trip_short_name}</strong>
              <br />
              {tripInfo.trip.trip_origin && tripInfo.trip.trip_headsign && (
                <>
                  {tripInfo.trip.trip_origin} → {tripInfo.trip.trip_headsign}
                  <br />
                </>
              )}
              Stop {tripInfo.stopIndex + 1} of {tripInfo.totalStops}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Component to fit map bounds when trips change
function MapBoundsUpdater({ filteredTrips, stops }) {
  const map = useMap()

  useEffect(() => {
    if (filteredTrips.length === 0) {
      // Default view of Europe
      map.setView([50.0, 10.0], 5)
      return
    }

    // Collect all stop coordinates
    const allCoords = []
    filteredTrips.forEach(({ stops: tripStops }) => {
      tripStops.forEach(ts => {
        const stop = stops[ts.stop_id]
        if (stop && stop.stop_lat && stop.stop_lon) {
          allCoords.push([stop.stop_lat, stop.stop_lon])
        }
      })
    })

    if (allCoords.length > 0) {
      const bounds = L.latLngBounds(allCoords)
      map.fitBounds(bounds, { padding: [50, 50] })
    }
  }, [filteredTrips, stops, map])

  return null
}

function TripMap({ stops, filteredTrips, selectedStationGroups, hoveredTripId, selectedTripId, onTripHover, onTripClick }) {
  const mapRef = useRef(null)

  // Check if any route is currently highlighted
  const hasHighlightedRoute = hoveredTripId !== null || selectedTripId !== null

  // Create a Set of selected station IDs for quick lookup
  const selectedStationIds = useMemo(() => {
    const ids = new Set()
    if (selectedStationGroups && Array.isArray(selectedStationGroups)) {
      selectedStationGroups.forEach(group => {
        if (group && group.stations) {
          group.stations.forEach(station => {
            if (station && station.stop_id) {
              ids.add(station.stop_id)
            }
          })
        }
      })
    }
    return ids
  }, [selectedStationGroups])

  // Find selected stations that are NOT on any route
  const selectedStationsNotOnRoute = useMemo(() => {
    // Collect all stop IDs that appear in filtered trips
    const stopsOnRoutes = new Set()
    filteredTrips.forEach(({ stops: tripStops }) => {
      tripStops.forEach(ts => {
        stopsOnRoutes.add(ts.stop_id)
      })
    })

    // Find selected stations that are not on any route (using Set to avoid duplicates)
    const notOnRouteIds = new Set()
    const notOnRoute = []
    if (selectedStationGroups && Array.isArray(selectedStationGroups)) {
      selectedStationGroups.forEach(group => {
        if (group && group.stations) {
          group.stations.forEach(station => {
            if (station && station.stop_id && !stopsOnRoutes.has(station.stop_id) && !notOnRouteIds.has(station.stop_id)) {
              const stop = stops[station.stop_id]
              if (stop && stop.stop_lat && stop.stop_lon) {
                notOnRouteIds.add(station.stop_id)
                notOnRoute.push(stop)
              }
            }
          })
        }
      })
    }
    return notOnRoute
  }, [selectedStationGroups, filteredTrips, stops])

  // Generate random colors for different trips
  const getColorForTrip = (index) => {
    const colors = [
      '#667eea', '#764ba2', '#f093fb', '#4facfe',
      '#43e97b', '#fa709a', '#fee140', '#30cfd0'
    ]
    return colors[index % colors.length]
  }

  // Convert hex color to HSL, reduce saturation, and convert back to hex
  const desaturateColor = (hexColor, saturationFactor = 0.3) => {
    // Convert hex to RGB
    const r = parseInt(hexColor.slice(1, 3), 16)
    const g = parseInt(hexColor.slice(3, 5), 16)
    const b = parseInt(hexColor.slice(5, 7), 16)
    
    // Convert RGB to HSL
    const rNorm = r / 255
    const gNorm = g / 255
    const bNorm = b / 255
    
    const max = Math.max(rNorm, gNorm, bNorm)
    const min = Math.min(rNorm, gNorm, bNorm)
    const l = (max + min) / 2
    
    let h = 0
    let s = 0
    
    if (max !== min) {
      const d = max - min
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
      
      switch (max) {
        case rNorm:
          h = ((gNorm - bNorm) / d + (gNorm < bNorm ? 6 : 0)) / 6
          break
        case gNorm:
          h = ((bNorm - rNorm) / d + 2) / 6
          break
        case bNorm:
          h = ((rNorm - gNorm) / d + 4) / 6
          break
      }
    }
    
    // Reduce saturation
    s = s * saturationFactor
    
    // Convert HSL back to RGB
    const hueToRgb = (p, q, t) => {
      if (t < 0) t += 1
      if (t > 1) t -= 1
      if (t < 1 / 6) return p + (q - p) * 6 * t
      if (t < 1 / 2) return q
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
      return p
    }
    
    let rOut, gOut, bOut
    if (s === 0) {
      rOut = gOut = bOut = l
    } else {
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s
      const p = 2 * l - q
      rOut = hueToRgb(p, q, h + 1 / 3)
      gOut = hueToRgb(p, q, h)
      bOut = hueToRgb(p, q, h - 1 / 3)
    }
    
    // Convert back to hex
    const toHex = (x) => {
      const hex = Math.round(x * 255).toString(16)
      return hex.length === 1 ? '0' + hex : hex
    }
    
    return `#${toHex(rOut)}${toHex(gOut)}${toHex(bOut)}`
  }

  // Helper function to create a segment key for two consecutive stops
  const getSegmentKey = (stopId1, stopId2) => {
    // Sort stop IDs to ensure consistent key regardless of direction
    return stopId1 < stopId2 ? `${stopId1}-${stopId2}` : `${stopId2}-${stopId1}`
  }

  // Build a map of segments to routes that use them
  const segmentToRoutes = useMemo(() => {
    const segmentMap = new Map()
    
    filteredTrips.forEach(({ stops: tripStops }, tripIndex) => {
      for (let i = 0; i < tripStops.length - 1; i++) {
        const stopId1 = tripStops[i].stop_id
        const stopId2 = tripStops[i + 1].stop_id
        const segmentKey = getSegmentKey(stopId1, stopId2)
        
        if (!segmentMap.has(segmentKey)) {
          segmentMap.set(segmentKey, [])
        }
        segmentMap.get(segmentKey).push(tripIndex)
      }
    })
    
    return segmentMap
  }, [filteredTrips])

  // Build a consolidated map of stops to all trips that use them
  const stopsToTripsMap = useMemo(() => {
    const stopMap = new Map()
    
    filteredTrips.forEach(({ trip, stops: tripStops }, tripIndex) => {
      tripStops.forEach((ts, stopIndex) => {
        if (!stopMap.has(ts.stop_id)) {
          stopMap.set(ts.stop_id, [])
        }
        stopMap.get(ts.stop_id).push({
          trip,
          tripIndex,
          stopIndex,
          totalStops: tripStops.length
        })
      })
    })
    
    return stopMap
  }, [filteredTrips])

  // Helper function to render a single trip route with its stops
  const renderTripRoute = (trip, tripStops, index, keyPrefix = '') => {
    // Get coordinates for all stops in this trip
    const coordinates = tripStops
      .map(ts => {
        const stop = stops[ts.stop_id]
        if (stop && stop.stop_lat && stop.stop_lon) {
          return [stop.stop_lat, stop.stop_lon]
        }
        return null
      })
      .filter(coord => coord !== null)

    if (coordinates.length === 0) return null

    const isHovered = hoveredTripId === trip.trip_id
    const isTripSelected = selectedTripId === trip.trip_id
    const isHighlighted = isHovered || isTripSelected

    // Base weight for offset calculation (constant for stable positioning)
    const baseWeight = 5
    const lineSpacing = baseWeight + 0 // Space between lines (set to 0 for no spacing)

    // Determine visual properties based on highlight state
    // Only desaturate if there is a highlighted route AND this route is not highlighted
    const baseColor = getColorForTrip(index)
    const shouldDesaturate = hasHighlightedRoute && !isHighlighted
    const color = shouldDesaturate ? desaturateColor(baseColor, 0.3) : baseColor
    const weight = isHighlighted ? 1.5 * baseWeight : baseWeight
    const opacity = shouldDesaturate ? 0.5 : (isHighlighted ? 1 : 0.8)

    // Draw each segment separately with per-segment offset calculation
    const segments = []
    for (let i = 0; i < tripStops.length - 1; i++) {
      const stop1 = stops[tripStops[i].stop_id]
      const stop2 = stops[tripStops[i + 1].stop_id]
      
      if (!stop1 || !stop2 || !stop1.stop_lat || !stop1.stop_lon || !stop2.stop_lat || !stop2.stop_lon) {
        continue
      }

      const segmentKey = getSegmentKey(stop1.stop_id, stop2.stop_id)
      const routesOnSegment = segmentToRoutes.get(segmentKey) || [index]
      
      // Find the position of this route among routes on this segment
      const positionInSegment = routesOnSegment.indexOf(index)
      const routesOnSegmentCount = routesOnSegment.length
      
      // Calculate offset based only on routes sharing this segment
      const totalWidth = routesOnSegmentCount * lineSpacing
      const offset = positionInSegment * lineSpacing - (totalWidth / 2) + (lineSpacing / 2)

      const northernStop = stop1.stop_lat > stop2.stop_lat ? stop1 : stop2
      const southernStop = stop1.stop_lat > stop2.stop_lat ? stop2 : stop1

      segments.push(
        <Polyline
          key={`${keyPrefix}${trip.trip_id}-segment-${i}`}
          positions={[
            [northernStop.stop_lat, northernStop.stop_lon],
            [southernStop.stop_lat , southernStop.stop_lon]
          ]}
          color={color}
          weight={weight}
          opacity={opacity}
          offset={offset}
          eventHandlers={{
            mouseover: () => onTripHover(trip.trip_id),
            mouseout: () => onTripHover(null),
            click: () => onTripClick && onTripClick(trip.trip_id)
          }}
        />
      )
    }

    return (
      <div key={`${keyPrefix}${trip.trip_id}`}>
        {/* Draw route segments with per-segment offsets */}
        {segments}
      </div>
    )
  }

  return (
    <div className="trip-map">
      <MapContainer
        ref={mapRef}
        center={[50.0, 10.0]}
        zoom={5}
        style={{ width: '100%', height: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapBoundsUpdater filteredTrips={filteredTrips} stops={stops} />

        {/* Render non-highlighted routes first (bottom layer) */}
        {filteredTrips.map(({ trip, stops: tripStops }, index) => {
          const isHovered = hoveredTripId === trip.trip_id
          const isTripSelected = selectedTripId === trip.trip_id

          // Skip selected or hovered routes in this pass
          if (isHovered || isTripSelected) return null

          return renderTripRoute(trip, tripStops, index)
        })}

        {/* Render selected routes (middle layer) */}
        {filteredTrips.map(({ trip, stops: tripStops }, index) => {
          const isHovered = hoveredTripId === trip.trip_id
          const isTripSelected = selectedTripId === trip.trip_id

          // Only render selected but not hovered routes in this pass
          if (!isTripSelected || isHovered) return null

          return renderTripRoute(trip, tripStops, index, 'selected-')
        })}

        {/* Render hovered routes last (top layer) */}
        {filteredTrips.map(({ trip, stops: tripStops }, index) => {
          const isHovered = hoveredTripId === trip.trip_id

          // Only render hovered routes in this pass
          if (!isHovered) return null

          return renderTripRoute(trip, tripStops, index, 'hovered-')
        })}

        {/* Render consolidated stop markers */}
        {Array.from(stopsToTripsMap.entries()).map(([stopId, tripInfos]) => {
          const stop = stops[stopId]
          if (!stop || !stop.stop_lat || !stop.stop_lon) return null

          const isSelected = selectedStationIds.has(stopId)

          // Use Marker for selected stations, skip them as they're rendered separately
          if (isSelected) {
            return null
          }

          // Check if any trip is currently highlighted (globally)
          const hasHighlightedTrip = hoveredTripId !== null || selectedTripId !== null

          // Check if any of the trips using this stop is highlighted
          const isHighlighted = tripInfos.some(
            info => info.trip.trip_id === hoveredTripId || info.trip.trip_id === selectedTripId
          )

          // Use grey color for all circles, with reduced opacity for non-highlighted stops
          const shouldReduceOpacity = hasHighlightedTrip && !isHighlighted
          const circleRadius = isHighlighted ? 5 : 4
          const circleFillOpacity = shouldReduceOpacity ? 0.5 : (isHighlighted ? 0.9 : 0.7)

          return (
            <CircleMarker
              key={`consolidated-${stopId}`}
              center={[stop.stop_lat, stop.stop_lon]}
              radius={circleRadius}
              pathOptions={{
                fillColor: STATION_MARKER_COLOR,
                fillOpacity: circleFillOpacity,
                color: STATION_MARKER_COLOR,
                weight: isHighlighted ? 2 : 1
              }}
            >
              <Popup>
                <StationPopupContent stop={stop} trips={tripInfos} />
              </Popup>
            </CircleMarker>
          )
        })}

        {/* Add markers for selected stations on routes */}
        {Array.from(stopsToTripsMap.entries()).map(([stopId, tripInfos]) => {
          const stop = stops[stopId]
          if (!stop || !stop.stop_lat || !stop.stop_lon) return null

          const isSelected = selectedStationIds.has(stopId)

          // Only render markers for selected stations that are on routes
          if (!isSelected) {
            return null
          }

          return (
            <Marker
              key={`selected-marker-${stopId}`}
              position={[stop.stop_lat, stop.stop_lon]}
            >
              <Popup>
                <StationPopupContent stop={stop} trips={tripInfos} />
              </Popup>
            </Marker>
          )
        })}

        {/* Add markers for selected stations not on any route */}
        {selectedStationsNotOnRoute.map((stop) => (
          <Marker
            key={`not-on-route-${stop.stop_id}`}
            position={[stop.stop_lat, stop.stop_lon]}
          >
            <Popup>
              <StationPopupContent stop={stop} trips={[]} />
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {filteredTrips.length === 0 && (
        <div className="map-overlay">
          <p>Select stations to display trips on the map</p>
        </div>
      )}
    </div>
  )
}

export default TripMap
