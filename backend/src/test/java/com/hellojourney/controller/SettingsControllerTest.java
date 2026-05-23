package com.hellojourney.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hellojourney.agent.TripPlannerAgent;
import com.hellojourney.config.AppSettings;
import com.hellojourney.config.RuntimeSettingsManager;
import com.hellojourney.model.dto.RuntimeSettingsPayload;
import com.hellojourney.service.GoogleMapService;
import com.hellojourney.service.LlmService;
import com.hellojourney.service.MapDispatcher;
import com.hellojourney.service.TencentMapService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(SettingsController.class)
class SettingsControllerTest {
    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private RuntimeSettingsManager runtimeSettingsManager;

    @MockBean
    private LlmService llmService;

    @MockBean
    private MapDispatcher mapDispatcher;

    @MockBean
    private GoogleMapService googleMapService;

    @MockBean
    private TencentMapService tencentMapService;

    @MockBean
    private TripPlannerAgent tripPlannerAgent;

    @MockBean
    private AppSettings appSettings;

    @Test
    void getSettings_returnsRuntimeConfig() throws Exception {
        Map<String, Object> runtimeSettings = new LinkedHashMap<>();
        runtimeSettings.put("tencent_maps_key", "test-key");
        runtimeSettings.put("google_maps_api_key", "");
        runtimeSettings.put("xhs_cookie", "");
        runtimeSettings.put("llm_active_provider", "openai");
        runtimeSettings.put("llm_providers", List.of());
        when(runtimeSettingsManager.getRuntimeSettings()).thenReturn(runtimeSettings);

        mockMvc.perform(get("/api/settings"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.tencent_maps_key").value("test-key"))
                .andExpect(jsonPath("$.data.llm_active_provider").value("openai"));
    }

    @Test
    void saveSettings_validPayload_returnsUpdatedConfig() throws Exception {
        RuntimeSettingsPayload payload = RuntimeSettingsPayload.builder()
                .tencentMapsKey("new-key")
                .googleMapsApiKey("new-google-key")
                .xhsCookie("new-cookie")
                .llmActiveProvider("deepseek")
                .build();

        Map<String, Object> updatedSettings = new LinkedHashMap<>();
        updatedSettings.put("tencent_maps_key", "new-key");
        updatedSettings.put("google_maps_api_key", "new-google-key");
        updatedSettings.put("xhs_cookie", "new-cookie");
        updatedSettings.put("llm_active_provider", "deepseek");
        updatedSettings.put("llm_providers", List.of());
        when(runtimeSettingsManager.updateRuntimeSettings(any())).thenReturn(updatedSettings);

        mockMvc.perform(put("/api/settings")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(payload)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.message").value("配置已保存并立即生效"))
                .andExpect(jsonPath("$.data.tencent_maps_key").value("new-key"));

        verify(llmService).reset();
        verify(mapDispatcher).reset();
        verify(tripPlannerAgent).reset();
    }

    @Test
    void getLlmProviders_returnsProviderList() throws Exception {
        Map<String, Object> providerMap = new LinkedHashMap<>();
        providerMap.put("key", "openai");
        providerMap.put("name", "GPT (OpenAI)");
        providerMap.put("api_key", "sk-xxx");
        providerMap.put("base_url", "https://api.openai.com/v1");
        providerMap.put("model", "gpt-4");
        providerMap.put("available", true);

        Map<String, Object> runtimeSettings = new LinkedHashMap<>();
        runtimeSettings.put("llm_providers", List.of(providerMap));
        when(runtimeSettingsManager.getRuntimeSettings()).thenReturn(runtimeSettings);
        when(appSettings.getLlmActiveProvider()).thenReturn("openai");

        mockMvc.perform(get("/api/settings/llm-providers"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.active_provider").value("openai"))
                .andExpect(jsonPath("$.data.providers[0].key").value("openai"))
                .andExpect(jsonPath("$.data.providers[0].name").value("GPT (OpenAI)"));
    }
}
