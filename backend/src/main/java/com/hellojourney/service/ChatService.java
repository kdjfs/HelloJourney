package com.hellojourney.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hellojourney.config.AppSettings;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class ChatService {
    private final LlmService llmService;
    private final AppSettings appSettings;
    private final ObjectMapper objectMapper;

    private static final String SYSTEM_PROMPT = "你是一个专业且贴心的私人旅行管家「旅途星辰AI」。\n\n"
            + "你当前正在为用户提供关于一份 **已生成的旅行计划** 的答疑服务。\n"
            + "用户可能会问你关于行程中的景点、酒店、餐饮、天气、交通、门票、费用等任何细节问题。\n\n"
            + "请根据下方提供的【当前旅行计划】JSON 上下文来回答用户的问题。\n"
            + "回答规则：\n"
            + "1. 如果行程数据中包含相关信息，请精确引用并给出详细回答。\n"
            + "2. 如果行程数据中没有明确信息，可以基于常识进行合理推断，但需说明\"行程中未提供该信息，以下是建议\"。\n"
            + "3. 回答要有温度、条理清晰，适当使用 emoji 增加亲切感 🌟。\n"
            + "4. 回答尽量简洁，控制在200字以内，除非用户要求详细展开。\n"
            + "5. 使用中文回答。";

    public String chatWithTripContext(String message, Map<String, Object> tripPlanDict, List<Map<String, String>> history) {
        if (appSettings.getLlmApiKey() == null || appSettings.getLlmApiKey().isEmpty()) {
            return "抱歉，AI 服务尚未配置 API Key，请先在设置页面中完成配置。";
        }

        try {
            List<Map<String, String>> messages = new ArrayList<>();
            messages.add(Map.of("role", "system", "content", SYSTEM_PROMPT));
            messages.add(Map.of("role", "user", "content", buildContextMessage(tripPlanDict)));

            if (history != null) {
                for (Map<String, String> item : history) {
                    messages.add(Map.of("role", item.getOrDefault("role", "user"), "content", item.getOrDefault("content", "")));
                }
            }

            messages.add(Map.of("role", "user", "content", message));

            return llmService.chat(messages, 0.7, 1024);
        } catch (IOException e) {
            log.error("LLM调用异常: {}", e.getMessage());
            return "抱歉，AI 出现了意外错误，请稍后重试 🙏";
        }
    }

    private String buildContextMessage(Map<String, Object> tripPlanDict) {
        try {
            return "【当前旅行计划】\n```json\n" + objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(tripPlanDict) + "\n```";
        } catch (Exception e) {
            return "【当前旅行计划】\n" + tripPlanDict.toString();
        }
    }
}
