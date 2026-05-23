package com.hellojourney.controller;

import com.hellojourney.model.dto.RouteRequest;
import com.hellojourney.model.vo.*;
import com.hellojourney.service.MapDispatcher;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/map")
@RequiredArgsConstructor
@Tag(name = "地图服务", description = "POI搜索、天气查询、路线规划")
public class MapController {
    private final MapDispatcher mapDispatcher;

    @GetMapping("/poi")
    @Operation(summary = "搜索POI兴趣点")
    public ResponseEntity<POISearchResponse> searchPoi(
            @Parameter(name = "keywords", description = "搜索关键词", required = true) @RequestParam String keywords,
            @Parameter(name = "city", description = "城市名称", required = true) @RequestParam String city,
            @Parameter(name = "citylimit", description = "是否限制城市范围") @RequestParam(defaultValue = "true") boolean citylimit) {
        try {
            var pois = mapDispatcher.searchPoiUnified(keywords, city, citylimit);
            return ResponseEntity.ok(POISearchResponse.builder()
                    .success(true).message("POI搜索成功").data(pois).build());
        } catch (Exception e) {
            log.error("POI搜索失败: {}", e.getMessage());
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "POI搜索失败: " + e.getMessage());
        }
    }

    @GetMapping("/weather")
    public ResponseEntity<WeatherResponse> getWeather(@RequestParam String city) {
        try {
            var weatherInfo = mapDispatcher.getWeatherUnified(city);
            return ResponseEntity.ok(WeatherResponse.builder()
                    .success(true).message("天气查询成功").data(weatherInfo).build());
        } catch (Exception e) {
            log.error("天气查询失败: {}", e.getMessage());
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "天气查询失败: " + e.getMessage());
        }
    }

    @PostMapping("/route")
    public ResponseEntity<RouteResponse> planRoute(@RequestBody RouteRequest request) {
        try {
            var routeInfo = mapDispatcher.planRouteUnified(
                    request.getOriginAddress(), request.getDestinationAddress(),
                    request.getOriginCity(), request.getDestinationCity(), request.getRouteType());
            RouteInfo info = RouteInfo.builder()
                    .distance((Double) routeInfo.getOrDefault("distance", 0.0))
                    .duration((Integer) routeInfo.getOrDefault("duration", 0))
                    .routeType(request.getRouteType())
                    .description((String) routeInfo.getOrDefault("description", ""))
                    .build();
            return ResponseEntity.ok(RouteResponse.builder()
                    .success(true).message("路线规划成功").data(info).build());
        } catch (Exception e) {
            log.error("路线规划失败: {}", e.getMessage());
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "路线规划失败: " + e.getMessage());
        }
    }

    @GetMapping("/health")
    @Operation(summary = "地图服务健康检查")
    public ResponseEntity<Map<String, Object>> healthCheck() {
        return ResponseEntity.ok(Map.of("status", "healthy", "service", "map-service"));
    }
}
