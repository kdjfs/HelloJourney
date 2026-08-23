package com.hellojourney.model.llm;

import java.io.IOException;

public class LlmApiException extends IOException {
    private final int statusCode;
    private final String providerErrorCode;
    private final boolean retryable;
    private final String requestId;

    public LlmApiException(String message, int statusCode, String providerErrorCode,
                           boolean retryable, String requestId, Throwable cause) {
        super(message, cause);
        this.statusCode = statusCode;
        this.providerErrorCode = providerErrorCode;
        this.retryable = retryable;
        this.requestId = requestId;
    }

    public int getStatusCode() {
        return statusCode;
    }

    public String getProviderErrorCode() {
        return providerErrorCode;
    }

    public boolean isRetryable() {
        return retryable;
    }

    public String getRequestId() {
        return requestId;
    }
}
