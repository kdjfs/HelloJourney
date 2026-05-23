package com.hellojourney.controller;

import com.hellojourney.config.AppSettings;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequiredArgsConstructor
@Tag(name = "系统信息", description = "系统基本信息和健康检查")
public class RootController {
    private final AppSettings appSettings;

    @GetMapping("/")
    @Operation(summary = "系统信息", description = "获取系统名称、版本等基本信息")
    public ResponseEntity<Map<String, Object>> root() {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("name", appSettings.getName());
        response.put("version", appSettings.getVersion());
        response.put("status", "running");
        response.put("docs", "/swagger-ui.html");
        return ResponseEntity.ok(response);
    }

    @GetMapping("/health")
    public ResponseEntity<Map<String, Object>> health() {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("status", "healthy");
        response.put("service", appSettings.getName());
        response.put("version", appSettings.getVersion());
        return ResponseEntity.ok(response);
    }
}
