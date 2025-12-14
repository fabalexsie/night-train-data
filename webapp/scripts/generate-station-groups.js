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
  
  const n = stopsArray.length;
  
  // Build neighbor list for each station (only within maxDistance)
  console.log('Building neighbor lists and merge queue...');
  const mergeQueue = [];
  
  for (let i = 0; i < n; i++) {
    if (i % 1000 === 0) {
      console.log(`  Processed ${i}/${n} stations...`);
    }
    for (let j = i + 1; j < n; j++) {
      const dist = calculateDistance(stopsArray[i], stopsArray[j]);
      if (dist <= maxDistance) {
        mergeQueue.push({ i, j, dist });
      }
    }
  }
  
  console.log(`Found ${mergeQueue.length} pairs within ${maxDistance}km`);
  console.log('Sorting merge queue...');
  mergeQueue.sort((a, b) => a.dist - b.dist);
  
  // Union-Find for cluster tracking
  const parent = new Array(n).fill(0).map((_, i) => i);
  const clusterStations = new Array(n).fill(null).map((_, i) => [i]);
  
  function find(x) {
    if (parent[x] !== x) {
      parent[x] = find(parent[x]);
    }
    return parent[x];
  }
  
  // Process merges in order of increasing distance
  console.log('Processing merges...');
  let processed = 0;
  let merged = 0;
  
  for (const { i, j } of mergeQueue) {
    processed++;
    if (processed % 10000 === 0) {
      console.log(`  Processed ${processed}/${mergeQueue.length} merges (${merged} successful)...`);
    }
    
    const rootI = find(i);
    const rootJ = find(j);
    
    if (rootI === rootJ) continue; // Already in same cluster
    
    // Check complete linkage constraint: max distance between any two points
    const stationsI = clusterStations[rootI];
    const stationsJ = clusterStations[rootJ];
    
    let valid = true;
    
    for (const si of stationsI) {
      if (!valid) break;
      for (const sj of stationsJ) {
        const d = calculateDistance(stopsArray[si], stopsArray[sj]);
        if (d > maxDistance) {
          valid = false;
          break;
        }
      }
    }
    
    // Merge if valid
    if (valid) {
      parent[rootJ] = rootI;
      clusterStations[rootI] = stationsI.concat(stationsJ);
      clusterStations[rootJ] = [];
      merged++;
    }
  }
  
  console.log(`Completed processing. Merged ${merged} times.`);
  
  // Build final clusters
  console.log('Building final clusters...');
  const clusterMap = new Map();
  for (let i = 0; i < n; i++) {
    const root = find(i);
    if (!clusterMap.has(root)) {
      clusterMap.set(root, []);
    }
    clusterMap.get(root).push(stopsArray[i]);
  }
  
  console.log(`Final number of clusters: ${clusterMap.size}`);
  
  // Convert clusters to groups
  console.log('Converting clusters to groups...');
  const groups = [];
  
  clusterMap.forEach((stations) => {
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
  });
  
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
