package com.hellojourney.config;

import com.hellojourney.service.TripPlanningJobService;
import org.junit.jupiter.api.Test;
import org.springframework.aop.support.AopUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.core.task.TaskExecutor;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
class AsyncExecutionConfigTest {

    @Autowired
    private TripPlanningJobService tripPlanningJobService;

    @Autowired
    @Qualifier("tripPlanningExecutor")
    private TaskExecutor tripPlanningExecutor;

    @Autowired
    @Qualifier("webSocketExecutor")
    private TaskExecutor webSocketExecutor;

    @Test
    void planningServiceIsSpringProxiedForRealAsyncExecution() {
        assertThat(AopUtils.isAopProxy(tripPlanningJobService)).isTrue();
    }

    @Test
    void executorsAreBoundedAndManagedBySpring() {
        assertThat(tripPlanningExecutor).isInstanceOf(ThreadPoolTaskExecutor.class);
        assertThat(webSocketExecutor).isInstanceOf(ThreadPoolTaskExecutor.class);

        ThreadPoolTaskExecutor planning = (ThreadPoolTaskExecutor) tripPlanningExecutor;
        ThreadPoolTaskExecutor events = (ThreadPoolTaskExecutor) webSocketExecutor;
        assertThat(planning.getThreadPoolExecutor().getQueue().remainingCapacity()).isEqualTo(32);
        assertThat(events.getThreadPoolExecutor().getQueue().remainingCapacity()).isEqualTo(128);
    }
}
