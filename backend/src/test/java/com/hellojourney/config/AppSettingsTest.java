package com.hellojourney.config;

import com.hellojourney.model.dto.LlmProviderConfig;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class AppSettingsTest {

    @Nested
    @DisplayName("Default values")
    class DefaultValues {

        @Test
        @DisplayName("Default values are correct")
        void getDefaultValues_correct() {
            AppSettings settings = new AppSettings();

            assertThat(settings.getName()).isEqualTo("HelloAgents智能旅行助手");
            assertThat(settings.getVersion()).isEqualTo("2.0.0");
            assertThat(settings.getPort()).isEqualTo(8000);
        }
    }

    @Nested
    @DisplayName("CORS origins list")
    class CorsOriginsList {

        @Test
        @DisplayName("Splits correctly")
        void getCorsOriginsList_splitsCorrectly() {
            AppSettings settings = new AppSettings();
            settings.setCorsOrigins("http://localhost:5173, http://localhost:3000, https://example.com");

            List<String> origins = settings.getCorsOriginsList();

            assertThat(origins).containsExactly("http://localhost:5173", "http://localhost:3000", "https://example.com");
        }

        @Test
        @DisplayName("Empty string returns empty list")
        void getCorsOriginsList_emptyString_returnsEmptyList() {
            AppSettings settings = new AppSettings();
            settings.setCorsOrigins("");

            List<String> origins = settings.getCorsOriginsList();

            assertThat(origins).isEmpty();
        }
    }

    @Nested
    @DisplayName("Active provider config")
    class ActiveProviderConfig {

        @Test
        @DisplayName("Matching key returns config")
        void getActiveProviderConfig_matchingKey_returnsConfig() {
            AppSettings settings = new AppSettings();
            AppSettings.LlmProviderProps props = new AppSettings.LlmProviderProps();
            props.setName("GPT");
            props.setApiKey("sk-test");
            props.setBaseUrl("https://api.openai.com/v1");
            props.setModel("gpt-4");
            settings.getLlm().getProviders().put("openai", props);

            LlmProviderConfig config = settings.getLlm().getActiveProviderConfig();

            assertThat(config).isNotNull();
            assertThat(config.getKey()).isEqualTo("openai");
            assertThat(config.getName()).isEqualTo("GPT");
            assertThat(config.getApiKey()).isEqualTo("sk-test");
            assertThat(config.getBaseUrl()).isEqualTo("https://api.openai.com/v1");
            assertThat(config.getModel()).isEqualTo("gpt-4");
        }

        @Test
        @DisplayName("Unknown active provider falls back to first")
        void getActiveProviderConfig_noMatchingKey_fallsBackToFirst() {
            AppSettings settings = new AppSettings();
            settings.setLlmActiveProvider("unknown");

            AppSettings.LlmProviderProps props = new AppSettings.LlmProviderProps();
            props.setName("DeepSeek");
            props.setApiKey("sk-ds");
            props.setBaseUrl("https://api.deepseek.com");
            props.setModel("deepseek-v4-pro");
            settings.getLlm().getProviders().put("deepseek", props);

            LlmProviderConfig config = settings.getLlm().getActiveProviderConfig();

            assertThat(config).isNotNull();
            assertThat(config.getKey()).isEqualTo("unknown");
            assertThat(config.getName()).isEqualTo("DeepSeek");
        }

        @Test
        @DisplayName("Empty providers returns null")
        void getActiveProviderConfig_emptyProviders_returnsNull() {
            AppSettings settings = new AppSettings();
            settings.getLlm().getProviders().clear();

            LlmProviderConfig config = settings.getLlm().getActiveProviderConfig();

            assertThat(config).isNull();
        }
    }

    @Nested
    @DisplayName("LLM API key")
    class LlmApiKey {

        @Test
        @DisplayName("No provider returns empty")
        void getLlmApiKey_noProvider_returnsEmpty() {
            AppSettings settings = new AppSettings();
            settings.getLlm().getProviders().clear();

            String apiKey = settings.getLlmApiKey();

            assertThat(apiKey).isEmpty();
        }
    }

    @Nested
    @DisplayName("Delegation methods")
    class Delegation {

        @Test
        @DisplayName("Set tencent maps key delegates correctly")
        void setTencentMapsKey_delegatesCorrectly() {
            AppSettings settings = new AppSettings();

            settings.setTencentMapsKey("new-key");

            assertThat(settings.getTencentMapsKey()).isEqualTo("new-key");
            assertThat(settings.getTencentMaps().getKey()).isEqualTo("new-key");
        }
    }
}
