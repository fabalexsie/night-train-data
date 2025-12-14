import { useEffect, useRef, useMemo } from 'react'
import { MapContainer, TileLayer, Polyline, Marker, CircleMarker, Popup, useMap } from 'react-leaflet'
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

function TripMap({ stops, filteredTrips, selectedStationGroups }) {
  const mapRef = useRef(null)

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

              {/* Add markers for selected stops, circles for other stops */}
              {tripStops.map((ts, stopIndex) => {
                const stop = stops[ts.stop_id]
                if (!stop || !stop.stop_lat || !stop.stop_lon) return null

                const isSelected = selectedStationIds.has(ts.stop_id)

                // Use Marker for selected stations, CircleMarker for others
                if (isSelected) {
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
                            {trip.trip_origin && trip.trip_headsign && (
                              <>
                                {trip.trip_origin} → {trip.trip_headsign}
                                <br />
                              </>
                            )}
                            Stop {stopIndex + 1} of {tripStops.length}
                          </div>
                        </div>
                      </Popup>
                    </Marker>
                  )
                } else {
                  return (
                    <CircleMarker
                      key={ts.train_stop_id}
                      center={[stop.stop_lat, stop.stop_lon]}
                      radius={4}
                      pathOptions={{
                        fillColor: color,
                        fillOpacity: 0.6,
                        color: color,
                        weight: 1
                      }}
                    >
                      <Popup>
                        <div className="stop-popup">
                          <strong>{stop.stop_name}</strong>
                          {stop.stop_country && <div>Country: {stop.stop_country}</div>}
                          <div style={{ marginTop: '0.5rem', color: '#666' }}>
                            <strong>{trip.trip_short_name}</strong>
                            <br />
                            {trip.trip_origin && trip.trip_headsign && (
                              <>
                                {trip.trip_origin} → {trip.trip_headsign}
                                <br />
                              </>
                            )}
                            Stop {stopIndex + 1} of {tripStops.length}
                          </div>
                        </div>
                      </Popup>
                    </CircleMarker>
                  )
                }
              })}
            </div>
          )
        })}

        {/* Add markers for selected stations not on any route */}
        {selectedStationsNotOnRoute.map((stop) => (
          <Marker
            key={`not-on-route-${stop.stop_id}`}
            position={[stop.stop_lat, stop.stop_lon]}
          >
            <Popup>
              <div className="stop-popup">
                <strong>{stop.stop_name}</strong>
                {stop.stop_country && <div>Country: {stop.stop_country}</div>}
                <div style={{ marginTop: '0.5rem', color: '#666' }}>
                  Not on any displayed route
                </div>
              </div>
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
