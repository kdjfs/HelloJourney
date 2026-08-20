package com.hellojourney.service;

import com.hellojourney.config.AppSettings;
import com.hellojourney.model.entity.Location;
import com.hellojourney.model.entity.WeatherInfo;
import com.hellojourney.model.vo.POIInfo;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class MapDispatcher {
    private final AppSettings appSettings;
    private final GoogleMapService googleMapService;
    private final TencentMapService tencentMapService;
    private volatile boolean googleFailed = false;

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
        tencentMapService.reset();
        googleMapService.reset();
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
        return tencentMapService.searchPoi(keywords, city, citylimit);
    }

    public List<WeatherInfo> getWeatherUnified(String city) {
        if ("google".equals(getMapProvider()) && !googleFailed) {
            try {
                List<WeatherInfo> result = googleMapService.getWeather(city);
                if (result != null && !result.isEmpty()) {
                    return result;
                }
            } catch (Exception e) {
                log.warn("[Dispatcher] Google 天气查询异常: {}", e.getMessage());
            }
            googleFailed = true;
            log.warn("[Dispatcher] Google 天气查询失败，降级到腾讯地图");
        }
        return tencentMapService.getWeather(city);
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
        return tencentMapService.planRoute(originAddress, destinationAddress, originCity, destinationCity, routeType);
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
        return tencentMapService.getPoiDetail(poiId);
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
}
