package com.hellojourney.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hellojourney.config.AppSettings;
import com.hellojourney.model.entity.Location;
import com.hellojourney.model.entity.WeatherInfo;
import okhttp3.mockwebserver.MockResponse;
import okhttp3.mockwebserver.MockWebServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class AmapMapServiceTest {
    private MockWebServer server;
    private AmapMapService service;
    private AppSettings settings;

    @BeforeEach
    void setUp() throws IOException {
        server = new MockWebServer();
        server.start();
        settings = new AppSettings();
        settings.getAmapMaps().setKey("amap-test-key");
        settings.getAmapMaps().setBaseUrl(server.url("/").newBuilder().host("127.0.0.1").build().toString());
        service = new AmapMapService(settings, new ObjectMapper());
    }

    @AfterEach
    void tearDown() throws IOException {
        server.shutdown();
    }

    @Test
    void geocode_validCity_returnsLocation() throws InterruptedException {
        server.enqueue(new MockResponse().setBody("{\"status\":\"1\",\"geocodes\":[{\"location\":\"104.066,30.572\"}]}"));

        Location loc = service.geocode("成都", "四川");

        assertThat(loc).isNotNull();
        assertThat(loc.getLatitude()).isEqualTo(30.572);
        assertThat(loc.getLongitude()).isEqualTo(104.066);
        var request = server.takeRequest();
        assertThat(request.getRequestUrl().encodedPath()).isEqualTo("/v3/geocode/geo");
        assertThat(request.getRequestUrl().queryParameter("address")).isEqualTo("成都");
        assertThat(request.getRequestUrl().queryParameter("key")).isEqualTo("amap-test-key");
    }

    @Test
    void geocode_invalidStatus_returnsNull() throws InterruptedException {
        server.enqueue(new MockResponse().setBody("{\"status\":\"0\",\"info\":\"INVALID_USER_KEY\",\"geocodes\":[]}"));

        Location loc = service.geocode("成都", null);

        assertThat(loc).isNull();
    }

    @Test
    void getWeather_validCity_returnsForecast() throws InterruptedException {
        server.enqueue(new MockResponse().setBody(
                "{\"status\":\"1\",\"forecasts\":[{\"casts\":["
                        + "{\"date\":\"2026-08-24\",\"dayweather\":\"多云\",\"nightweather\":\"晴\","
                        + "\"daytemp\":\"32\",\"nighttemp\":\"24\",\"daywind\":\"东南\",\"daypower\":\"2\"},"
                        + "{\"date\":\"2026-08-25\",\"dayweather\":\"小雨\",\"nightweather\":\"阴\","
                        + "\"daytemp\":\"29\",\"nighttemp\":\"22\",\"daywind\":\"北\",\"daypower\":\"3\"}"
                        + "]}]}"));

        List<WeatherInfo> result = service.getWeather("成都");

        assertThat(result).hasSize(2);
        assertThat(result.get(0).getDate()).isEqualTo("2026-08-24");
        assertThat(result.get(0).getCity()).isEqualTo("成都");
        assertThat(result.get(0).getDayWeather()).isEqualTo("多云");
        assertThat(result.get(0).getNightTempAsInt()).isEqualTo(24);
        assertThat(result.get(1).getDayTempAsInt()).isEqualTo(29);
        var request = server.takeRequest();
        assertThat(request.getRequestUrl().encodedPath()).isEqualTo("/v3/weather/weatherInfo");
        assertThat(request.getRequestUrl().queryParameter("extensions")).isEqualTo("all");
    }

    @Test
    void getWeather_failureStatus_returnsEmpty() {
        server.enqueue(new MockResponse().setBody("{\"status\":\"0\",\"info\":\"DAILY_QUERY_OVER_LIMIT\"}"));

        List<WeatherInfo> result = service.getWeather("成都");

        assertThat(result).isEmpty();
    }

    @Test
    void getSubCities_province_returnsChildren() throws InterruptedException {
        server.enqueue(new MockResponse().setBody(
                "{\"status\":\"1\",\"districts\":[{\"name\":\"四川省\",\"districts\":["
                        + "{\"name\":\"成都市\"},{\"name\":\"绵阳市\"}]}]}"));

        List<String> result = service.getSubCities("四川");

        assertThat(result).containsExactly("成都市", "绵阳市");
        var request = server.takeRequest();
        assertThat(request.getRequestUrl().encodedPath()).isEqualTo("/v3/config/district");
        assertThat(request.getRequestUrl().queryParameter("keywords")).isEqualTo("四川");
    }

    @Test
    void getSubCities_notConfigured_returnsEmpty() {
        settings.getAmapMaps().setKey("");

        List<String> result = service.getSubCities("四川");

        assertThat(result).isEmpty();
        assertThat(server.getRequestCount()).isZero();
    }

    @Test
    void planRoute_driving_returnsNormalizedResult() throws InterruptedException {
        server.enqueue(new MockResponse().setBody("{\"status\":\"1\",\"geocodes\":[{\"location\":\"113.324,23.129\"}]}"));
        server.enqueue(new MockResponse().setBody("{\"status\":\"1\",\"geocodes\":[{\"location\":\"113.271,23.135\"}]}"));
        server.enqueue(new MockResponse().setBody(
                "{\"status\":\"1\",\"route\":{\"paths\":[{\"distance\":\"5123\",\"duration\":\"1200\"}]}}"));

        Map<String, Object> result = service.planRoute("广州塔", "陈家祠", "广州", "广州", "driving");

        assertThat(result).containsEntry("distance", 5123.0);
        assertThat(result).containsEntry("duration", 1200);
        assertThat(result).containsEntry("route_type", "driving");
        assertThat(result.get("description").toString()).contains("米");
        assertThat(server.getRequestCount()).isEqualTo(3);
    }
}
