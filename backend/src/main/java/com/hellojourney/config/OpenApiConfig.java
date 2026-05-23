package com.hellojourney.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.servers.Server;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.List;

@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI customOpenAPI(@Value("${app.version:2.0.0}") String appVersion) {
        return new OpenAPI()
                .info(new Info()
                        .title("HelloJourney 智能旅行助手 API")
                        .version(appVersion)
                        .description("HelloJourney 后端 API 文档 - 多智能体旅行规划系统，支持多城市行程规划、POI搜索、路线规划、天气查询、AI对话等功能")
                        .contact(new Contact()
                                .name("HelloJourney Team")
                                .url("https://github.com/kdjfs/HelloJourney")))
                .servers(List.of(
                        new Server().url("http://localhost:8000").description("开发环境"),
                        new Server().url("https://api.xxxxx.com").description("生产环境")
                ));
    }
}
