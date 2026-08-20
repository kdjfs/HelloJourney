package com.hellojourney.model.dto.replan;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.JsonNode;
import com.hellojourney.model.entity.Attraction;
import com.hellojourney.model.entity.TripPlan;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.util.List;
import java.util.Map;

public final class PartialReplanContracts {
    private PartialReplanContracts() {
    }

    public record Request(
            @NotBlank @Size(max = 1_000) String instruction,
            @NotBlank @Pattern(regexp = "day|attraction|hotel|route|budget|all") String scope,
            @JsonProperty("day_index") Integer dayIndex,
            @NotNull @JsonProperty("current_plan") TripPlan currentPlan
    ) {
    }

    public record Operation(
            @NotBlank String type,
            @JsonProperty("dayIndex") Integer dayIndex,
            @JsonProperty("attractionIndex") Integer attractionIndex,
            @JsonProperty("fromDayIndex") Integer fromDayIndex,
            @JsonProperty("toDayIndex") Integer toDayIndex,
            Integer at,
            Attraction attraction,
            Map<String, JsonNode> patch
    ) {
    }

    public record ChangeSet(String id, String title, String summary, List<Operation> operations) {
    }
}
