#!/usr/bin/env node

// If called with a parameter it should get the coordinates from nominatim
// Usage with: npm run fix-station -- "Berlin Hbf"
// Insert result in `correctedPositions` in `generate-station-groups.js`
async function main() {
  const args = process.argv.slice(2);
  if (args.length > 0) {
    // Get coordinates from nominatim
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=10&q=${encodeURIComponent(args[0])}`;
      const response = await fetch(url, {
        headers: {
          "User-Agent": "NightTrainDataScript/1.0",
        },
      });
      const data = await response.json();
      if (data.length > 0) {
        data.forEach((result, index) => {
          console.log(`${index + 1}. mit "${result.name}"`);
          console.log(
            `  "${args[0]}": { lat: ${result.lat}, lon: ${result.lon} },`,
          );
        });
      } else {
        throw new Error(`No results found for station: ${args[0]}`);
      }

      console.log(`"${args[0]}": { lat: ${coords.lat}, lon: ${coords.lon} },`);
    } catch (error) {
      console.error(error.message);
    }
  } else {
    throw new Error(
      "No station name provided. Please provide a station name as an argument.",
    );
  }
}

main().catch((error) => {
  console.error("An error occurred:", error);
  process.exit(1);
});
