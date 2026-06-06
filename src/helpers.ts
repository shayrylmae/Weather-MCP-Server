// ============================================
// HELPER FUNCTIONS MODULE
// ============================================

/**
 * Geocodes a city name to coordinates using Open-Meteo API
 * @param city - City name to geocode
 * @param country - Optional country code
 * @param maxRetries - Maximum number of retry attempts (default: 3)
 * @param timeoutMs - Request timeout in milliseconds (default: 10000)
 * @returns Location data with coordinates and metadata
 */
export async function geocodeCity(
  city: string,
  country?: string,
  maxRetries: number = 3,
  timeoutMs: number = 10000
): Promise<{
  latitude: number;
  longitude: number;
  name: string;
  country: string;
  timezone: string;
}> {
  const searchQuery = country ? `${city}, ${country}` : city;
  const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
    searchQuery
  )}&count=1&language=en&format=json`;

  let lastError: Error | null = null;

  // Retry logic with exponential backoff
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(geoUrl, {
        signal: controller.signal,
      }).finally(() => clearTimeout(timeoutId));

      if (!response.ok) {
        // Distinguish between different HTTP errors
        if (response.status >= 500) {
          throw new Error(
            `Geocoding API server error (${response.status}): ${response.statusText}. The service may be temporarily down.`
          );
        } else if (response.status === 429) {
          throw new Error('Geocoding API rate limit exceeded. Please try again later.');
        } else {
          throw new Error(
            `Geocoding API error (${response.status}): ${response.statusText}`
          );
        }
      }

      let data;
      try {
        data = await response.json();
      } catch (parseError) {
        throw new Error(
          `Geocoding API returned invalid JSON response. The service may be experiencing issues.`
        );
      }

      if (!data.results || data.results.length === 0) {
        // This is a user error, not an API error - don't retry
        throw new Error(
          `City not found: "${city}"${country ? ` in ${country}` : ''}. Please check the spelling and try again.`
        );
      }

      const result = data.results[0];

      // Validate the response has required fields
      if (
        !result.latitude ||
        !result.longitude ||
        !result.name ||
        !result.timezone
      ) {
        throw new Error(
          'Geocoding API returned incomplete data. The service may be experiencing issues.'
        );
      }

      return {
        latitude: result.latitude,
        longitude: result.longitude,
        name: result.name,
        country: result.country_code || result.country,
        timezone: result.timezone,
      };
    } catch (error: any) {
      lastError = error;

      // Don't retry for user errors
      if (
        error.message.includes('City not found') ||
        error.message.includes('rate limit')
      ) {
        throw error;
      }

      // Check if error is from AbortController (timeout)
      if (error.name === 'AbortError') {
        lastError = new Error(
          `Geocoding request timed out after ${timeoutMs}ms. The service may be slow or down.`
        );
      }

      // If not the last attempt, wait before retrying with exponential backoff
      if (attempt < maxRetries - 1) {
        const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  // All retries exhausted
  throw lastError || new Error('Geocoding failed after all retry attempts');
}

/**
 * Makes a weather API call with retry logic and timeout handling
 * @param url - API URL to call
 * @param maxRetries - Maximum number of retry attempts (default: 3)
 * @param timeoutMs - Request timeout in milliseconds (default: 10000)
 * @returns Parsed JSON response from the weather API
 */
export async function fetchWeatherData(
  url: string,
  maxRetries: number = 3,
  timeoutMs: number = 10000
): Promise<any> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(url, {
        signal: controller.signal,
      }).finally(() => clearTimeout(timeoutId));

      if (!response.ok) {
        if (response.status >= 500) {
          throw new Error(
            `Weather API server error (${response.status}): ${response.statusText}. The service may be temporarily down.`
          );
        } else if (response.status === 429) {
          throw new Error('Weather API rate limit exceeded. Please try again later.');
        } else if (response.status === 400) {
          // Bad request - don't retry
          const errorText = await response.text();
          throw new Error(`Weather API request error: ${errorText}`);
        } else {
          throw new Error(
            `Weather API error (${response.status}): ${response.statusText}`
          );
        }
      }

      let data;
      try {
        data = await response.json();
      } catch (parseError) {
        throw new Error(
          'Weather API returned invalid JSON response. The service may be experiencing issues.'
        );
      }

      return data;
    } catch (error: any) {
      lastError = error;

      // Don't retry for client errors
      if (
        error.message.includes('rate limit') ||
        error.message.includes('request error') ||
        error.message.includes('400')
      ) {
        throw error;
      }

      // Check if error is from AbortController (timeout)
      if (error.name === 'AbortError') {
        lastError = new Error(
          `Weather API request timed out after ${timeoutMs}ms. The service may be slow or down.`
        );
      }

      // If not the last attempt, wait before retrying with exponential backoff
      if (attempt < maxRetries - 1) {
        const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  // All retries exhausted
  throw lastError || new Error('Weather API request failed after all retry attempts');
}

// ============================================
// WEATHER CODE MAPPING (Open-Meteo WMO codes)
// ============================================
export const WEATHER_CODES: Record<number, string> = {
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