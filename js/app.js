const GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search";
const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const AIR_QUALITY_URL = "https://air-quality-api.open-meteo.com/v1/air-quality";
const ELEVATION_URL = "https://api.open-meteo.com/v1/elevation";
const FLOOD_URL = "https://flood-api.open-meteo.com/v1/flood";
const MARINE_URL = "https://marine-api.open-meteo.com/v1/marine";
const REVERSE_GEOCODING_URL = "https://api.bigdatacloud.net/data/reverse-geocode-client";
const NOMINATIM_SEARCH_URL = "https://nominatim.openstreetmap.org/search";
const USAGE_STORAGE_KEY = "skyline-api-request-minutes";

const requestLimits = [
  { label: "Last minute", limit: 600, start: (now) => now - 60_000 },
  { label: "Last hour", limit: 5_000, start: (now) => now - 3_600_000 },
  {
    label: "Today (UTC)",
    limit: 10_000,
    start: (now) => Date.UTC(new Date(now).getUTCFullYear(), new Date(now).getUTCMonth(), new Date(now).getUTCDate())
  },
  {
    label: "This month (UTC)",
    limit: 300_000,
    start: (now) => Date.UTC(new Date(now).getUTCFullYear(), new Date(now).getUTCMonth(), 1)
  }
];

const weatherDescriptions = {
  0: ["Clear sky", "☀️"],
  1: ["Mainly clear", "🌤️"],
  2: ["Partly cloudy", "⛅"],
  3: ["Overcast", "☁️"],
  45: ["Fog", "🌫️"],
  48: ["Rime fog", "🌫️"],
  51: ["Light drizzle", "🌦️"],
  53: ["Drizzle", "🌦️"],
  55: ["Dense drizzle", "🌧️"],
  56: ["Light freezing drizzle", "🌧️"],
  57: ["Freezing drizzle", "🌧️"],
  61: ["Light rain", "🌦️"],
  63: ["Rain", "🌧️"],
  65: ["Heavy rain", "🌧️"],
  66: ["Light freezing rain", "🌧️"],
  67: ["Freezing rain", "🌧️"],
  71: ["Light snow", "🌨️"],
  73: ["Snow", "🌨️"],
  75: ["Heavy snow", "❄️"],
  77: ["Snow grains", "🌨️"],
  80: ["Light showers", "🌦️"],
  81: ["Rain showers", "🌧️"],
  82: ["Heavy showers", "🌧️"],
  85: ["Snow showers", "🌨️"],
  86: ["Heavy snow showers", "❄️"],
  95: ["Thunderstorm", "⛈️"],
  96: ["Thunderstorm with hail", "⛈️"],
  99: ["Thunderstorm with heavy hail", "⛈️"]
};

const searchForm = document.querySelector("#search-form");
const cityInput = document.querySelector("#city-input");
const locationButton = document.querySelector("#location-button");
const statusMessage = document.querySelector("#status-message");
const searchResults = document.querySelector("#search-results");
const resultList = document.querySelector("#result-list");
const dashboard = document.querySelector("#weather-dashboard");
const usageMeters = document.querySelector("#usage-meters");
const usageStorageNote = document.querySelector("#usage-storage-note");
const waterButton = document.querySelector("#water-button");
const waterResults = document.querySelector("#water-results");
const waterNote = document.querySelector("#water-note");
const themeToggle = document.querySelector("#theme-toggle");
const themeIcon = document.querySelector("#theme-icon");
const themeLabel = document.querySelector("#theme-label");
const themeColor = document.querySelector("meta[name='theme-color']");

let matchingPlaces = [];
let currentPlace = null;
let usageStorageAvailable = true;
let usageBuckets = {};
let themeStorageAvailable = true;
const riverNameCache = new Map();
let nominatimRequestQueue = Promise.resolve();
let lastNominatimRequestAt = 0;
let theme = window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
let localTimeInterval = null;

try {
  const storedBuckets = localStorage.getItem(USAGE_STORAGE_KEY);
  if (storedBuckets) {
    const parsedBuckets = JSON.parse(storedBuckets);
    if (parsedBuckets && typeof parsedBuckets === "object" && !Array.isArray(parsedBuckets)) {
      usageBuckets = Object.fromEntries(
        Object.entries(parsedBuckets).filter(([minute, count]) =>
          Number.isFinite(Number(minute)) && Number.isInteger(count) && count > 0
        )
      );
    }
  }
} catch {
  usageStorageAvailable = false;
}

function renderUsage() {
  const now = Date.now();
  const monthStart = requestLimits[3].start(now);
  usageBuckets = Object.fromEntries(
    Object.entries(usageBuckets).filter(([minute]) => Number(minute) >= monthStart)
  );
  usageMeters.replaceChildren();

  requestLimits.forEach(({ label, limit, start }) => {
    const windowStart = start(now);
    const used = Object.entries(usageBuckets).reduce((total, [minute, count]) =>
      Number(minute) >= windowStart ? total + count : total, 0
    );
    const meter = document.createElement("div");
    meter.className = "usage-meter";

    const heading = document.createElement("div");
    heading.className = "usage-meter-heading";
    const title = document.createElement("span");
    title.textContent = label;
    const count = document.createElement("strong");
    count.textContent = `${used.toLocaleString()} / ${limit.toLocaleString()}`;
    heading.append(title, count);

    const progress = document.createElement("progress");
    progress.max = limit;
    progress.value = Math.min(used, limit);
    progress.setAttribute("aria-label", `${label}: ${used} of ${limit} locally recorded requests`);

    const percentage = document.createElement("span");
    percentage.className = "usage-percentage";
    percentage.textContent = `${(used / limit * 100).toFixed(3)}% of limit`;

    meter.append(heading, progress, percentage);
    usageMeters.append(meter);
  });

  usageStorageNote.textContent = usageStorageAvailable
    ? "Counts are saved in this browser for this site."
    : "Browser storage is unavailable; estimates last only while this page stays open.";
}

function recordApiRequest() {
  const now = Date.now();
  const minute = Math.floor(now / 60_000) * 60_000;
  usageBuckets[minute] = (usageBuckets[minute] ?? 0) + 1;
  usageBuckets = Object.fromEntries(
    Object.entries(usageBuckets).filter(([bucket]) =>
      Number(bucket) >= requestLimits[3].start(now)
    )
  );
  try {
    localStorage.setItem(USAGE_STORAGE_KEY, JSON.stringify(usageBuckets));
  } catch {
    usageStorageAvailable = false;
  }
  renderUsage();
}

renderUsage();

try {
  const savedTheme = localStorage.getItem("skyline-theme");
  if (savedTheme === "light" || savedTheme === "dark") theme = savedTheme;
} catch {
  themeStorageAvailable = false;
}

function applyTheme(nextTheme) {
  theme = nextTheme;
  document.documentElement.dataset.theme = theme;
  const nextMode = theme === "dark" ? "light" : "dark";
  themeIcon.textContent = theme === "dark" ? "☀" : "☾";
  themeLabel.textContent = `${nextMode[0].toUpperCase()}${nextMode.slice(1)} mode`;
  themeToggle.setAttribute("aria-label", `Switch to ${nextMode} mode`);
  themeToggle.title = themeStorageAvailable ? "" : "This browser cannot save the theme preference.";
  themeColor.content = theme === "dark" ? "#0d1726" : "#f3f6fb";
}

applyTheme(theme);

themeToggle.addEventListener("click", () => {
  applyTheme(theme === "dark" ? "light" : "dark");
  try {
    localStorage.setItem("skyline-theme", theme);
    themeStorageAvailable = true;
    applyTheme(theme);
    setStatus("");
  } catch {
    themeStorageAvailable = false;
    applyTheme(theme);
    setStatus("Theme changed, but this browser could not save your preference.");
  }
});

function weatherForCode(code) {
  return weatherDescriptions[code] ?? ["Weather unavailable", "🌡️"];
}

function roundedTemperature(value) {
  return `${Math.round(value)}°`;
}

function setStatus(message) {
  statusMessage.textContent = message;
}

function setBusy(isBusy) {
  searchForm.querySelector("button[type='submit']").disabled = isBusy;
  cityInput.disabled = isBusy;
  locationButton.disabled = isBusy;
}

async function fetchJson(url, apiName) {
  recordApiRequest();
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Open-Meteo ${apiName} API returned ${response.status}. Please try again.`);
  }
  return response.json();
}

async function searchPlaces(name) {
  const url = new URL(GEOCODING_URL);
  url.search = new URLSearchParams({
    name,
    count: "5",
    language: "en",
    format: "json"
  });
  const data = await fetchJson(url, "geocoding");
  return data.results ?? [];
}

function placeDescription(place) {
  return [place.admin1, place.country].filter(Boolean).join(", ");
}

function renderPlaceResults(places) {
  matchingPlaces = places;
  resultList.replaceChildren();

  places.forEach((place, index) => {
    const button = document.createElement("button");
    button.className = "result-button";
    button.type = "button";
    button.dataset.placeIndex = String(index);

    const name = document.createElement("span");
    name.className = "result-name";
    name.textContent = place.name;

    const detail = document.createElement("span");
    detail.className = "result-detail";
    detail.textContent = placeDescription(place) || place.timezone;

    button.append(name, detail);
    resultList.append(button);
  });

  searchResults.hidden = places.length === 0;
}

function formatTime(time) {
  return time?.split("T")[1]?.slice(0, 5) ?? "";
}

function updateLocalTime(timeZone) {
  if (!timeZone) return;

  const now = new Date();
  const timeParts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  }).formatToParts(now);
  const getPart = (type) => timeParts.find((part) => part.type === type)?.value ?? "";
  const time = `${getPart("hour")}:${getPart("minute")}:${getPart("second")}`;

  let offset = "";
  let abbreviation = "";
  try {
    const offsetParts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      timeZoneName: "shortOffset"
    }).formatToParts(now);
    offset = offsetParts.find((part) => part.type === "timeZoneName")?.value ?? "";
    offset = offset.replace(/^GMT(?=[+-])/, "UTC ");
    if (offset === "GMT") offset = "UTC +0:00";
  } catch {
    offset = "";
  }
  try {
    const abbreviationParts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      timeZoneName: "long"
    }).formatToParts(now);
    const timeZoneName = abbreviationParts.find((part) => part.type === "timeZoneName")?.value ?? "";
    if (!/^GMT(?:[+-]|$)/.test(timeZoneName)) {
      abbreviation = timeZoneName
        .split(/\s+/)
        .map((word) => word.match(/[A-Z]/)?.[0] ?? "")
        .join("");
    }
  } catch {
    abbreviation = "";
  }

  const zone = [offset, abbreviation].filter(Boolean).join(" | ");
  document.querySelector("#local-time").textContent = zone
    ? `Local time ${time} (${zone})`
    : `Local time ${time}`;
}

async function reverseGeocode(latitude, longitude) {
  const url = new URL(REVERSE_GEOCODING_URL);
  url.search = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    localityLanguage: "en"
  });

  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}

function formatDay(date, index) {
  if (index === 0) return "Today";
  if (index === 1) return "Tomorrow";
  return new Intl.DateTimeFormat(undefined, { weekday: "long", timeZone: "UTC" })
    .format(new Date(`${date}T12:00:00Z`));
}

function formatDate(date) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC"
  }).format(new Date(`${date}T12:00:00Z`));
}

function renderHourlyForecast(hourly, currentTime) {
  const startIndex = Math.max(0, hourly.time.findIndex((time) => time >= currentTime));
  const hours = hourly.time.slice(startIndex, startIndex + 12);
  const list = document.querySelector("#hourly-list");
  list.replaceChildren();

  hours.forEach((time, index) => {
    const sourceIndex = startIndex + index;
    const [description, icon] = weatherForCode(hourly.weather_code[sourceIndex]);
    const item = document.createElement("div");
    item.className = "hour-item";

    const timeLabel = document.createElement("span");
    timeLabel.className = "hour-time";
    timeLabel.textContent = index === 0 ? "Now" : formatTime(time);

    const iconLabel = document.createElement("span");
    iconLabel.className = "hour-icon";
    iconLabel.setAttribute("aria-label", description);
    iconLabel.textContent = icon;

    const temperature = document.createElement("span");
    temperature.className = "hour-temp";
    temperature.textContent = roundedTemperature(hourly.temperature_2m[sourceIndex]);

    const rain = document.createElement("span");
    rain.className = "hour-rain";
    rain.textContent = `${hourly.precipitation_probability[sourceIndex] ?? 0}% rain`;

    item.append(timeLabel, iconLabel, temperature, rain);
    list.append(item);
  });
}

function renderWeeklyForecast(daily) {
  const list = document.querySelector("#weekly-list");
  list.replaceChildren();

  daily.time.forEach((date, index) => {
    const [description, icon] = weatherForCode(daily.weather_code[index]);
    const row = document.createElement("div");
    row.className = "day-row";

    const day = document.createElement("span");
    day.className = "day-name";
    day.textContent = formatDay(date, index);

    const conditions = document.createElement("span");
    conditions.className = "day-condition";
    const weatherIcon = document.createElement("span");
    weatherIcon.setAttribute("aria-hidden", "true");
    weatherIcon.textContent = icon;
    conditions.append(weatherIcon, document.createTextNode(description));

    const range = document.createElement("span");
    range.className = "temperature-range";
    const high = document.createElement("strong");
    high.textContent = `Max ${roundedTemperature(daily.temperature_2m_max[index])}`;
    high.setAttribute("aria-label", `Maximum ${roundedTemperature(daily.temperature_2m_max[index])}`);
    const low = document.createElement("span");
    low.className = "low";
    low.textContent = `Min ${roundedTemperature(daily.temperature_2m_min[index])}`;
    low.setAttribute("aria-label", `Minimum ${roundedTemperature(daily.temperature_2m_min[index])}`);
    const track = document.createElement("span");
    track.className = "range-track";
    track.setAttribute("aria-hidden", "true");
    range.append(high, track, low);

    const rain = document.createElement("span");
    rain.className = "rain-chance";
    rain.textContent = `${daily.precipitation_probability_max[index] ?? 0}%`;
    rain.setAttribute("aria-label", `Maximum precipitation chance ${rain.textContent}`);

    track.style.background = "linear-gradient(90deg, #f3cb82, #7d9de3)";

    row.append(day, conditions, range, rain);
    list.append(row);
  });
}

function renderAirQuality(result) {
  const content = document.querySelector("#air-quality-content");
  content.replaceChildren();
  if (!result || !Number.isFinite(result.current?.us_aqi)) {
    const unavailable = document.createElement("p");
    unavailable.className = "data-placeholder";
    unavailable.textContent = "Air quality data is not available for this location right now.";
    content.append(unavailable);
    return;
  }

  const aqi = result.current.us_aqi;
  const quality = aqi <= 50
    ? ["Good", "good"]
    : aqi <= 100
      ? ["Moderate", "moderate"]
      : aqi <= 150
        ? ["Unhealthy for sensitive groups", "sensitive"]
        : aqi <= 200
          ? ["Unhealthy", "unhealthy"]
          : aqi <= 300
            ? ["Very unhealthy", "very-unhealthy"]
            : ["Hazardous", "hazardous"];

  const summary = document.createElement("div");
  summary.className = `aqi-summary aqi-${quality[1]}`;
  const value = document.createElement("strong");
  value.className = "aqi-value";
  value.textContent = String(Math.round(aqi));
  const description = document.createElement("span");
  description.className = "aqi-description";
  description.textContent = quality[0];
  summary.append(value, description);

  const bar = document.createElement("progress");
  bar.className = "aqi-progress";
  bar.max = 500;
  bar.value = Math.min(aqi, 500);
  bar.setAttribute("aria-label", `US Air Quality Index ${Math.round(aqi)}: ${quality[0]}`);

  const pollutants = document.createElement("div");
  pollutants.className = "pollutant-list";
  [
    ["PM2.5", result.current.pm2_5],
    ["PM10", result.current.pm10]
  ].forEach(([name, amount]) => {
    const row = document.createElement("span");
    row.textContent = `${name} ${Number.isFinite(amount) ? `${amount.toFixed(1)} μg/m³` : "—"}`;
    pollutants.append(row);
  });

  const timestamp = document.createElement("p");
  timestamp.className = "data-caption";
  timestamp.textContent = `Modeled at ${formatTime(result.current.time)} local time. Not a monitoring-station reading.`;
  content.append(summary, bar, pollutants, timestamp);
}

function renderElevation(result) {
  const content = document.querySelector("#elevation-content");
  content.replaceChildren();
  const elevation = result?.elevation?.[0];
  if (!Number.isFinite(elevation)) {
    const unavailable = document.createElement("p");
    unavailable.className = "data-placeholder";
    unavailable.textContent = "Elevation data is not available right now.";
    content.append(unavailable);
    return;
  }

  const value = document.createElement("strong");
  value.className = "elevation-value";
  value.textContent = `${Math.round(elevation).toLocaleString()} m`;
  const caption = document.createElement("p");
  caption.className = "data-caption";
  caption.textContent = "Estimated terrain height above sea level.";
  content.append(value, caption);
}

function renderWeather(place, data, airQuality, elevation) {
  const { current, hourly, daily } = data;
  const [description, icon] = weatherForCode(current.weather_code);
  const [latitude, longitude] = [place.latitude, place.longitude];
  currentPlace = { ...place, timezone: place.timezone ?? data.timezone };

  document.querySelector("#place-name").textContent = currentPlace.name;
  document.querySelector("#place-details").textContent = [
    currentPlace.admin1,
    currentPlace.country,
    currentPlace.timezone
  ].filter(Boolean).join(" · ") || `${latitude.toFixed(2)}°, ${longitude.toFixed(2)}°`;
  if (localTimeInterval) window.clearInterval(localTimeInterval);
  updateLocalTime(currentPlace.timezone);
  localTimeInterval = window.setInterval(() => {
    if (currentPlace) updateLocalTime(currentPlace.timezone);
  }, 1000);
  document.querySelector("#current-date").textContent = formatDate(current.time.slice(0, 10));
  document.querySelector("#current-icon").textContent = icon;
  document.querySelector("#current-icon").setAttribute("aria-label", description);
  document.querySelector("#current-temperature").textContent = roundedTemperature(current.temperature_2m);
  document.querySelector("#current-condition").textContent = description;
  document.querySelector("#feels-like").textContent = roundedTemperature(current.apparent_temperature);
  document.querySelector("#humidity").textContent = `${current.relative_humidity_2m}%`;
  document.querySelector("#wind-speed").textContent = `${Math.round(current.wind_speed_10m)} km/h`;

  renderHourlyForecast(hourly, current.time);
  renderWeeklyForecast(daily);
  renderAirQuality(airQuality);
  renderElevation(elevation);
  waterResults.hidden = true;
  waterButton.disabled = false;
  waterButton.textContent = "Load water data ↗";
  dashboard.hidden = false;
  searchResults.hidden = true;
}

async function showWeather(place) {
  setBusy(true);
  setStatus("Getting the latest forecast…");
  searchResults.hidden = true;
  dashboard.hidden = true;
  currentPlace = null;
  waterResults.hidden = true;

  try {
    const forecastUrl = new URL(FORECAST_URL);
    forecastUrl.search = new URLSearchParams({
      latitude: String(place.latitude),
      longitude: String(place.longitude),
      current: "temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m",
      hourly: "temperature_2m,precipitation_probability,weather_code",
      daily: "weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max,precipitation_probability_max",
      timezone: "auto",
      forecast_days: "7"
    });
    const airQualityUrl = new URL(AIR_QUALITY_URL);
    airQualityUrl.search = new URLSearchParams({
      latitude: String(place.latitude),
      longitude: String(place.longitude),
      current: "us_aqi,european_aqi,pm2_5,pm10",
      timezone: "auto"
    });
    const elevationUrl = new URL(ELEVATION_URL);
    elevationUrl.search = new URLSearchParams({
      latitude: String(place.latitude),
      longitude: String(place.longitude)
    });

    const [weatherResult, airQualityResult, elevationResult] = await Promise.allSettled([
      fetchJson(forecastUrl, "weather forecast"),
      fetchJson(airQualityUrl, "air quality"),
      fetchJson(elevationUrl, "elevation")
    ]);
    if (weatherResult.status === "rejected") throw weatherResult.reason;

    renderWeather(
      place,
      weatherResult.value,
      airQualityResult.status === "fulfilled" ? airQualityResult.value : null,
      elevationResult.status === "fulfilled" ? elevationResult.value : null
    );
    setStatus("");
    if (airQualityResult.status === "rejected" || elevationResult.status === "rejected") {
      setStatus("Weather loaded, but some air quality or elevation data could not be retrieved.");
    }
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "Could not load the forecast. Please try again.");
  } finally {
    setBusy(false);
  }
}

function makeWaterUrl(base, place, params) {
  const url = new URL(base);
  url.search = new URLSearchParams({
    latitude: String(place.latitude),
    longitude: String(place.longitude),
    timezone: "auto",
    ...params
  });
  return url;
}

async function loadWaterConditions() {
  if (!currentPlace) return;

  waterButton.disabled = true;
  waterButton.textContent = "Loading water data…";
  waterNote.textContent = "";
  waterResults.hidden = false;
  document.querySelector("#flood-value").textContent = "Loading…";
  document.querySelector("#flood-river").textContent = "";
  document.querySelector("#flood-detail").textContent = "";
  document.querySelector("#marine-value").textContent = "Loading…";
  document.querySelector("#marine-detail").textContent = "";

  const place = currentPlace;
  const [floodResult, marineResult] = await Promise.allSettled([
    fetchJson(makeWaterUrl(FLOOD_URL, currentPlace, {
      daily: "river_discharge",
      forecast_days: "7"
    }), "flood"),
    fetchJson(makeWaterUrl(MARINE_URL, currentPlace, {
      current: "wave_height,wave_direction,wave_period,sea_surface_temperature",
      forecast_days: "1"
    }), "marine")
  ]);

  const floodValue = document.querySelector("#flood-value");
  const floodRiver = document.querySelector("#flood-river");
  const floodDetail = document.querySelector("#flood-detail");
  floodRiver.textContent = "Looking up nearby river…";

  if (floodResult.status === "fulfilled" && Number.isFinite(floodResult.value.daily?.river_discharge?.[0])) {
    const discharge = floodResult.value.daily.river_discharge[0];
    floodValue.textContent = `${discharge.toLocaleString(undefined, { maximumFractionDigits: 1 })} m³/s`;
    floodDetail.textContent = "Nearest modeled river · today";
  } else {
    floodValue.textContent = "No data";
    floodDetail.textContent = floodResult.status === "rejected"
      ? floodResult.reason.message
      : "No nearby river model coverage.";
  }

  const marineValue = document.querySelector("#marine-value");
  const marineDetail = document.querySelector("#marine-detail");
  if (marineResult.status === "fulfilled" && Number.isFinite(marineResult.value.current?.wave_height)) {
    const { wave_height: waveHeight, wave_period: wavePeriod, sea_surface_temperature: seaTemperature } = marineResult.value.current;
    marineValue.textContent = `${waveHeight.toFixed(1)} m waves`;
    marineDetail.textContent = [
      Number.isFinite(wavePeriod) ? `${wavePeriod.toFixed(1)} s period` : null,
      Number.isFinite(seaTemperature) ? `${seaTemperature.toFixed(1)}°C sea` : null
    ].filter(Boolean).join(" · ");
  } else {
    marineValue.textContent = "No data";
    marineDetail.textContent = marineResult.status === "rejected"
      ? marineResult.reason.message
      : "No nearby marine model coverage.";
  }

  waterButton.disabled = false;
  waterButton.textContent = "Refresh water data ↗";

  findNearbyRiver(place).then((riverName) => {
    if (currentPlace !== place) return;
    floodRiver.textContent = riverName
      ? `Nearest major river: ${riverName}`
      : "No major river found nearby.";
  }).catch(() => {
    if (currentPlace === place) floodRiver.textContent = "River name lookup unavailable.";
  });
}

async function findNearbyRiver(place) {
  const cacheKey = `${place.latitude.toFixed(3)},${place.longitude.toFixed(3)}`;
  if (riverNameCache.has(cacheKey)) return riverNameCache.get(cacheKey);

  const pendingLookup = lookupNearbyRiver(place);
  riverNameCache.set(cacheKey, pendingLookup);
  try {
    const name = await pendingLookup;
    riverNameCache.set(cacheKey, name);
    return name;
  } catch (error) {
    riverNameCache.delete(cacheKey);
    throw error;
  }
}

async function lookupNearbyRiver(place) {
  const locality = place.name?.split(",")[0].trim();
  const queries = locality && locality.toLowerCase() !== "your location"
    ? [`${locality} river`, "river"]
    : ["river"];

  for (const query of queries) {
    const rivers = await searchNearbyRiverCandidates(place, query);
    const majorRiver = selectMajorRiver(rivers, place);
    if (majorRiver) return majorRiver;
  }

  return null;
}

function searchNearbyRiverCandidates(place, query) {
  const latitudeRadius = 30 / 111.32;
  const longitudeRadius = latitudeRadius / Math.max(Math.cos(place.latitude * Math.PI / 180), 0.01);
  const url = new URL(NOMINATIM_SEARCH_URL);
  url.search = new URLSearchParams({
    format: "jsonv2",
    q: query,
    viewbox: [
      place.longitude - longitudeRadius,
      place.latitude + latitudeRadius,
      place.longitude + longitudeRadius,
      place.latitude - latitudeRadius
    ].join(","),
    bounded: "1",
    limit: "20",
    extratags: "1"
  });
  const request = nominatimRequestQueue.then(async () => {
    const wait = Math.max(0, 1000 - (Date.now() - lastNominatimRequestAt));
    if (wait > 0) await new Promise((resolve) => window.setTimeout(resolve, wait));
    lastNominatimRequestAt = Date.now();

    const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) {
      throw new Error(`OpenStreetMap river lookup returned ${response.status}.`);
    }
    return response.json();
  });
  nominatimRequestQueue = request.then(() => undefined, () => undefined);
  return request;
}

function selectMajorRiver(results, place) {
  const isDrain = (river) => {
    const name = river.name?.toLowerCase() ?? "";
    const description = river.extratags?.description?.toLowerCase() ?? "";
    return /\b(nala|nallah|nullah|drain|canal)\b/.test(name)
      || /storm.?water|drain|canal/.test(description);
  };
  const isRiver = (river) => river.type === "river"
    || (["lake", "water"].includes(river.type) && /\briver\b/i.test(river.name ?? ""));

  const riversByName = new Map();
  results
    .filter((river) => river.name && isRiver(river) && !isDrain(river))
    .map((river) => {
      const bounds = river.boundingbox?.map(Number);
      const extent = bounds?.length === 4
        ? Math.hypot(
          (bounds[1] - bounds[0]) * 111.32,
          (bounds[3] - bounds[2])
            * 111.32
            * Math.cos(place.latitude * Math.PI / 180)
        )
        : 0;
      const distance = Math.hypot(
        (Number(river.lat) - place.latitude) * 111.32,
        (Number(river.lon) - place.longitude)
          * 111.32
          * Math.cos(place.latitude * Math.PI / 180)
      );
      return { name: river.name, extent, importance: Number(river.importance) || 0, distance };
    })
    .filter((river) => Number.isFinite(river.distance))
    .forEach((river) => {
      const current = riversByName.get(river.name) ?? {
        name: river.name,
        extent: 0,
        importance: 0,
        distance: Infinity
      };
      current.extent += river.extent;
      current.importance = Math.max(current.importance, river.importance);
      current.distance = Math.min(current.distance, river.distance);
      riversByName.set(river.name, current);
    });

  return [...riversByName.values()]
    .sort((first, second) =>
      second.extent - first.extent
      || second.importance - first.importance
      || first.distance - second.distance
    )[0]?.name ?? null;
}

searchForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const name = cityInput.value.trim();
  if (!name) {
    setStatus("Enter a city name to search.");
    cityInput.focus();
    return;
  }

  setBusy(true);
  setStatus("Looking for places…");
  dashboard.hidden = true;
  searchResults.hidden = true;

  try {
    const places = await searchPlaces(name);
    if (places.length === 0) {
      renderPlaceResults([]);
      setStatus(`No places found for “${name}”. Try another city name.`);
      return;
    }
    renderPlaceResults(places);
    setStatus("");
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "Could not search for that place. Please try again.");
  } finally {
    setBusy(false);
  }
});

resultList.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-place-index]");
  if (!button) return;

  const place = matchingPlaces[Number(button.dataset.placeIndex)];
  if (place) showWeather(place);
});

waterButton.addEventListener("click", loadWaterConditions);

locationButton.addEventListener("click", () => {
  if (!navigator.geolocation) {
    setStatus("Location is not supported by this browser. You can search for a city instead.");
    return;
  }

  setStatus("Waiting for your location…");
  setBusy(true);
  navigator.geolocation.getCurrentPosition(
    async ({ coords }) => {
      const location = await reverseGeocode(coords.latitude, coords.longitude);
      const locality = location?.locality
        || location?.city
        || location?.principalSubdivision
        || "Your location";
      const name = locality === location?.principalSubdivision
        ? locality
        : [locality, location?.principalSubdivision].filter((value, index, values) =>
          value && values.indexOf(value) === index
        ).join(", ");

      showWeather({
        name,
        admin1: location?.principalSubdivision,
        country: location?.countryName,
        timezone: location?.timezone?.name,
        latitude: coords.latitude,
        longitude: coords.longitude
      });
    },
    (error) => {
      const messages = {
        1: "Location permission was denied. You can search for a city instead.",
        2: "Your location could not be determined. Try searching for a city.",
        3: "Location took too long to respond. Please try again."
      };
      setStatus(messages[error.code] ?? "Could not get your location. You can search for a city instead.");
      setBusy(false);
    },
    { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
  );
});
