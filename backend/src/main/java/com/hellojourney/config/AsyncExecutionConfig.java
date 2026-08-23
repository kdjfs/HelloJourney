package com.hellojourney.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

@Configuration
public class AsyncExecutionConfig {

    @Bean(name = "tripPlanningExecutor")
    public ThreadPoolTaskExecutor tripPlanningExecutor() {
        return executor("trip-planning-", 2, 4, 32);
    }

    @Bean(name = "webSocketExecutor")
    public ThreadPoolTaskExecutor webSocketExecutor() {
        return executor("trip-events-", 2, 8, 128);
    }

    @Bean(name = "agentToolExecutor")
    public ThreadPoolTaskExecutor agentToolExecutor() {
        return executor("agent-tool-", 4, 8, 64);
    }

    private ThreadPoolTaskExecutor executor(String prefix, int coreSize, int maxSize, int queueCapacity) {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setThreadNamePrefix(prefix);
        executor.setCorePoolSize(coreSize);
        executor.setMaxPoolSize(maxSize);
        executor.setQueueCapacity(queueCapacity);
        executor.setWaitForTasksToCompleteOnShutdown(true);
        executor.setAwaitTerminationSeconds(10);
        executor.initialize();
        return executor;
    }
}
