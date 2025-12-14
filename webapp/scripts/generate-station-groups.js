#!/usr/bin/env node
/**
 * Script to pre-compute station groups from stops.json
 * This runs during Docker build time to generate station-groups.json
 */

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import clustersDbscan from '@turf/clusters-dbscan';
import { point, featureCollection } from '@turf/helpers';

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
 * Group stations using DBSCAN clustering algorithm
 * This is the same logic as in webapp/src/utils/stationGrouping.js
 */
function groupStations(stops, maxDistance = 15) {
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
  
  // Create GeoJSON FeatureCollection for DBSCAN
  const features = stopsArray.map(stop => 
    point([stop.lon, stop.lat], {
      stop_id: stop.stop_id,
      stop_name: stop.stop_name,
      stop_country: stop.stop_country,
      lat: stop.lat,
      lon: stop.lon
    })
  );
  
  const pointsCollection = featureCollection(features);
  
  // Apply DBSCAN clustering
  const clustered = clustersDbscan(pointsCollection, maxDistance, { minPoints: 1 });
  
  // Group features by cluster ID
  const clusterMap = new Map();
  
  clustered.features.forEach(feature => {
    const clusterId = feature.properties.cluster;
    
    if (!clusterMap.has(clusterId)) {
      clusterMap.set(clusterId, []);
    }
    
    clusterMap.get(clusterId).push({
      stop_id: feature.properties.stop_id,
      stop_name: feature.properties.stop_name,
      stop_country: feature.properties.stop_country,
      lat: feature.properties.lat,
      lon: feature.properties.lon
    });
  });
  
  // Convert clusters to groups
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
