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

        console.log('=== DATA LOADED ===')
        console.log('Stops:', Object.keys(stopsData).length)
        console.log('Trips:', Object.keys(tripsData).length)
        console.log('TripStops:', Object.keys(tripStopsData).length)
        console.log('Sample stop:', Object.values(stopsData)[0])
        console.log('Sample trip:', Object.values(tripsData)[0])
        console.log('Sample tripStop:', Object.values(tripStopsData)[0])

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
    console.log('=== FILTERING TRIPS ===')
    console.log('Selected stations:', selectedStations)
    console.log('Stops available:', Object.keys(stops).length)
    console.log('Trips available:', Object.keys(trips).length)
    console.log('TripStops available:', Object.keys(tripStops).length)

    if (selectedStations.length === 0) {
      console.log('No stations selected, clearing filtered trips')
      setFilteredTrips([])
      return
    }

    const selectedStationIds = new Set(selectedStations.map(s => {
      console.log('  Mapping station:', s.stop_name, 'with stop_id:', s.stop_id, 'type:', typeof s.stop_id)
      return s.stop_id
    }))
    console.log('Selected station IDs:', Array.from(selectedStationIds))
    
    const matchingTrips = []

    // For each trip, check if any of its stops match the selected stations
    Object.values(trips).forEach((trip, index) => {
      const tripId = trip.trip_id
      
      if (index === 0) {
        console.log('  Processing first trip:', tripId)
      }
      
      // Find all stops for this trip
      const stopsForTrip = Object.values(tripStops).filter(
        ts => ts.trip_id === tripId
      )

      if (index === 0) {
        console.log('    Stops for first trip:', stopsForTrip.length)
        if (stopsForTrip.length > 0) {
          console.log('    Sample stop:', stopsForTrip[0])
        }
      }

      // Check if any stop matches the selected stations
      const hasMatchingStation = stopsForTrip.some(
        ts => {
          const matches = selectedStationIds.has(ts.stop_id)
          if (index === 0 && stopsForTrip.indexOf(ts) === 0) {
            console.log('    Checking stop_id:', ts.stop_id, 'type:', typeof ts.stop_id, 'matches:', matches)
          }
          return matches
        }
      )

      if (hasMatchingStation) {
        matchingTrips.push({
          trip,
          stops: stopsForTrip.sort((a, b) => a.stop_sequence - b.stop_sequence)
        })
      }
    })

    console.log('Matching trips found:', matchingTrips.length)
    if (matchingTrips.length > 0) {
      console.log('First matching trip:', matchingTrips[0].trip.trip_short_name)
    }

    setFilteredTrips(matchingTrips)
  }, [selectedStations, trips, tripStops, stops])

  const handleStationAdd = (station) => {
    console.log('=== STATION ADDED ===')
    console.log('Station:', station)
    if (!selectedStations.find(s => s.stop_id === station.stop_id)) {
      setSelectedStations([...selectedStations, station])
    }
  }

  const handleStationRemove = (stationId) => {
    console.log('=== STATION REMOVED ===')
    console.log('Station ID:', stationId)
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
        <h1>Night Train Map (DEBUG VERSION)</h1>
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
