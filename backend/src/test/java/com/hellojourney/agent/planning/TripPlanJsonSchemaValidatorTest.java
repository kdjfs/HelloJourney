package com.hellojourney.agent.planning;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class TripPlanJsonSchemaValidatorTest {
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final TripPlanJsonSchemaValidator validator = new TripPlanJsonSchemaValidator(objectMapper);

    @Test
    void validate_acceptsVersionedTripPlanContract() {
        JsonNode json = objectMapper.valueToTree(PlanningTestData.plan());

        assertThat(validator.validate(json)).isEmpty();
    }

    @Test
    void validate_reportsMissingPropertiesAndInvalidCoordinates() {
        JsonNode json = objectMapper.valueToTree(PlanningTestData.plan());
        ((com.fasterxml.jackson.databind.node.ObjectNode) json).remove("budget");
        ((com.fasterxml.jackson.databind.node.ObjectNode) json.path("days").path(0)
                .path("attractions").path(0).path("location")).put("longitude", 999);

        List<SchemaViolation> violations = validator.validate(json);

        assertThat(violations).extracting(SchemaViolation::path)
                .contains("$.budget", "$.days[0].attractions[0].location.longitude");
    }
}
