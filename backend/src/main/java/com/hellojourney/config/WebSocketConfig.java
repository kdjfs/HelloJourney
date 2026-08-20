package com.hellojourney.config;

import com.hellojourney.websocket.TripTaskWebSocketHandler;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

@Configuration
@EnableWebSocket
@RequiredArgsConstructor
public class WebSocketConfig implements WebSocketConfigurer {
    private final TripTaskWebSocketHandler tripTaskWebSocketHandler;
    private final AppSettings appSettings;

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(tripTaskWebSocketHandler, "/api/trip/ws/{taskId}")
                .setAllowedOrigins(appSettings.getCorsOriginsList().toArray(new String[0]));
    }
}
