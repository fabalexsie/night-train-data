#!/usr/bin/env node
/**
 * Script to combine identical routes that have the same stations in forward and backward order.
 * Both train names are kept when routes are combined.
 * This runs during Docker build time to process routes.json and trips.json
 */

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Get ordered list of stop IDs for a trip
 */
function getStopsForTrip(tripId, tripStopsData) {
  const stops = [];
  
  for (const [tsId, ts] of Object.entries(tripStopsData)) {
    if (String(ts.trip_id) === String(tripId)) {
      let seq = ts.stop_sequence || 0;
      try {
        seq = (seq !== '' && seq !== null) ? parseInt(seq, 10) : 0;
      } catch (e) {
        seq = 0;
      }
      stops.push({ seq, stopId: ts.stop_id });
    }
  }
  
  stops.sort((a, b) => a.seq - b.seq);
  return stops.map(s => s.stopId);
}

/**
 * Normalize station names for comparison
 */
function normalizeStops(stops) {
  return stops.map(stop => stop.trim());
}

/**
 * Check if two stop lists are similar enough (Jaccard similarity)
 */
function stopsAreSimilar(stops1, stops2, threshold = 0.7) {
  const set1 = new Set(normalizeStops(stops1));
  const set2 = new Set(normalizeStops(stops2));
  
  if (set1.size === 0 || set2.size === 0) {
    return false;
  }
  
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  
  const similarity = intersection.size / union.size;
  return similarity >= threshold;
}

/**
 * Check if two routes are identical (same stations in forward/backward order)
 */
function areRoutesIdentical(route1Trips, route2Trips) {
  if (route1Trips.length < 2 || route2Trips.length < 2) {
    return false;
  }
  
  const r1Fwd = route1Trips[0].stops;
  const r1Bwd = route1Trips[1].stops;
  const r2Fwd = route2Trips[0].stops;
  const r2Bwd = route2Trips[1].stops;
  
  const fwdMatch = stopsAreSimilar(r1Fwd, r2Fwd) || stopsAreSimilar(r1Fwd, r2Bwd);
  const bwdMatch = stopsAreSimilar(r1Bwd, r2Bwd) || stopsAreSimilar(r1Bwd, r2Fwd);
  
  return fwdMatch && bwdMatch;
}

/**
 * Combine two route names, keeping both train names
 */
function combineRouteNames(route1Name, route2Name) {
  const parts = new Set();
  
  for (const name of [route1Name, route2Name]) {
    if (name.includes('=')) {
      name.split('=').forEach(part => parts.add(part.trim()));
    } else if (name.includes('/')) {
      name.split('/').forEach(part => parts.add(part.trim()));
    } else {
      parts.add(name.trim());
    }
  }
  
  // Remove empty strings and sort
  const sortedParts = [...parts].filter(p => p).sort();
  
  return sortedParts.join(' / ');
}

/**
 * Find routes that should be combined (same endpoints, similar stops)
 */
function findDuplicateRoutes(routes, trips, tripStops) {
  const routePatterns = new Map();
  
  for (const [routeId, route] of Object.entries(routes)) {
    // Get all trips for this route
    const routeTrips = Object.entries(trips)
      .filter(([tid, t]) => String(t.route_id) === String(routeId))
      .map(([tid, t]) => ({ tripId: tid, ...t }));
    
    if (routeTrips.length === 0) {
      continue;
    }
    
    // Get stops for each trip
    const tripStopsList = [];
    for (const trip of routeTrips) {
      const stops = getStopsForTrip(trip.tripId, tripStops);
      if (stops && stops.length > 1) {
        tripStopsList.push({ tripId: trip.tripId, stops });
      }
    }
    
    if (tripStopsList.length >= 2) {
      const trip1Stops = tripStopsList[0].stops;
      const trip2Stops = tripStopsList[1].stops;
      
      // Create a pattern key based on endpoints (sorted for consistency)
      const endpoints = [
        [trip1Stops[0], trip1Stops[trip1Stops.length - 1]],
        [trip2Stops[0], trip2Stops[trip2Stops.length - 1]]
      ].sort((a, b) => {
        const cmp1 = a[0].localeCompare(b[0]);
        return cmp1 !== 0 ? cmp1 : a[1].localeCompare(b[1]);
      });
      
      const endpointsKey = JSON.stringify(endpoints);
      
      if (!routePatterns.has(endpointsKey)) {
        routePatterns.set(endpointsKey, []);
      }
      
      routePatterns.get(endpointsKey).push({
        routeId,
        trips: tripStopsList,
        route
      });
    }
  }
  
  // Find routes with matching endpoints that should be combined
  const routesToCombine = [];
  
  for (const [endpointsKey, routeList] of routePatterns.entries()) {
    if (routeList.length <= 1) {
      continue;
    }
    
    // Group routes that are identical
    const groups = [];
    for (const routeInfo of routeList) {
      let added = false;
      for (const group of groups) {
        if (areRoutesIdentical(routeInfo.trips, group[0].trips)) {
          group.push(routeInfo);
          added = true;
          break;
        }
      }
      
      if (!added) {
        groups.push([routeInfo]);
      }
    }
    
    // Add groups with more than one route to the combine list
    for (const group of groups) {
      if (group.length > 1) {
        routesToCombine.push(group.map(r => r.routeId));
      }
    }
  }
  
  return routesToCombine;
}

/**
 * Combine the identified duplicate routes
 */
function combineRoutes(routes, trips, routesToCombine) {
  const routesCombined = { ...routes };
  const tripsCombined = { ...trips };
  const routesToDelete = new Set();
  
  for (const routeGroup of routesToCombine) {
    if (routeGroup.length < 2) {
      continue;
    }
    
    // Keep the route with the lowest ID
    const primaryRouteId = routeGroup.reduce((min, rid) => 
      parseInt(rid, 10) < parseInt(min, 10) ? rid : min
    );
    const otherRouteIds = routeGroup.filter(rid => rid !== primaryRouteId);
    
    console.log(`\nCombining routes: ${routeGroup.join(', ')} -> ${primaryRouteId}`);
    
    // Combine route names
    const primaryRoute = routesCombined[primaryRouteId];
    let combinedName = primaryRoute.route_short_name || '';
    
    for (const otherId of otherRouteIds) {
      const otherRoute = routesCombined[otherId];
      const otherName = otherRoute.route_short_name || '';
      combinedName = combineRouteNames(combinedName, otherName);
      
      console.log(`  ${otherRoute.route_short_name || ''} (Route ${otherId})`);
    }
    
    // Update the primary route with combined name
    routesCombined[primaryRouteId].route_short_name = combinedName;
    
    console.log(`  -> Combined name: ${combinedName}`);
    
    // Update trips to point to primary route
    const otherIdsSet = new Set(otherRouteIds);
    for (const [tripId, trip] of Object.entries(tripsCombined)) {
      if (otherIdsSet.has(String(trip.route_id))) {
        tripsCombined[tripId].route_id = parseInt(primaryRouteId, 10);
      }
    }
    
    // Mark other routes for deletion
    otherRouteIds.forEach(rid => routesToDelete.add(rid));
  }
  
  // Delete the redundant routes
  for (const routeId of routesToDelete) {
    delete routesCombined[routeId];
    console.log(`Removed route ${routeId}`);
  }
  
  return { routes: routesCombined, trips: tripsCombined };
}

// Main execution
try {
  console.log('Combining duplicate routes...');
  
  let runningInDocker = true;
  let routesInputPath = join(__dirname, '..', 'public', 'data', 'routes.json');
  let tripsInputPath = join(__dirname, '..', 'public', 'data', 'trips.json');
  let tripStopPath = join(__dirname, '..', 'public', 'data', 'trip_stop.json');
  
  let routesOutputPath = join(__dirname, '..', 'public', 'data', 'routes-filtered.json');
  let tripsOutputPath = join(__dirname, '..', 'public', 'data', 'trips-filtered.json');
  
  if (!existsSync(routesInputPath)) {
    runningInDocker = false;
    routesInputPath = join(__dirname, '..', '..', 'data', 'latest', 'routes.json');
    tripsInputPath = join(__dirname, '..', '..', 'data', 'latest', 'trips.json');
    tripStopPath = join(__dirname, '..', '..', 'data', 'latest', 'trip_stop.json');
    
    routesOutputPath = join(__dirname, '..', '..', 'data', 'latest', 'routes-filtered.json');
    tripsOutputPath = join(__dirname, '..', '..', 'data', 'latest', 'trips-filtered.json');
  }
  
  console.log('Reading routes.json...');
  const routes = JSON.parse(readFileSync(routesInputPath, 'utf-8'));
  console.log(`Loaded ${Object.keys(routes).length} routes`);
  
  console.log('Reading trips.json...');
  const trips = JSON.parse(readFileSync(tripsInputPath, 'utf-8'));
  console.log(`Loaded ${Object.keys(trips).length} trips`);
  
  console.log('Reading trip_stop.json...');
  const tripStops = JSON.parse(readFileSync(tripStopPath, 'utf-8'));
  console.log(`Loaded ${Object.keys(tripStops).length} trip stops`);
  
  console.log('\nFinding duplicate routes...');
  const routesToCombine = findDuplicateRoutes(routes, trips, tripStops);
  
  if (routesToCombine.length === 0) {
    console.log('No duplicate routes found.');
  } else {
    console.log(`\nFound ${routesToCombine.length} groups of routes to combine:`);
    for (const group of routesToCombine) {
      const routeNames = group.map(rid => routes[rid].route_short_name || `Route ${rid}`);
      console.log(`  ${routeNames.join(' + ')}`);
    }
    
    console.log('\nCombining routes...');
    const { routes: routesNew, trips: tripsNew } = combineRoutes(routes, trips, routesToCombine);
    
    console.log(`\nAfter combining: ${Object.keys(routesNew).length} routes (removed ${Object.keys(routes).length - Object.keys(routesNew).length})`);
    
    // Save updated data
    console.log('\nSaving updated data...');
    writeFileSync(routesOutputPath, JSON.stringify(routesNew, null, 2));
    console.log(`Routes saved to ${routesOutputPath}`);
    
    writeFileSync(tripsOutputPath, JSON.stringify(tripsNew, null, 2));
    console.log(`Trips saved to ${tripsOutputPath}`);
  }
  
  console.log('Done!');
} catch (error) {
  console.error('Error combining routes:', error);
  process.exit(1);
}
