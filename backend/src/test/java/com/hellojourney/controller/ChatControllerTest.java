package com.hellojourney.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hellojourney.config.AppSettings;
import com.hellojourney.model.dto.ChatMessage;
import com.hellojourney.model.dto.TripChatRequest;
import com.hellojourney.service.ChatService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Map;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(ChatController.class)
class ChatControllerTest {
    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private ChatService chatService;

    @MockBean
    private AppSettings appSettings;

    private TripChatRequest buildValidRequest() {
        return TripChatRequest.builder()
                .message("故宫门票多少钱？")
                .tripPlan(Map.of("city", "北京", "days", List.of()))
                .history(List.of(
                        ChatMessage.builder().role("user").content("你好").build(),
                        ChatMessage.builder().role("assistant").content("你好！有什么可以帮你？").build()
                ))
                .build();
    }

    @Test
    void askAboutTrip_validRequest_returnsReply() throws Exception {
        TripChatRequest request = buildValidRequest();
        when(chatService.chatWithTripContext(
                eq("故宫门票多少钱？"),
                any(),
                any()
        )).thenReturn("故宫门票60元");

        mockMvc.perform(post("/api/chat/ask")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.reply").value("故宫门票60元"));
    }

    @Test
    void askAboutTrip_serviceThrows_returns500() throws Exception {
        TripChatRequest request = buildValidRequest();
        when(chatService.chatWithTripContext(any(), any(), any()))
                .thenThrow(new RuntimeException("AI服务异常"));

        mockMvc.perform(post("/api/chat/ask")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isInternalServerError());
    }
}
