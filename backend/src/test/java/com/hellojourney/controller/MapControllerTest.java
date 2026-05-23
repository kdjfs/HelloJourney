package com.hellojourney.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hellojourney.model.dto.RouteRequest;
import com.hellojourney.model.entity.WeatherInfo;
import com.hellojourney.model.vo.POIInfo;
import com.hellojourney.config.AppSettings;
import com.hellojourney.service.GoogleMapService;
import com.hellojourney.service.MapDispatcher;
import com.hellojourney.service.TencentMapService;
import com.hellojourney.util.TestDataFactory;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Map;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(MapController.class)
class MapControllerTest {
    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private MapDispatcher mapDispatcher;

    @MockBean
    private AppSettings appSettings;

    @MockBean
    private GoogleMapService googleMapService;

    @MockBean
    private TencentMapService tencentMapService;

    @Test
    void searchPoi_validParams_returnsPoiList() throws Exception {
        POIInfo poi = POIInfo.builder()
                .id("poi-001")
                .name("故宫博物院")
                .type("历史文化")
                .address("北京市东城区景山前街4号")
                .location(TestDataFactory.buildLocation(116.403414, 39.924091))
                .tel("010-85007114")
                .build();
        when(mapDispatcher.searchPoiUnified("故宫", "北京", true))
                .thenReturn(List.of(poi));

        mockMvc.perform(get("/api/map/poi")
                        .param("keywords", "故宫")
                        .param("city", "北京"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.message").value("POI搜索成功"))
                .andExpect(jsonPath("$.data[0].id").value("poi-001"))
                .andExpect(jsonPath("$.data[0].name").value("故宫博物院"));
    }

    @Test
    void getWeather_validCity_returnsWeather() throws Exception {
        WeatherInfo weather = TestDataFactory.buildWeatherInfo();
        when(mapDispatcher.getWeatherUnified("北京"))
                .thenReturn(List.of(weather));

        mockMvc.perform(get("/api/map/weather")
                        .param("city", "北京"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.message").value("天气查询成功"))
                .andExpect(jsonPath("$.data[0].city").value("北京"))
                .andExpect(jsonPath("$.data[0].day_weather").value("晴"));
    }

    @Test
    void planRoute_validRequest_returnsRoute() throws Exception {
        RouteRequest request = RouteRequest.builder()
                .originAddress("天安门")
                .destinationAddress("故宫博物院")
                .originCity("北京")
                .destinationCity("北京")
                .routeType("walking")
                .build();

        Map<String, Object> routeInfo = Map.of(
                "distance", 1500.0,
                "duration", 1200,
                "description", "1500米, 约1200秒"
        );
        when(mapDispatcher.planRouteUnified("天安门", "故宫博物院", "北京", "北京", "walking"))
                .thenReturn(routeInfo);

        mockMvc.perform(post("/api/map/route")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.message").value("路线规划成功"))
                .andExpect(jsonPath("$.data.distance").value(1500.0))
                .andExpect(jsonPath("$.data.duration").value(1200))
                .andExpect(jsonPath("$.data.route_type").value("walking"));
    }

    @Test
    void healthCheck_returnsHealthy() throws Exception {
        mockMvc.perform(get("/api/map/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("healthy"))
                .andExpect(jsonPath("$.service").value("map-service"));
    }
}
