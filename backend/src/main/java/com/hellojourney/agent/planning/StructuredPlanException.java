package com.hellojourney.agent.planning;

import java.io.IOException;
import java.util.List;

public class StructuredPlanException extends IOException {
    private final String code;
    private final List<String> issueCodes;

    public StructuredPlanException(String message, String code, List<String> issueCodes, Throwable cause) {
        super(message, cause);
        this.code = code;
        this.issueCodes = List.copyOf(issueCodes);
    }

    public String getCode() {
        return code;
    }

    public List<String> getIssueCodes() {
        return issueCodes;
    }
}
