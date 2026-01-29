#!/usr/bin/env python3
"""
Test script to verify that routes have been correctly combined.
"""

import json
import sys
from pathlib import Path


def test_combined_routes():
    """Test that routes were combined correctly."""
    script_dir = Path(__file__).parent
    data_dir = script_dir.parent / 'data' / 'latest'
    
    # Load data
    with open(data_dir / 'routes.json') as f:
        routes = json.load(f)
    with open(data_dir / 'trips.json') as f:
        trips = json.load(f)
    
    print("Testing combined routes...")
    
    # Expected combined routes (route_id: expected train names in short_name)
    expected_combined = {
        '68': ['Nattåg 91', 'Nattåg 92', 'Nattåg 93 (L)', 'Nattåg 94 (L)'],
        '77': ['300', '301', 'EN 345', 'EN 346'],
        '101': ['IC Notte 1954', 'IC Notte 1955 (P)', 'IC Notte 1958', 'IC Notte 1959 (P)'],
        '103': ['IC Notte 1955 (S)', 'IC Notte 1956', 'IC Notte 1959 (S)', 'IC Notte 1960'],
        '152': ['019', '020', '023', '024'],
    }
    
    # Routes that should have been deleted
    deleted_routes = ['81', '153', '102', '78', '104']
    
    passed = 0
    failed = 0
    
    # Test 1: Check that combined routes exist and have correct names
    print("\n1. Testing combined routes exist with correct names:")
    for route_id, expected_names in expected_combined.items():
        if route_id not in routes:
            print(f"  ✗ Route {route_id} not found!")
            failed += 1
            continue
        
        route = routes[route_id]
        short_name = route['route_short_name']
        
        # Check if all expected train names are in the short_name
        all_present = all(name in short_name for name in expected_names)
        
        if all_present:
            print(f"  ✓ Route {route_id}: {short_name}")
            passed += 1
        else:
            print(f"  ✗ Route {route_id}: Missing some expected train names")
            print(f"    Expected: {', '.join(expected_names)}")
            print(f"    Got: {short_name}")
            failed += 1
    
    # Test 2: Check that deleted routes are gone
    print("\n2. Testing deleted routes are removed:")
    for route_id in deleted_routes:
        if route_id in routes:
            print(f"  ✗ Route {route_id} should have been deleted but still exists!")
            failed += 1
        else:
            print(f"  ✓ Route {route_id} deleted")
            passed += 1
    
    # Test 3: Check that trips are correctly assigned to combined routes
    print("\n3. Testing trips are assigned to combined routes:")
    for route_id, expected_names in expected_combined.items():
        route_trips = {tid: t for tid, t in trips.items() 
                      if str(t['route_id']) == route_id}
        
        if len(route_trips) >= len(expected_names):
            print(f"  ✓ Route {route_id} has {len(route_trips)} trips (expected >= {len(expected_names)})")
            passed += 1
        else:
            print(f"  ✗ Route {route_id} has only {len(route_trips)} trips (expected >= {len(expected_names)})")
            failed += 1
    
    # Test 4: Check that no trips reference deleted routes
    print("\n4. Testing no trips reference deleted routes:")
    orphan_trips = []
    for trip_id, trip in trips.items():
        if str(trip['route_id']) in deleted_routes:
            orphan_trips.append((trip_id, trip['route_id']))
    
    if orphan_trips:
        print(f"  ✗ Found {len(orphan_trips)} trips referencing deleted routes:")
        for trip_id, route_id in orphan_trips[:5]:
            print(f"    - Trip {trip_id} -> Route {route_id}")
        failed += 1
    else:
        print(f"  ✓ No trips reference deleted routes")
        passed += 1
    
    # Summary
    print(f"\n{'='*60}")
    print(f"Test Results: {passed} passed, {failed} failed")
    print(f"{'='*60}")
    
    return 0 if failed == 0 else 1


if __name__ == '__main__':
    sys.exit(test_combined_routes())
