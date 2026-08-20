package com.hellojourney.agent.planning;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.Iterator;
import java.util.List;
import java.util.Set;
import java.util.regex.Pattern;
import java.util.regex.PatternSyntaxException;

@Component
public class TripPlanJsonSchemaValidator {
    private static final int MAX_VIOLATIONS = 100;

    private final JsonNode schema;
    private final String schemaText;

    public TripPlanJsonSchemaValidator(ObjectMapper objectMapper) {
        try {
            ClassPathResource resource = new ClassPathResource("schemas/trip-plan-v3.schema.json");
            this.schemaText = new String(resource.getInputStream().readAllBytes(), java.nio.charset.StandardCharsets.UTF_8);
            this.schema = objectMapper.readTree(schemaText);
        } catch (IOException exception) {
            throw new IllegalStateException("TripPlan schema could not be loaded", exception);
        }
    }

    public List<SchemaViolation> validate(JsonNode instance) {
        List<SchemaViolation> violations = new ArrayList<>();
        validateNode(instance, schema, "$", violations);
        return List.copyOf(violations);
    }

    public String schemaText() {
        return schemaText;
    }

    private void validateNode(JsonNode value, JsonNode currentSchema, String path,
                              List<SchemaViolation> violations) {
        if (violations.size() >= MAX_VIOLATIONS) {
            return;
        }
        if (currentSchema.has("$ref")) {
            JsonNode resolved = resolveReference(currentSchema.path("$ref").asText());
            if (resolved == null) {
                add(violations, path, "$ref", "schema reference is invalid");
                return;
            }
            validateNode(value, resolved, path, violations);
            return;
        }
        if (currentSchema.has("anyOf")) {
            for (JsonNode option : currentSchema.path("anyOf")) {
                List<SchemaViolation> candidate = new ArrayList<>();
                validateNode(value, option, path, candidate);
                if (candidate.isEmpty()) {
                    return;
                }
            }
            add(violations, path, "anyOf", "value does not match an allowed schema");
            return;
        }

        if (!matchesType(value, currentSchema.path("type"))) {
            add(violations, path, "type", "value has an invalid type");
            return;
        }
        if (value == null || value.isNull()) {
            return;
        }
        if (value.isObject()) {
            validateObject(value, currentSchema, path, violations);
        } else if (value.isArray()) {
            validateArray(value, currentSchema, path, violations);
        } else if (value.isTextual()) {
            validateString(value.asText(), currentSchema, path, violations);
        } else if (value.isNumber()) {
            validateNumber(value, currentSchema, path, violations);
        }
        validateEnum(value, currentSchema, path, violations);
    }

    private void validateObject(JsonNode value, JsonNode currentSchema, String path,
                                List<SchemaViolation> violations) {
        JsonNode properties = currentSchema.path("properties");
        for (JsonNode required : currentSchema.path("required")) {
            String name = required.asText();
            if (!value.has(name) || value.get(name).isNull()) {
                add(violations, child(path, name), "required", "required property is missing");
            }
        }
        if (!currentSchema.path("additionalProperties").asBoolean(true) && properties.isObject()) {
            Set<String> allowed = new HashSet<>();
            properties.fieldNames().forEachRemaining(allowed::add);
            value.fieldNames().forEachRemaining(name -> {
                if (!allowed.contains(name)) {
                    add(violations, child(path, name), "additionalProperties", "unknown property");
                }
            });
        }
        if (properties.isObject()) {
            Iterator<String> names = properties.fieldNames();
            while (names.hasNext()) {
                String name = names.next();
                if (value.has(name)) {
                    validateNode(value.get(name), properties.get(name), child(path, name), violations);
                }
            }
        }
    }

    private void validateArray(JsonNode value, JsonNode currentSchema, String path,
                               List<SchemaViolation> violations) {
        int size = value.size();
        if (size < currentSchema.path("minItems").asInt(0)) {
            add(violations, path, "minItems", "array has too few items");
        }
        if (size > currentSchema.path("maxItems").asInt(Integer.MAX_VALUE)) {
            add(violations, path, "maxItems", "array has too many items");
        }
        JsonNode items = currentSchema.get("items");
        if (items != null) {
            for (int index = 0; index < size; index++) {
                validateNode(value.get(index), items, path + "[" + index + "]", violations);
            }
        }
    }

    private void validateString(String value, JsonNode currentSchema, String path,
                                List<SchemaViolation> violations) {
        if (value.length() < currentSchema.path("minLength").asInt(0)) {
            add(violations, path, "minLength", "string is too short");
        }
        if (value.length() > currentSchema.path("maxLength").asInt(Integer.MAX_VALUE)) {
            add(violations, path, "maxLength", "string is too long");
        }
        if (currentSchema.has("pattern")) {
            try {
                if (!Pattern.matches(currentSchema.path("pattern").asText(), value)) {
                    add(violations, path, "pattern", "string has an invalid format");
                }
            } catch (PatternSyntaxException exception) {
                add(violations, path, "pattern", "schema pattern is invalid");
            }
        }
        if ("date".equals(currentSchema.path("format").asText())) {
            try {
                LocalDate.parse(value);
            } catch (DateTimeParseException exception) {
                add(violations, path, "format", "date must use YYYY-MM-DD");
            }
        }
    }

    private void validateNumber(JsonNode value, JsonNode currentSchema, String path,
                                List<SchemaViolation> violations) {
        if (currentSchema.has("minimum") && value.asDouble() < currentSchema.path("minimum").asDouble()) {
            add(violations, path, "minimum", "number is below the minimum");
        }
        if (currentSchema.has("maximum") && value.asDouble() > currentSchema.path("maximum").asDouble()) {
            add(violations, path, "maximum", "number is above the maximum");
        }
    }

    private void validateEnum(JsonNode value, JsonNode currentSchema, String path,
                              List<SchemaViolation> violations) {
        JsonNode allowed = currentSchema.path("enum");
        if (!allowed.isArray()) {
            return;
        }
        for (JsonNode option : allowed) {
            if (option.equals(value)) {
                return;
            }
        }
        add(violations, path, "enum", "value is not in the allowed set");
    }

    private boolean matchesType(JsonNode value, JsonNode typeSchema) {
        if (typeSchema.isMissingNode()) {
            return true;
        }
        if (typeSchema.isArray()) {
            for (JsonNode option : typeSchema) {
                if (matchesSingleType(value, option.asText())) {
                    return true;
                }
            }
            return false;
        }
        return matchesSingleType(value, typeSchema.asText());
    }

    private boolean matchesSingleType(JsonNode value, String type) {
        if (value == null) {
            return "null".equals(type);
        }
        return switch (type) {
            case "null" -> value.isNull();
            case "object" -> value.isObject();
            case "array" -> value.isArray();
            case "string" -> value.isTextual();
            case "integer" -> value.isIntegralNumber();
            case "number" -> value.isNumber();
            case "boolean" -> value.isBoolean();
            default -> true;
        };
    }

    private JsonNode resolveReference(String reference) {
        if (!reference.startsWith("#/")) {
            return null;
        }
        JsonNode node = schema;
        for (String segment : reference.substring(2).split("/")) {
            node = node.path(segment.replace("~1", "/").replace("~0", "~"));
        }
        return node.isMissingNode() ? null : node;
    }

    private String child(String path, String field) {
        return path + "." + field;
    }

    private void add(List<SchemaViolation> violations, String path, String keyword, String message) {
        if (violations.size() < MAX_VIOLATIONS) {
            violations.add(new SchemaViolation(path, keyword, message));
        }
    }
}
