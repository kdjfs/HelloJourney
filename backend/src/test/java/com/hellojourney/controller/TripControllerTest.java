package com.hellojourney.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hellojourney.config.AppSettings;
import com.hellojourney.model.dto.TripRequest;
import com.hellojourney.service.TripPlanningJobService;
import com.hellojourney.util.TestDataFactory;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.nio.file.Path;
import java.util.concurrent.CompletableFuture;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(TripController.class)
class TripControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private TripController tripController;

    @MockBean
    private TripPlanningJobService tripPlanningJobService;

    @MockBean
    private AppSettings appSettings;

    @TempDir
    Path tempDir;

    private CompletableFuture<com.hellojourney.model.vo.TripPlanResponse> pending;

    @BeforeEach
    void setUp() throws Exception {
        tripController.tasks.clear();
        pending = new CompletableFuture<>();

        AppSettings.TaskConfig tasks = new AppSettings.TaskConfig();
        tasks.setDataDir(tempDir.toString());
        tasks.setExecutionTimeoutSeconds(300);
        when(appSettings.getTasks()).thenReturn(tasks);
        when(tripPlanningJobService.planAsync(anyString(), any(), any(), any())).thenReturn(pending);
    }

    @Test
    void planTrip_returns202WithoutWaitingForCompletion() throws Exception {
        TripRequest request = TestDataFactory.buildTripRequest();

        mockMvc.perform(post("/api/trip/plan")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.task_id").isNotEmpty())
                .andExpect(jsonPath("$.status").value("processing"));

        assertThat(pending).isNotDone();
        verify(tripPlanningJobService).planAsync(anyString(), any(), any(), any());
    }

    @Test
    void planTrip_reusesTaskForSameIdempotencyKey() throws Exception {
        String body = objectMapper.writeValueAsString(TestDataFactory.buildTripRequest());

        MvcResult first = mockMvc.perform(post("/api/trip/plan")
                        .header("Idempotency-Key", "same-request")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isAccepted())
                .andReturn();
        MvcResult second = mockMvc.perform(post("/api/trip/plan")
                        .header("Idempotency-Key", "same-request")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.duplicate").value(true))
                .andReturn();

        JsonNode firstJson = objectMapper.readTree(first.getResponse().getContentAsString());
        JsonNode secondJson = objectMapper.readTree(second.getResponse().getContentAsString());
        assertThat(secondJson.get("task_id").asText()).isEqualTo(firstJson.get("task_id").asText());
        verify(tripPlanningJobService, times(1)).planAsync(anyString(), any(), any(), any());
    }

    @Test
    void cancelTrip_marksTaskCancelledAndCancelsFuture() throws Exception {
        MvcResult created = mockMvc.perform(post("/api/trip/plan")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(TestDataFactory.buildTripRequest())))
                .andExpect(status().isAccepted())
                .andReturn();
        String taskId = objectMapper.readTree(created.getResponse().getContentAsString())
                .get("task_id").asText();

        mockMvc.perform(delete("/api/trip/tasks/{taskId}", taskId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("cancelled"));

        assertThat(pending).isCancelled();
        assertThat(tripController.tasks.get(taskId).getStatus()).isEqualTo("cancelled");
    }

    @Test
    void failedJobReturnsGenericErrorWithoutRequestPayload() throws Exception {
        MvcResult created = mockMvc.perform(post("/api/trip/plan")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(TestDataFactory.buildTripRequest())))
                .andExpect(status().isAccepted())
                .andReturn();
        String taskId = objectMapper.readTree(created.getResponse().getContentAsString())
                .get("task_id").asText();

        pending.completeExceptionally(new IllegalStateException("internal-provider-detail"));

        mockMvc.perform(get("/api/trip/status/{taskId}", taskId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("failed"))
                .andExpect(jsonPath("$.error").value("旅行规划失败，请稍后重试"))
                .andExpect(jsonPath("$.request_payload").doesNotExist());
    }
}
