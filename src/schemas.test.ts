import { describe, it, expect } from 'vitest';
import { z } from 'zod';

// Tool schemas from the main file
const GetCurrentWeatherArgsSchema = z.object({
  city: z.string().optional().describe("City name (e.g., 'London', 'New York')"),
  country: z.string().optional().describe("Country code (optional, e.g., 'US', 'GB')"),
  latitude: z.number().optional().describe("Latitude coordinate"),
  longitude: z.number().optional().describe("Longitude coordinate"),
}).refine(
  (data) => (data.city !== undefined) || (data.latitude !== undefined && data.longitude !== undefined),
  { message: "Either 'city' or both 'latitude' and 'longitude' must be provided" }
);

const GetWeatherForecastArgsSchema = z.object({
  city: z.string().optional().describe("City name"),
  country: z.string().optional().describe("Country code (optional)"),
  latitude: z.number().optional().describe("Latitude coordinate"),
  longitude: z.number().optional().describe("Longitude coordinate"),
  days: z.number().min(1).max(16).default(7).describe("Number of forecast days (1-16, default: 7)"),
}).refine(
  (data) => (data.city !== undefined) || (data.latitude !== undefined && data.longitude !== undefined),
  { message: "Either 'city' or both 'latitude' and 'longitude' must be provided" }
);

const GetHourlyWeatherArgsSchema = z.object({
  city: z.string().optional().describe("City name"),
  country: z.string().optional().describe("Country code (optional)"),
  latitude: z.number().optional().describe("Latitude coordinate"),
  longitude: z.number().optional().describe("Longitude coordinate"),
  hours: z.number().min(1).max(168).default(24).describe("Number of hours to forecast (1-168, default: 24)"),
}).refine(
  (data) => (data.city !== undefined) || (data.latitude !== undefined && data.longitude !== undefined),
  { message: "Either 'city' or both 'latitude' and 'longitude' must be provided" }
);

describe('Schema Validations', () => {
  describe('GetCurrentWeatherArgsSchema', () => {
    it('should accept valid city input', () => {
      const validInput = { city: 'London' };
      const result = GetCurrentWeatherArgsSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it('should accept valid city with country', () => {
      const validInput = { city: 'London', country: 'GB' };
      const result = GetCurrentWeatherArgsSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it('should accept valid coordinates', () => {
      const validInput = { latitude: 51.5074, longitude: -0.1278 };
      const result = GetCurrentWeatherArgsSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it('should accept both city and coordinates', () => {
      const validInput = {
        city: 'London',
        latitude: 51.5074,
        longitude: -0.1278
      };
      const result = GetCurrentWeatherArgsSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it('should reject empty input', () => {
      const invalidInput = {};
      const result = GetCurrentWeatherArgsSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain("Either 'city' or both 'latitude' and 'longitude'");
      }
    });

    it('should reject only latitude without longitude', () => {
      const invalidInput = { latitude: 51.5074 };
      const result = GetCurrentWeatherArgsSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it('should reject only longitude without latitude', () => {
      const invalidInput = { longitude: -0.1278 };
      const result = GetCurrentWeatherArgsSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });
  });

  describe('GetWeatherForecastArgsSchema', () => {
    it('should accept valid city with default days', () => {
      const validInput = { city: 'Paris' };
      const result = GetWeatherForecastArgsSchema.safeParse(validInput);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.days).toBe(7);
      }
    });

    it('should accept valid city with custom days', () => {
      const validInput = { city: 'Paris', days: 10 };
      const result = GetWeatherForecastArgsSchema.safeParse(validInput);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.days).toBe(10);
      }
    });

    it('should reject days below minimum', () => {
      const invalidInput = { city: 'Paris', days: 0 };
      const result = GetWeatherForecastArgsSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it('should reject days above maximum', () => {
      const invalidInput = { city: 'Paris', days: 17 };
      const result = GetWeatherForecastArgsSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it('should accept maximum valid days', () => {
      const validInput = { city: 'Paris', days: 16 };
      const result = GetWeatherForecastArgsSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });
  });

  describe('GetHourlyWeatherArgsSchema', () => {
    it('should accept valid city with default hours', () => {
      const validInput = { city: 'Tokyo' };
      const result = GetHourlyWeatherArgsSchema.safeParse(validInput);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.hours).toBe(24);
      }
    });

    it('should accept valid coordinates with custom hours', () => {
      const validInput = {
        latitude: 35.6762,
        longitude: 139.6503,
        hours: 48
      };
      const result = GetHourlyWeatherArgsSchema.safeParse(validInput);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.hours).toBe(48);
      }
    });

    it('should reject hours below minimum', () => {
      const invalidInput = { city: 'Tokyo', hours: 0 };
      const result = GetHourlyWeatherArgsSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it('should reject hours above maximum', () => {
      const invalidInput = { city: 'Tokyo', hours: 169 };
      const result = GetHourlyWeatherArgsSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it('should accept maximum valid hours', () => {
      const validInput = { city: 'Tokyo', hours: 168 };
      const result = GetHourlyWeatherArgsSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });
  });

  describe('Schema Type Safety', () => {
    it('should reject invalid latitude type', () => {
      const invalidInput = { latitude: "51.5074", longitude: -0.1278 };
      const result = GetCurrentWeatherArgsSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it('should reject invalid longitude type', () => {
      const invalidInput = { latitude: 51.5074, longitude: "-0.1278" };
      const result = GetCurrentWeatherArgsSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it('should reject invalid days type', () => {
      const invalidInput = { city: 'Paris', days: "7" };
      const result = GetWeatherForecastArgsSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it('should reject invalid hours type', () => {
      const invalidInput = { city: 'Tokyo', hours: "24" };
      const result = GetHourlyWeatherArgsSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });
  });
});