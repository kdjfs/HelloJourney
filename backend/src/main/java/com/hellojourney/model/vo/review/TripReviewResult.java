package com.hellojourney.model.vo.review;

import java.util.List;

public record TripReviewResult(
        boolean pass,
        List<ReviewIssue> warnings,
        List<ReviewIssue> errors,
        List<String> suggestedFixes
) {
}
