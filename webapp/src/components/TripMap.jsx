import { useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import './TripMap.css'

// Fix Leaflet default icon issue
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

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

function TripMap({ stops, filteredTrips }) {
  const mapRef = useRef(null)

  // Debug logging
  useEffect(() => {
    console.log('[TripMap] Props updated:', {
      stops: Object.keys(stops).length,
      filteredTrips: filteredTrips.length
    })
  }, [stops, filteredTrips])

  // Generate random colors for different trips
  const getColorForTrip = (index) => {
    const colors = [
      '#667eea', '#764ba2', '#f093fb', '#4facfe',
      '#43e97b', '#fa709a', '#fee140', '#30cfd0'
    ]
    return colors[index % colors.length]
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

        {filteredTrips.map(({ trip, stops: tripStops }, index) => {
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

          const color = getColorForTrip(index)

          return (
            <div key={trip.trip_id}>
              {/* Draw the route line */}
              <Polyline
                positions={coordinates}
                color={color}
                weight={3}
                opacity={0.7}
              />

              {/* Add markers for each stop */}
              {tripStops.map((ts, stopIndex) => {
                const stop = stops[ts.stop_id]
                if (!stop || !stop.stop_lat || !stop.stop_lon) return null

                return (
                  <Marker
                    key={ts.train_stop_id}
                    position={[stop.stop_lat, stop.stop_lon]}
                  >
                    <Popup>
                      <div className="stop-popup">
                        <strong>{stop.stop_name}</strong>
                        {stop.stop_country && <div>Country: {stop.stop_country}</div>}
                        <div style={{ marginTop: '0.5rem', color: '#666' }}>
                          <strong>{trip.trip_short_name}</strong>
                          <br />
                          Stop {stopIndex + 1} of {tripStops.length}
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                )
              })}
            </div>
          )
        })}
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
