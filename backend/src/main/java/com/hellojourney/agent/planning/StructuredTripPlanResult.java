package com.hellojourney.agent.planning;

import com.hellojourney.model.entity.TripPlan;
import com.hellojourney.model.llm.LlmUsage;
import com.hellojourney.model.vo.review.TripReviewResult;

public record StructuredTripPlanResult(
        TripPlan plan,
        TripReviewResult review,
        String model,
        String responseId,
        LlmUsage usage,
        int repairAttempts
) {
}
