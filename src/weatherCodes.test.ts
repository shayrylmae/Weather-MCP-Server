import { describe, it, expect } from 'vitest';

// Weather code mapping from the main file
const WEATHER_CODES: Record<number, string> = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Foggy",
  48: "Depositing rime fog",
  51: "Light drizzle",
  53: "Moderate drizzle",
  55: "Dense drizzle",
  61: "Slight rain",
  63: "Moderate rain",
  65: "Heavy rain",
  71: "Slight snow fall",
  73: "Moderate snow fall",
  75: "Heavy snow fall",
  77: "Snow grains",
  80: "Slight rain showers",
  81: "Moderate rain showers",
  82: "Violent rain showers",
  85: "Slight snow showers",
  86: "Heavy snow showers",
  95: "Thunderstorm",
  96: "Thunderstorm with slight hail",
  99: "Thunderstorm with heavy hail",
};

describe('Weather Codes', () => {
  it('should have all WMO weather codes defined', () => {
    // Common weather codes that should be present
    const commonCodes = [0, 1, 2, 3, 45, 48, 51, 61, 71, 80, 95];

    commonCodes.forEach(code => {
      expect(WEATHER_CODES[code]).toBeDefined();
      expect(typeof WEATHER_CODES[code]).toBe('string');
      expect(WEATHER_CODES[code].length).toBeGreaterThan(0);
    });
  });

  it('should return correct descriptions for clear weather codes', () => {
    expect(WEATHER_CODES[0]).toBe("Clear sky");
    expect(WEATHER_CODES[1]).toBe("Mainly clear");
    expect(WEATHER_CODES[2]).toBe("Partly cloudy");
    expect(WEATHER_CODES[3]).toBe("Overcast");
  });

  it('should return correct descriptions for rain codes', () => {
    expect(WEATHER_CODES[51]).toBe("Light drizzle");
    expect(WEATHER_CODES[61]).toBe("Slight rain");
    expect(WEATHER_CODES[63]).toBe("Moderate rain");
    expect(WEATHER_CODES[65]).toBe("Heavy rain");
  });

  it('should return correct descriptions for snow codes', () => {
    expect(WEATHER_CODES[71]).toBe("Slight snow fall");
    expect(WEATHER_CODES[73]).toBe("Moderate snow fall");
    expect(WEATHER_CODES[75]).toBe("Heavy snow fall");
    expect(WEATHER_CODES[77]).toBe("Snow grains");
  });

  it('should return correct descriptions for thunderstorm codes', () => {
    expect(WEATHER_CODES[95]).toBe("Thunderstorm");
    expect(WEATHER_CODES[96]).toBe("Thunderstorm with slight hail");
    expect(WEATHER_CODES[99]).toBe("Thunderstorm with heavy hail");
  });

  it('should handle undefined weather codes gracefully', () => {
    const unknownCode = 999;
    expect(WEATHER_CODES[unknownCode]).toBeUndefined();
  });

  it('should have unique descriptions for each code', () => {
    const descriptions = Object.values(WEATHER_CODES);
    const uniqueDescriptions = new Set(descriptions);
    expect(descriptions.length).toBe(uniqueDescriptions.size);
  });
});