import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const correctedPositions = {
  "St. Valentin": { lat: 46.7659675, lon: 10.531858 },
};

const stopsPath = path.join(__dirname, "..", "data", "stops.json");

// If called with a parameter it should get the coordinates from nominatim, else fix the known wrong positions in stops.json
// Usage with: npm run fix-station -- "Berlin Hbf"
async function getCoordinatesFromNominatim(stationName) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(stationName)}`;
  const response = await fetch(url, {
    headers: {
      "User-Agent": "NightTrainDataScript/1.0",
    },
  });
  const data = await response.json();
  if (data.length > 0) {
    return {
      lat: parseFloat(data[0].lat),
      lon: parseFloat(data[0].lon),
    };
  } else {
    throw new Error(`No results found for station: ${stationName}`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length > 0) {
    // Get coordinates from nominatim
    try {
      const coords = await getCoordinatesFromNominatim(args[0]);
      console.log(`"${args[0]}": { lat: ${coords.lat}, lon: ${coords.lon} },`);
    } catch (error) {
      console.error(error.message);
    }
  } else {
    const stopsData = JSON.parse(fs.readFileSync(stopsPath, "utf-8"));
    for (const stop of stopsData) {
      // Fix known wrong positions
      if (correctedPositions[stop.name]) {
        stop.lat = correctedPositions[stop.name].lat;
        stop.lon = correctedPositions[stop.name].lon;
        console.log(`Fixed ${stop.name}: lat=${stop.lat}, lon=${stop.lon}`);
      }
    }
    fs.writeFileSync(stopsPath, JSON.stringify(stopsData, null, 2), "utf-8");
    console.log("Station positions updated successfully.");
  }
}

main().catch((error) => {
  console.error("An error occurred:", error);
  process.exit(1);
});
