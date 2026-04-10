import type { DashboardSettings } from "@/types/dashboard";

export const DASHBOARD_SETTINGS_STORAGE_KEY = "ipad-dashboard-settings";

export const defaultSettings: DashboardSettings = {
  userName: "user",
  backgroundImageUrl: "",
  temperatureUnit: "fahrenheit",
  weatherApiKey: "",
  coordinateMode: "ip",
  manualLatitude: "",
  manualLongitude: "",
  showSettingsIcon: true,
};

export function sanitizeSettings(
  value: Partial<DashboardSettings> | null | undefined,
): DashboardSettings {
  return {
    userName:
      typeof value?.userName === "string" && value.userName.trim()
        ? value.userName.trim()
        : defaultSettings.userName,
    backgroundImageUrl:
      typeof value?.backgroundImageUrl === "string"
        ? value.backgroundImageUrl.trim()
        : defaultSettings.backgroundImageUrl,
    temperatureUnit:
      value?.temperatureUnit === "celsius" ? "celsius" : "fahrenheit",
    weatherApiKey:
      typeof value?.weatherApiKey === "string"
        ? value.weatherApiKey.trim()
        : defaultSettings.weatherApiKey,
    coordinateMode:
      value?.coordinateMode === "manual" || value?.coordinateMode === "browser"
        ? value.coordinateMode
        : defaultSettings.coordinateMode,
    manualLatitude:
      typeof value?.manualLatitude === "string"
        ? value.manualLatitude.trim()
        : defaultSettings.manualLatitude,
    manualLongitude:
      typeof value?.manualLongitude === "string"
        ? value.manualLongitude.trim()
        : defaultSettings.manualLongitude,
    showSettingsIcon:
      typeof value?.showSettingsIcon === "boolean"
        ? value.showSettingsIcon
        : defaultSettings.showSettingsIcon,
  };
}
