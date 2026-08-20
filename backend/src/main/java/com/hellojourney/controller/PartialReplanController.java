package com.hellojourney.controller;

import com.hellojourney.model.dto.replan.PartialReplanContracts;
import com.hellojourney.model.llm.LlmApiException;
import com.hellojourney.service.PartialReplanService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/trip/plans")
@RequiredArgsConstructor
@Tag(name = "行程调整", description = "生成需由用户确认的局部行程变更集")
public class PartialReplanController {
    private final PartialReplanService partialReplanService;

    @PostMapping("/{planId}/replan")
    @Operation(summary = "提出局部行程调整", description = "只返回变更集，不直接修改或持久化当前行程")
    public ResponseEntity<?> replan(@PathVariable String planId,
                                    @Valid @RequestBody PartialReplanContracts.Request request) {
        if (!planId.matches("[A-Za-z0-9-]{8,64}")) {
            return ResponseEntity.badRequest().body(error("invalid_plan_id", "无效的行程 ID"));
        }
        try {
            return ResponseEntity.ok(partialReplanService.propose(request));
        } catch (PartialReplanService.PartialReplanException exception) {
            return ResponseEntity.unprocessableEntity().body(error(exception.getCode(), exception.getMessage()));
        } catch (LlmApiException exception) {
            HttpStatus status = "configuration_error".equals(exception.getProviderErrorCode())
                    ? HttpStatus.SERVICE_UNAVAILABLE : HttpStatus.BAD_GATEWAY;
            log.warn("partial_replan_llm_failed planId={} code={} status={}",
                    planId, exception.getProviderErrorCode(), exception.getStatusCode());
            return ResponseEntity.status(status).body(error("replan_unavailable", "AI 调整服务暂时不可用"));
        } catch (IOException exception) {
            log.warn("partial_replan_failed planId={} type={}", planId, exception.getClass().getSimpleName());
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
                    .body(error("replan_unavailable", "AI 调整服务暂时不可用"));
        }
    }

    private Map<String, String> error(String code, String message) {
        return Map.of("code", code, "message", message);
    }
}
