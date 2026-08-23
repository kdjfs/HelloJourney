package com.hellojourney.service;

import com.hellojourney.config.AppSettings;
import com.hellojourney.model.entity.Location;
import com.hellojourney.model.entity.WeatherInfo;
import com.hellojourney.model.vo.POIInfo;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Service
public class MapDispatcher {
    private final AppSettings appSettings;
    private final GoogleMapService googleMapService;
    private final TencentMapService tencentMapService;
    private final AmapMapService amapMapService;
    private volatile boolean googleFailed = false;

    /** 天气结果缓存（城市 → 结果/时间戳），避免 Agent 多次重复查询耗尽配额。 */
    private final Map<String, CachedWeather> weatherCache = new ConcurrentHashMap<>();
    private static final long WEATHER_CACHE_TTL_MS = 30 * 60 * 1000L;

    public MapDispatcher(AppSettings appSettings, GoogleMapService googleMapService,
                         TencentMapService tencentMapService, AmapMapService amapMapService) {
        this.appSettings = appSettings;
        this.googleMapService = googleMapService;
        this.tencentMapService = tencentMapService;
        this.amapMapService = amapMapService;
    }

    public String getMapProvider() {
        if (appSettings.getGoogleMapsApiKey() != null && !appSettings.getGoogleMapsApiKey().isEmpty()) {
            return "google";
        }
        return "tencent";
    }

    public String getEffectiveMapProvider() {
        return "google".equals(getMapProvider()) && !googleFailed ? "google" : "tencent";
    }

    public synchronized void reset() {
        googleFailed = false;
        weatherCache.clear();
        tencentMapService.reset();
        googleMapService.reset();
        amapMapService.reset();
    }

    public Map<String, Double> geocodeUnified(String address, String city, String addressZh, String addressEn) {
        if ("google".equals(getMapProvider()) && !googleFailed) {
            String googleAddress = (addressEn != null && !addressEn.isEmpty()) ? addressEn : address;
            Location loc = googleMapService.geocode(googleAddress, city);
            if (loc != null) {
                return Map.of("longitude", loc.getLongitude(), "latitude", loc.getLatitude());
            }
            googleFailed = true;
            log.warn("[Dispatcher] Google 地理编码失败 (后续采用腾讯地图): {}", addressEn != null ? addressEn : address);
        }

        String tencentAddress = (addressZh != null && !addressZh.isEmpty()) ? addressZh : address;
        Location loc = tencentMapService.geocode(tencentAddress, city);
        if (loc != null) {
            return Map.of("longitude", loc.getLongitude(), "latitude", loc.getLatitude());
        }
        if (amapMapService.isConfigured()) {
            Location amapLoc = amapMapService.geocode(addressZh != null && !addressZh.isEmpty() ? addressZh : address, city);
            if (amapLoc != null) {
                log.info("[Dispatcher] 腾讯地理编码失败，降级到高德地图: {}", address);
                return Map.of("longitude", amapLoc.getLongitude(), "latitude", amapLoc.getLatitude());
            }
        }
        // An empty result is safer than presenting Beijing's coordinates as a verified location.
        return Map.of();
    }

    public List<POIInfo> searchPoiUnified(String keywords, String city, boolean citylimit) {
        if ("google".equals(getMapProvider()) && !googleFailed) {
            try {
                List<POIInfo> result = googleMapService.searchPoi(keywords, city, citylimit);
                if (result != null && !result.isEmpty()) {
                    return result;
                }
            } catch (Exception e) {
                log.warn("[Dispatcher] Google POI搜索异常: {}", e.getMessage());
            }
            googleFailed = true;
            log.warn("[Dispatcher] Google POI搜索失败，降级到腾讯地图");
        }
        List<POIInfo> result = tencentMapService.searchPoi(keywords, city, citylimit);
        if ((result == null || result.isEmpty()) && amapMapService.isConfigured()) {
            log.info("[Dispatcher] 腾讯POI搜索无结果，降级到高德地图: {} {}", city, keywords);
            List<POIInfo> amapResult = amapMapService.searchPoi(keywords, city, citylimit);
            if (amapResult != null && !amapResult.isEmpty()) {
                return amapResult;
            }
        }
        return result == null ? Collections.emptyList() : result;
    }

    public List<WeatherInfo> getWeatherUnified(String city) {
        String cacheKey = city == null ? "" : city.trim();
        CachedWeather cached = weatherCache.get(cacheKey);
        if (cached != null && System.currentTimeMillis() - cached.createdAt < WEATHER_CACHE_TTL_MS) {
            return cached.result;
        }

        List<WeatherInfo> result;
        if ("google".equals(getMapProvider()) && !googleFailed) {
            try {
                List<WeatherInfo> googleResult = googleMapService.getWeather(city);
                if (googleResult != null && !googleResult.isEmpty()) {
                    result = googleResult;
                    weatherCache.put(cacheKey, new CachedWeather(result));
                    return result;
                }
            } catch (Exception e) {
                log.warn("[Dispatcher] Google 天气查询异常: {}", e.getMessage());
            }
            googleFailed = true;
            log.warn("[Dispatcher] Google 天气查询失败，降级到腾讯地图");
        }
        result = tencentMapService.getWeather(city);
        if ((result == null || result.isEmpty()) && amapMapService.isConfigured()) {
            log.info("[Dispatcher] 腾讯天气查询无结果，降级到高德地图: {}", city);
            List<WeatherInfo> amapResult = amapMapService.getWeather(city);
            if (amapResult != null && !amapResult.isEmpty()) {
                result = amapResult;
            }
        }
        List<WeatherInfo> finalResult = result == null ? Collections.emptyList() : result;
        weatherCache.put(cacheKey, new CachedWeather(finalResult));
        return finalResult;
    }

    public Map<String, Object> planRouteUnified(String originAddress, String destinationAddress,
                                                  String originCity, String destinationCity, String routeType) {
        if ("google".equals(getMapProvider()) && !googleFailed) {
            try {
                Map<String, Object> result = googleMapService.planRoute(originAddress, destinationAddress, originCity, destinationCity, routeType);
                if (result != null && !result.isEmpty()) {
                    return normalizeRouteResult(result, routeType);
                }
            } catch (Exception e) {
                log.warn("[Dispatcher] Google 路线规划异常: {}", e.getMessage());
            }
            googleFailed = true;
            log.warn("[Dispatcher] Google 路线规划失败，降级到腾讯地图");
        }
        Map<String, Object> result = tencentMapService.planRoute(originAddress, destinationAddress, originCity, destinationCity, routeType);
        if ((result == null || result.isEmpty()) && amapMapService.isConfigured()) {
            log.info("[Dispatcher] 腾讯路线规划无结果，降级到高德地图: {} → {}", originAddress, destinationAddress);
            Map<String, Object> amapResult = amapMapService.planRoute(originAddress, destinationAddress, originCity, destinationCity, routeType);
            if (amapResult != null && !amapResult.isEmpty()) {
                return normalizeRouteResult(amapResult, routeType);
            }
        }
        return result == null ? Collections.emptyMap() : result;
    }

    public Map<String, Object> getPoiDetailUnified(String poiId) {
        if ("google".equals(getMapProvider()) && !googleFailed) {
            try {
                Map<String, Object> result = googleMapService.getPoiDetail(poiId);
                if (result != null && !result.isEmpty()) {
                    return result;
                }
            } catch (Exception e) {
                log.warn("[Dispatcher] Google POI详情异常: {}", e.getMessage());
            }
            googleFailed = true;
            log.warn("[Dispatcher] Google POI详情失败，降级到腾讯地图");
        }
        Map<String, Object> result = tencentMapService.getPoiDetail(poiId);
        if ((result == null || result.isEmpty()) && amapMapService.isConfigured()) {
            log.info("[Dispatcher] 腾讯POI详情无结果，降级到高德地图: {}", poiId);
            Map<String, Object> amapResult = amapMapService.getPoiDetail(poiId);
            if (amapResult != null && !amapResult.isEmpty()) {
                return amapResult;
            }
        }
        return result == null ? Collections.emptyMap() : result;
    }

    public List<String> getSubCities(String region) {
        if (!amapMapService.isConfigured()) {
            return Collections.emptyList();
        }
        List<String> result = amapMapService.getSubCities(region);
        log.info("[Dispatcher] 行政区划查询: region={} subCities={}", region,
                result.isEmpty() ? "[]" : result.size() + " 个");
        return result;
    }

    private Map<String, Object> normalizeRouteResult(Map<String, Object> result, String routeType) {
        Map<String, Object> normalized = new LinkedHashMap<>();
        Object distance = result.get("distance");
        normalized.put("distance", distance instanceof Number ? ((Number) distance).doubleValue() : 0.0);
        Object duration = result.get("duration");
        normalized.put("duration", duration instanceof Number ? ((Number) duration).intValue() : 0);
        normalized.put("route_type", routeType);
        String description = (String) result.getOrDefault("description", "");
        if (description.isEmpty() && result.containsKey("distance_text")) {
            description = result.getOrDefault("distance_text", "") + ", " + result.getOrDefault("duration_text", "");
        }
        normalized.put("description", description);
        return normalized;
    }

    private record CachedWeather(List<WeatherInfo> result, long createdAt) {
        CachedWeather(List<WeatherInfo> result) {
            this(result, System.currentTimeMillis());
        }
    }
}
