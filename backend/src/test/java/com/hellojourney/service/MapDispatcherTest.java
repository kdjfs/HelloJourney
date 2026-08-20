package com.hellojourney.service;

import com.hellojourney.config.AppSettings;
import com.hellojourney.model.entity.Location;
import com.hellojourney.model.entity.WeatherInfo;
import com.hellojourney.model.vo.POIInfo;
import com.hellojourney.util.TestDataFactory;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.lang.reflect.Field;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class MapDispatcherTest {

    @Mock
    private AppSettings appSettings;

    @Mock
    private GoogleMapService googleMapService;

    @Mock
    private TencentMapService tencentMapService;

    @InjectMocks
    private MapDispatcher mapDispatcher;

    private void resetGoogleFailed() throws Exception {
        Field field = MapDispatcher.class.getDeclaredField("googleFailed");
        field.setAccessible(true);
        field.set(mapDispatcher, false);
    }

    @Nested
    @DisplayName("Map provider selection")
    class MapProvider {

        @Test
        @DisplayName("Google key present returns google")
        void getMapProvider_googleKeyPresent_returnsGoogle() {
            when(appSettings.getGoogleMapsApiKey()).thenReturn("test-google-key");

            String provider = mapDispatcher.getMapProvider();

            assertThat(provider).isEqualTo("google");
        }

        @Test
        @DisplayName("Google key absent returns tencent")
        void getMapProvider_googleKeyAbsent_returnsTencent() {
            when(appSettings.getGoogleMapsApiKey()).thenReturn("");

            String provider = mapDispatcher.getMapProvider();

            assertThat(provider).isEqualTo("tencent");
        }
    }

    @Nested
    @DisplayName("Unified geocode")
    class GeocodeUnified {

        @BeforeEach
        void setUp() throws Exception {
            resetGoogleFailed();
        }

        @Test
        @DisplayName("Google succeeds returns Google result")
        void geocodeUnified_googleSucceeds_returnsGoogleResult() {
            when(appSettings.getGoogleMapsApiKey()).thenReturn("test-key");
            Location googleLoc = TestDataFactory.buildLocation(121.4737, 31.2304);
            when(googleMapService.geocode(anyString(), anyString())).thenReturn(googleLoc);

            Map<String, Double> result = mapDispatcher.geocodeUnified("外滩", "上海", "外滩", "The Bund");

            assertThat(result.get("longitude")).isEqualTo(121.4737);
            assertThat(result.get("latitude")).isEqualTo(31.2304);
            verify(googleMapService).geocode(anyString(), eq("上海"));
            verifyNoInteractions(tencentMapService);
        }

        @Test
        @DisplayName("Google fails falls back to Tencent")
        void geocodeUnified_googleFails_fallsBackToTencent() {
            when(appSettings.getGoogleMapsApiKey()).thenReturn("test-key");
            when(googleMapService.geocode(anyString(), anyString())).thenReturn(null);
            Location tencentLoc = TestDataFactory.buildLocation(116.397128, 39.916527);
            when(tencentMapService.geocode(anyString(), anyString())).thenReturn(tencentLoc);

            Map<String, Double> result = mapDispatcher.geocodeUnified("故宫", "北京", "故宫", "Forbidden City");

            assertThat(result.get("longitude")).isEqualTo(116.397128);
            assertThat(result.get("latitude")).isEqualTo(39.916527);
            verify(googleMapService).geocode(anyString(), anyString());
            verify(tencentMapService).geocode(anyString(), anyString());
        }

        @Test
        @DisplayName("Google fails sets flag subsequent calls skip Google")
        void geocodeUnified_googleFails_setsFlag_subsequentCallsSkipGoogle() throws Exception {
            when(appSettings.getGoogleMapsApiKey()).thenReturn("test-key");
            when(googleMapService.geocode(anyString(), anyString())).thenReturn(null);
            Location tencentLoc = TestDataFactory.buildLocation(116.397128, 39.916527);
            when(tencentMapService.geocode(anyString(), anyString())).thenReturn(tencentLoc);

            mapDispatcher.geocodeUnified("故宫", "北京", "故宫", "Forbidden City");

            reset(googleMapService);
            reset(tencentMapService);
            when(tencentMapService.geocode(anyString(), anyString())).thenReturn(tencentLoc);

            mapDispatcher.geocodeUnified("长城", "北京", "长城", "Great Wall");

            verifyNoInteractions(googleMapService);
            verify(tencentMapService).geocode(anyString(), anyString());
        }

        @Test
        @DisplayName("Both fail returns empty unverified result")
        void geocodeUnified_bothFail_returnsEmptyResult() {
            when(appSettings.getGoogleMapsApiKey()).thenReturn("test-key");
            when(googleMapService.geocode(anyString(), anyString())).thenReturn(null);
            when(tencentMapService.geocode(anyString(), anyString())).thenReturn(null);

            Map<String, Double> result = mapDispatcher.geocodeUnified("test", "city", "test", "test");

            assertThat(result).isEmpty();
        }

        @Test
        @DisplayName("English address provided Google receives English")
        void geocodeUnified_addressEnProvided_googleReceivesEnglish() {
            when(appSettings.getGoogleMapsApiKey()).thenReturn("test-key");
            Location loc = TestDataFactory.buildLocation();
            when(googleMapService.geocode(anyString(), anyString())).thenReturn(loc);

            mapDispatcher.geocodeUnified("故宫", "北京", "故宫", "Forbidden City");

            verify(googleMapService).geocode(eq("Forbidden City"), eq("北京"));
        }

        @Test
        @DisplayName("Chinese address provided Tencent receives Chinese")
        void geocodeUnified_addressZhProvided_tencentReceivesChinese() {
            when(appSettings.getGoogleMapsApiKey()).thenReturn("");
            Location loc = TestDataFactory.buildLocation();
            when(tencentMapService.geocode(anyString(), anyString())).thenReturn(loc);

            mapDispatcher.geocodeUnified("故宫", "北京", "故宫", "Forbidden City");

            verify(tencentMapService).geocode(eq("故宫"), eq("北京"));
        }
    }

    @Nested
    @DisplayName("Unified POI search")
    class SearchPoiUnified {

        @BeforeEach
        void setUp() throws Exception {
            resetGoogleFailed();
        }

        @Test
        @DisplayName("Google succeeds returns Google result")
        void searchPoiUnified_googleSucceeds_returnsGoogleResult() {
            when(appSettings.getGoogleMapsApiKey()).thenReturn("test-key");
            POIInfo poi = POIInfo.builder().id("g-001").name("故宫").build();
            when(googleMapService.searchPoi("故宫", "北京", true)).thenReturn(List.of(poi));

            List<POIInfo> result = mapDispatcher.searchPoiUnified("故宫", "北京", true);

            assertThat(result).hasSize(1);
            assertThat(result.get(0).getName()).isEqualTo("故宫");
            verifyNoInteractions(tencentMapService);
        }

        @Test
        @DisplayName("Google empty falls back to Tencent")
        void searchPoiUnified_googleEmpty_fallsBackToTencent() {
            when(appSettings.getGoogleMapsApiKey()).thenReturn("test-key");
            when(googleMapService.searchPoi("故宫", "北京", true)).thenReturn(List.of());
            POIInfo poi = POIInfo.builder().id("t-001").name("故宫博物院").build();
            when(tencentMapService.searchPoi("故宫", "北京", true)).thenReturn(List.of(poi));

            List<POIInfo> result = mapDispatcher.searchPoiUnified("故宫", "北京", true);

            assertThat(result).hasSize(1);
            assertThat(result.get(0).getName()).isEqualTo("故宫博物院");
        }

        @Test
        @DisplayName("No Google key uses Tencent directly")
        void searchPoiUnified_noGoogleKey_usesTencent() {
            when(appSettings.getGoogleMapsApiKey()).thenReturn("");
            POIInfo poi = POIInfo.builder().id("t-001").name("故宫").build();
            when(tencentMapService.searchPoi("故宫", "北京", true)).thenReturn(List.of(poi));

            List<POIInfo> result = mapDispatcher.searchPoiUnified("故宫", "北京", true);

            assertThat(result).hasSize(1);
            verifyNoInteractions(googleMapService);
        }
    }

    @Nested
    @DisplayName("Unified weather")
    class GetWeatherUnified {

        @BeforeEach
        void setUp() throws Exception {
            resetGoogleFailed();
        }

        @Test
        @DisplayName("Google succeeds returns Google result")
        void getWeatherUnified_googleSucceeds_returnsGoogleResult() {
            when(appSettings.getGoogleMapsApiKey()).thenReturn("test-key");
            WeatherInfo weather = TestDataFactory.buildWeatherInfo();
            when(googleMapService.getWeather("北京")).thenReturn(List.of(weather));

            List<WeatherInfo> result = mapDispatcher.getWeatherUnified("北京");

            assertThat(result).hasSize(1);
            verifyNoInteractions(tencentMapService);
        }

        @Test
        @DisplayName("Google fails falls back to Tencent")
        void getWeatherUnified_googleFails_fallsBackToTencent() {
            when(appSettings.getGoogleMapsApiKey()).thenReturn("test-key");
            when(googleMapService.getWeather("北京")).thenReturn(List.of());
            WeatherInfo weather = TestDataFactory.buildWeatherInfo();
            when(tencentMapService.getWeather("北京")).thenReturn(List.of(weather));

            List<WeatherInfo> result = mapDispatcher.getWeatherUnified("北京");

            assertThat(result).hasSize(1);
        }
    }

    @Nested
    @DisplayName("Unified route planning")
    class PlanRouteUnified {

        @BeforeEach
        void setUp() throws Exception {
            resetGoogleFailed();
        }

        @Test
        @DisplayName("Google succeeds returns normalized result")
        void planRouteUnified_googleSucceeds_returnsNormalizedResult() {
            when(appSettings.getGoogleMapsApiKey()).thenReturn("test-key");
            Map<String, Object> googleResult = Map.of(
                    "distance", 1500, "duration", 1200,
                    "distance_text", "1.5 km", "duration_text", "20 mins"
            );
            when(googleMapService.planRoute("天安门", "故宫", "北京", "北京", "walking"))
                    .thenReturn(googleResult);

            Map<String, Object> result = mapDispatcher.planRouteUnified("天安门", "故宫", "北京", "北京", "walking");

            assertThat(result.get("distance")).isEqualTo(1500.0);
            assertThat(result.get("duration")).isEqualTo(1200);
            assertThat(result.get("route_type")).isEqualTo("walking");
            assertThat(result.get("description")).isEqualTo("1.5 km, 20 mins");
            verifyNoInteractions(tencentMapService);
        }

        @Test
        @DisplayName("Google fails falls back to Tencent")
        void planRouteUnified_googleFails_fallsBackToTencent() {
            when(appSettings.getGoogleMapsApiKey()).thenReturn("test-key");
            when(googleMapService.planRoute(anyString(), anyString(), anyString(), anyString(), anyString()))
                    .thenReturn(Map.of());
            Map<String, Object> tencentResult = Map.of(
                    "distance", 1500.0, "duration", 1200,
                    "route_type", "walking", "description", "1500米"
            );
            when(tencentMapService.planRoute("天安门", "故宫", "北京", "北京", "walking"))
                    .thenReturn(tencentResult);

            Map<String, Object> result = mapDispatcher.planRouteUnified("天安门", "故宫", "北京", "北京", "walking");

            assertThat(result.get("distance")).isEqualTo(1500.0);
        }
    }

    @Nested
    @DisplayName("Unified POI detail")
    class GetPoiDetailUnified {

        @BeforeEach
        void setUp() throws Exception {
            resetGoogleFailed();
        }

        @Test
        @DisplayName("Google succeeds returns Google result")
        void getPoiDetailUnified_googleSucceeds_returnsGoogleResult() {
            when(appSettings.getGoogleMapsApiKey()).thenReturn("test-key");
            Map<String, Object> googleResult = Map.of("id", "g-001", "name", "故宫");
            when(googleMapService.getPoiDetail("g-001")).thenReturn(googleResult);

            Map<String, Object> result = mapDispatcher.getPoiDetailUnified("g-001");

            assertThat(result.get("id")).isEqualTo("g-001");
            verifyNoInteractions(tencentMapService);
        }

        @Test
        @DisplayName("Google fails falls back to Tencent")
        void getPoiDetailUnified_googleFails_fallsBackToTencent() {
            when(appSettings.getGoogleMapsApiKey()).thenReturn("test-key");
            when(googleMapService.getPoiDetail("t-001")).thenReturn(Map.of());
            Map<String, Object> tencentResult = Map.of("id", "t-001", "title", "故宫");
            when(tencentMapService.getPoiDetail("t-001")).thenReturn(tencentResult);

            Map<String, Object> result = mapDispatcher.getPoiDetailUnified("t-001");

            assertThat(result.get("id")).isEqualTo("t-001");
        }
    }

    @Nested
    @DisplayName("Reset")
    class Reset {

        @Test
        @DisplayName("Reset clears googleFailed flag and delegates to services")
        void reset_clearsFlagAndDelegates() throws Exception {
            when(appSettings.getGoogleMapsApiKey()).thenReturn("test-key");
            when(googleMapService.geocode(anyString(), anyString())).thenReturn(null);
            when(tencentMapService.geocode(anyString(), anyString())).thenReturn(TestDataFactory.buildLocation());

            mapDispatcher.geocodeUnified("test", "city", "test", "test");

            Field field = MapDispatcher.class.getDeclaredField("googleFailed");
            field.setAccessible(true);
            assertThat((boolean) field.get(mapDispatcher)).isTrue();

            mapDispatcher.reset();

            assertThat((boolean) field.get(mapDispatcher)).isFalse();
            verify(tencentMapService).reset();
            verify(googleMapService).reset();
        }
    }
}
