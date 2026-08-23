package com.hellojourney.agent.tool;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.stereotype.Component;

import java.util.HashSet;
import java.util.Iterator;
import java.util.Set;

@Component
public class JsonSchemaArgumentValidator {

    public String validate(JsonNode arguments, ObjectNode schema) {
        if (arguments == null || !arguments.isObject()) {
            return "arguments_must_be_object";
        }
        JsonNode properties = schema.path("properties");
        Set<String> allowed = new HashSet<>();
        properties.fieldNames().forEachRemaining(allowed::add);

        if (!schema.path("additionalProperties").asBoolean(true)) {
            Iterator<String> fields = arguments.fieldNames();
            while (fields.hasNext()) {
                if (!allowed.contains(fields.next())) {
                    return "unknown_argument";
                }
            }
        }

        for (JsonNode required : schema.path("required")) {
            String name = required.asText();
            JsonNode value = arguments.get(name);
            if (value == null || value.isNull() || (value.isTextual() && value.asText().isBlank())) {
                return "missing_required_argument";
            }
        }

        Iterator<String> names = properties.fieldNames();
        while (names.hasNext()) {
            String name = names.next();
            JsonNode value = arguments.get(name);
            if (value == null || value.isNull()) {
                continue;
            }
            JsonNode propertySchema = properties.get(name);
            String type = propertySchema.path("type").asText();
            if (("string".equals(type) && !value.isTextual())
                    || ("boolean".equals(type) && !value.isBoolean())
                    || ("integer".equals(type) && !value.isIntegralNumber())
                    || ("number".equals(type) && !value.isNumber())) {
                return "invalid_argument_type";
            }
            if (value.isTextual()) {
                int length = value.asText().length();
                if (length < propertySchema.path("minLength").asInt(0)
                        || length > propertySchema.path("maxLength").asInt(Integer.MAX_VALUE)) {
                    return "invalid_argument_length";
                }
                JsonNode allowedValues = propertySchema.path("enum");
                if (allowedValues.isArray()) {
                    boolean matched = false;
                    for (JsonNode allowedValue : allowedValues) {
                        matched |= allowedValue.asText().equals(value.asText());
                    }
                    if (!matched) {
                        return "invalid_argument_value";
                    }
                }
            }
        }
        return null;
    }
}
