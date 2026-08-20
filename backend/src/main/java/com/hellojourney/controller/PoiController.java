package com.hellojourney.controller;

import com.hellojourney.service.MapDispatcher;
import com.hellojourney.service.image.AttractionImageService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.LinkedHashMap;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/poi")
@RequiredArgsConstructor
public class PoiController {
    private final MapDispatcher mapDispatcher;
    private final AttractionImageService attractionImageService;

    @GetMapping("/detail/{poiId}")
    @Operation(summary = "获取POI详情", description = "根据POI ID获取详细信息")
    public ResponseEntity<Map<String, Object>> getPoiDetail(@Parameter(name = "poiId", description = "POI唯一标识", required = true) @PathVariable String poiId) {
        try {
            Map<String, Object> result = mapDispatcher.getPoiDetailUnified(poiId);
            Map<String, Object> response = new LinkedHashMap<>();
            response.put("success", true);
            response.put("message", "获取POI详情成功");
            response.put("data", result);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("获取POI详情失败: {}", e.getMessage());
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "获取POI详情失败: " + e.getMessage());
        }
    }

    @GetMapping("/search")
    @Operation(summary = "搜索POI", description = "根据关键词和城市搜索兴趣点")
    public ResponseEntity<Map<String, Object>> searchPoi(
            @Parameter(name = "keywords", description = "搜索关键词", required = true) @RequestParam String keywords,
            @Parameter(name = "city", description = "城市名称", example = "北京") @RequestParam(defaultValue = "北京") String city) {
        try {
            var result = mapDispatcher.searchPoiUnified(keywords, city, true);
            Map<String, Object> response = new LinkedHashMap<>();
            response.put("success", true);
            response.put("message", "搜索成功");
            response.put("data", result);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("搜索POI失败: {}", e.getMessage());
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "搜索POI失败: " + e.getMessage());
        }
    }

    @GetMapping("/photo")
    @Operation(summary = "获取景点图片", description = "按城市和景点POI身份解析已验证的真实景点图片")
    public ResponseEntity<Map<String, Object>> getAttractionPhoto(
            @Parameter(name = "name", description = "景点名称", required = true) @RequestParam String name,
            @Parameter(name = "city", description = "城市名称", required = true) @RequestParam String city,
            @Parameter(name = "poiId", description = "已有POI ID") @RequestParam(required = false) String poiId) {
        if (name.isBlank() || name.length() > 80 || city.isBlank() || city.length() > 80
                || poiId != null && poiId.length() > 128) {
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "message", "景点名称、城市或 POI ID 参数无效"
            ));
        }
        try {
            var data = attractionImageService.resolveImage(name, city, poiId);
            Map<String, Object> response = new LinkedHashMap<>();
            response.put("success", true);
            response.put("message", data.isVerified() ? "获取图片成功" : "暂无已验证图片");
            response.put("data", data);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("获取景点图片失败 (type={})", e.getClass().getSimpleName());
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "获取景点图片失败");
        }
    }
}
