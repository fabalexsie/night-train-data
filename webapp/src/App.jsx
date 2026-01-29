import { useState, useEffect, useRef, useMemo } from 'react'
import StationAutocomplete from './components/StationAutocomplete'
import TripMap from './components/TripMap'
import TabPanel from './components/TabPanel'
import { saveSelectedStationGroups, loadSelectedStationGroups, loadGroupingEnabled, saveGroupingEnabled } from './utils/localStorage'
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
  const [groupingEnabled, setGroupingEnabled] = useState(() => loadGroupingEnabled())
  const [hoveredTripId, setHoveredTripId] = useState(null)
  const [selectedTripId, setSelectedTripId] = useState(null)
  const [activeTab, setActiveTab] = useState(0)
  const isRestoredRef = useRef(false)
  const tripRefs = useRef({})

  // Flatten station groups into individual stations when grouping is disabled
  const displayStationGroups = useMemo(() => {
    if (groupingEnabled || stationGroups.length === 0) {
      return stationGroups;
    }
    
    // Flatten all groups into individual stations
    // Each station becomes its own "group" with the same structure as grouped items
    const flattenedStations = [];
    stationGroups.forEach(group => {
      group.stations.forEach(station => {
        flattenedStations.push({
          groupName: station.stop_name,  // Used as unique identifier
          displayName: station.stop_name,  // Used for display in UI
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
          fetch('/data/stops-filtered.json'),
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
      setSelectedTripId(null) // Clear selection when no stations are selected
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
    
    // Clear selection if the selected trip is no longer in the filtered results
    if (selectedTripId && !matchingTrips.find(({ trip }) => trip.trip_id === selectedTripId)) {
      setSelectedTripId(null)
    }
  }, [selectedStationGroups, trips, tripStops, selectedTripId])

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

  const handleTripHover = (tripId) => {
    setHoveredTripId(tripId)
  }

  const handleTripClick = (tripId) => {
    const newTripId = tripId === selectedTripId ? null : tripId
    setSelectedTripId(newTripId)
    
    // Switch to Filtered Trips tab and scroll the trip into view if it's being selected
    if (newTripId) {
      setActiveTab(1) // Switch to Filtered Trips tab (index 1)
      // Use setTimeout to ensure the tab has switched and the element is rendered
      setTimeout(() => {
        if (tripRefs.current[newTripId]) {
          tripRefs.current[newTripId].scrollIntoView({
            behavior: 'smooth',
            block: 'nearest'
          })
        }
      }, 100)
    }
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
          <TabPanel 
            activeTab={activeTab}
            onTabChange={setActiveTab}
            tabs={[
              {
                label: 'Selected Stations',
                content: (
                  <StationAutocomplete 
                    stationGroups={displayStationGroups}
                    selectedGroups={selectedStationGroups}
                    onGroupAdd={handleStationGroupAdd}
                    onGroupRemove={handleStationGroupRemove}
                    groupingEnabled={groupingEnabled}
                    onToggleGrouping={handleToggleGrouping}
                  />
                )
              },
              {
                label: 'Filtered Trips',
                content: (
                  <div className="trip-info">
                    <h3>Filtered Trips</h3>
                    <p>{filteredTrips.length} trip(s) found</p>
                    
                    {filteredTrips.length > 0 && (
                      <div className="trip-list">
                        {filteredTrips.map(({ trip }) => (
                          <div 
                            key={trip.trip_id}
                            ref={(el) => {
                              if (el) {
                                tripRefs.current[trip.trip_id] = el
                              } else {
                                delete tripRefs.current[trip.trip_id]
                              }
                            }}
                            className={`trip-item ${hoveredTripId === trip.trip_id ? 'hovered' : ''} ${selectedTripId === trip.trip_id ? 'selected' : ''}`}
                            onMouseEnter={() => handleTripHover(trip.trip_id)}
                            onMouseLeave={() => handleTripHover(null)}
                            onClick={() => handleTripClick(trip.trip_id)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault()
                                handleTripClick(trip.trip_id)
                              }
                            }}
                            tabIndex={0}
                            role="button"
                            aria-pressed={selectedTripId === trip.trip_id}
                          >
                            <strong>{trip.trip_short_name}</strong>
                            <br />
                            {trip.trip_origin} → {trip.trip_headsign}
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {selectedTripId && filteredTrips.find(({ trip }) => trip.trip_id === selectedTripId) && (
                      <div className="selected-trip-stops">
                        <h4>Stops for selected trip:</h4>
                        <div className="stops-horizontal-scroll">
                          {filteredTrips
                            .find(({ trip }) => trip.trip_id === selectedTripId)
                            .stops.map((ts, index) => {
                              const stop = stops[ts.stop_id]
                              return stop ? (
                                <div key={ts.train_stop_id} className="stop-chip">
                                  <span className="stop-sequence">{index + 1}</span>
                                  <span className="stop-name">{stop.stop_name}</span>
                                </div>
                              ) : null
                            })}
                        </div>
                      </div>
                    )}
                  </div>
                )
              }
            ]}
          />
        </aside>

        <main className="map-container">
          <TripMap 
            stops={stops}
            filteredTrips={filteredTrips}
            selectedStationGroups={selectedStationGroups}
            hoveredTripId={hoveredTripId}
            selectedTripId={selectedTripId}
            onTripHover={handleTripHover}
            onTripClick={handleTripClick}
          />
        </main>
      </div>
    </div>
  )
}

export default App
