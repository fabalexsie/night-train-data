/**
 * Utility functions for grouping train stations with similar names at similar locations
 */

/**
 * Calculate the Haversine distance between two points in kilometers
 * @param {number} lat1 - Latitude of first point
 * @param {number} lon1 - Longitude of first point
 * @param {number} lat2 - Latitude of second point
 * @param {number} lon2 - Longitude of second point
 * @returns {number} Distance in kilometers
 */
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const toRad = (deg) => deg * Math.PI / 180;
  
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Get the most common country from a list of stations
 * @param {Array} stations - Array of station objects with stop_country property
 * @returns {string} Most common country code, or empty string if none found
 */
function getMostCommonCountry(stations) {
  const countryFreq = {};
  stations.forEach(s => {
    if (s.stop_country) {
      countryFreq[s.stop_country] = (countryFreq[s.stop_country] || 0) + 1;
    }
  });
  
  if (Object.keys(countryFreq).length === 0) {
    return '';
  }
  
  return Object.keys(countryFreq).reduce((a, b) => 
    countryFreq[a] > countryFreq[b] ? a : b
  );
}

/**
 * Extract the base name from a station name
 * E.g., "Frankfurt (Main) Hbf" -> "Frankfurt (Main)"
 *       "Berlin Hauptbahnhof" -> "Berlin"
 * @param {string} stationName - Full station name
 * @returns {string} Base name
 */
function extractBaseName(stationName) {
  // Keep text in parentheses as part of base name
  if (stationName.includes('(') && stationName.includes(')')) {
    const closeParen = stationName.lastIndexOf(')');
    return stationName.substring(0, closeParen + 1).trim();
  }
  
  // Common station suffixes to remove (check from end of string)
  const suffixes = [
    'Hauptbahnhof', 'Hbf', 'HB', 'Bf', 'Station', 'Gare',
    'Centrale', 'Central', 'Airport', 'Flughafen', 
    'Sud', 'Süd', 'Nord', 'Ost', 'West', 'Est',
    'Ostbahnhof', 'Westbahnhof', 'Südbahnhof', 'Nordbahnhof',
    'Ostkreuz', 'Westkreuz'
  ];
  
  // Try to match suffixes at the end of the string
  for (const suffix of suffixes) {
    const pattern = ' ' + suffix;
    if (stationName.endsWith(pattern) || stationName.endsWith(pattern + ' ')) {
      return stationName.substring(0, stationName.lastIndexOf(pattern)).trim();
    }
  }
  
  return stationName;
}

/**
 * Group stations by their base name and proximity
 * @param {Object} stops - Object mapping stop_id to stop data
 * @param {number} maxDistance - Maximum distance in km to consider stations as a group (default: 50)
 * @returns {Array} Array of station groups, each with groupName, displayName, stations, and coordinates
 */
export function groupStations(stops, maxDistance = 50) {
  // Generic base names that shouldn't be grouped (too common)
  const genericBaseNames = new Set([
    'Bad', 'St.', 'St', 'La', 'Le', 'Les', 'Il', 'El', 'De', 'Den', 'Het'
  ]);
  
  // First pass: group by base name
  const baseNameGroups = {};
  
  Object.entries(stops).forEach(([stopId, stop]) => {
    const baseName = extractBaseName(stop.stop_name);
    const lat = parseFloat(stop.stop_lat);
    const lon = parseFloat(stop.stop_lon);
    
    // Skip stations without valid coordinates
    if (isNaN(lat) || isNaN(lon)) {
      return;
    }
    
    if (!baseNameGroups[baseName]) {
      baseNameGroups[baseName] = [];
    }
    
    baseNameGroups[baseName].push({
      ...stop,
      stop_id: stopId,
      lat,
      lon
    });
  });
  
  // Second pass: create groups and individual stations
  const groups = [];
  
  Object.entries(baseNameGroups).forEach(([baseName, stations]) => {
    // Don't group stations with generic base names
    if (genericBaseNames.has(baseName)) {
      stations.forEach(station => {
        groups.push({
          groupName: baseName,
          displayName: station.stop_name,
          isGroup: false,
          stations: [station],
          lat: station.lat,
          lon: station.lon,
          stop_country: station.stop_country
        });
      });
      return;
    }
    
    if (stations.length === 1) {
      // Single station - add as individual entry
      const station = stations[0];
      groups.push({
        groupName: baseName,
        displayName: station.stop_name,
        isGroup: false,
        stations: [station],
        lat: station.lat,
        lon: station.lon,
        stop_country: station.stop_country
      });
    } else {
      // Multiple stations - check if they're close enough to group
      let maxDist = 0;
      let tooFarApart = false;
      
      // Calculate maximum distance between any two stations
      for (let i = 0; i < stations.length && !tooFarApart; i++) {
        for (let j = i + 1; j < stations.length && !tooFarApart; j++) {
          const dist = haversineDistance(
            stations[i].lat, stations[i].lon,
            stations[j].lat, stations[j].lon
          );
          maxDist = Math.max(maxDist, dist);
          
          // Early exit if we find stations that are too far apart
          if (maxDist > maxDistance) {
            tooFarApart = true;
          }
        }
      }
      
      if (!tooFarApart && maxDist <= maxDistance) {
        // Stations are close enough - create a group
        // Calculate centroid
        const avgLat = stations.reduce((sum, s) => sum + s.lat, 0) / stations.length;
        const avgLon = stations.reduce((sum, s) => sum + s.lon, 0) / stations.length;
        
        groups.push({
          groupName: baseName,
          displayName: `${baseName} (${stations.length} stations)`,
          isGroup: true,
          stations: stations.sort((a, b) => a.stop_name.localeCompare(b.stop_name)),
          lat: avgLat,
          lon: avgLon,
          stop_country: getMostCommonCountry(stations)
        });
      } else {
        // Stations are too far apart - add individually
        stations.forEach(station => {
          groups.push({
            groupName: baseName,
            displayName: station.stop_name,
            isGroup: false,
            stations: [station],
            lat: station.lat,
            lon: station.lon,
            stop_country: station.stop_country
          });
        });
      }
    }
  });
  
  return groups;
}

/**
 * Search for station groups by name or country
 * @param {Array} groups - Array of station groups
 * @param {string} searchTerm - Search term
 * @param {number} limit - Maximum number of results (default: 20)
 * @returns {Array} Filtered and limited array of groups
 */
export function searchStationGroups(groups, searchTerm, limit = 20) {
  if (!searchTerm) {
    return [];
  }
  
  const lowerSearch = searchTerm.toLowerCase();
  
  return groups
    .filter(group => {
      // Search in group name
      if (group.groupName.toLowerCase().includes(lowerSearch)) {
        return true;
      }
      
      // Search in display name
      if (group.displayName.toLowerCase().includes(lowerSearch)) {
        return true;
      }
      
      // Search in country
      if (group.stop_country && group.stop_country.toLowerCase().includes(lowerSearch)) {
        return true;
      }
      
      // Search in individual station names within the group
      return group.stations.some(station => 
        station.stop_name.toLowerCase().includes(lowerSearch)
      );
    })
    .slice(0, limit);
}
