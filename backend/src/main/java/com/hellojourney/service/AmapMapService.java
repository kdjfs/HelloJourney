package com.hellojourney.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hellojourney.config.AppSettings;
import com.hellojourney.model.entity.Location;
import com.hellojourney.model.entity.WeatherInfo;
import com.hellojourney.model.vo.POIInfo;
import lombok.extern.slf4j.Slf4j;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import org.springframework.stereotype.Service;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 高德地图 Web 服务兜底 Provider。
 *
 * 腾讯地图 Key 达到日配额（status=121）或调用失败时，由 MapDispatcher 降级到本服务。
 * 覆盖地理编码、天气、POI 搜索、POI 详情与驾车/步行路线。
 * 天气/地理编码/POI 使用 Web 服务 API（restapi.amap.com）；与景点图片 Provider 共用同一 Key。
 */
@Slf4j
@Service
public class AmapMapService {
    private final AppSettings appSettings;
    private final ObjectMapper objectMapper;
    private final OkHttpClient httpClient;

    public AmapMapService(AppSettings appSettings, ObjectMapper objectMapper) {
        this.appSettings = appSettings;
        this.objectMapper = objectMapper;
        this.httpClient = new OkHttpClient.Builder().build();
    }

    public synchronized void reset() {
    }

    public boolean isConfigured() {
        String key = appSettings.getAmapMapsKey();
        return key != null && !key.isBlank();
    }

    private final Map<String, List<String>> subCityCache = new ConcurrentHashMap<>();
    private static final long SUB_CITY_CACHE_TTL_MS = 24 * 60 * 60 * 1000L;

    /** 查询省级行政区下的城市列表（用于把「四川」这类省级请求匹配到「成都/绵阳…」）。 */
    public List<String> getSubCities(String region) {
        if (!isConfigured()) {
            return Collections.emptyList();
        }
        try {
            String baseUrl = base();
            String url = baseUrl + "/v3/config/district?keywords="
                    + URLEncoder.encode(region, StandardCharsets.UTF_8)
                    + "&subdistrict=1&extensions=base&key=" + appSettings.getAmapMapsKey();
            JsonNode root = executeJson(url.toString());
            if (root == null || !"1".equals(root.path("status").asText())) {
                return Collections.emptyList();
            }
            JsonNode children = root.path("districts").path(0).path("districts");
            List<String> names = new ArrayList<>();
            for (JsonNode child : children) {
                String name = child.path("name").asText("");
                if (!name.isEmpty()) {
                    names.add(name);
                }
            }
            List<String> result = List.copyOf(names);
            subCityCache.put(region, result);
            return result;
        } catch (Exception e) {
            log.warn("[高德地图] 行政区划查询异常: {}", e.getMessage());
            return subCityCache.getOrDefault(region, Collections.emptyList());
        }
    }

    /** 归一化 base URL：去除尾部斜杠，避免拼接出 //v3/... 双斜杠路径。 */
    private String base() {
        String base = appSettings.getAmapMapsBaseUrl();
        if (base == null || base.isBlank()) {
            return "https://restapi.amap.com";
        }
        return base.endsWith("/") ? base.substring(0, base.length() - 1) : base;
    }

    public Location geocode(String address, String city) {
        try {
            String baseUrl = base();
            StringBuilder url = new StringBuilder(baseUrl)
                    .append("/v3/geocode/geo?address=")
                    .append(URLEncoder.encode(address, StandardCharsets.UTF_8))
                    .append("&key=").append(appSettings.getAmapMapsKey());
            if (city != null && !city.isEmpty()) {
                url.append("&city=").append(URLEncoder.encode(city, StandardCharsets.UTF_8));
            }
            JsonNode root = executeJson(url.toString());
            if (root == null || !"1".equals(root.path("status").asText())) {
                log.warn("[高德地图] 地理编码失败: address={} status={} info={}",
                        address, root == null ? "n/a" : root.path("status").asText(),
                        root == null ? "n/a" : root.path("info").asText());
                return null;
            }
            JsonNode first = root.path("geocodes").path(0);
            if (first.isMissingNode()) {
                return null;
            }
            String[] lonLat = first.path("location").asText("").split(",");
            if (lonLat.length == 2) {
                double lng = Double.parseDouble(lonLat[0].trim());
                double lat = Double.parseDouble(lonLat[1].trim());
                if (lat != 0 || lng != 0) {
                    return Location.builder().latitude(lat).longitude(lng).build();
                }
            }
        } catch (Exception e) {
            log.error("[高德地图] 地理编码异常: {}", e.getMessage());
        }
        return null;
    }

    public List<WeatherInfo> getWeather(String city) {
        try {
            String cleanCity = city.split("-")[city.split("-").length - 1].trim();
            String baseUrl = base();
            String url = baseUrl + "/v3/weather/weatherInfo?city="
                    + URLEncoder.encode(cleanCity, StandardCharsets.UTF_8)
                    + "&extensions=all&key=" + appSettings.getAmapMapsKey();
            JsonNode root = executeJson(url.toString());
            if (root == null || !"1".equals(root.path("status").asText())) {
                log.warn("[高德地图] 天气查询失败: city={} status={} info={}",
                        cleanCity, root == null ? "n/a" : root.path("status").asText(),
                        root == null ? "n/a" : root.path("info").asText());
                return Collections.emptyList();
            }
            JsonNode casts = root.path("forecasts").path(0).path("casts");
            List<WeatherInfo> results = new ArrayList<>();
            for (JsonNode cast : casts) {
                String date = cast.path("date").asText("");
                if (date.isEmpty()) {
                    continue;
                }
                results.add(WeatherInfo.builder()
                        .date(date)
                        .city(cleanCity)
                        .dayWeather(cast.path("dayweather").asText(""))
                        .nightWeather(cast.path("nightweather").asText(""))
                        .dayTemp(parseIntSafe(cast.path("daytemp").asText("0")))
                        .nightTemp(parseIntSafe(cast.path("nighttemp").asText("0")))
                        .windDirection(cast.path("daywind").asText(""))
                        .windPower(cast.path("daypower").asText(""))
                        .build());
            }
            if (results.size() > 7) {
                results = results.subList(0, 7);
            }
            return results;
        } catch (Exception e) {
            log.error("[高德地图] 天气查询异常: {}", e.getMessage());
            return Collections.emptyList();
        }
    }

    public List<POIInfo> searchPoi(String keywords, String city, boolean citylimit) {
        try {
            String baseUrl = base();
            StringBuilder url = new StringBuilder(baseUrl)
                    .append("/v5/place/text?keywords=")
                    .append(URLEncoder.encode(keywords, StandardCharsets.UTF_8))
                    .append("&page_size=10&page_num=1&key=").append(appSettings.getAmapMapsKey());
            if (citylimit && city != null && !city.isEmpty()) {
                url.append("&region=").append(URLEncoder.encode(city, StandardCharsets.UTF_8));
            }
            JsonNode root = executeJson(url.toString());
            if (root == null || !"1".equals(root.path("status").asText())) {
                log.warn("[高德地图] POI搜索失败: keywords={} status={} info={}",
                        keywords, root == null ? "n/a" : root.path("status").asText(),
                        root == null ? "n/a" : root.path("info").asText());
                return Collections.emptyList();
            }
            List<POIInfo> results = new ArrayList<>();
            for (JsonNode poi : root.path("pois")) {
                String[] lonLat = poi.path("location").asText("").split(",");
                Location loc = null;
                if (lonLat.length == 2) {
                    loc = Location.builder()
                            .latitude(parseDoubleSafe(lonLat[1]))
                            .longitude(parseDoubleSafe(lonLat[0]))
                            .build();
                }
                results.add(POIInfo.builder()
                        .id(poi.path("id").asText(""))
                        .name(poi.path("name").asText(""))
                        .type(poi.path("type").asText(""))
                        .address(poi.path("address").asText(""))
                        .location(loc)
                        .tel(poi.path("tel").isMissingNode() ? null : poi.path("tel").asText(null))
                        .build());
            }
            return results;
        } catch (Exception e) {
            log.error("[高德地图] POI搜索异常: {}", e.getMessage());
            return Collections.emptyList();
        }
    }

    public Map<String, Object> getPoiDetail(String poiId) {
        try {
            String baseUrl = base();
            String url = baseUrl + "/v5/place/detail?place_id="
                    + URLEncoder.encode(poiId, StandardCharsets.UTF_8)
                    + "&key=" + appSettings.getAmapMapsKey();
            JsonNode root = executeJson(url);
            if (root == null || !"1".equals(root.path("status").asText())) {
                return Collections.emptyMap();
            }
            JsonNode pois = root.path("pois");
            if (pois.isArray() && pois.size() > 0) {
                return objectMapper.convertValue(pois.get(0), Map.class);
            }
            return Collections.emptyMap();
        } catch (Exception e) {
            log.error("[高德地图] POI详情异常: {}", e.getMessage());
            return Collections.emptyMap();
        }
    }

    public Map<String, Object> planRoute(String originAddress, String destinationAddress,
                                          String originCity, String destinationCity, String routeType) {
        try {
            Location originLoc = geocode(originAddress, originCity);
            Location destLoc = geocode(destinationAddress, destinationCity);
            if (originLoc == null || destLoc == null) {
                log.warn("[高德地图] 路线规划: 无法解析起终点坐标");
                return Collections.emptyMap();
            }
            String mode = "driving".equals(routeType) ? "driving" : "walking";
            String baseUrl = base();
            StringBuilder url = new StringBuilder(baseUrl)
                    .append("/v3/direction/").append(mode)
                    .append("?origin=").append(originLoc.getLongitude()).append(",").append(originLoc.getLatitude())
                    .append("&destination=").append(destLoc.getLongitude()).append(",").append(destLoc.getLatitude())
                    .append("&key=").append(appSettings.getAmapMapsKey());
            JsonNode root = executeJson(url.toString());
            if (root == null || !"1".equals(root.path("status").asText())) {
                return Collections.emptyMap();
            }
            JsonNode path = root.path("route").path("paths").path(0);
            Map<String, Object> result = new HashMap<>();
            double distance = path.path("distance").asDouble(0);
            int duration = path.path("duration").asInt(0);
            result.put("distance", distance);
            result.put("duration", duration);
            result.put("route_type", routeType);
            result.put("description", Math.round(distance) + "米, 约" + Math.round(duration / 60.0) + "分钟");
            return result;
        } catch (Exception e) {
            log.error("[高德地图] 路线规划异常: {}", e.getMessage());
            return Collections.emptyMap();
        }
    }

    private JsonNode executeJson(String url) {
        Request request = new Request.Builder().url(url).get().build();
        try (Response response = httpClient.newCall(request).execute()) {
            String body = response.body() != null ? response.body().string() : "{}";
            return objectMapper.readTree(body);
        } catch (Exception e) {
            log.error("[高德地图] 请求异常: {}", e.getMessage());
            return null;
        }
    }

    private int parseIntSafe(String value) {
        try {
            return Integer.parseInt(value.trim());
        } catch (Exception e) {
            return 0;
        }
    }

    private double parseDoubleSafe(String value) {
        try {
            return Double.parseDouble(value.trim());
        } catch (Exception e) {
            return 0;
        }
    }
}
