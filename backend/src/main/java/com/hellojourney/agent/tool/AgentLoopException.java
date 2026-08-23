package com.hellojourney.agent.tool;

import java.io.IOException;

public class AgentLoopException extends IOException {
    private final String code;

    public AgentLoopException(String message, String code) {
        super(message);
        this.code = code;
    }

    public String getCode() {
        return code;
    }
}
