package com.hellojourney.websocket;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hellojourney.agent.TripPlannerAgent;
import com.hellojourney.config.AppSettings;
import com.hellojourney.controller.TripController;
import com.hellojourney.service.KnowledgeGraphService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

import java.net.URI;
import java.util.Map;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.LinkedBlockingQueue;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TripTaskWebSocketHandlerTest {

    @Mock
    private TripPlannerAgent tripPlannerAgent;

    @Mock
    private KnowledgeGraphService knowledgeGraphService;

    @Mock
    private AppSettings appSettings;

    @Mock
    private WebSocketSession session;

    private ObjectMapper objectMapper;

    private TripController tripController;

    private TripTaskWebSocketHandler handler;

    @BeforeEach
    void setUp() {
        objectMapper = spy(new ObjectMapper());
        tripController = spy(new TripController(tripPlannerAgent, knowledgeGraphService, appSettings, objectMapper));
        lenient().doReturn(null).when(tripController).loadTaskFromDisk(anyString());
        handler = new TripTaskWebSocketHandler(tripController, objectMapper);
    }

    private void setupSessionMock(String taskId) throws Exception {
        when(session.getUri()).thenReturn(new URI("/api/trip/ws/" + taskId));
        when(session.getAttributes()).thenReturn(new ConcurrentHashMap<>());
    }

    private TripController.TaskState createTaskState(String taskId, String status) {
        TripController.TaskState task = new TripController.TaskState();
        task.setTaskId(taskId);
        task.setPlanId(taskId);
        task.setStatus(status);
        task.setStage(status);
        task.setProgress(100);
        task.setMessage("test message");
        return task;
    }

    @Test
    @DisplayName("afterConnectionEstablished - task not found - sends error and closes")
    void afterConnectionEstablished_taskNotFound_sendsErrorAndCloses() throws Exception {
        String taskId = "unknown-task-id";
        setupSessionMock(taskId);

        handler.afterConnectionEstablished(session);

        ArgumentCaptor<TextMessage> messageCaptor = ArgumentCaptor.forClass(TextMessage.class);
        verify(session).sendMessage(messageCaptor.capture());

        Map<String, Object> payload = objectMapper.readValue(messageCaptor.getValue().getPayload(), Map.class);
        assertThat(payload)
                .containsEntry("task_id", taskId)
                .containsEntry("status", "failed")
                .containsEntry("error", "任务不存在");

        verify(session).close(CloseStatus.NOT_ACCEPTABLE);
    }

    @Test
    @DisplayName("afterConnectionEstablished - completed task - sends snapshot and closes")
    void afterConnectionEstablished_completedTask_sendsSnapshotAndCloses() throws Exception {
        String taskId = "completed-task-id";
        setupSessionMock(taskId);
        when(session.isOpen()).thenReturn(false);

        TripController.TaskState task = createTaskState(taskId, "completed");
        tripController.tasks.put(taskId, task);

        handler.afterConnectionEstablished(session);

        ArgumentCaptor<TextMessage> messageCaptor = ArgumentCaptor.forClass(TextMessage.class);
        verify(session).sendMessage(messageCaptor.capture());

        Map<String, Object> payload = objectMapper.readValue(messageCaptor.getValue().getPayload(), Map.class);
        assertThat(payload)
                .containsEntry("task_id", taskId)
                .containsEntry("status", "completed");

        verify(session).close();
        assertThat(task.getSubscribers()).isEmpty();
    }

    @Test
    @DisplayName("afterConnectionEstablished - processing task - adds subscriber")
    void afterConnectionEstablished_processingTask_addsSubscriber() throws Exception {
        String taskId = "processing-task-id";
        setupSessionMock(taskId);
        when(session.isOpen()).thenReturn(false);

        TripController.TaskState task = createTaskState(taskId, "processing");
        tripController.tasks.put(taskId, task);

        handler.afterConnectionEstablished(session);

        ArgumentCaptor<TextMessage> messageCaptor = ArgumentCaptor.forClass(TextMessage.class);
        verify(session).sendMessage(messageCaptor.capture());

        Map<String, Object> payload = objectMapper.readValue(messageCaptor.getValue().getPayload(), Map.class);
        assertThat(payload)
                .containsEntry("task_id", taskId)
                .containsEntry("status", "processing");

        assertThat(session.getAttributes()).containsEntry("taskId", taskId);
        assertThat(session.getAttributes()).containsKey("queue");

        BlockingQueue<Map<String, Object>> queue =
                (BlockingQueue<Map<String, Object>>) session.getAttributes().get("queue");
        assertThat(task.getSubscribers()).contains(queue);

        Thread.sleep(200);
    }

    @Test
    @DisplayName("afterConnectionClosed - removes subscriber")
    void afterConnectionClosed_removesSubscriber() throws Exception {
        String taskId = "test-task-id";
        setupSessionMock(taskId);

        TripController.TaskState task = createTaskState(taskId, "processing");
        tripController.tasks.put(taskId, task);

        BlockingQueue<Map<String, Object>> queue = new LinkedBlockingQueue<>();
        task.getSubscribers().add(queue);

        session.getAttributes().put("taskId", taskId);
        session.getAttributes().put("queue", queue);

        handler.afterConnectionClosed(session, CloseStatus.NORMAL);

        assertThat(task.getSubscribers()).doesNotContain(queue);
    }
}
