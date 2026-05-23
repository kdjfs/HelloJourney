package com.hellojourney.controller;

import com.hellojourney.service.MapDispatcher;
import com.hellojourney.service.XhsService;
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
    private final XhsService xhsService;

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
    @Operation(summary = "获取景点图片", description = "从小红书获取景点封面图片URL")
    public ResponseEntity<Map<String, Object>> getAttractionPhoto(
            @Parameter(name = "name", description = "景点名称", required = true) @RequestParam String name,
            @Parameter(name = "city", description = "城市名称") @RequestParam(required = false) String city) {
        try {
            String queryKw = name + " 风景";
            String photoUrl = xhsService.getPhotoFromXhs(queryKw);
            if (photoUrl == null || photoUrl.isEmpty()) {
                photoUrl = "";
            }
            Map<String, Object> data = new LinkedHashMap<>();
            data.put("name", name);
            data.put("photo_url", photoUrl);
            Map<String, Object> response = new LinkedHashMap<>();
            response.put("success", true);
            response.put("message", "获取图片成功");
            response.put("data", data);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("获取景点图片失败: {}", e.getMessage());
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "获取景点图片失败: " + e.getMessage());
        }
    }
}
