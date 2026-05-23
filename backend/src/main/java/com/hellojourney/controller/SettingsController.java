package com.hellojourney.controller;

import com.hellojourney.agent.TripPlannerAgent;
import com.hellojourney.config.AppSettings;
import com.hellojourney.config.RuntimeSettingsManager;
import com.hellojourney.model.dto.RuntimeSettingsPayload;
import com.hellojourney.service.MapDispatcher;
import com.hellojourney.service.LlmService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/settings")
@RequiredArgsConstructor
@Tag(name = "系统设置", description = "运行时配置管理、LLM供应商管理")
public class SettingsController {
    private final RuntimeSettingsManager runtimeSettingsManager;
    private final LlmService llmService;
    private final MapDispatcher mapDispatcher;
    private final TripPlannerAgent tripPlannerAgent;
    private final AppSettings appSettings;

    @GetMapping("")
    @Operation(summary = "获取当前配置", description = "获取所有运行时配置项，包括地图Key、LLM供应商列表等")
    public ResponseEntity<Map<String, Object>> getSettings() {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("success", true);
        response.put("message", "ok");
        response.put("data", runtimeSettingsManager.getRuntimeSettings());
        return ResponseEntity.ok(response);
    }

    @PutMapping("")
    @Operation(summary = "保存配置", description = "更新运行时配置，保存后立即生效并持久化")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "配置保存成功"),
            @ApiResponse(responseCode = "500", description = "保存配置失败")
    })
    public ResponseEntity<Map<String, Object>> saveSettings(@RequestBody RuntimeSettingsPayload payload) {
        try {
            Map<String, Object> updates = new LinkedHashMap<>();
            if (payload.getTencentMapsKey() != null) updates.put("tencent_maps_key", payload.getTencentMapsKey());
            if (payload.getGoogleMapsApiKey() != null) updates.put("google_maps_api_key", payload.getGoogleMapsApiKey());
            if (payload.getXhsCookie() != null) updates.put("xhs_cookie", payload.getXhsCookie());
            if (payload.getLlmActiveProvider() != null) updates.put("llm_active_provider", payload.getLlmActiveProvider());
            if (payload.getLlmProviders() != null) updates.put("llm_providers", payload.getLlmProviders());

            Map<String, Object> updated = runtimeSettingsManager.updateRuntimeSettings(updates);

            llmService.reset();
            mapDispatcher.reset();
            tripPlannerAgent.reset();

            Map<String, Object> response = new LinkedHashMap<>();
            response.put("success", true);
            response.put("message", "配置已保存并立即生效");
            response.put("data", updated);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "保存配置失败: " + e.getMessage());
        }
    }

    @GetMapping("/llm-providers")
    @Operation(summary = "获取LLM供应商列表", description = "获取所有LLM供应商配置及可用状态")
    public ResponseEntity<Map<String, Object>> getLlmProviders() {
        List<Map<String, Object>> providers = (List<Map<String, Object>>) runtimeSettingsManager.getRuntimeSettings().get("llm_providers");
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("success", true);
        response.put("message", "ok");
        response.put("data", Map.of(
                "active_provider", appSettings.getLlmActiveProvider(),
                "providers", providers
        ));
        return ResponseEntity.ok(response);
    }
}
