import type { Coordinates, TemperatureUnit, WeatherData } from "@/types/dashboard";

const OPEN_WEATHER_BASE_URL = "https://api.openweathermap.org/data/2.5/weather";
const IP_LOOKUP_URL = "https://ipapi.co/json/";

type OpenWeatherResponse = {
  cod?: number | string;
  message?: string;
  main?: {
    temp?: number;
  };
  weather?: Array<{
    description?: string;
    icon?: string;
  }>;
};

function assertNumber(value: unknown, label: string): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new Error(`Missing ${label}.`);
  }

  return value;
}

export async function getCoordinatesFromIp(): Promise<Coordinates> {
  const response = await fetch(IP_LOOKUP_URL);

  if (!response.ok) {
    throw new Error("Unable to estimate location from IP.");
  }

  const payload = (await response.json()) as {
    latitude?: number;
    longitude?: number;
    lat?: number;
    lon?: number;
  };

  console.log(payload);

  return {
    latitude: assertNumber(payload.latitude ?? payload.lat, "latitude"),
    longitude: assertNumber(payload.longitude ?? payload.lon, "longitude"),
  };
}

export function getCoordinatesFromBrowser(): Promise<Coordinates> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("This browser does not support location access."));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      (error) => {
        reject(
          new Error(
            error.message || "Location permission was denied for this device.",
          ),
        );
      },
      {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 10 * 60 * 1000,
      },
    );
  });
}

export function getCoordinatesFromManualInput(
  latitude: string,
  longitude: string,
): Coordinates {
  const parsedLatitude = Number.parseFloat(latitude);
  const parsedLongitude = Number.parseFloat(longitude);

  if (Number.isNaN(parsedLatitude) || Number.isNaN(parsedLongitude)) {
    throw new Error("Enter a valid latitude and longitude.");
  }

  return {
    latitude: parsedLatitude,
    longitude: parsedLongitude,
  };
}

export async function fetchWeather(
  coordinates: Coordinates,
  apiKey: string,
  unit: TemperatureUnit,
): Promise<WeatherData> {
  const params = new URLSearchParams({
    lat: String(coordinates.latitude),
    lon: String(coordinates.longitude),
    appid: apiKey,
    units: unit === "fahrenheit" ? "imperial" : "metric",
  });

  console.log(coordinates.latitude);
  console.log(coordinates.longitude);

  const response = await fetch(`${OPEN_WEATHER_BASE_URL}?${params.toString()}`);
  const payload = (await response.json()) as OpenWeatherResponse;

  if (!response.ok || String(payload.cod ?? "") === "401") {
    throw new Error(payload.message || "Weather lookup failed.");
  }

  const currentWeather = payload.weather?.[0];
  const temperature = payload.main?.temp;

  if (typeof temperature !== "number" || !currentWeather) {
    throw new Error("Weather data is incomplete.");
  }

  return {
    temperature,
    description: currentWeather.description || "Unknown conditions",
    iconCode: currentWeather.icon || "01d",
  };
}
