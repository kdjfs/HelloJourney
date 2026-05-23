package com.hellojourney.controller;

import com.hellojourney.model.dto.TripChatRequest;
import com.hellojourney.model.vo.TripChatResponse;
import com.hellojourney.service.ChatService;
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

import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/chat")
@RequiredArgsConstructor
@Tag(name = "AI对话", description = "基于旅行计划的智能问答")
public class ChatController {
    private final ChatService chatService;

    @PostMapping("/ask")
    @Operation(summary = "旅行相关问答", description = "基于当前旅行计划上下文的AI对话，可询问行程中的景点、酒店、餐饮等细节")
    @ApiResponses({@ApiResponse(responseCode = "200", description = "问答成功"), @ApiResponse(responseCode = "500", description = "AI服务异常")})
    public ResponseEntity<TripChatResponse> askAboutTrip(@RequestBody TripChatRequest request) {
        try {
            log.info("收到行程问答: {}...", request.getMessage().substring(0, Math.min(50, request.getMessage().length())));
            List<Map<String, String>> history = null;
            if (request.getHistory() != null) {
                history = request.getHistory().stream()
                        .map(m -> Map.of("role", m.getRole(), "content", m.getContent()))
                        .toList();
            }
            String reply = chatService.chatWithTripContext(request.getMessage(), request.getTripPlan(), history);
            log.info("AI 回复: {}...", reply.substring(0, Math.min(80, reply.length())));
            return ResponseEntity.ok(TripChatResponse.builder().success(true).reply(reply).build());
        } catch (Exception e) {
            log.error("行程问答失败: {}", e.getMessage());
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "AI问答服务异常: " + e.getMessage());
        }
    }
}
