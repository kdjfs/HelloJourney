package com.hellojourney.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hellojourney.config.AppSettings;
import com.hellojourney.model.entity.Location;
import com.hellojourney.model.entity.WeatherInfo;
import com.hellojourney.model.vo.POIInfo;
import lombok.extern.slf4j.Slf4j;
import okhttp3.*;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.concurrent.TimeUnit;

@Slf4j
@Service
public class GoogleMapService {
    private static final String PLACES_BASE = "https://places.googleapis.com/v1/places";
    private static final String GEOCODING_BASE = "https://maps.googleapis.com/maps/api/geocode/json";
    private static final String DIRECTIONS_BASE = "https://maps.googleapis.com/maps/api/directions/json";

    private final AppSettings appSettings;
    private final ObjectMapper objectMapper;
    private final OkHttpClient httpClient;

    public GoogleMapService(AppSettings appSettings, ObjectMapper objectMapper) {
        this.appSettings = appSettings;
        this.objectMapper = objectMapper;
        OkHttpClient.Builder builder = new OkHttpClient.Builder()
                .connectTimeout(15, TimeUnit.SECONDS)
                .readTimeout(15, TimeUnit.SECONDS);
        if (appSettings.getGoogleMapsProxy() != null && !appSettings.getGoogleMapsProxy().isEmpty()) {
        }
        this.httpClient = builder.build();
    }

    public synchronized void reset() {
    }

    public List<POIInfo> searchPoi(String keywords, String city, boolean citylimit) {
        try {
            String url = PLACES_BASE + ":searchText";
            Map<String, Object> body = new HashMap<>();
            body.put("textQuery", citylimit ? city + " " + keywords : keywords);
            body.put("languageCode", "zh-CN");

            String jsonBody = objectMapper.writeValueAsString(body);
            Request request = new Request.Builder()
                    .url(url)
                    .addHeader("Content-Type", "application/json")
                    .addHeader("X-Goog-Api-Key", appSettings.getGoogleMapsApiKey())
                    .addHeader("X-Goog-FieldMask", "places.id,places.displayName,places.formattedAddress,places.location,places.types,places.internationalPhoneNumber")
                    .post(RequestBody.create(jsonBody, MediaType.parse("application/json")))
                    .build();

            try (Response response = httpClient.newCall(request).execute()) {
                String responseBody = response.body() != null ? response.body().string() : "{}";
                JsonNode root = objectMapper.readTree(responseBody);
                List<POIInfo> results = new ArrayList<>();
                for (JsonNode place : root.path("places")) {
                    JsonNode loc = place.path("location");
                    results.add(POIInfo.builder()
                            .id(place.path("id").asText(""))
                            .name(place.path("displayName").path("text").asText(""))
                            .type(getTypesString(place.path("types")))
                            .address(place.path("formattedAddress").asText(""))
                            .location(Location.builder()
                                    .longitude(loc.path("longitude").asDouble(0))
                                    .latitude(loc.path("latitude").asDouble(0))
                                    .build())
                            .tel(place.path("internationalPhoneNumber").asText(null))
                            .build());
                }
                return results;
            }
        } catch (Exception e) {
            log.error("[Google] POI搜索失败: {}", e.getMessage());
            return Collections.emptyList();
        }
    }

    public Location geocode(String address, String city) {
        try {
            String fullAddress = city != null && !city.isEmpty() ? address + ", " + city : address;
            HttpUrl.Builder urlBuilder = HttpUrl.parse(GEOCODING_BASE).newBuilder()
                    .addQueryParameter("address", fullAddress)
                    .addQueryParameter("key", appSettings.getGoogleMapsApiKey())
                    .addQueryParameter("language", "zh-CN");

            Request request = new Request.Builder().url(urlBuilder.build()).get().build();
            try (Response response = httpClient.newCall(request).execute()) {
                String body = response.body() != null ? response.body().string() : "{}";
                JsonNode root = objectMapper.readTree(body);
                JsonNode results = root.path("results");
                if (results.isArray() && !results.isEmpty()) {
                    JsonNode loc = results.get(0).path("geometry").path("location");
                    return Location.builder()
                            .longitude(loc.path("lng").asDouble(0))
                            .latitude(loc.path("lat").asDouble(0))
                            .build();
                }
            }
        } catch (Exception e) {
            log.error("[Google] 地理编码失败 ({}): {}", address, e.getMessage());
        }
        return null;
    }

    public Map<String, Object> planRoute(String originAddress, String destinationAddress,
                                          String originCity, String destinationCity, String routeType) {
        try {
            String mode = switch (routeType) {
                case "driving" -> "driving";
                case "transit" -> "transit";
                default -> "walking";
            };
            String origin = originCity != null ? originAddress + ", " + originCity : originAddress;
            String destination = destinationCity != null ? destinationAddress + ", " + destinationCity : destinationAddress;

            HttpUrl.Builder urlBuilder = HttpUrl.parse(DIRECTIONS_BASE).newBuilder()
                    .addQueryParameter("origin", origin)
                    .addQueryParameter("destination", destination)
                    .addQueryParameter("mode", mode)
                    .addQueryParameter("key", appSettings.getGoogleMapsApiKey())
                    .addQueryParameter("language", "zh-CN");

            Request request = new Request.Builder().url(urlBuilder.build()).get().build();
            try (Response response = httpClient.newCall(request).execute()) {
                String body = response.body() != null ? response.body().string() : "{}";
                JsonNode root = objectMapper.readTree(body);
                if (root.path("routes").isArray() && !root.path("routes").isEmpty()) {
                    JsonNode leg = root.path("routes").get(0).path("legs").get(0);
                    Map<String, Object> result = new HashMap<>();
                    result.put("distance", leg.path("distance").path("value").asInt(0));
                    result.put("duration", leg.path("duration").path("value").asInt(0));
                    result.put("distance_text", leg.path("distance").path("text").asText(""));
                    result.put("duration_text", leg.path("duration").path("text").asText(""));
                    List<String> steps = new ArrayList<>();
                    for (JsonNode step : leg.path("steps")) {
                        if (steps.size() >= 5) break;
                        steps.add(step.path("html_instructions").asText(""));
                    }
                    result.put("steps", steps);
                    return result;
                }
            }
        } catch (Exception e) {
            log.error("[Google] 路线规划失败: {}", e.getMessage());
        }
        return Collections.emptyMap();
    }

    public Map<String, Object> getPoiDetail(String poiId) {
        try {
            String url = PLACES_BASE + "/" + poiId;
            Request request = new Request.Builder()
                    .url(url)
                    .addHeader("X-Goog-Api-Key", appSettings.getGoogleMapsApiKey())
                    .addHeader("X-Goog-FieldMask", "id,displayName,formattedAddress,location,types,photos,editorialSummary,rating,userRatingCount")
                    .get()
                    .build();
            try (Response response = httpClient.newCall(request).execute()) {
                String body = response.body() != null ? response.body().string() : "{}";
                return objectMapper.readValue(body, Map.class);
            }
        } catch (Exception e) {
            log.error("[Google] POI详情失败: {}", e.getMessage());
            return Collections.emptyMap();
        }
    }

    public List<WeatherInfo> getWeather(String city) {
        try {
            Location loc = geocode(city, null);
            if (loc == null) {
                log.warn("[Google] 天气查询: 无法解析城市 '{}' 的坐标", city);
                return Collections.emptyList();
            }

            String forecastUrl = "https://weather.googleapis.com/v1/forecast/days:lookup";
            HttpUrl.Builder urlBuilder = HttpUrl.parse(forecastUrl).newBuilder()
                    .addQueryParameter("key", appSettings.getGoogleMapsApiKey())
                    .addQueryParameter("location.latitude", String.valueOf(loc.getLatitude()))
                    .addQueryParameter("location.longitude", String.valueOf(loc.getLongitude()))
                    .addQueryParameter("days", "7")
                    .addQueryParameter("languageCode", "zh-CN")
                    .addQueryParameter("unitsSystem", "METRIC");

            Request request = new Request.Builder().url(urlBuilder.build()).get().build();
            try (Response response = httpClient.newCall(request).execute()) {
                String body = response.body() != null ? response.body().string() : "{}";
                JsonNode root = objectMapper.readTree(body);
                List<WeatherInfo> weatherList = new ArrayList<>();
                Map<String, String> conditionMap = Map.ofEntries(
                        Map.entry("CLEAR", "晴"), Map.entry("MOSTLY_CLEAR", "晴"),
                        Map.entry("PARTLY_CLOUDY", "多云"), Map.entry("MOSTLY_CLOUDY", "多云"),
                        Map.entry("CLOUDY", "阴"), Map.entry("OVERCAST", "阴"),
                        Map.entry("LIGHT_RAIN", "小雨"), Map.entry("RAIN", "中雨"),
                        Map.entry("MODERATE_RAIN", "中雨"), Map.entry("HEAVY_RAIN", "大雨"),
                        Map.entry("LIGHT_SNOW", "小雪"), Map.entry("SNOW", "中雪"),
                        Map.entry("HEAVY_SNOW", "大雪"), Map.entry("THUNDERSTORM", "雷阵雨"),
                        Map.entry("DRIZZLE", "毛毛雨"), Map.entry("FOG", "雾"),
                        Map.entry("HAZE", "霾"), Map.entry("WIND", "大风")
                );

                for (JsonNode dayData : root.path("forecastDays")) {
                    JsonNode dateInfo = dayData.path("displayDate");
                    String dateStr = String.format("%d-%02d-%02d",
                            dateInfo.path("year").asInt(2025),
                            dateInfo.path("month").asInt(1),
                            dateInfo.path("day").asInt(1));

                    JsonNode daytime = dayData.path("daytimeForecast");
                    JsonNode nighttime = dayData.path("nighttimeForecast");
                    JsonNode dayTempData = dayData.path("maxTemperature");
                    JsonNode nightTempData = dayData.path("minTemperature");

                    JsonNode dayWind = daytime.path("wind");
                    String windDir = dayWind.path("direction").path("cardinal").asText("");
                    double windSpeed = dayWind.path("speed").path("value").asDouble(0);
                    String windPower;
                    if (windSpeed < 6) windPower = "微风";
                    else if (windSpeed < 12) windPower = "1-2级";
                    else if (windSpeed < 20) windPower = "3级";
                    else if (windSpeed < 29) windPower = "4级";
                    else if (windSpeed < 39) windPower = "5级";
                    else windPower = "6级以上";

                    String dayCondition = daytime.path("weatherCondition").asText("");
                    String nightCondition = nighttime.path("weatherCondition").asText("");
                    String dayWeather = conditionMap.getOrDefault(dayCondition, dayCondition);
                    String nightWeather = conditionMap.getOrDefault(nightCondition, nightCondition);

                    weatherList.add(WeatherInfo.builder()
                            .date(dateStr)
                            .dayWeather(dayWeather)
                            .nightWeather(nightWeather)
                            .dayTemp(dayTempData.path("degrees").asInt(0))
                            .nightTemp(nightTempData.path("degrees").asInt(0))
                            .windDirection(windDir)
                            .windPower(windPower)
                            .build());
                }
                log.info("[Google] 天气查询成功: {}, {} 天预报", city, weatherList.size());
                return weatherList;
            }
        } catch (Exception e) {
            log.error("[Google] 天气查询失败: {}", e.getMessage());
            return Collections.emptyList();
        }
    }

    private String getTypesString(JsonNode typesNode) {
        if (!typesNode.isArray()) return "";
        List<String> types = new ArrayList<>();
        int limit = Math.min(3, typesNode.size());
        for (int i = 0; i < limit; i++) {
            types.add(typesNode.get(i).asText(""));
        }
        return String.join(",", types);
    }
}
