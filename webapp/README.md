# Night Train Map - React Application

A React single-page application for filtering and visualizing night train trips on a map.

## Features

- **Station Autocomplete**: Search and select stations using an autocomplete text input
- **Trip Filtering**: Filter trips by selected stations - if at least one station matches, the complete trip is shown
- **Interactive Map**: Display filtered trips on an interactive map with routes and station markers
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
- Expose the application on port 80

The application will be available at http://localhost/

### Stopping the Application

```bash
docker compose down
```

### Building the Docker Image Manually

From the webapp directory:

```bash
docker build -t night-train-map .
```

### Running the Docker Container Manually

```bash
docker run -d -p 80:80 --name night-train-map night-train-map
```

## Data Files

The application uses three data files located in `public/data/`:
- `stops.json` - Station information with coordinates
- `trips.json` - Trip information
- `trip_stop.json` - Mapping of trips to stations

These files are copied from the `data/latest/` directory. To update them when new data is available, run:

```bash
./update-data.sh
```

## Technology Stack

- **React** - UI framework
- **Vite** - Build tool and dev server
- **Leaflet** - Interactive maps
- **React Leaflet** - React components for Leaflet
- **Nginx** - Production web server (in Docker)

## License

See the main repository LICENSE file.
