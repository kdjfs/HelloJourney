package com.hellojourney.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hellojourney.config.AppSettings;
import com.hellojourney.model.entity.Location;
import com.hellojourney.model.entity.WeatherInfo;
import com.hellojourney.model.vo.POIInfo;
import com.hellojourney.util.TestDataFactory;
import okhttp3.HttpUrl;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.mockwebserver.MockResponse;
import okhttp3.mockwebserver.MockWebServer;
import okhttp3.mockwebserver.RecordedRequest;
import org.junit.jupiter.api.*;

import java.lang.reflect.Field;
import java.net.InetAddress;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;

class GoogleMapServiceTest {

    private MockWebServer mockWebServer;
    private GoogleMapService googleMapService;

    @BeforeEach
    void setUp() throws Exception {
        mockWebServer = new MockWebServer();
        mockWebServer.start(InetAddress.getLoopbackAddress(), 0);

        AppSettings appSettings = TestDataFactory.buildAppSettings();
        appSettings.setGoogleMapsApiKey("test-api-key");
        ObjectMapper objectMapper = new ObjectMapper();

        googleMapService = new GoogleMapService(appSettings, objectMapper);

        OkHttpClient mockClient = new OkHttpClient.Builder()
                .addInterceptor(chain -> {
                    Request original = chain.request();
                    HttpUrl newUrl = original.url().newBuilder()
                            .host("127.0.0.1")
                            .port(mockWebServer.getPort())
                            .scheme("http")
                            .build();
                    return chain.proceed(original.newBuilder().url(newUrl).build());
                })
                .connectTimeout(15, TimeUnit.SECONDS)
                .readTimeout(15, TimeUnit.SECONDS)
                .build();

        Field httpClientField = GoogleMapService.class.getDeclaredField("httpClient");
        httpClientField.setAccessible(true);
        httpClientField.set(googleMapService, mockClient);
    }

    @AfterEach
    void tearDown() throws Exception {
        mockWebServer.shutdown();
    }

    @Nested
    @DisplayName("geocode")
    class Geocode {

        @Test
        @DisplayName("geocode success returns Location")
        void geocode_success_returnsLocation() throws Exception {
            mockWebServer.enqueue(new MockResponse()
                    .setBody("{\"results\":[{\"geometry\":{\"location\":{\"lng\":116.397128,\"lat\":39.916527}}}]}")
                    .setResponseCode(200)
                    .addHeader("Content-Type", "application/json"));

            Location result = googleMapService.geocode("故宫博物院", "北京");

            assertThat(result).isNotNull();
            assertThat(result.getLongitude()).isEqualTo(116.397128);
            assertThat(result.getLatitude()).isEqualTo(39.916527);

            RecordedRequest request = mockWebServer.takeRequest();
            assertThat(request.getPath()).contains("/maps/api/geocode/json");
            assertThat(request.getMethod()).isEqualTo("GET");
        }

        @Test
        @DisplayName("geocode no results returns null")
        void geocode_noResults_returnsNull() {
            mockWebServer.enqueue(new MockResponse()
                    .setBody("{\"results\":[],\"status\":\"ZERO_RESULTS\"}")
                    .setResponseCode(200)
                    .addHeader("Content-Type", "application/json"));

            Location result = googleMapService.geocode("不存在的地址", null);

            assertThat(result).isNull();
        }

        @Test
        @DisplayName("geocode with city appends city to address")
        void geocode_withCity_appendsCityToAddress() throws Exception {
            mockWebServer.enqueue(new MockResponse()
                    .setBody("{\"results\":[{\"geometry\":{\"location\":{\"lng\":121.473701,\"lat\":31.230416}}}]}")
                    .setResponseCode(200)
                    .addHeader("Content-Type", "application/json"));

            googleMapService.geocode("外滩", "上海");

            RecordedRequest request = mockWebServer.takeRequest();
            String decodedPath = URLDecoder.decode(request.getPath(), StandardCharsets.UTF_8);
            assertThat(decodedPath).contains("外滩, 上海");
        }
    }

    @Nested
    @DisplayName("searchPoi")
    class SearchPoi {

        @Test
        @DisplayName("searchPoi success returns POI list")
        void searchPoi_success_returnsPoiList() throws Exception {
            mockWebServer.enqueue(new MockResponse()
                    .setBody("{\"places\":[{\"id\":\"place1\",\"displayName\":{\"text\":\"故宫博物院\"},\"formattedAddress\":\"北京市东城区景山前街4号\",\"location\":{\"longitude\":116.403414,\"latitude\":39.924091},\"types\":[\"museum\",\"tourist_attraction\",\"establishment\"],\"internationalPhoneNumber\":\"+861088887777\"}]}")
                    .setResponseCode(200)
                    .addHeader("Content-Type", "application/json"));

            List<POIInfo> results = googleMapService.searchPoi("故宫", "北京", true);

            assertThat(results).hasSize(1);
            POIInfo poi = results.get(0);
            assertThat(poi.getId()).isEqualTo("place1");
            assertThat(poi.getName()).isEqualTo("故宫博物院");
            assertThat(poi.getAddress()).isEqualTo("北京市东城区景山前街4号");
            assertThat(poi.getLocation().getLongitude()).isEqualTo(116.403414);
            assertThat(poi.getLocation().getLatitude()).isEqualTo(39.924091);
            assertThat(poi.getType()).isEqualTo("museum,tourist_attraction,establishment");
            assertThat(poi.getTel()).isEqualTo("+861088887777");

            RecordedRequest request = mockWebServer.takeRequest();
            assertThat(request.getMethod()).isEqualTo("POST");
            assertThat(request.getPath()).contains("/v1/places:searchText");
        }

        @Test
        @DisplayName("searchPoi error returns empty list")
        void searchPoi_error_returnsEmptyList() {
            mockWebServer.enqueue(new MockResponse()
                    .setResponseCode(500)
                    .setBody("Internal Server Error"));

            List<POIInfo> results = googleMapService.searchPoi("故宫", "北京", false);

            assertThat(results).isEmpty();
        }
    }

    @Nested
    @DisplayName("planRoute")
    class PlanRoute {

        @Test
        @DisplayName("planRoute success returns route info")
        void planRoute_success_returnsRouteInfo() throws Exception {
            mockWebServer.enqueue(new MockResponse()
                    .setBody("{\"routes\":[{\"legs\":[{\"distance\":{\"value\":15000,\"text\":\"15.0 km\"},\"duration\":{\"value\":1800,\"text\":\"30 mins\"},\"steps\":[{\"html_instructions\":\"Head north\"},{\"html_instructions\":\"Turn right\"}]}]}]}")
                    .setResponseCode(200)
                    .addHeader("Content-Type", "application/json"));

            Map<String, Object> result = googleMapService.planRoute("天安门", "故宫", "北京", "北京", "driving");

            assertThat(result).isNotEmpty();
            assertThat(result.get("distance")).isEqualTo(15000);
            assertThat(result.get("duration")).isEqualTo(1800);
            assertThat(result.get("distance_text")).isEqualTo("15.0 km");
            assertThat(result.get("duration_text")).isEqualTo("30 mins");

            @SuppressWarnings("unchecked")
            List<String> steps = (List<String>) result.get("steps");
            assertThat(steps).hasSize(2);
            assertThat(steps.get(0)).isEqualTo("Head north");
            assertThat(steps.get(1)).isEqualTo("Turn right");

            RecordedRequest request = mockWebServer.takeRequest();
            assertThat(request.getPath()).contains("/maps/api/directions/json");
            assertThat(request.getPath()).contains("mode=driving");
        }

        @Test
        @DisplayName("planRoute no routes returns empty map")
        void planRoute_noRoutes_returnsEmptyMap() {
            mockWebServer.enqueue(new MockResponse()
                    .setBody("{\"routes\":[],\"status\":\"ZERO_RESULTS\"}")
                    .setResponseCode(200)
                    .addHeader("Content-Type", "application/json"));

            Map<String, Object> result = googleMapService.planRoute("天安门", "故宫", "北京", "北京", "walking");

            assertThat(result).isEmpty();
        }
    }

    @Nested
    @DisplayName("getPoiDetail")
    class GetPoiDetail {

        @Test
        @DisplayName("getPoiDetail success returns map")
        void getPoiDetail_success_returnsMap() throws Exception {
            mockWebServer.enqueue(new MockResponse()
                    .setBody("{\"id\":\"place1\",\"displayName\":{\"text\":\"故宫博物院\"},\"formattedAddress\":\"北京市东城区景山前街4号\",\"rating\":4.9}")
                    .setResponseCode(200)
                    .addHeader("Content-Type", "application/json"));

            Map<String, Object> result = googleMapService.getPoiDetail("place1");

            assertThat(result).isNotEmpty();
            assertThat(result.get("id")).isEqualTo("place1");

            RecordedRequest request = mockWebServer.takeRequest();
            assertThat(request.getMethod()).isEqualTo("GET");
            assertThat(request.getPath()).contains("/v1/places/place1");
        }

        @Test
        @DisplayName("getPoiDetail error returns empty map")
        void getPoiDetail_error_returnsEmptyMap() {
            mockWebServer.enqueue(new MockResponse()
                    .setResponseCode(500)
                    .setBody("Internal Server Error"));

            Map<String, Object> result = googleMapService.getPoiDetail("invalid-id");

            assertThat(result).isEmpty();
        }
    }

    @Nested
    @DisplayName("getWeather")
    class GetWeather {

        @Test
        @DisplayName("getWeather geocode fails returns empty list")
        void getWeather_geocodeFails_returnsEmptyList() {
            mockWebServer.enqueue(new MockResponse()
                    .setBody("{\"results\":[],\"status\":\"ZERO_RESULTS\"}")
                    .setResponseCode(200)
                    .addHeader("Content-Type", "application/json"));

            List<WeatherInfo> result = googleMapService.getWeather("不存在的城市");

            assertThat(result).isEmpty();
        }

        @Test
        @DisplayName("getWeather success returns weather list")
        void getWeather_success_returnsWeatherList() {
            mockWebServer.enqueue(new MockResponse()
                    .setBody("{\"results\":[{\"geometry\":{\"location\":{\"lng\":116.397128,\"lat\":39.916527}}}]}")
                    .setResponseCode(200)
                    .addHeader("Content-Type", "application/json"));
            mockWebServer.enqueue(new MockResponse()
                    .setBody("{\"forecastDays\":[{\"displayDate\":{\"year\":2025,\"month\":6,\"day\":1},\"daytimeForecast\":{\"weatherCondition\":\"CLEAR\",\"wind\":{\"direction\":{\"cardinal\":\"S\"},\"speed\":{\"value\":5.0}}},\"nighttimeForecast\":{\"weatherCondition\":\"PARTLY_CLOUDY\"},\"maxTemperature\":{\"degrees\":30},\"minTemperature\":{\"degrees\":20}}]}")
                    .setResponseCode(200)
                    .addHeader("Content-Type", "application/json"));

            List<WeatherInfo> result = googleMapService.getWeather("北京");

            assertThat(result).hasSize(1);
            WeatherInfo weather = result.get(0);
            assertThat(weather.getDate()).isEqualTo("2025-06-01");
            assertThat(weather.getDayWeather()).isEqualTo("晴");
            assertThat(weather.getNightWeather()).isEqualTo("多云");
            assertThat(weather.getDayTemp()).isEqualTo(30);
            assertThat(weather.getNightTemp()).isEqualTo(20);
            assertThat(weather.getWindDirection()).isEqualTo("S");
            assertThat(weather.getWindPower()).isEqualTo("微风");
        }
    }

    @Nested
    @DisplayName("reset")
    class Reset {

        @Test
        @DisplayName("reset no exception")
        void reset_noException() {
            assertThatCode(() -> googleMapService.reset()).doesNotThrowAnyException();
        }
    }
}
