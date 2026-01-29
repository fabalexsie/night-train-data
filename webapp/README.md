# Night Train Map - React Application

A React single-page application for filtering and visualizing night train trips on a map.

## Features

- **Station Autocomplete**: Search and select stations using an autocomplete text input
- **Trip Filtering**: Filter trips by selected stations - if at least one station matches, the complete trip is shown
- **Interactive Map**: Display filtered trips on an interactive map with routes and station markers
- **Metro-Style Route Organization**: Routes are automatically offset perpendicular to their direction to prevent overlap, similar to metro maps where multiple lines are shown side-by-side
- **Responsive Design**: Works on desktop and mobile devices

## Development

### Prerequisites

- Node.js 20 or higher
- npm

### Installation

```bash
npm install
```

### Running in Development Mode

```bash
npm run dev
```

The application will be available at http://localhost:5173/

### Building for Production

```bash
npm run build
```

The built files will be in the `dist/` directory.

## Production Deployment with Docker

### Using Docker Compose (Recommended)

From the repository root directory:

```bash
docker compose up -d
```

This will:

- Build the Docker image
- Start the container
- Expose the application on port 32516

The application will be available at http://localhost:32516/

### Stopping the Application

```bash
docker compose down
```

### Building the Docker Image Manually

From the webapp directory:

```bash
docker build -t night-train-map .
```

### Running the Docker Container Manually (available on host port 80)

```bash
docker run -d -p 80:32516 --name night-train-map night-train-map
```

## Data Files

The application uses the following data files:

- `stops-filtered.json` - Filtered station information (only stations used by night trains)
- `station-groups.json` - Pre-computed station groups for autocomplete
- `trips.json` - Trip information
- `trip_stop.json` - Mapping of trips to stations

The application automatically filters stations on startup to only include those used by night trains. This reduces the station count from ~28,760 to ~615 stations, significantly improving performance.

### Data Generation

On startup (both `npm run dev` and `npm run build`), the `generate-station-groups.js` script automatically:
1. Reads the original `stops.json` and `trip_stop.json`
2. Filters stops to only those used by night trains
3. Generates `stops-filtered.json` with filtered stations
4. Generates `station-groups.json` with grouped stations

These files are accessed via a symlink from `public/data/` to the repository's `data/latest/` directory. The webapp always uses the latest data without requiring any manual updates.

**Note:** If you need to recreate the symlink (e.g., after cloning the repository), run:

```bash
cd webapp/public
ln -s ../../data/latest data
```

## Route Organization

The application uses the **Leaflet.PolylineOffset** plugin to organize multiple routes on the map in a metro-style layout. This prevents routes from overlapping and makes it easier to distinguish between different train lines.

### How It Works

When multiple routes are displayed:
- Each route is automatically offset perpendicular to its direction
- Routes are spread evenly around the original path
- The offset distance is calculated based on the total number of routes and line weight
- Routes maintain their visual properties (color, weight, opacity) while being offset

This creates a visual effect similar to metro maps where multiple lines running parallel are shown side-by-side rather than on top of each other.

### Technical Details

The offset for each route is calculated using the formula:
```javascript
offset = index * lineSpacing - (totalWidth / 2) + (lineSpacing / 2)
```

Where:
- `index` is the route's position in the filtered trips array
- `lineSpacing` is the space between lines (line weight + 2 pixels)
- `totalWidth` is the total width needed for all routes

This ensures routes are centered around the original path and evenly distributed.

## Technology Stack

- **React** - UI framework
- **Vite** - Build tool and dev server
- **Leaflet** - Interactive maps
- **React Leaflet** - React components for Leaflet
- **Leaflet.PolylineOffset** - Plugin for offsetting polylines to prevent route overlap
- **Nginx** - Production web server (in Docker)

## License

See the main repository LICENSE file.
