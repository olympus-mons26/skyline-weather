# 🌦️ Skyline Weather

Skyline Weather is a responsive, browser-only weather dashboard.

## What it does

- Searches for cities or uses the device's current location
- Displays current conditions, feels-like temperature, humidity, and wind
- Shows the next 12 hours and a 7-day forecast
- Displays modeled air quality and elevation
- Optionally loads modeled river flow, a nearby major river name, and nearby marine conditions
- Supports light and dark themes
- Keeps theme and estimated API request counts in the browser

Weather data and city search are powered by [Open-Meteo](https://open-meteo.com/). The app does not require an API key or a backend server.

Flood and marine coverage varies by location. River discharge is not a flood warning, and marine conditions are not intended for navigation. Air quality is model output, not a local monitoring-station reading.
Nearby river names are looked up with [Nominatim](https://nominatim.openstreetmap.org/) using [OpenStreetMap](https://www.openstreetmap.org/) data, independently of the modeled river-discharge data. The lookup searches by place name, prefers larger mapped water features, excludes obvious drains/canals, and is cached in the page session. River identification is approximate and can be wrong.

## What you need

- A modern web browser
- An internet connection
- One of the following ways to serve the files:
  - Docker Desktop with Docker
  - Python 3
  - A static web host such as Surge

Location access is optional. City search works without sharing device location.

## Run locally

The quickest option is Python's built-in web server. No project dependencies or API key are needed.

1. Make sure [Python 3](https://www.python.org/downloads/) is installed.
2. Open a terminal in the project folder (the folder containing `index.html`).
3. Start the local web server:

   ```sh
   python3 -m http.server 8080
   ```

4. Open [http://localhost:8080](http://localhost:8080) in your browser.
5. To stop the server, return to the terminal and press `Ctrl+C`.

### Using Docker instead

Install and start Docker Desktop, then run these commands from the project folder:

```sh
docker build -t skyline-weather .
docker run --rm -p 8080:80 skyline-weather
```

Open [http://localhost:8080](http://localhost:8080). Stop the container with `Ctrl+C`.
If Docker cannot connect to `docker.sock`, wait for the Docker engine to finish starting and try again.

## Surge

[skyline-weather.surge.sh](https://skyline-weather.surge.sh)

Thank you to [Surge](https://surge.sh/) for free static web hosting.

## Request usage estimate

The dashboard stores this browser's rough request counts in local storage and compares them with the public Free / Open-Access limits:

- 600 calls per minute
- 5,000 calls per hour
- 10,000 calls per day
- 300,000 calls per month

The Free / Open-Access tier is for non-commercial use. Subject to the [Open-Meteo pricing and usage terms](https://open-meteo.com/en/pricing).

## Project structure

- `index.html` - Page structure
- `assets/`
  - `weather.svg` - Browser and brand icon
- `css/`
  - `style.css` - Responsive layout and themes
- `js/`
  - `app.js` - Weather requests and dashboard behavior
- `Dockerfile` - Docker web-server configuration

## Attribution

Weather icon by [SVG Repo](https://www.svgrepo.com/svg/530233/weather). The icon is provided under its source-page terms and is separately attributed; it is not covered by this project's MIT license.

### License

MIT License

---

Made by Baljit Panda [(olympus/mons26)](https://github.com/olymppus-mons26/skyline-weather)
