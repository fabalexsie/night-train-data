#!/usr/bin/env python3
"""
Script to combine identical routes that have the same stations in forward and backward order.
Both train names are kept when routes are combined.
This is a preprocessing step that modifies the data files.
"""

import json
import sys
from pathlib import Path
from collections import defaultdict
from typing import Dict, List, Tuple, Set


def get_stops_for_trip(trip_id: str, trip_stops_data: Dict) -> List[str]:
    """Get ordered list of stop IDs for a trip."""
    stops = []
    for ts_id, ts in trip_stops_data.items():
        if ts['trip_id'] == trip_id:
            seq = ts.get('stop_sequence', 0)
            try:
                seq = int(seq) if seq != '' and seq is not None else 0
            except (ValueError, TypeError):
                seq = 0
            stops.append((seq, ts['stop_id']))
    stops.sort(key=lambda x: x[0])
    return [s[1] for s in stops]


def normalize_stops(stops: List[str]) -> Tuple[str, ...]:
    """Normalize station names for comparison (handle minor variations)."""
    normalized = []
    for stop in stops:
        # Remove common suffixes and normalize
        norm = stop.strip()
        # Add more normalization rules if needed
        normalized.append(norm)
    return tuple(normalized)


def stops_are_similar(stops1: List[str], stops2: List[str], threshold: float = 0.7) -> bool:
    """
    Check if two stop lists are similar enough to be considered the same route.
    Returns True if they share at least threshold% of stops.
    """
    set1 = set(normalize_stops(stops1))
    set2 = set(normalize_stops(stops2))
    
    if len(set1) == 0 or len(set2) == 0:
        return False
    
    intersection = len(set1 & set2)
    union = len(set1 | set2)
    
    similarity = intersection / union if union > 0 else 0
    return similarity >= threshold


def are_routes_identical(route1_trips: List[Tuple[str, List[str]]], 
                         route2_trips: List[Tuple[str, List[str]]]) -> bool:
    """
    Check if two routes are identical (same stations in forward/backward order).
    Each route has 2 trips (forward and backward).
    """
    if len(route1_trips) < 2 or len(route2_trips) < 2:
        return False
    
    # Get stops for both directions of each route
    r1_fwd = route1_trips[0][1]
    r1_bwd = route1_trips[1][1]
    r2_fwd = route2_trips[0][1]
    r2_bwd = route2_trips[1][1]
    
    # Check if the routes are similar
    # Route 1 forward should be similar to Route 2 forward
    # Route 1 backward should be similar to Route 2 backward
    fwd_match = stops_are_similar(r1_fwd, r2_fwd) or stops_are_similar(r1_fwd, r2_bwd)
    bwd_match = stops_are_similar(r1_bwd, r2_bwd) or stops_are_similar(r1_bwd, r2_fwd)
    
    return fwd_match and bwd_match


def combine_route_names(route1_name: str, route2_name: str) -> str:
    """Combine two route names, keeping both train names."""
    # If one route name contains '=', extract both parts
    parts = set()
    
    for name in [route1_name, route2_name]:
        if '=' in name:
            # Split by '='
            for part in name.split('='):
                parts.add(part.strip())
        elif '/' in name:
            # Split by '/'
            for part in name.split('/'):
                parts.add(part.strip())
        else:
            parts.add(name.strip())
    
    # Remove empty strings
    parts = [p for p in parts if p]
    
    # Sort for consistency
    parts.sort()
    
    # Join with ' / ' to separate multiple train names
    return ' / '.join(parts)


def find_duplicate_routes(routes: Dict, trips: Dict, trip_stops: Dict) -> List[List[str]]:
    """
    Find routes that should be combined (same endpoints, similar stops).
    Returns a list of route ID groups that should be combined.
    """
    # Build a map of route endpoints to route IDs
    route_patterns = defaultdict(list)
    
    for route_id, route in routes.items():
        # Get all trips for this route
        route_trips = {tid: t for tid, t in trips.items() 
                      if str(t['route_id']) == str(route_id)}
        
        if len(route_trips) == 0:
            continue
        
        # Get stops for each trip
        trip_stops_list = []
        for trip_id in route_trips:
            stops = get_stops_for_trip(trip_id, trip_stops)
            if stops and len(stops) > 1:
                trip_stops_list.append((trip_id, stops))
        
        if len(trip_stops_list) >= 2:
            # Get endpoints (first and last stops of first trip)
            trip1_stops = trip_stops_list[0][1]
            trip2_stops = trip_stops_list[1][1]
            
            # Create a pattern key based on endpoints (sorted for consistency)
            endpoints = tuple(sorted([
                (trip1_stops[0], trip1_stops[-1]),
                (trip2_stops[0], trip2_stops[-1])
            ]))
            
            route_patterns[endpoints].append({
                'route_id': route_id,
                'trips': trip_stops_list,
                'route': route
            })
    
    # Find routes with matching endpoints that should be combined
    routes_to_combine = []
    
    for endpoints, route_list in route_patterns.items():
        if len(route_list) <= 1:
            continue
        
        # Group routes that are identical
        groups = []
        for route_info in route_list:
            added = False
            for group in groups:
                # Check if this route is identical to any route in the group
                if are_routes_identical(route_info['trips'], group[0]['trips']):
                    group.append(route_info)
                    added = True
                    break
            
            if not added:
                groups.append([route_info])
        
        # Add groups with more than one route to the combine list
        for group in groups:
            if len(group) > 1:
                routes_to_combine.append([r['route_id'] for r in group])
    
    return routes_to_combine


def combine_routes(routes: Dict, trips: Dict, trip_stops: Dict, 
                   routes_to_combine: List[List[str]]) -> Tuple[Dict, Dict, Dict]:
    """
    Combine the identified duplicate routes.
    Keep the first route and merge data from others into it.
    """
    routes_combined = routes.copy()
    trips_combined = trips.copy()
    trip_stops_combined = trip_stops.copy()
    
    routes_to_delete = set()
    
    for route_group in routes_to_combine:
        if len(route_group) < 2:
            continue
        
        # Keep the first route (with lowest ID)
        primary_route_id = min(route_group, key=lambda x: int(x))
        other_route_ids = [rid for rid in route_group if rid != primary_route_id]
        
        print(f"\nCombining routes: {', '.join(route_group)} -> {primary_route_id}")
        
        # Combine route names
        primary_route = routes_combined[primary_route_id]
        combined_name = primary_route.get('route_short_name', '')
        
        for other_id in other_route_ids:
            other_route = routes_combined[other_id]
            other_name = other_route.get('route_short_name', '')
            combined_name = combine_route_names(combined_name, other_name)
            
            print(f"  {other_route.get('route_short_name', '')} (Route {other_id})")
        
        # Update the primary route with combined name
        routes_combined[primary_route_id]['route_short_name'] = combined_name
        
        print(f"  -> Combined name: {combined_name}")
        
        # Update trips to point to primary route
        for other_id in other_route_ids:
            for trip_id, trip in trips_combined.items():
                if str(trip['route_id']) == str(other_id):
                    trips_combined[trip_id]['route_id'] = int(primary_route_id)
            
            # Mark other routes for deletion
            routes_to_delete.add(other_id)
    
    # Delete the redundant routes
    for route_id in routes_to_delete:
        del routes_combined[route_id]
        print(f"Removed route {route_id}")
    
    return routes_combined, trips_combined, trip_stops_combined


def main():
    """Main function to combine routes."""
    # Determine paths
    script_dir = Path(__file__).parent
    data_dir = script_dir.parent / 'data' / 'latest'
    
    # Load data
    print("Loading data...")
    routes_path = data_dir / 'routes.json'
    trips_path = data_dir / 'trips.json'
    trip_stops_path = data_dir / 'trip_stop.json'
    
    with open(routes_path) as f:
        routes = json.load(f)
    with open(trips_path) as f:
        trips = json.load(f)
    with open(trip_stops_path) as f:
        trip_stops = json.load(f)
    
    print(f"Loaded {len(routes)} routes, {len(trips)} trips, {len(trip_stops)} trip stops")
    
    # Find duplicate routes
    print("\nFinding duplicate routes...")
    routes_to_combine = find_duplicate_routes(routes, trips, trip_stops)
    
    if not routes_to_combine:
        print("No duplicate routes found.")
        return 0
    
    print(f"\nFound {len(routes_to_combine)} groups of routes to combine:")
    for group in routes_to_combine:
        route_names = [routes[rid].get('route_short_name', f'Route {rid}') for rid in group]
        print(f"  {' + '.join(route_names)}")
    
    # Ask for confirmation
    response = input("\nProceed with combining these routes? (yes/no): ")
    if response.lower() not in ['yes', 'y']:
        print("Aborted.")
        return 1
    
    # Combine routes
    print("\nCombining routes...")
    routes_new, trips_new, trip_stops_new = combine_routes(
        routes, trips, trip_stops, routes_to_combine
    )
    
    print(f"\nAfter combining: {len(routes_new)} routes (removed {len(routes) - len(routes_new)})")
    
    # Save updated data
    print("\nSaving updated data...")
    with open(routes_path, 'w') as f:
        json.dump(routes_new, f, indent=2, ensure_ascii=False)
    with open(trips_path, 'w') as f:
        json.dump(trips_new, f, indent=2, ensure_ascii=False)
    
    # trip_stops doesn't need to be saved unless it was modified
    # (in this case, it's not modified)
    
    print("Done!")
    return 0


if __name__ == '__main__':
    sys.exit(main())
