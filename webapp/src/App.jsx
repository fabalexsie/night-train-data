import { useState, useEffect } from 'react'
import StationAutocomplete from './components/StationAutocomplete'
import TripMap from './components/TripMap'
import './App.css'

function App() {
  const [stops, setStops] = useState({})
  const [trips, setTrips] = useState({})
  const [tripStops, setTripStops] = useState({})
  const [selectedStations, setSelectedStations] = useState([])
  const [filteredTrips, setFilteredTrips] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Load data from JSON files
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)
        const [stopsRes, tripsRes, tripStopsRes] = await Promise.all([
          fetch('/data/stops.json'),
          fetch('/data/trips.json'),
          fetch('/data/trip_stop.json')
        ])

        if (!stopsRes.ok || !tripsRes.ok || !tripStopsRes.ok) {
          throw new Error('Failed to load data')
        }

        const [stopsData, tripsData, tripStopsData] = await Promise.all([
          stopsRes.json(),
          tripsRes.json(),
          tripStopsRes.json()
        ])

        setStops(stopsData)
        setTrips(tripsData)
        setTripStops(tripStopsData)
        setLoading(false)
      } catch (err) {
        setError(err.message)
        setLoading(false)
      }
    }

    loadData()
  }, [])

  // Filter trips based on selected stations
  useEffect(() => {
    if (selectedStations.length === 0) {
      setFilteredTrips([])
      return
    }

    const selectedStationIds = new Set(selectedStations.map(s => s.stop_id))
    const matchingTrips = []

    // For each trip, check if any of its stops match the selected stations
    Object.values(trips).forEach(trip => {
      const tripId = trip.trip_id
      
      // Find all stops for this trip
      const stopsForTrip = Object.values(tripStops).filter(
        ts => ts.trip_id === tripId
      )

      // Check if any stop matches the selected stations
      const hasMatchingStation = stopsForTrip.some(
        ts => selectedStationIds.has(ts.stop_id)
      )

      if (hasMatchingStation) {
        matchingTrips.push({
          trip,
          stops: stopsForTrip.sort((a, b) => a.stop_sequence - b.stop_sequence)
        })
      }
    })

    setFilteredTrips(matchingTrips)
  }, [selectedStations, trips, tripStops])

  const handleStationAdd = (station) => {
    if (!selectedStations.find(s => s.stop_id === station.stop_id)) {
      setSelectedStations([...selectedStations, station])
    }
  }

  const handleStationRemove = (stationId) => {
    setSelectedStations(selectedStations.filter(s => s.stop_id !== stationId))
  }

  if (loading) {
    return <div className="loading">Loading data...</div>
  }

  if (error) {
    return <div className="error">Error: {error}</div>
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>Night Train Map</h1>
        <p>Filter trips by stations and view them on the map</p>
      </header>
      
      <div className="app-content">
        <aside className="sidebar">
          <StationAutocomplete 
            stops={stops}
            selectedStations={selectedStations}
            onStationAdd={handleStationAdd}
            onStationRemove={handleStationRemove}
          />
          
          <div className="trip-info">
            <h3>Filtered Trips</h3>
            <p>{filteredTrips.length} trip(s) found</p>
            
            {filteredTrips.length > 0 && (
              <div className="trip-list">
                {filteredTrips.slice(0, 10).map(({ trip }) => (
                  <div key={trip.trip_id} className="trip-item">
                    <strong>{trip.trip_short_name}</strong>
                    <br />
                    {trip.trip_origin} → {trip.trip_headsign}
                  </div>
                ))}
                {filteredTrips.length > 10 && (
                  <p className="more-trips">... and {filteredTrips.length - 10} more</p>
                )}
              </div>
            )}
          </div>
        </aside>

        <main className="map-container">
          <TripMap 
            stops={stops}
            filteredTrips={filteredTrips}
          />
        </main>
      </div>
    </div>
  )
}

export default App
