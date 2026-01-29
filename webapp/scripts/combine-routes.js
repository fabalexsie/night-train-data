#!/usr/bin/env node
/**
 * Script to combine identical routes that serve the same endpoints in both directions.
 * Simplified version that groups routes by their start and end cities.
 * Both train names are kept when routes are combined.
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
 * Check if two station sequences are the reverse of each other
 */
function areStopsReversed(stops1, stops2) {
  if (stops1.length !== stops2.length) {
    return false;
  }
  
  for (let i = 0; i < stops1.length; i++) {
    if (stops1[i] !== stops2[stops2.length - 1 - i]) {
      return false;
    }
  }
  
  return true;
}

/**
 * Get all trips with their stop sequences for a route
 */
function getRouteTripStops(routeId, trips, tripStops) {
  const routeTrips = Object.entries(trips)
    .filter(([tid, t]) => String(t.route_id) === String(routeId))
    .map(([tid, t]) => tid);
  
  if (routeTrips.length === 0) {
    return null;
  }
  
  // Get stops for all trips
  const tripStopsList = [];
  for (const tripId of routeTrips) {
    const stops = getStopsForTrip(tripId, tripStops);
    if (stops && stops.length >= 2) {
      tripStopsList.push({
        tripId,
        stops
      });
    }
  }
  
  return tripStopsList.length >= 2 ? tripStopsList : null;
}

/**
 * Check if two routes are identical (same stops in forward/backward order)
 * A route with trips A-B-C-D-E and E-D-C-B-A should match another route
 * with the same pattern
 */
function areRoutesIdentical(route1Trips, route2Trips) {
  if (!route1Trips || !route2Trips) {
    return false;
  }
  
  // For each trip in route1, check if there's a matching reversed trip in route2
  for (const trip1 of route1Trips) {
    let foundMatch = false;
    
    for (const trip2 of route2Trips) {
      if (areStopsReversed(trip1.stops, trip2.stops)) {
        foundMatch = true;
        break;
      }
    }
    
    if (!foundMatch) {
      return false;
    }
  }
  
  // Also check the reverse: each trip in route2 should have a match in route1
  for (const trip2 of route2Trips) {
    let foundMatch = false;
    
    for (const trip1 of route1Trips) {
      if (areStopsReversed(trip1.stops, trip2.stops)) {
        foundMatch = true;
        break;
      }
    }
    
    if (!foundMatch) {
      return false;
    }
  }
  
  return true;
}

/**
 * Find routes that have identical station sequences (forward/backward)
 */
function findDuplicateRoutes(routes, trips, tripStops) {
  const allRoutes = [];
  
  // Get trip stops for all routes
  for (const [routeId, route] of Object.entries(routes)) {
    const tripStopsList = getRouteTripStops(routeId, trips, tripStops);
    
    if (tripStopsList) {
      allRoutes.push({
        routeId,
        route,
        trips: tripStopsList
      });
    }
  }
  
  // Find groups of identical routes
  const routeGroups = [];
  const processed = new Set();
  
  for (let i = 0; i < allRoutes.length; i++) {
    if (processed.has(allRoutes[i].routeId)) {
      continue;
    }
    
    const group = [allRoutes[i]];
    processed.add(allRoutes[i].routeId);
    
    // Find all other routes that are identical to this one
    for (let j = i + 1; j < allRoutes.length; j++) {
      if (processed.has(allRoutes[j].routeId)) {
        continue;
      }
      
      if (areRoutesIdentical(allRoutes[i].trips, allRoutes[j].trips)) {
        group.push(allRoutes[j]);
        processed.add(allRoutes[j].routeId);
      }
    }
    
    // If we found duplicates, add to the result
    if (group.length > 1) {
      // Sort by route ID to ensure consistent primary route selection
      group.sort((a, b) => parseInt(a.routeId) - parseInt(b.routeId));
      
      // Get endpoints for display
      const firstTrip = group[0].trips[0];
      const endpoints = `${firstTrip.stops[0]} <-> ${firstTrip.stops[firstTrip.stops.length - 1]}`;
      
      routeGroups.push({
        endpoints,
        routes: group.map(r => r.routeId)
      });
    }
  }
  
  return routeGroups;
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
 * Combine the identified duplicate routes
 */
function combineRoutes(routes, trips, routesToCombine) {
  const routesCombined = { ...routes };
  const tripsCombined = { ...trips };
  const routesToDelete = new Set();
  
  for (const group of routesToCombine) {
    const routeIds = group.routes;
    
    if (routeIds.length < 2) {
      continue;
    }
    
    // Keep the route with the lowest ID
    const primaryRouteId = routeIds[0];
    const otherRouteIds = routeIds.slice(1);
    
    console.log(`\nCombining routes for ${group.endpoints}:`);
    console.log(`  Primary: Route ${primaryRouteId} (${routesCombined[primaryRouteId].route_short_name})`);
    
    // Combine route names
    let combinedName = routesCombined[primaryRouteId].route_short_name || '';
    
    for (const otherId of otherRouteIds) {
      const otherRoute = routesCombined[otherId];
      const otherName = otherRoute.route_short_name || '';
      combinedName = combineRouteNames(combinedName, otherName);
      
      console.log(`  + Route ${otherId} (${otherName})`);
    }
    
    // Update the primary route with combined name
    routesCombined[primaryRouteId].route_short_name = combinedName;
    
    console.log(`  -> Combined: ${combinedName}`);
    
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
  }
  
  if (routesToDelete.size > 0) {
    console.log(`\nRemoved ${routesToDelete.size} duplicate routes`);
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
    console.log(`\nFound ${routesToCombine.length} endpoint pairs with multiple routes`);
    
    const { routes: routesNew, trips: tripsNew } = combineRoutes(routes, trips, routesToCombine);
    
    const removedCount = Object.keys(routes).length - Object.keys(routesNew).length;
    console.log(`\nResult: ${Object.keys(routesNew).length} routes (combined ${removedCount} duplicates)`);
    
    // Save updated data
    console.log('\nSaving filtered data...');
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
