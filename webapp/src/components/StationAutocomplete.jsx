import { useState, useMemo } from 'react'
import { searchStationGroups } from '../utils/searchInStationGroups.js'
import './StationAutocomplete.css'

function StationAutocomplete({ stationGroups, selectedGroups, onGroupAdd, onGroupRemove }) {
  const [searchTerm, setSearchTerm] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)

  // Get set of already selected group names
  const selectedGroupNames = useMemo(
    () => new Set(selectedGroups.map(g => g.groupName)),
    [selectedGroups]
  )

  // Filter station groups based on search term and exclude already selected groups
  const filteredGroups = searchStationGroups(stationGroups, searchTerm, 20)
    .filter(group => !selectedGroupNames.has(group.groupName))

  const handleInputChange = (e) => {
    setSearchTerm(e.target.value)
    setShowSuggestions(true)
  }

  const handleSelectGroup = (group) => {
    onGroupAdd(group)
    setSearchTerm('')
    setShowSuggestions(false)
  }

  const handleRemoveGroup = (groupName) => {
    onGroupRemove(groupName)
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
        
        {showSuggestions && filteredGroups.length > 0 && (
          <ul className="suggestions-list">
            {filteredGroups.map(group => (
              <li 
                key={group.groupName}
                className="suggestion-item"
                onClick={() => handleSelectGroup(group)}
              >
                <div>
                  <strong>{group.displayName}</strong>
                  {group.stop_country && <span className="country">{group.stop_country}</span>}
                </div>
                {group.isGroup && group.stations.length > 0 && (
                  <div className="group-stations">
                    {group.stations.slice(0, 3).map(s => s.stop_name).join(', ')}
                    {group.stations.length > 3 && '...'}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {selectedGroups.length > 0 && (
        <div className="selected-stations">
          <h3>Selected Stations:</h3>
          <ul className="station-tags">
            {selectedGroups.map(group => (
              <li key={group.groupName} className="station-tag">
                {group.displayName}
                {group.stop_country && <span className="tag-country">({group.stop_country})</span>}
                <button 
                  className="remove-btn"
                  onClick={() => handleRemoveGroup(group.groupName)}
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
