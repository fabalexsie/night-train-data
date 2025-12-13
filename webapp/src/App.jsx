import { useState, useEffect, useMemo, useRef } from 'react'
import StationAutocomplete from './components/StationAutocomplete'
import TripMap from './components/TripMap'
import { groupStations } from './utils/stationGrouping'
import { saveSelectedStationGroups, loadSelectedStationGroups } from './utils/localStorage'
import './App.css'

function App() {
  const [stops, setStops] = useState({})
  const [trips, setTrips] = useState({})
  const [tripStops, setTripStops] = useState({})
  const [selectedStationGroups, setSelectedStationGroups] = useState([])
  const [filteredTrips, setFilteredTrips] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const isRestoredRef = useRef(false)

  // Group stations for easier selection
  const stationGroups = useMemo(() => {
    return groupStations(stops)
  }, [stops])

  // Restore selected station groups from localStorage when data is loaded
  useEffect(() => {
    if (Object.keys(stops).length === 0) {
      return; // Wait for data to load
    }

    const savedGroups = loadSelectedStationGroups();
    if (savedGroups.length > 0) {
      console.log('Restoring', savedGroups.length, 'station groups from localStorage');
      setSelectedStationGroups(savedGroups);
    }
    isRestoredRef.current = true;
  }, [stops]); // Run once when stops are loaded

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

        console.log('Data loaded:', {
          stops: Object.keys(stopsData).length,
          trips: Object.keys(tripsData).length,
          tripStops: Object.keys(tripStopsData).length
        })

        setStops(stopsData)
        setTrips(tripsData)
        setTripStops(tripStopsData)
        setLoading(false)
      } catch (err) {
        console.error('Error loading data:', err)
        setError(err.message)
        setLoading(false)
      }
    }

    loadData()
  }, [])

  // Filter trips based on selected station groups
  useEffect(() => {
    if (selectedStationGroups.length === 0) {
      setFilteredTrips([])
      return
    }

    // Ensure data is loaded before filtering
    if (Object.keys(trips).length === 0 || Object.keys(tripStops).length === 0) {
      console.log('Waiting for data to load...')
      return
    }

    // Collect all station IDs from selected groups
    const selectedStationIds = new Set()
    selectedStationGroups.forEach(group => {
      group.stations.forEach(station => {
        selectedStationIds.add(station.stop_id)
      })
    })
    
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

    console.log(`Found ${matchingTrips.length} trips for ${selectedStationGroups.length} station group(s)`)
    setFilteredTrips(matchingTrips)
  }, [selectedStationGroups, trips, tripStops])

  // Save selected station groups to localStorage whenever they change
  // Only save after initial restoration to avoid overwriting saved data
  useEffect(() => {
    if (isRestoredRef.current) {
      saveSelectedStationGroups(selectedStationGroups);
    }
  }, [selectedStationGroups]);

  const handleStationGroupAdd = (group) => {
    if (!selectedStationGroups.find(g => g.groupName === group.groupName)) {
      setSelectedStationGroups([...selectedStationGroups, group])
    }
  }

  const handleStationGroupRemove = (groupName) => {
    setSelectedStationGroups(selectedStationGroups.filter(g => g.groupName !== groupName))
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
            stationGroups={stationGroups}
            selectedGroups={selectedStationGroups}
            onGroupAdd={handleStationGroupAdd}
            onGroupRemove={handleStationGroupRemove}
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
