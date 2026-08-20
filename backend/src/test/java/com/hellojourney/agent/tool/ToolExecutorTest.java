package com.hellojourney.agent.tool;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hellojourney.config.AppSettings;
import com.hellojourney.model.entity.WeatherInfo;
import com.hellojourney.service.MapDispatcher;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.core.task.support.TaskExecutorAdapter;

import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ToolExecutorTest {
    @Mock
    private MapDispatcher mapDispatcher;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private AppSettings settings;
    private ToolRegistry registry;
    private ToolExecutor executor;

    @BeforeEach
    void setUp() {
        settings = new AppSettings();
        settings.getAgent().setToolMaxRetries(0);
        registry = new ToolRegistry(mapDispatcher, objectMapper);
        executor = new ToolExecutor(registry, new JsonSchemaArgumentValidator(), objectMapper,
                settings, new TaskExecutorAdapter(Runnable::run));
    }

    @Test
    void registry_exposesOnlySixTravelTools() {
        assertThat(registry.definitions()).extracting(ToolDefinition::name)
                .containsExactlyInAnyOrder("get_weather", "search_poi", "search_hotel",
                        "search_restaurant", "geocode", "route_plan");
        assertThat(registry.definitions()).allSatisfy(definition ->
                assertThat(definition.parameters().path("additionalProperties").asBoolean()).isFalse());
    }

    @Test
    void execute_rejectsUnknownToolAndInvalidArgumentsWithoutDispatching() {
        ToolResult unknown = executor.execute(new ToolCall("1", "run_command", "{}"), "trace", () -> false);
        ToolResult invalid = executor.execute(new ToolCall("2", "get_weather", "{\"city\":42}"),
                "trace", () -> false);

        assertThat(unknown.success()).isFalse();
        assertThat(unknown.errorCode()).isEqualTo("tool_not_allowed");
        assertThat(invalid.success()).isFalse();
        assertThat(invalid.errorCode()).isEqualTo("invalid_argument_type");
    }

    @Test
    void execute_dispatchesValidatedWeatherToolAndAddsSourceMetadata() {
        WeatherInfo weather = WeatherInfo.builder().city("北京").date("2026-08-21").build();
        when(mapDispatcher.getWeatherUnified("北京")).thenReturn(List.of(weather));
        when(mapDispatcher.getEffectiveMapProvider()).thenReturn("tencent");

        ToolResult result = executor.execute(
                new ToolCall("1", "get_weather", "{\"city\":\"北京\"}"), "trace", () -> false);

        assertThat(result.success()).isTrue();
        assertThat(result.data().path("source").asText()).isEqualTo("map_api");
        assertThat(result.data().path("provider").asText()).isEqualTo("tencent");
        assertThat(result.data().path("verified").asBoolean()).isTrue();
        assertThat(result.data().path("items")).hasSize(1);
        verify(mapDispatcher).getWeatherUnified("北京");
    }

    @Test
    void execute_honorsCancellationBeforeDispatch() {
        ToolResult result = executor.execute(
                new ToolCall("1", "get_weather", "{\"city\":\"北京\"}"), "trace", () -> true);

        assertThat(result.errorCode()).isEqualTo("cancelled");
    }

    @Test
    void execute_retriesTransientToolFailureWithinPolicy() {
        settings.getAgent().setToolMaxRetries(1);
        WeatherInfo weather = WeatherInfo.builder().city("北京").date("2026-08-21").build();
        when(mapDispatcher.getWeatherUnified("北京"))
                .thenThrow(new IllegalStateException("temporary"))
                .thenReturn(List.of(weather));
        when(mapDispatcher.getEffectiveMapProvider()).thenReturn("tencent");

        ToolResult result = executor.execute(
                new ToolCall("1", "get_weather", "{\"city\":\"北京\"}"), "trace", () -> false);

        assertThat(result.success()).isTrue();
        verify(mapDispatcher, org.mockito.Mockito.times(2)).getWeatherUnified("北京");
    }
}
