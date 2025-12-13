import { useState, useMemo } from 'react'
import './StationAutocomplete.css'

function StationAutocomplete({ stops, selectedStations, onStationAdd, onStationRemove }) {
  const [searchTerm, setSearchTerm] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)

  // Convert stops object to array and filter based on search term
  const filteredStops = useMemo(() => {
    if (!searchTerm) return []
    
    const stopsArray = Object.values(stops)
    const lowerSearch = searchTerm.toLowerCase()
    
    return stopsArray
      .filter(stop => 
        stop.stop_name.toLowerCase().includes(lowerSearch) ||
        (stop.stop_country && stop.stop_country.toLowerCase().includes(lowerSearch))
      )
      .sort((a, b) => {
        const aName = a.stop_name.toLowerCase()
        const bName = b.stop_name.toLowerCase()
        
        // Prioritize exact matches
        const aExact = aName === lowerSearch
        const bExact = bName === lowerSearch
        if (aExact && !bExact) return -1
        if (!aExact && bExact) return 1
        
        // Prioritize starts with
        const aStarts = aName.startsWith(lowerSearch)
        const bStarts = bName.startsWith(lowerSearch)
        if (aStarts && !bStarts) return -1
        if (!aStarts && bStarts) return 1
        
        // Otherwise sort alphabetically
        return aName.localeCompare(bName)
      })
      .slice(0, 20) // Limit to 20 suggestions
  }, [stops, searchTerm])

  const handleInputChange = (e) => {
    setSearchTerm(e.target.value)
    setShowSuggestions(true)
  }

  const handleSelectStation = (station) => {
    console.log('[StationAutocomplete] Station selected:', station.stop_name, station)
    onStationAdd(station)
    setSearchTerm('')
    setShowSuggestions(false)
  }

  const handleRemoveStation = (stationId) => {
    onStationRemove(stationId)
  }

  return (
    <div className="station-autocomplete">
      <h2>Filter by Stations</h2>
      
      <div className="search-container">
        <input
          type="text"
          className="search-input"
          placeholder="Search for a station..."
          value={searchTerm}
          onChange={handleInputChange}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
        />
        
        {showSuggestions && filteredStops.length > 0 && (
          <ul className="suggestions-list">
            {filteredStops.map(stop => (
              <li 
                key={stop.stop_id}
                className="suggestion-item"
                onClick={() => handleSelectStation(stop)}
              >
                <strong>{stop.stop_name}</strong>
                {stop.stop_country && <span className="country">{stop.stop_country}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>

      {selectedStations.length > 0 && (
        <div className="selected-stations">
          <h3>Selected Stations:</h3>
          <ul className="station-tags">
            {selectedStations.map(station => (
              <li key={station.stop_id} className="station-tag">
                {station.stop_name}
                {station.stop_country && <span className="tag-country">({station.stop_country})</span>}
                <button 
                  className="remove-btn"
                  onClick={() => handleRemoveStation(station.stop_id)}
                  aria-label="Remove station"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

export default StationAutocomplete
