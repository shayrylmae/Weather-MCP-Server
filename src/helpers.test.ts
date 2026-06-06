import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { geocodeCity, fetchWeatherData, WEATHER_CODES } from './helpers.js';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('geocodeCity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should successfully geocode a city', async () => {
    const mockResponse = {
      results: [{
        latitude: 51.5074,
        longitude: -0.1278,
        name: 'London',
        country_code: 'GB',
        timezone: 'Europe/London'
      }]
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    const result = await geocodeCity('London');

    expect(result).toEqual({
      latitude: 51.5074,
      longitude: -0.1278,
      name: 'London',
      country: 'GB',
      timezone: 'Europe/London'
    });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('London'),
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
  });

  it('should geocode a city with country', async () => {
    const mockResponse = {
      results: [{
        latitude: 51.5074,
        longitude: -0.1278,
        name: 'London',
        country_code: 'GB',
        timezone: 'Europe/London'
      }]
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    const result = await geocodeCity('London', 'GB');

    expect(result.country).toBe('GB');
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('London%2C%20GB'),
      expect.any(Object)
    );
  });

  it('should throw error for city not found', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ results: [] }),
    });

    await expect(geocodeCity('NonExistentCity')).rejects.toThrow(
      'City not found: "NonExistentCity"'
    );

    // Should not retry for user errors
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('should retry on server errors', async () => {
    // First attempt: server error
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    });

    // Second attempt: success
    const mockResponse = {
      results: [{
        latitude: 51.5074,
        longitude: -0.1278,
        name: 'London',
        country_code: 'GB',
        timezone: 'Europe/London'
      }]
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    const promise = geocodeCity('London');

    // Fast-forward through retry delay
    await vi.advanceTimersByTimeAsync(1000);

    const result = await promise;

    expect(result.name).toBe('London');
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('should not retry on rate limit errors', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      statusText: 'Too Many Requests',
    });

    await expect(geocodeCity('London')).rejects.toThrow(
      'Geocoding API rate limit exceeded'
    );

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('should handle timeout errors', async () => {
    mockFetch.mockImplementationOnce(async (url, options) => {
      // Simulate a timeout by waiting for the abort signal
      return new Promise((resolve, reject) => {
        options.signal.addEventListener('abort', () => {
          const error = new Error('The operation was aborted');
          error.name = 'AbortError';
          reject(error);
        });
      });
    });

    const promise = geocodeCity('London', undefined, 1, 100);

    // Fast-forward past timeout
    await vi.advanceTimersByTimeAsync(100);

    await expect(promise).rejects.toThrow(
      'Geocoding request timed out after 100ms'
    );

    // Clean up any remaining timers
    vi.runAllTimers();
  });

  it('should validate response has required fields', async () => {
    const incompleteResponse = {
      results: [{
        latitude: 51.5074,
        // Missing required fields
      }]
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => incompleteResponse,
    });

    // Use maxRetries: 1 to avoid timeout
    await expect(geocodeCity('London', undefined, 1)).rejects.toThrow(
      'Geocoding API returned incomplete data'
    );
  });

  it('should handle JSON parse errors', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => { throw new Error('Invalid JSON'); },
    });

    // Use maxRetries: 1 to avoid timeout
    await expect(geocodeCity('London', undefined, 1)).rejects.toThrow(
      'Geocoding API returned invalid JSON response'
    );
  });
});

describe('fetchWeatherData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should successfully fetch weather data', async () => {
    const mockWeatherData = {
      temperature: 20,
      humidity: 65,
      windspeed: 10
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockWeatherData,
    });

    const result = await fetchWeatherData('https://api.example.com/weather');

    expect(result).toEqual(mockWeatherData);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.example.com/weather',
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
  });

  it('should retry on server errors with exponential backoff', async () => {
    // First attempt: server error
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
    });

    // Second attempt: server error
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    });

    // Third attempt: success
    const mockWeatherData = { temperature: 20 };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockWeatherData,
    });

    const promise = fetchWeatherData('https://api.example.com/weather');

    // Fast-forward through retry delays (1s + 2s)
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(2000);

    const result = await promise;

    expect(result).toEqual(mockWeatherData);
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it('should not retry on client errors', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      text: async () => 'Invalid parameters',
    });

    await expect(fetchWeatherData('https://api.example.com/weather')).rejects.toThrow(
      'Weather API request error: Invalid parameters'
    );

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('should handle rate limit errors without retry', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      statusText: 'Too Many Requests',
    });

    await expect(fetchWeatherData('https://api.example.com/weather')).rejects.toThrow(
      'Weather API rate limit exceeded'
    );

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('should handle timeout with proper error message', async () => {
    mockFetch.mockImplementationOnce(async (url, options) => {
      return new Promise((resolve, reject) => {
        options.signal.addEventListener('abort', () => {
          const error = new Error('The operation was aborted');
          error.name = 'AbortError';
          reject(error);
        });
      });
    });

    const promise = fetchWeatherData('https://api.example.com/weather', 1, 50);

    // Fast-forward past timeout
    await vi.advanceTimersByTimeAsync(50);

    await expect(promise).rejects.toThrow(
      'Weather API request timed out after 50ms'
    );

    // Clean up any remaining timers
    vi.runAllTimers();
  });

  it('should throw after all retries are exhausted', async () => {
    // All three attempts fail
    mockFetch
      .mockRejectedValueOnce(new Error('Network error'))
      .mockRejectedValueOnce(new Error('Network error'))
      .mockRejectedValueOnce(new Error('Network error'));

    const promise = fetchWeatherData('https://api.example.com/weather', 3, 100);

    // Fast-forward through all retry delays
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(2000);
    await vi.advanceTimersByTimeAsync(4000);

    await expect(promise).rejects.toThrow('Network error');
    expect(mockFetch).toHaveBeenCalledTimes(3);

    // Clean up any remaining timers
    vi.runAllTimers();
  });
});

describe('WEATHER_CODES', () => {
  it('should export weather codes mapping', () => {
    expect(WEATHER_CODES).toBeDefined();
    expect(typeof WEATHER_CODES).toBe('object');
    expect(Object.keys(WEATHER_CODES).length).toBeGreaterThan(0);
  });

  it('should contain essential weather conditions', () => {
    expect(WEATHER_CODES[0]).toBe('Clear sky');
    expect(WEATHER_CODES[61]).toBe('Slight rain');
    expect(WEATHER_CODES[71]).toBe('Slight snow fall');
    expect(WEATHER_CODES[95]).toBe('Thunderstorm');
  });
});