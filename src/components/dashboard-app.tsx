"use client";

import NextImage from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  DASHBOARD_SETTINGS_STORAGE_KEY,
  defaultSettings,
  sanitizeSettings,
} from "@/lib/dashboard-settings";
import {
  fetchWeather,
  getCoordinatesFromBrowser,
  getCoordinatesFromIp,
  getCoordinatesFromManualInput,
} from "@/lib/weather";
import type {
  CoordinateMode,
  DashboardSettings,
  TemperatureUnit,
  WeatherData,
} from "@/types/dashboard";

type WeatherState = {
  data: WeatherData | null;
  error: string | null;
  loading: boolean;
};

const DEFAULT_BACKGROUND =
  "https://raw.githubusercontent.com/hotsno/wallpapers/main/images/040.jpg";

const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

const UNKNOWN_WEATHER_ICON_SRC = "/OneDark/unknown.png";

function resolveOneDarkWeatherIconSrc(iconCode: string | undefined): string {
  if (iconCode) {
    return `/OneDark/${iconCode}.png`;
  }
  return UNKNOWN_WEATHER_ICON_SRC;
}

/** Matches `example/js/greeting.js` thresholds and copy. */
function getGreetingPrefix(date: Date): string {
  const hour = date.getHours();
  const nbsp = "\u00a0";

  if (hour >= 23 || hour < 6) {
    return `Good evening,${nbsp}`;
  }

  if (hour >= 6 && hour < 12) {
    return `Good morning,${nbsp}`;
  }

  if (hour >= 12 && hour < 17) {
    return `Good afternoon,${nbsp}`;
  }

  return `Good evening,${nbsp}`;
}

function getClockParts(date: Date): { hour: string; minutes: string } {
  const minutes = date.getMinutes().toString().padStart(2, "0");
  const hour12 = date.getHours() % 12 || 12;

  return {
    hour: String(hour12),
    minutes,
  };
}

function useResolvedBackground(imageUrl: string) {
  const [resolvedBackground, setResolvedBackground] =
    useState(DEFAULT_BACKGROUND);

  useEffect(() => {
    if (!imageUrl) {
      const frame = window.requestAnimationFrame(() => {
        setResolvedBackground(DEFAULT_BACKGROUND);
      });

      return () => window.cancelAnimationFrame(frame);
    }

    let isActive = true;
    const testImage = new Image();

    testImage.onload = () => {
      if (isActive) {
        setResolvedBackground(imageUrl);
      }
    };
    testImage.onerror = () => {
      if (isActive) {
        setResolvedBackground(DEFAULT_BACKGROUND);
      }
    };
    testImage.src = imageUrl;

    return () => {
      isActive = false;
    };
  }, [imageUrl]);

  return resolvedBackground;
}

function loadStoredSettings(): DashboardSettings | null {
  try {
    const rawValue = window.localStorage.getItem(
      DASHBOARD_SETTINGS_STORAGE_KEY,
    );

    if (!rawValue) {
      return null;
    }

    return sanitizeSettings(JSON.parse(rawValue) as Partial<DashboardSettings>);
  } catch {
    return null;
  }
}

function SettingsIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-6 w-6"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function DashboardApp() {
  const [now, setNow] = useState(() => new Date());
  const [settings, setSettings] = useState<DashboardSettings>(defaultSettings);
  const [mounted, setMounted] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);
  const [weather, setWeather] = useState<WeatherState>({
    data: null,
    error: null,
    loading: false,
  });
  const lastFetchSignature = useRef<string>("");

  const backgroundImage = useResolvedBackground(settings.backgroundImageUrl);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setMounted(true);

      const storedSettings = loadStoredSettings();

      if (!storedSettings) {
        return;
      }

      setSettings(storedSettings);
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!mounted) {
      return;
    }

    window.localStorage.setItem(
      DASHBOARD_SETTINGS_STORAGE_KEY,
      JSON.stringify(settings),
    );
  }, [mounted, settings]);

  useEffect(() => {
    if (!mounted) {
      return;
    }

    async function loadWeather() {
      if (!settings.weatherApiKey) {
        setWeather({
          data: null,
          error: "No API key",
          loading: false,
        });
        return;
      }

      const signature = JSON.stringify({
        apiKey: settings.weatherApiKey,
        unit: settings.temperatureUnit,
        mode: settings.coordinateMode,
        lat: settings.manualLatitude,
        lon: settings.manualLongitude,
      });

      if (signature === lastFetchSignature.current && weather.data) {
        return;
      }

      lastFetchSignature.current = signature;
      setWeather((current) => ({
        data: current.data,
        error: null,
        loading: true,
      }));

      try {
        const coordinates =
          settings.coordinateMode === "manual"
            ? getCoordinatesFromManualInput(
                settings.manualLatitude,
                settings.manualLongitude,
              )
            : settings.coordinateMode === "browser"
              ? await getCoordinatesFromBrowser()
              : await getCoordinatesFromIp();

        const nextWeather = await fetchWeather(
          coordinates,
          settings.weatherApiKey,
          settings.temperatureUnit,
        );

        setWeather({
          data: nextWeather,
          error: null,
          loading: false,
        });
      } catch (error) {
        setWeather({
          data: null,
          error:
            error instanceof Error
              ? error.message
              : "Unable to load weather right now.",
          loading: false,
        });
      }
    }

    loadWeather();
  }, [
    mounted,
    refreshToken,
    settings.coordinateMode,
    settings.manualLatitude,
    settings.manualLongitude,
    settings.temperatureUnit,
    settings.weatherApiKey,
    weather.data,
  ]);

  useEffect(() => {
    if (!mounted) {
      return;
    }

    const refresh = window.setInterval(
      () => {
        lastFetchSignature.current = "";
        setRefreshToken((current) => current + 1);
      },
      10 * 60 * 1000,
    );

    return () => window.clearInterval(refresh);
  }, [mounted]);

  const greeting = useMemo(
    () =>
      `${getGreetingPrefix(now)}${settings.userName.trim() || defaultSettings.userName}`,
    [now, settings.userName],
  );
  const weatherIconSrc = weather.data
    ? resolveOneDarkWeatherIconSrc(weather.data.iconCode)
    : UNKNOWN_WEATHER_ICON_SRC;
  const temperatureLabel =
    settings.temperatureUnit === "fahrenheit" ? "F" : "C";

  function updateSetting<Key extends keyof DashboardSettings>(
    key: Key,
    value: DashboardSettings[Key],
  ) {
    setSettings((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function handleCoordinateModeChange(mode: CoordinateMode) {
    updateSetting("coordinateMode", mode);
  }

  function handleTemperatureUnitChange(unit: TemperatureUnit) {
    updateSetting("temperatureUnit", unit);
  }

  const { hour: clockHour, minutes: clockMinutes } = getClockParts(now);
  const monthShort = MONTH_NAMES[now.getMonth()];
  const dayNumber = now.getDate();

  return (
    <main
      className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-[#19171a] text-[#d8dee9] transition-[color,background-color] duration-200 ease-in-out"
      style={{
        backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.6), rgba(0, 0, 0, 0.6)), url(${backgroundImage})`,
        backgroundPosition: "center",
        backgroundSize: "cover",
      }}
    >
      <button
        type="button"
        aria-label="Open settings from hidden corner"
        className="absolute left-0 top-0 z-10 h-24 w-24 cursor-default bg-transparent"
        onClick={() => setIsSettingsOpen(true)}
      />

      <div className="relative z-1 grid h-[85vh] w-[145vh] max-h-dvh max-w-full grid-cols-4 grid-rows-4 gap-[30px] p-5 max-[68.75em]:h-auto max-[68.75em]:min-h-[85vh] max-[68.75em]:gap-5 max-[68.75em]:p-10">
        <div className="col-span-2 row-span-2 row-start-2 flex flex-col items-center justify-center max-[68.75em]:col-span-4 max-[68.75em]:row-span-2 max-[68.75em]:row-start-1">
          <div className="flex items-center justify-center font-bold leading-none text-[12vh] max-[68.75em]:text-[clamp(4rem,18vw,12vh)]">
            <span>{clockHour}</span>
            <span aria-hidden="true"> : </span>
            <span>{clockMinutes}</span>
          </div>
          <p className="mt-0 text-[3vh] font-normal max-[68.75em]:text-[clamp(1rem,4vw,3vh)]">
            {greeting}
          </p>
        </div>

        <div className="col-span-2 row-span-4 col-start-3 row-start-1 flex flex-col items-center justify-center max-[68.75em]:hidden">
          <div className="mt-[30px] flex items-center justify-center">
            <span className="text-[8vh] font-bold leading-none max-[68.75em]:text-[clamp(3rem,10vw,8vh)]">
              {monthShort}
            </span>
            <span className="ml-6 text-[8vh] font-bold leading-none max-[68.75em]:text-[clamp(3rem,10vw,8vh)]">
              {dayNumber}
            </span>
          </div>

          <div className="mt-0 flex items-center justify-center">
            <div className="h-[70px] w-[70px] shrink-0">
              <NextImage
                src={weatherIconSrc}
                alt=""
                className="h-[70px] w-[70px]"
                width={70}
                height={70}
              />
            </div>

            <p className="ml-[15px] text-[3vh] font-bold leading-normal">
              {weather.loading && !weather.data ? (
                "…"
              ) : weather.data ? (
                <>
                  {Math.round(weather.data.temperature)}°
                  <span className="font-bold">{temperatureLabel}</span>
                </>
              ) : (
                <>
                  --°<span className="font-bold">{temperatureLabel}</span>
                </>
              )}
            </p>

            <p className="ml-[15px] text-[3vh] font-normal leading-normal">
              {weather.error
                ? weather.error
                : weather.data?.description || " "}
            </p>
          </div>
        </div>

        <div
          className="pointer-events-none col-span-4 row-start-4 flex flex-col items-center justify-center"
          aria-hidden
        />
      </div>

      {settings.showSettingsIcon && (
        <button
          type="button"
          aria-label="Open settings"
          onClick={() => setIsSettingsOpen(true)}
          className="absolute bottom-5 left-5 z-20 rounded-full border border-[#d8dee9]/18 bg-black/35 p-3 text-[#d8dee9]/90 shadow-[0_14px_35px_rgba(0,0,0,0.35)] backdrop-blur-md transition-colors duration-200 ease-in-out hover:bg-black/55 hover:text-[#d8dee9]"
        >
          <SettingsIcon />
        </button>
      )}

      {isSettingsOpen && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/58 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-[2rem] border border-white/12 bg-[#08111f]/92 p-6 shadow-[0_35px_120px_rgba(0,0,0,0.5)] sm:p-8">
            <div className="flex items-start justify-between gap-6">
              <div>
                <p className="font-sans text-3xl font-semibold tracking-[-0.04em]">
                  Dashboard Settings
                </p>
                <p className="mt-2 max-w-xl text-sm text-white/68">
                  Everything saves locally on this device so the dashboard can
                  stay lightweight on Vercel.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsSettingsOpen(false)}
                className="rounded-full border border-white/12 px-3 py-2 text-sm text-white/78 transition hover:bg-white/8"
              >
                Close
              </button>
            </div>

            <div className="mt-8 grid gap-5 sm:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm text-white/68">
                  User name
                </span>
                <input
                  value={settings.userName}
                  onChange={(event) =>
                    updateSetting("userName", event.target.value)
                  }
                  className="w-full rounded-2xl border border-white/12 bg-white/6 px-4 py-3 text-white outline-none transition placeholder:text-white/35 focus:border-white/35 focus:bg-white/10"
                  placeholder="user"
                />
              </label>

              <label className="block sm:col-span-2">
                <span className="mb-2 block text-sm text-white/68">
                  Background image URL
                </span>
                <input
                  value={settings.backgroundImageUrl}
                  onChange={(event) =>
                    updateSetting("backgroundImageUrl", event.target.value)
                  }
                  className="w-full rounded-2xl border border-white/12 bg-white/6 px-4 py-3 text-white outline-none transition placeholder:text-white/35 focus:border-white/35 focus:bg-white/10"
                  placeholder="https://example.com/background.jpg"
                />
              </label>

              <fieldset className="rounded-[1.5rem] border border-white/10 bg-white/4 p-4">
                <legend className="px-2 text-sm text-white/68">
                  Temperature unit
                </legend>
                <div className="mt-2 flex gap-3">
                  <button
                    type="button"
                    onClick={() => handleTemperatureUnitChange("fahrenheit")}
                    className={`rounded-full px-4 py-2 text-sm transition ${
                      settings.temperatureUnit === "fahrenheit"
                        ? "bg-white text-slate-950"
                        : "border border-white/14 bg-transparent text-white/78"
                    }`}
                  >
                    Fahrenheit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTemperatureUnitChange("celsius")}
                    className={`rounded-full px-4 py-2 text-sm transition ${
                      settings.temperatureUnit === "celsius"
                        ? "bg-white text-slate-950"
                        : "border border-white/14 bg-transparent text-white/78"
                    }`}
                  >
                    Celsius
                  </button>
                </div>
              </fieldset>

              <label className="block">
                <span className="mb-2 block text-sm text-white/68">
                  OpenWeatherMap API key
                </span>
                <input
                  value={settings.weatherApiKey}
                  onChange={(event) =>
                    updateSetting("weatherApiKey", event.target.value)
                  }
                  className="w-full rounded-2xl border border-white/12 bg-white/6 px-4 py-3 text-white outline-none transition placeholder:text-white/35 focus:border-white/35 focus:bg-white/10"
                  placeholder="Paste your API key"
                />
              </label>

              <fieldset className="sm:col-span-2 rounded-[1.5rem] border border-white/10 bg-white/4 p-4">
                <legend className="px-2 text-sm text-white/68">
                  Coordinate source
                </legend>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <button
                    type="button"
                    onClick={() => handleCoordinateModeChange("ip")}
                    className={`rounded-2xl px-4 py-3 text-sm transition ${
                      settings.coordinateMode === "ip"
                        ? "bg-white text-slate-950"
                        : "border border-white/14 text-white/78"
                    }`}
                  >
                    Based on IP
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCoordinateModeChange("manual")}
                    className={`rounded-2xl px-4 py-3 text-sm transition ${
                      settings.coordinateMode === "manual"
                        ? "bg-white text-slate-950"
                        : "border border-white/14 text-white/78"
                    }`}
                  >
                    Manual lat/lon
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCoordinateModeChange("browser")}
                    className={`rounded-2xl px-4 py-3 text-sm transition ${
                      settings.coordinateMode === "browser"
                        ? "bg-white text-slate-950"
                        : "border border-white/14 text-white/78"
                    }`}
                  >
                    Location API
                  </button>
                </div>
              </fieldset>

              {settings.coordinateMode === "manual" && (
                <>
                  <label className="block">
                    <span className="mb-2 block text-sm text-white/68">
                      Latitude
                    </span>
                    <input
                      value={settings.manualLatitude}
                      onChange={(event) =>
                        updateSetting("manualLatitude", event.target.value)
                      }
                      className="w-full rounded-2xl border border-white/12 bg-white/6 px-4 py-3 text-white outline-none transition placeholder:text-white/35 focus:border-white/35 focus:bg-white/10"
                      placeholder="37.7749"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm text-white/68">
                      Longitude
                    </span>
                    <input
                      value={settings.manualLongitude}
                      onChange={(event) =>
                        updateSetting("manualLongitude", event.target.value)
                      }
                      className="w-full rounded-2xl border border-white/12 bg-white/6 px-4 py-3 text-white outline-none transition placeholder:text-white/35 focus:border-white/35 focus:bg-white/10"
                      placeholder="-122.4194"
                    />
                  </label>
                </>
              )}

              <label className="sm:col-span-2 flex items-center justify-between rounded-[1.5rem] border border-white/10 bg-white/4 px-4 py-4">
                <div>
                  <span className="block text-sm text-white/82">
                    Show settings icon
                  </span>
                  <span className="mt-1 block text-xs text-white/54">
                    You can always reopen settings from the hidden top-left
                    hotspot.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={settings.showSettingsIcon}
                  onChange={(event) =>
                    updateSetting("showSettingsIcon", event.target.checked)
                  }
                  className="h-5 w-5 accent-white"
                />
              </label>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
