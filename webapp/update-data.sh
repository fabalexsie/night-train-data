#!/bin/bash
# Script to update the data files in the webapp from the latest data

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
DATA_DIR="$SCRIPT_DIR/../data/latest"
WEBAPP_DATA_DIR="$SCRIPT_DIR/public/data"

echo "Updating webapp data files from $DATA_DIR..."

# Create the directory if it doesn't exist
mkdir -p "$WEBAPP_DATA_DIR"

# Copy the required data files
cp "$DATA_DIR/stops.json" "$WEBAPP_DATA_DIR/"
cp "$DATA_DIR/trips.json" "$WEBAPP_DATA_DIR/"
cp "$DATA_DIR/trip_stop.json" "$WEBAPP_DATA_DIR/"

echo "Data files updated successfully!"
echo "Files copied:"
echo "  - stops.json"
echo "  - trips.json"
echo "  - trip_stop.json"
