/**
 * Utility functions for grouping train stations using Complete Linkage clustering
 */

import distance from '@turf/distance';
import { point } from '@turf/helpers';

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
 * Find the longest common prefix of multiple strings
 * @param {Array<string>} strings - Array of strings to find common prefix
 * @returns {string} Longest common prefix, trimmed
 */
function longestCommonPrefix(strings) {
  if (!strings || strings.length === 0) {
    return '';
  }
  
  // For single string, return it as-is since it's the only option
  // The caller should decide how to use it
  if (strings.length === 1) {
    return strings[0].trim();
  }
  
  // Sort strings to compare first and last (lexicographically)
  const sorted = strings.slice().sort();
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  
  let i = 0;
  while (i < first.length && first[i] === last[i]) {
    i++;
  }
  
  return first.substring(0, i).trim();
}

/**
 * Calculate distance between two stations in kilometers
 * @param {Object} station1 - First station with lat/lon
 * @param {Object} station2 - Second station with lat/lon
 * @returns {number} Distance in kilometers
 */
function calculateDistance(station1, station2) {
  const from = point([station1.lon, station1.lat]);
  const to = point([station2.lon, station2.lat]);
  return distance(from, to, { units: 'kilometers' });
}

/**
 * Group stations using Complete Linkage clustering algorithm
 * Complete Linkage ensures that the maximum distance between any two points
 * in a cluster is at most the threshold distance.
 * @param {Object} stops - Object mapping stop_id to stop data
 * @param {number} maxDistance - Maximum distance in km between any two points in a cluster (default: 25)
 * @returns {Array} Array of station groups, each with groupName, displayName, stations, and coordinates
 */
export function groupStations(stops, maxDistance = 25) {
  // Minimum length for a meaningful group name prefix
  const MIN_GROUP_NAME_LENGTH = 3;
  
  // Convert stops to array with coordinates
  const stopsArray = Object.entries(stops).map(([stopId, stop]) => {
    const lat = parseFloat(stop.stop_lat);
    const lon = parseFloat(stop.stop_lon);
    
    return {
      ...stop,
      stop_id: stopId,
      lat,
      lon
    };
  }).filter(stop => !isNaN(stop.lat) && !isNaN(stop.lon)); // Filter out invalid coordinates
  
  // Initialize each station as its own cluster
  const clusters = stopsArray.map((stop) => [stop]);
  
  // Cache for maximum distances between clusters
  const maxDistCache = new Map();
  
  function getCacheKey(i, j) {
    return i < j ? `${i},${j}` : `${j},${i}`;
  }
  
  function getMaxDistBetweenClusters(clusterI, clusterJ, iIdx, jIdx) {
    const key = getCacheKey(iIdx, jIdx);
    if (maxDistCache.has(key)) {
      return maxDistCache.get(key);
    }
    
    let maxDist = 0;
    for (const station1 of clusterI) {
      for (const station2 of clusterJ) {
        const dist = calculateDistance(station1, station2);
        if (dist > maxDist) {
          maxDist = dist;
        }
      }
    }
    
    maxDistCache.set(key, maxDist);
    return maxDist;
  }
  
  // Complete Linkage clustering: greedily merge closest valid cluster pairs
  let iteration = 0;
  while (true) {
    iteration++;
    let bestI = -1;
    let bestJ = -1;
    let bestDist = Infinity;
    
    // Find the pair of clusters with minimum complete linkage distance
    for (let i = 0; i < clusters.length; i++) {
      for (let j = i + 1; j < clusters.length; j++) {
        const maxDist = getMaxDistBetweenClusters(clusters[i], clusters[j], i, j);
        
        // Only consider merges that keep all points within maxDistance
        if (maxDist <= maxDistance && maxDist < bestDist) {
          bestDist = maxDist;
          bestI = i;
          bestJ = j;
        }
      }
    }
    
    // If no valid merge found, stop
    if (bestI === -1) {
      break;
    }
    
    // Merge the two clusters
    clusters[bestI] = clusters[bestI].concat(clusters[bestJ]);
    clusters.splice(bestJ, 1);
    
    // Invalidate cache entries involving merged clusters
    maxDistCache.clear();
  }
  
  // Convert clusters to groups
  const groups = [];
  
  for (const stations of clusters) {
    if (stations.length === 1) {
      // Single station cluster
      const station = stations[0];
      groups.push({
        groupName: station.stop_name,
        displayName: station.stop_name,
        isGroup: false,
        stations: [station],
        lat: station.lat,
        lon: station.lon,
        stop_country: station.stop_country
      });
    } else {
      // Multi-station cluster - use longest common prefix as name
      const stationNames = stations.map(s => s.stop_name);
      let groupName = longestCommonPrefix(stationNames);
      
      // If the prefix is too short or empty, use a more meaningful name
      if (!groupName || groupName.length < MIN_GROUP_NAME_LENGTH) {
        // Use "Cluster" with a reference to one of the station names
        const sortedNames = stationNames.slice().sort();
        groupName = `Cluster (${sortedNames[0]}, ...)`;
      }
      
      // Calculate centroid
      const avgLat = stations.reduce((sum, s) => sum + s.lat, 0) / stations.length;
      const avgLon = stations.reduce((sum, s) => sum + s.lon, 0) / stations.length;
      
      groups.push({
        groupName: groupName,
        displayName: `${groupName} (${stations.length} stations)`,
        isGroup: true,
        stations: stations.sort((a, b) => a.stop_name.localeCompare(b.stop_name)),
        lat: avgLat,
        lon: avgLon,
        stop_country: getMostCommonCountry(stations)
      });
    }
  }
  
  return groups;
}

/**
 * Search for station groups by name or country with smart sorting
 * @param {Array} groups - Array of station groups
 * @param {string} searchTerm - Search term
 * @param {number} limit - Maximum number of results (default: 20)
 * @returns {Array} Filtered, sorted, and limited array of groups
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
    .sort((a, b) => {
      const aName = a.groupName.toLowerCase();
      const bName = b.groupName.toLowerCase();
      const aDisplay = a.displayName.toLowerCase();
      const bDisplay = b.displayName.toLowerCase();
      
      // Prioritize exact matches on group name
      const aExactGroup = aName === lowerSearch;
      const bExactGroup = bName === lowerSearch;
      if (aExactGroup && !bExactGroup) return -1;
      if (!aExactGroup && bExactGroup) return 1;
      
      // Prioritize exact matches on display name
      const aExactDisplay = aDisplay === lowerSearch;
      const bExactDisplay = bDisplay === lowerSearch;
      if (aExactDisplay && !bExactDisplay) return -1;
      if (!aExactDisplay && bExactDisplay) return 1;
      
      // Prioritize starts with on group name
      const aStartsGroup = aName.startsWith(lowerSearch);
      const bStartsGroup = bName.startsWith(lowerSearch);
      if (aStartsGroup && !bStartsGroup) return -1;
      if (!aStartsGroup && bStartsGroup) return 1;
      
      // Prioritize starts with on display name
      const aStartsDisplay = aDisplay.startsWith(lowerSearch);
      const bStartsDisplay = bDisplay.startsWith(lowerSearch);
      if (aStartsDisplay && !bStartsDisplay) return -1;
      if (!aStartsDisplay && bStartsDisplay) return 1;
      
      // NEW: Prioritize grouped stations (isGroup=true) over individual stations
      if (a.isGroup && b.isGroup) {
        // Both are groups - sort by amount of stations (more stations first)
        if (b.stations.length !== a.stations.length) {
          return b.stations.length - a.stations.length;
        }
      }
      if (a.isGroup && !b.isGroup) return -1;
      if (!a.isGroup && b.isGroup) return 1;
      
      // Otherwise sort alphabetically by display name
      return aDisplay.localeCompare(bDisplay);
    })
    .slice(0, limit);
}
