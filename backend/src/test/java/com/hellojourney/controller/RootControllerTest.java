package com.hellojourney.controller;

import com.hellojourney.config.AppSettings;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(RootController.class)
class RootControllerTest {
    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private AppSettings appSettings;

    @Test
    void root_returnsSystemInfo() throws Exception {
        when(appSettings.getName()).thenReturn("HelloAgents智能旅行助手");
        when(appSettings.getVersion()).thenReturn("2.0.0");

        mockMvc.perform(get("/"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("HelloAgents智能旅行助手"))
                .andExpect(jsonPath("$.version").value("2.0.0"))
                .andExpect(jsonPath("$.status").value("running"));
    }

    @Test
    void health_returnsHealthy() throws Exception {
        when(appSettings.getName()).thenReturn("HelloAgents智能旅行助手");
        when(appSettings.getVersion()).thenReturn("2.0.0");

        mockMvc.perform(get("/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("healthy"))
                .andExpect(jsonPath("$.service").value("HelloAgents智能旅行助手"));
    }
}
