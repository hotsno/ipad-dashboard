export type TemperatureUnit = "fahrenheit" | "celsius";

export type CoordinateMode = "ip" | "manual" | "browser";

export type DashboardSettings = {
  userName: string;
  backgroundImageUrl: string;
  temperatureUnit: TemperatureUnit;
  weatherApiKey: string;
  coordinateMode: CoordinateMode;
  manualLatitude: string;
  manualLongitude: string;
  showSettingsIcon: boolean;
};

export type WeatherData = {
  temperature: number;
  description: string;
  iconCode: string;
};

export type Coordinates = {
  latitude: number;
  longitude: number;
};
