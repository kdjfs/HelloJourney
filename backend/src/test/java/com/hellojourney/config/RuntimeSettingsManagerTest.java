package com.hellojourney.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hellojourney.util.TestDataFactory;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;

import java.io.File;
import java.lang.reflect.Field;
import java.nio.file.Path;
import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class RuntimeSettingsManagerTest {

    @Mock
    private AppSettings appSettings;

    @Spy
    private ObjectMapper objectMapper = new ObjectMapper();

    @InjectMocks
    private RuntimeSettingsManager runtimeSettingsManager;

    @TempDir
    Path tempDir;

    private AppSettings realSettings;

    @BeforeEach
    void setUp() throws Exception {
        realSettings = TestDataFactory.buildAppSettings();

        lenient().when(appSettings.getTencentMapsKey()).thenAnswer(inv -> realSettings.getTencentMapsKey());
        lenient().when(appSettings.getGoogleMapsApiKey()).thenAnswer(inv -> realSettings.getGoogleMapsApiKey());
        lenient().when(appSettings.getXhsCookie()).thenAnswer(inv -> realSettings.getXhsCookie());
        lenient().when(appSettings.getLlmActiveProvider()).thenAnswer(inv -> realSettings.getLlmActiveProvider());
        lenient().when(appSettings.getLlm()).thenAnswer(inv -> realSettings.getLlm());

        lenient().doAnswer(inv -> {
            realSettings.setTencentMapsKey(inv.getArgument(0));
            return null;
        }).when(appSettings).setTencentMapsKey(anyString());

        lenient().doAnswer(inv -> {
            realSettings.setGoogleMapsApiKey(inv.getArgument(0));
            return null;
        }).when(appSettings).setGoogleMapsApiKey(anyString());

        lenient().doAnswer(inv -> {
            realSettings.setXhsCookie(inv.getArgument(0));
            return null;
        }).when(appSettings).setXhsCookie(anyString());

        lenient().doAnswer(inv -> {
            realSettings.setLlmActiveProvider(inv.getArgument(0));
            return null;
        }).when(appSettings).setLlmActiveProvider(anyString());

        File settingsFile = tempDir.resolve("runtime_settings.json").toFile();
        Field field = RuntimeSettingsManager.class.getDeclaredField("settingsFile");
        field.setAccessible(true);
        field.set(runtimeSettingsManager, settingsFile);
    }

    private String anyString() {
        return any(String.class);
    }

    @Nested
    @DisplayName("Get runtime settings")
    class GetRuntimeSettings {

        @Test
        @DisplayName("Returns all expected keys")
        void getRuntimeSettings_returnsAllKeys() {
            Map<String, Object> result = runtimeSettingsManager.getRuntimeSettings();

            assertThat(result).containsKeys(
                    "tencent_maps_key",
                    "google_maps_api_key",
                    "xhs_cookie",
                    "llm_active_provider",
                    "llm_providers"
            );
        }

        @Test
        @DisplayName("Null values converted to empty")
        void getRuntimeSettings_nullValues_convertedToEmpty() {
            when(appSettings.getTencentMapsKey()).thenReturn(null);
            when(appSettings.getGoogleMapsApiKey()).thenReturn(null);
            when(appSettings.getXhsCookie()).thenReturn(null);
            when(appSettings.getLlmActiveProvider()).thenReturn(null);

            Map<String, Object> result = runtimeSettingsManager.getRuntimeSettings();

            assertThat(result.get("tencent_maps_key")).isEqualTo("");
            assertThat(result.get("google_maps_api_key")).isEqualTo("");
            assertThat(result.get("xhs_cookie")).isEqualTo("");
            assertThat(result.get("llm_active_provider")).isEqualTo("");
        }
    }

    @Nested
    @DisplayName("Update runtime settings")
    class UpdateRuntimeSettings {

        @Test
        @DisplayName("Simple key updates and applies")
        void updateRuntimeSettings_simpleKey_updatesAndApplies() {
            Map<String, Object> updates = Map.of("tencent_maps_key", "new-tencent-key");

            Map<String, Object> result = runtimeSettingsManager.updateRuntimeSettings(updates);

            assertThat(result.get("tencent_maps_key")).isEqualTo("new-tencent-key");
            verify(appSettings).setTencentMapsKey("new-tencent-key");
        }

        @Test
        @DisplayName("LLM providers converts list to map")
        void updateRuntimeSettings_llmProviders_convertsListToMap() {
            Map<String, Object> providerData = new LinkedHashMap<>();
            providerData.put("key", "openai");
            providerData.put("api_key", "sk-new-key");
            providerData.put("base_url", "https://api.openai.com/v1");
            providerData.put("model", "gpt-4o");

            Map<String, Object> updates = Map.of("llm_providers", List.of(providerData));

            Map<String, Object> result = runtimeSettingsManager.updateRuntimeSettings(updates);

            assertThat(result).containsKey("llm_providers");
        }

        @Test
        @DisplayName("Unknown key ignored")
        void updateRuntimeSettings_unknownKey_ignored() {
            Map<String, Object> updates = Map.of("unknown_key", "value");

            Map<String, Object> result = runtimeSettingsManager.updateRuntimeSettings(updates);

            assertThat(result).isNotNull();
        }

        @Test
        @DisplayName("Persists to file")
        void updateRuntimeSettings_persistsToFile() throws Exception {
            Map<String, Object> updates = Map.of("tencent_maps_key", "persisted-key");

            runtimeSettingsManager.updateRuntimeSettings(updates);

            verify(objectMapper).writerWithDefaultPrettyPrinter();
        }
    }
}
