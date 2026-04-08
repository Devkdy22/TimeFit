import { Injectable } from '@nestjs/common';
import { AppConfigService } from '../../../common/config/app-config.service';
import { SafeLogger } from '../../../common/logger/safe-logger.service';
import type { LocationInput } from '../types/recommendation.types';
import type { NormalizedWeatherDto } from '../dto/integration/normalized-weather.dto';
import { fetchJsonWithTimeout } from '../utils/http-client.util';

interface WeatherApiResponse {
  weather?: Array<{
    main?: string;
    description?: string;
  }>;
  rain?: Record<string, number>;
  snow?: Record<string, number>;
}

interface WeatherSnapshot {
  source: 'api' | 'fallback';
  weatherType: string;
  weatherDescription: string;
  isRain: boolean;
  isSnow: boolean;
  delayRisk: number;
}

@Injectable()
export class WeatherClient {
  private readonly cache = new Map<string, { expiresAt: number; value: WeatherSnapshot }>();
  private readonly ttlMs = 120_000;

  constructor(
    private readonly appConfigService: AppConfigService,
    private readonly logger: SafeLogger,
  ) {}

  async getWeather(lat: number, lng: number): Promise<{ weatherType: string; delayRisk: number }> {
    const snapshot = await this.getWeatherSnapshot(lat, lng);
    return { weatherType: snapshot.weatherType, delayRisk: snapshot.delayRisk };
  }

  async getWeatherDelayFactor(
    origin: LocationInput,
    destination: LocationInput,
  ): Promise<NormalizedWeatherDto> {
    const midLat = (origin.lat + destination.lat) / 2;
    const midLng = (origin.lng + destination.lng) / 2;
    const snapshot = await this.getWeatherSnapshot(midLat, midLng);

    return {
      source: snapshot.source,
      fetchedAt: new Date().toISOString(),
      cacheableForMs: this.ttlMs,
      severityIndex: snapshot.delayRisk,
    };
  }

  private async getWeatherSnapshot(lat: number, lng: number): Promise<WeatherSnapshot> {
    const cacheKey = `${lat.toFixed(4)},${lng.toFixed(4)}`;
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      this.logWeather(lat, lng, cached.value.weatherType, cached.value.delayRisk);
      return cached.value;
    }

    const baseUrl = this.appConfigService.weatherApiUrl;
    const apiKey = this.appConfigService.weatherApiKey;

    if (!baseUrl || !apiKey) {
      const fallback = this.buildFallbackSnapshot();
      this.cache.set(cacheKey, { expiresAt: Date.now() + this.ttlMs, value: fallback });
      this.logWeather(lat, lng, fallback.weatherType, fallback.delayRisk);
      return fallback;
    }

    try {
      const url = this.buildUrl(baseUrl, lat, lng, apiKey);

      const raw = await fetchJsonWithTimeout<WeatherApiResponse>(url, { method: 'GET' }, 2500);
      const normalized = this.normalizeWeather(raw);
      const snapshot: WeatherSnapshot = {
        source: 'api',
        ...normalized,
      };

      this.cache.set(cacheKey, { expiresAt: Date.now() + this.ttlMs, value: snapshot });
      this.logWeather(lat, lng, snapshot.weatherType, snapshot.delayRisk);
      return snapshot;
    } catch {
      const fallback = this.buildFallbackSnapshot();
      this.cache.set(cacheKey, { expiresAt: Date.now() + this.ttlMs, value: fallback });
      this.logWeather(lat, lng, fallback.weatherType, fallback.delayRisk);
      return fallback;
    }
  }

  private normalizeWeather(raw: WeatherApiResponse): Omit<WeatherSnapshot, 'source'> {
    const main = raw.weather?.[0]?.main?.trim() || 'Unknown';
    const description = raw.weather?.[0]?.description?.trim() || '';
    const lowerMain = main.toLowerCase();
    const isRain = lowerMain.includes('rain') || Boolean(raw.rain);
    const isSnow = lowerMain.includes('snow') || Boolean(raw.snow);

    let delayRisk = 0.1;
    if (isSnow) {
      delayRisk = 0.3;
    } else if (isRain) {
      delayRisk = 0.2;
    } else if (lowerMain.includes('clear')) {
      delayRisk = 0.05;
    }

    return {
      weatherType: main,
      weatherDescription: description,
      isRain,
      isSnow,
      delayRisk,
    };
  }

  private buildFallbackSnapshot(): WeatherSnapshot {
    return {
      source: 'fallback',
      weatherType: 'fallback',
      weatherDescription: 'fallback weather',
      isRain: false,
      isSnow: false,
      delayRisk: 0.1,
    };
  }

  private buildUrl(baseUrl: string, lat: number, lng: number, apiKey: string) {
    const separator = baseUrl.includes('?') ? '&' : '?';
    return `${baseUrl}${separator}lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}&appid=${encodeURIComponent(apiKey)}&units=metric`;
  }

  private logWeather(lat: number, lng: number, weatherMain: string, delayRisk: number) {
    this.logger.log(
      {
        event: 'weather.fetch',
        lat,
        lng,
        weatherMain,
        delayRisk,
      },
      WeatherClient.name,
    );
  }
}
