package com.hellojourney.agent.planning;

import com.hellojourney.model.entity.Attraction;
import com.hellojourney.model.entity.TripPlan;
import com.hellojourney.model.vo.review.ReviewIssue;
import com.hellojourney.model.vo.review.TripReviewResult;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class TripReviewAgentTest {
    private final TripReviewAgent reviewAgent = new TripReviewAgent();

    @Test
    void review_allowsWarningsButPassesConsistentPlan() {
        TripReviewResult review = reviewAgent.review(PlanningTestData.plan(), PlanningTestData.request());

        assertThat(review.pass()).isTrue();
        assertThat(review.errors()).isEmpty();
        assertThat(review.warnings()).extracting(ReviewIssue::code)
                .contains("poi_needs_verification", "hotel_needs_verification", "weather_needs_verification");
    }

    @Test
    void review_blocksBudgetMismatchAndTimeConflict() {
        TripPlan plan = PlanningTestData.plan();
        Attraction second = Attraction.builder()
                .name("景山公园").address("景山西街44号")
                .location(com.hellojourney.model.entity.Location.builder().longitude(116.4).latitude(39.9).build())
                .visitDuration(60).description("城市公园").category("公园").ticketPrice(2)
                .startTime("11:30").endTime("13:00").build();
        java.util.List<Attraction> attractions = new java.util.ArrayList<>(plan.getDays().get(0).getAttractions());
        attractions.add(second);
        plan.getDays().get(0).setAttractions(attractions);
        plan.getDays().get(0).getAttractions().get(0).setVerificationStatus("verified");
        plan.getBudget().setTotal(1);

        TripReviewResult review = reviewAgent.review(plan, PlanningTestData.request());

        assertThat(review.pass()).isFalse();
        assertThat(review.errors()).extracting(ReviewIssue::code)
                .contains("time_conflict", "budget_total_mismatch", "invalid_verified_claim");
        assertThat(review.suggestedFixes()).isNotEmpty();
    }

    @Test
    void review_blocksPlanThatExceedsRequestedBudget() {
        var request = PlanningTestData.request();
        request.setBudgetLimit(1000);

        TripReviewResult review = reviewAgent.review(PlanningTestData.plan(), request);

        assertThat(review.pass()).isFalse();
        assertThat(review.errors()).extracting(ReviewIssue::code).contains("budget_limit_exceeded");
        assertThat(review.suggestedFixes()).anyMatch(fix -> fix.contains("¥1000"));
    }
}
