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

@Slf4j
@Service
public class TencentMapService {
    private final AppSettings appSettings;
    private final ObjectMapper objectMapper;
    private final OkHttpClient httpClient;

    public TencentMapService(AppSettings appSettings, ObjectMapper objectMapper) {
        this.appSettings = appSettings;
        this.objectMapper = objectMapper;
        this.httpClient = new OkHttpClient.Builder().build();
    }

    public synchronized void reset() {
    }

    public List<POIInfo> searchPoi(String keywords, String city, boolean citylimit) {
        try {
            String boundary = "";
            if (citylimit && city != null && !city.isEmpty()) {
                Location cityLoc = geocode(city, null);
                if (cityLoc != null) {
                    boundary = "&boundary=nearby(" + cityLoc.getLatitude() + "," + cityLoc.getLongitude() + ",50000)";
                }
            }

            String url = "https://apis.map.qq.com/ws/place/v1/search"
                    + "?keyword=" + URLEncoder.encode(keywords, StandardCharsets.UTF_8)
                    + boundary
                    + "&page_size=10"
                    + "&page_index=1"
                    + "&key=" + appSettings.getTencentMapsKey()
                    + "&output=json";

            Request request = new Request.Builder().url(url).get().build();
            try (Response response = httpClient.newCall(request).execute()) {
                String body = response.body() != null ? response.body().string() : "{}";
                JsonNode root = objectMapper.readTree(body);
                List<POIInfo> results = new ArrayList<>();
                JsonNode data = root.path("data");
                for (JsonNode poi : data) {
                    JsonNode locNode = poi.path("location");
                    Location loc = Location.builder()
                            .latitude(locNode.path("lat").asDouble(0))
                            .longitude(locNode.path("lng").asDouble(0))
                            .build();
                    results.add(POIInfo.builder()
                            .id(poi.path("id").asText(""))
                            .name(poi.path("title").asText(""))
                            .type(poi.path("category").asText(""))
                            .address(poi.path("address").asText(""))
                            .location(loc)
                            .tel(poi.path("tel").asText(null))
                            .build());
                }
                return results;
            }
        } catch (Exception e) {
            log.error("[腾讯地图] POI搜索失败: {}", e.getMessage());
            return Collections.emptyList();
        }
    }

    public List<WeatherInfo> getWeather(String city) {
        try {
            String cleanCity = city.split("-")[city.split("-").length - 1].trim();
            Location loc = geocode(cleanCity, null);
            if (loc == null) {
                log.warn("[腾讯地图] 天气查询: 无法解析城市 '{}' 的坐标", cleanCity);
                return Collections.emptyList();
            }

            String url = "https://apis.map.qq.com/ws/weather/v1"
                    + "?latitude=" + loc.getLatitude()
                    + "&longitude=" + loc.getLongitude()
                    + "&key=" + appSettings.getTencentMapsKey();

            Request request = new Request.Builder().url(url).get().build();
            try (Response response = httpClient.newCall(request).execute()) {
                String body = response.body() != null ? response.body().string() : "{}";
                JsonNode root = objectMapper.readTree(body);
                List<WeatherInfo> results = new ArrayList<>();
                JsonNode forecast24h = root.path("result").path("forecast_24h");
                if (forecast24h.isObject()) {
                    Iterator<Map.Entry<String, JsonNode>> fields = forecast24h.fields();
                    Map<String, WeatherInfo> dailyWeather = new LinkedHashMap<>();
                    while (fields.hasNext()) {
                        Map.Entry<String, JsonNode> entry = fields.next();
                        JsonNode hourData = entry.getValue();
                        String date = hourData.path("date").asText("");
                        if (date.isEmpty()) continue;

                        WeatherInfo existing = dailyWeather.get(date);
                        String weatherDesc = hourData.path("weather").asText("");
                        int temp = hourData.path("temperature").asInt(0);
                        String windDir = hourData.path("wind_direction").asText("");
                        String windPower = hourData.path("wind_power").asText("");

                        if (existing == null) {
                            existing = WeatherInfo.builder()
                                    .date(date)
                                    .city(cleanCity)
                                    .dayWeather(weatherDesc)
                                    .nightWeather(weatherDesc)
                                    .dayTemp(temp)
                                    .nightTemp(temp)
                                    .windDirection(windDir)
                                    .windPower(windPower)
                                    .build();
                            dailyWeather.put(date, existing);
                        } else {
                            int hour = hourData.path("time").asInt(0);
                            if (hour >= 6 && hour <= 18) {
                                existing.setDayWeather(weatherDesc);
                                existing.setDayTemp(Math.max(temp, existing.getDayTempAsInt()));
                                if (windDir != null && !windDir.isEmpty()) existing.setWindDirection(windDir);
                            } else {
                                existing.setNightWeather(weatherDesc);
                                existing.setNightTemp(Math.min(temp, existing.getNightTempAsInt()));
                            }
                        }
                    }
                    results.addAll(dailyWeather.values());
                    if (results.size() > 7) {
                        results = results.subList(0, 7);
                    }
                }
                return results;
            }
        } catch (Exception e) {
            log.error("[腾讯地图] 天气查询失败: {}", e.getMessage());
            return Collections.emptyList();
        }
    }

    public Map<String, Object> planRoute(String originAddress, String destinationAddress,
                                          String originCity, String destinationCity, String routeType) {
        try {
            Location originLoc = geocode(originAddress, originCity);
            Location destLoc = geocode(destinationAddress, destinationCity);
            if (originLoc == null || destLoc == null) {
                log.warn("[腾讯地图] 路线规划: 无法解析起终点坐标");
                return Collections.emptyMap();
            }

            String mode = switch (routeType) {
                case "driving" -> "driving";
                case "transit" -> "transit";
                default -> "walking";
            };

            String url = "https://apis.map.qq.com/ws/direction/v1/" + mode
                    + "?from=" + originLoc.getLatitude() + "," + originLoc.getLongitude()
                    + "&to=" + destLoc.getLatitude() + "," + destLoc.getLongitude()
                    + "&key=" + appSettings.getTencentMapsKey()
                    + "&output=json";

            if ("transit".equals(mode) && originCity != null && !originCity.isEmpty()) {
                url += "&city=" + URLEncoder.encode(originCity, StandardCharsets.UTF_8);
            }

            Request request = new Request.Builder().url(url).get().build();
            try (Response response = httpClient.newCall(request).execute()) {
                String body = response.body() != null ? response.body().string() : "{}";
                JsonNode root = objectMapper.readTree(body);
                Map<String, Object> result = new HashMap<>();
                JsonNode resultNode = root.path("result");
                JsonNode routes = resultNode.path("routes");

                if ("driving".equals(mode) && routes.isArray() && !routes.isEmpty()) {
                    JsonNode route = routes.get(0);
                    result.put("distance", route.path("distance").asDouble(0));
                    result.put("duration", route.path("duration").asInt(0));
                    result.put("route_type", routeType);
                    result.put("description", route.path("distance").asText("") + "米, 约" + route.path("duration").asText("") + "秒");
                } else if ("walking".equals(mode)) {
                    result.put("distance", resultNode.path("distance").asDouble(0));
                    result.put("duration", resultNode.path("duration").asInt(0));
                    result.put("route_type", routeType);
                    result.put("description", resultNode.path("distance").asText("") + "米, 约" + resultNode.path("duration").asText("") + "秒");
                } else if ("transit".equals(mode) && routes.isArray() && !routes.isEmpty()) {
                    JsonNode route = routes.get(0);
                    result.put("distance", route.path("distance").asDouble(0));
                    result.put("duration", route.path("duration").asInt(0));
                    result.put("route_type", routeType);
                    result.put("description", route.path("distance").asText("") + "米, 约" + route.path("duration").asText("") + "秒");
                }
                return result;
            }
        } catch (Exception e) {
            log.error("[腾讯地图] 路线规划失败: {}", e.getMessage());
            return Collections.emptyMap();
        }
    }

    public Location geocode(String address, String city) {
        try {
            StringBuilder urlBuilder = new StringBuilder("https://apis.map.qq.com/ws/geocoder/v1")
                    .append("?address=").append(URLEncoder.encode(address, StandardCharsets.UTF_8))
                    .append("&key=").append(appSettings.getTencentMapsKey())
                    .append("&output=json");
            if (city != null && !city.isEmpty()) {
                urlBuilder.append("&region=").append(URLEncoder.encode(city, StandardCharsets.UTF_8));
            }

            Request request = new Request.Builder().url(urlBuilder.toString()).get().build();
            try (Response response = httpClient.newCall(request).execute()) {
                String body = response.body() != null ? response.body().string() : "{}";
                JsonNode root = objectMapper.readTree(body);
                JsonNode loc = root.path("result").path("location");
                double lat = loc.path("lat").asDouble(0);
                double lng = loc.path("lng").asDouble(0);
                if (lat != 0 || lng != 0) {
                    return Location.builder().latitude(lat).longitude(lng).build();
                }
            }
        } catch (Exception e) {
            log.error("[腾讯地图] 地理编码失败: {}", e.getMessage());
        }
        return null;
    }

    public Map<String, Object> getPoiDetail(String poiId) {
        try {
            String url = "https://apis.map.qq.com/ws/place/v1/detail"
                    + "?id=" + poiId
                    + "&key=" + appSettings.getTencentMapsKey()
                    + "&output=json";

            Request request = new Request.Builder().url(url).get().build();
            try (Response response = httpClient.newCall(request).execute()) {
                String body = response.body() != null ? response.body().string() : "{}";
                JsonNode root = objectMapper.readTree(body);
                JsonNode data = root.path("data");
                if (!data.isMissingNode() && !data.isNull()) {
                    return objectMapper.convertValue(data, Map.class);
                }
                return Collections.emptyMap();
            }
        } catch (Exception e) {
            log.error("[腾讯地图] 获取POI详情失败: {}", e.getMessage());
            return Collections.emptyMap();
        }
    }
}
