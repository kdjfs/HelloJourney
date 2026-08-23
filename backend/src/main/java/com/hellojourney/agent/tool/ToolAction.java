package com.hellojourney.agent.tool;

import com.fasterxml.jackson.databind.JsonNode;

@FunctionalInterface
public interface ToolAction {
    JsonNode execute(JsonNode arguments) throws Exception;
}
