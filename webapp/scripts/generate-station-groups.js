#!/usr/bin/env node
/**
 * Script to pre-compute station groups from stops.json
 * This runs during Docker build time to generate station-groups.json
 */

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import distance from '@turf/distance';
import { point } from '@turf/helpers';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Get the most common country from a list of stations
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
 */
function longestCommonPrefix(strings) {
  if (!strings || strings.length === 0) {
    return '';
  }
  
  if (strings.length === 1) {
    return strings[0].trim();
  }
  
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
 * This is the same logic as in webapp/src/utils/stationGrouping.js
 */
function groupStations(stops, maxDistance = 25) {
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
  }).filter(stop => !isNaN(stop.lat) && !isNaN(stop.lon));
  
  console.log(`Processing ${stopsArray.length} valid stations...`);
  
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
  console.log('Starting clustering...');
  let iteration = 0;
  while (true) {
    iteration++;
    if (iteration % 100 === 0) {
      console.log(`  Iteration ${iteration}, clusters remaining: ${clusters.length}`);
    }
    
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
  
  console.log(`Clustering complete. Final number of clusters: ${clusters.length}`);
  
  // Convert clusters to groups
  console.log('Converting clusters to groups...');
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

// Main execution
try {
  console.log('Reading stops.json...');
  let runningInDocker = true;
  let stopsPath = join(__dirname, '..', 'public', 'data', 'stops.json');
  if (!existsSync(stopsPath)) {
    runningInDocker = false;
    stopsPath = join(__dirname, '..', '..', 'data', 'latest', 'stops.json');
  }
  
  let stopsData;
  try {
    stopsData = JSON.parse(readFileSync(stopsPath, 'utf-8'));
  } catch (err) {
    console.error(`Failed to read stops.json from ${stopsPath}:`, err.message);
    process.exit(1);
  }
  
  console.log(`Loaded ${Object.keys(stopsData).length} stops`);
  
  console.log('Generating station groups...');
  const groups = groupStations(stopsData);
  
  console.log(`Generated ${groups.length} station groups`);
  
  const outputPath = runningInDocker
    ? join(__dirname, '..', 'public', 'data', 'station-groups.json')
    : join(__dirname, '..', '..', 'data', 'latest', 'station-groups.json');
  try {
    writeFileSync(outputPath, JSON.stringify(groups, null, 2));
    console.log(`Station groups saved to ${outputPath}`);
  } catch (err) {
    console.error(`Failed to write station-groups.json to ${outputPath}:`, err.message);
    process.exit(1);
  }
  
  console.log('Done!');
} catch (error) {
  console.error('Error generating station groups:', error);
  process.exit(1);
}
