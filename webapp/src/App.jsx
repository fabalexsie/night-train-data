import { useState, useEffect, useRef, useMemo } from 'react'
import StationAutocomplete from './components/StationAutocomplete'
import TripMap from './components/TripMap'
import { saveSelectedStationGroups, loadSelectedStationGroups, saveGroupingEnabled, loadGroupingEnabled } from './utils/localStorage'
import './App.css'

function App() {
  const [stops, setStops] = useState({})
  const [trips, setTrips] = useState({})
  const [tripStops, setTripStops] = useState({})
  const [stationGroups, setStationGroups] = useState([])
  const [selectedStationGroups, setSelectedStationGroups] = useState([])
  const [filteredTrips, setFilteredTrips] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [groupingEnabled, setGroupingEnabled] = useState(true)
  const isRestoredRef = useRef(false)

  // Flatten station groups into individual stations when grouping is disabled
  const displayStationGroups = useMemo(() => {
    if (groupingEnabled) {
      return stationGroups;
    }
    
    // Flatten all groups into individual stations
    const flattenedStations = [];
    stationGroups.forEach(group => {
      group.stations.forEach(station => {
        flattenedStations.push({
          groupName: station.stop_name,
          displayName: station.stop_name,
          isGroup: false,
          stations: [station],
          lat: station.lat,
          lon: station.lon,
          stop_country: station.stop_country
        });
      });
    });
    return flattenedStations;
  }, [stationGroups, groupingEnabled]);

  // Restore grouping preference from localStorage
  useEffect(() => {
    const savedGroupingEnabled = loadGroupingEnabled();
    setGroupingEnabled(savedGroupingEnabled);
  }, []);

  // Restore selected station groups from localStorage when data is loaded
  useEffect(() => {
    if (stationGroups.length === 0) {
      return; // Wait for station groups to load
    }

    const savedGroups = loadSelectedStationGroups();
    if (savedGroups.length > 0) {
      console.log('Restoring', savedGroups.length, 'station groups from localStorage');
      setSelectedStationGroups(savedGroups);
    }
    // Mark as restored regardless of whether there were saved groups
    isRestoredRef.current = true;
  }, [stationGroups]); // Run once when station groups are loaded

  // Load data from JSON files
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)
        const [stopsRes, tripsRes, tripStopsRes, stationGroupsRes] = await Promise.all([
          fetch('/data/stops.json'),
          fetch('/data/trips.json'),
          fetch('/data/trip_stop.json'),
          fetch('/data/station-groups.json')
        ])

        if (!stopsRes.ok || !tripsRes.ok || !tripStopsRes.ok || !stationGroupsRes.ok) {
          throw new Error('Failed to load data')
        }

        const [stopsData, tripsData, tripStopsData, stationGroupsData] = await Promise.all([
          stopsRes.json(),
          tripsRes.json(),
          tripStopsRes.json(),
          stationGroupsRes.json()
        ])

        console.log('Data loaded:', {
          stops: Object.keys(stopsData).length,
          trips: Object.keys(tripsData).length,
          tripStops: Object.keys(tripStopsData).length,
          stationGroups: stationGroupsData.length
        })

        setStops(stopsData)
        setTrips(tripsData)
        setTripStops(tripStopsData)
        setStationGroups(stationGroupsData)
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

  // Save grouping preference to localStorage whenever it changes
  useEffect(() => {
    saveGroupingEnabled(groupingEnabled);
  }, [groupingEnabled]);

  const handleStationGroupAdd = (group) => {
    if (!selectedStationGroups.find(g => g.groupName === group.groupName)) {
      setSelectedStationGroups([...selectedStationGroups, group])
    }
  }

  const handleStationGroupRemove = (groupName) => {
    setSelectedStationGroups(selectedStationGroups.filter(g => g.groupName !== groupName))
  }

  const handleToggleGrouping = () => {
    setGroupingEnabled(prev => !prev);
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
            stationGroups={displayStationGroups}
            selectedGroups={selectedStationGroups}
            onGroupAdd={handleStationGroupAdd}
            onGroupRemove={handleStationGroupRemove}
            groupingEnabled={groupingEnabled}
            onToggleGrouping={handleToggleGrouping}
          />
          
          <div className="trip-info">
            <h3>Filtered Trips</h3>
            <p>{filteredTrips.length} trip(s) found</p>
            
            {filteredTrips.length > 0 && (
              <div className="trip-list">
                {filteredTrips.map(({ trip }) => (
                  <div key={trip.trip_id} className="trip-item">
                    <strong>{trip.trip_short_name}</strong>
                    <br />
                    {trip.trip_origin} → {trip.trip_headsign}
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>

        <main className="map-container">
          <TripMap 
            stops={stops}
            filteredTrips={filteredTrips}
            selectedStationGroups={selectedStationGroups}
          />
        </main>
      </div>
    </div>
  )
}

export default App
