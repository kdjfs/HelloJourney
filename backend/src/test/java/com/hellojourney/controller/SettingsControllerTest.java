package com.hellojourney.controller;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
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
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.ArgumentMatchers.any;
import static org.assertj.core.api.Assertions.assertThat;
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
    void getSettings_neverReturnsSecrets() throws Exception {
        Map<String, Object> runtimeSettings = new LinkedHashMap<>();
        runtimeSettings.put("tencent_maps_key", "sensitive-tencent-key");
        runtimeSettings.put("google_maps_api_key", "sensitive-google-key");
        runtimeSettings.put("xhs_cookie", "sensitive-cookie");
        runtimeSettings.put("llm_active_provider", "openai");
        runtimeSettings.put("llm_providers", List.of(Map.of(
                "key", "openai",
                "api_key", "sensitive-provider-key",
                "base_url", "https://internal-provider.example/v1"
        )));
        when(runtimeSettingsManager.getRuntimeSettings()).thenReturn(runtimeSettings);

        mockMvc.perform(get("/api/settings"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.llm_active_provider").value("openai"))
                .andExpect(jsonPath("$.data.tencent_maps_key").doesNotExist())
                .andExpect(jsonPath("$.data.google_maps_api_key").doesNotExist())
                .andExpect(jsonPath("$.data.xhs_cookie").doesNotExist())
                .andExpect(jsonPath("$.data.llm_providers[0].api_key").doesNotExist())
                .andExpect(jsonPath("$.data.llm_providers[0].base_url").doesNotExist());
    }

    @Test
    void saveSettings_anonymousRequestCannotModifySecrets() throws Exception {
        RuntimeSettingsPayload payload = RuntimeSettingsPayload.builder()
                .tencentMapsKey("new-key")
                .googleMapsApiKey("new-google-key")
                .xhsCookie("new-cookie")
                .llmActiveProvider("deepseek")
                .build();

        mockMvc.perform(put("/api/settings")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(payload)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value("运行时敏感配置修改未启用"))
                .andExpect(content().string(org.hamcrest.Matchers.not(
                        org.hamcrest.Matchers.containsString("new-key"))));

        verify(runtimeSettingsManager, never()).updateRuntimeSettings(org.mockito.ArgumentMatchers.any());
    }

    @Test
    void saveSettings_enabledButMissingAdminTokenCannotModifySecrets() throws Exception {
        AppSettings.SettingsSecurityConfig security = new AppSettings.SettingsSecurityConfig();
        security.setAllowSecretUpdates(true);
        security.setAdminToken("server-only-admin-token");
        when(appSettings.getSettings()).thenReturn(security);

        mockMvc.perform(put("/api/settings")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"llm_active_provider\":\"deepseek\"}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value("无权修改运行时敏感配置"));

        verify(runtimeSettingsManager, never()).updateRuntimeSettings(any());
    }

    @Test
    void saveSettings_authorizedResponseIsSanitized() throws Exception {
        AppSettings.SettingsSecurityConfig security = new AppSettings.SettingsSecurityConfig();
        security.setAllowSecretUpdates(true);
        security.setAdminToken("server-only-admin-token");
        when(appSettings.getSettings()).thenReturn(security);
        when(runtimeSettingsManager.updateRuntimeSettings(any())).thenReturn(Map.of(
                "llm_active_provider", "deepseek",
                "llm_providers", List.of(Map.of(
                        "key", "deepseek",
                        "name", "DeepSeek",
                        "api_key", "must-not-leak",
                        "base_url", "https://internal.example",
                        "model", "model-name",
                        "configured", true
                ))
        ));

        mockMvc.perform(put("/api/settings")
                        .header("X-HelloJourney-Admin-Token", "server-only-admin-token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"llm_active_provider\":\"deepseek\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.llm_active_provider").value("deepseek"))
                .andExpect(jsonPath("$.data.llm_providers[0].configured").value(true))
                .andExpect(jsonPath("$.data.llm_providers[0].api_key").doesNotExist())
                .andExpect(jsonPath("$.data.llm_providers[0].base_url").doesNotExist());

        verify(llmService).reset();
        verify(mapDispatcher).reset();
        verify(tripPlannerAgent).reset();
    }

    @Test
    void saveSettings_errorDoesNotExposeOrLogSecret() throws Exception {
        String secret = "secret-value-that-must-not-escape";
        AppSettings.SettingsSecurityConfig security = new AppSettings.SettingsSecurityConfig();
        security.setAllowSecretUpdates(true);
        security.setAdminToken("server-only-admin-token");
        when(appSettings.getSettings()).thenReturn(security);
        when(runtimeSettingsManager.updateRuntimeSettings(any()))
                .thenThrow(new IllegalStateException("provider rejected " + secret));

        Logger logger = (Logger) LoggerFactory.getLogger(SettingsController.class);
        ListAppender<ILoggingEvent> appender = new ListAppender<>();
        appender.start();
        logger.addAppender(appender);
        try {
            mockMvc.perform(put("/api/settings")
                            .header("X-HelloJourney-Admin-Token", "server-only-admin-token")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"llm_active_provider\":\"deepseek\"}"))
                    .andExpect(status().isInternalServerError())
                    .andExpect(content().string(org.hamcrest.Matchers.not(
                            org.hamcrest.Matchers.containsString(secret))));

            assertThat(appender.list.stream()
                    .map(ILoggingEvent::getFormattedMessage)
                    .noneMatch(message -> message.contains(secret))).isTrue();
        } finally {
            logger.detachAppender(appender);
            appender.stop();
        }
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
                .andExpect(jsonPath("$.data.providers[0].name").value("GPT (OpenAI)"))
                .andExpect(jsonPath("$.data.providers[0].api_key").doesNotExist())
                .andExpect(jsonPath("$.data.providers[0].base_url").doesNotExist());
    }
}
