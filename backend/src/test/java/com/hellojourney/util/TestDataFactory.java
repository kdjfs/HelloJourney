package com.hellojourney.util;

import com.hellojourney.config.AppSettings;
import com.hellojourney.model.dto.CityStay;
import com.hellojourney.model.dto.TripRequest;
import com.hellojourney.model.entity.*;

import java.util.List;

public final class TestDataFactory {

    private TestDataFactory() {}

    public static Location buildLocation() {
        return Location.builder().longitude(116.397128).latitude(39.916527).build();
    }

    public static Location buildLocation(double lng, double lat) {
        return Location.builder().longitude(lng).latitude(lat).build();
    }

    public static Attraction buildAttraction() {
        return Attraction.builder()
                .name("故宫博物院")
                .address("北京市东城区景山前街4号")
                .location(buildLocation(116.403414, 39.924091))
                .visitDuration(240)
                .description("中国明清两代的皇家宫殿")
                .category("历史文化")
                .rating(4.9)
                .ticketPrice(60)
                .reservationRequired(true)
                .reservationTips("需提前7天在官网预约")
                .build();
    }

    public static Attraction buildAttraction(String name) {
        return Attraction.builder()
                .name(name)
                .address("测试地址")
                .location(buildLocation())
                .visitDuration(120)
                .description("测试景点")
                .category("景点")
                .ticketPrice(0)
                .reservationRequired(false)
                .build();
    }

    public static Meal buildMeal() {
        return Meal.builder()
                .type("breakfast")
                .name("庆丰包子铺")
                .address("西城区西安门大街")
                .location(buildLocation())
                .description("北京特色早餐")
                .estimatedCost(30)
                .build();
    }

    public static Meal buildMeal(String type, String name) {
        return Meal.builder()
                .type(type)
                .name(name)
                .address("测试地址")
                .estimatedCost(50)
                .build();
    }

    public static Hotel buildHotel() {
        return Hotel.builder()
                .name("北京饭店")
                .address("东城区东长安街")
                .location(buildLocation())
                .priceRange("500-800元")
                .rating("4.5")
                .distance("距天安门500米")
                .type("商务酒店")
                .estimatedCost(600)
                .build();
    }

    public static DayPlan buildDayPlan() {
        return DayPlan.builder()
                .date("2025-06-01")
                .dayIndex(0)
                .city("北京")
                .isTransferDay(false)
                .description("北京一日游")
                .transportation("公共交通")
                .accommodation("经济型酒店")
                .hotel(buildHotel())
                .attractions(List.of(buildAttraction()))
                .meals(List.of(buildMeal()))
                .build();
    }

    public static DayPlan buildDayPlan(int dayIndex, String city) {
        return DayPlan.builder()
                .date("2025-06-0" + (dayIndex + 1))
                .dayIndex(dayIndex)
                .city(city)
                .isTransferDay(false)
                .description(city + "游览")
                .transportation("公共交通")
                .accommodation("经济型酒店")
                .hotel(buildHotel())
                .attractions(List.of(buildAttraction(city + "景点")))
                .meals(List.of(
                        buildMeal("breakfast", "早餐"),
                        buildMeal("lunch", "午餐"),
                        buildMeal("dinner", "晚餐")
                ))
                .build();
    }

    public static WeatherInfo buildWeatherInfo() {
        return WeatherInfo.builder()
                .date("2025-06-01")
                .city("北京")
                .dayWeather("晴")
                .nightWeather("多云")
                .dayTemp(30)
                .nightTemp(20)
                .windDirection("南风")
                .windPower("1-3级")
                .build();
    }

    public static Budget buildBudget() {
        return Budget.builder()
                .totalAttractions(180)
                .totalHotels(1200)
                .totalMeals(480)
                .totalTransportation(200)
                .totalInterCityTransport(0)
                .total(2060)
                .build();
    }

    public static TripPlan buildTripPlan() {
        return TripPlan.builder()
                .city("北京")
                .cities(List.of("北京"))
                .startDate("2025-06-01")
                .endDate("2025-06-03")
                .days(List.of(buildDayPlan()))
                .weatherInfo(List.of(buildWeatherInfo()))
                .overallSuggestions("建议穿舒适的鞋子")
                .budget(buildBudget())
                .build();
    }

    public static TripPlan buildMultiCityTripPlan() {
        DayPlan day0 = DayPlan.builder()
                .date("2025-06-01").dayIndex(0).city("北京")
                .isTransferDay(false).description("北京游览")
                .transportation("公共交通").accommodation("经济型酒店")
                .hotel(buildHotel())
                .attractions(List.of(buildAttraction("故宫")))
                .meals(List.of(buildMeal("breakfast", "早餐"), buildMeal("lunch", "午餐"), buildMeal("dinner", "晚餐")))
                .build();
        DayPlan day1 = DayPlan.builder()
                .date("2025-06-02").dayIndex(1).city("北京")
                .isTransferDay(false).description("北京游览")
                .transportation("公共交通").accommodation("经济型酒店")
                .hotel(buildHotel())
                .attractions(List.of(buildAttraction("长城")))
                .meals(List.of(buildMeal("breakfast", "早餐"), buildMeal("lunch", "午餐"), buildMeal("dinner", "晚餐")))
                .build();
        DayPlan day2 = DayPlan.builder()
                .date("2025-06-03").dayIndex(2).city("上海")
                .isTransferDay(true).transferInfo("北京→上海 高铁")
                .description("前往上海").transportation("高铁").accommodation("经济型酒店")
                .hotel(buildHotel())
                .attractions(List.of(buildAttraction("外滩")))
                .meals(List.of(buildMeal("breakfast", "早餐"), buildMeal("lunch", "午餐"), buildMeal("dinner", "晚餐")))
                .build();

        return TripPlan.builder()
                .city("北京")
                .cities(List.of("北京", "上海"))
                .startDate("2025-06-01")
                .endDate("2025-06-03")
                .days(List.of(day0, day1, day2))
                .weatherInfo(List.of(buildWeatherInfo()))
                .overallSuggestions("多城市行程注意城际交通时间")
                .budget(Budget.builder()
                        .totalAttractions(180).totalHotels(1800).totalMeals(720)
                        .totalTransportation(300).totalInterCityTransport(500).total(3500)
                        .build())
                .build();
    }

    public static TripRequest buildTripRequest() {
        return TripRequest.builder()
                .city("北京")
                .startDate("2025-06-01")
                .endDate("2025-06-03")
                .travelDays(3)
                .transportation("公共交通")
                .accommodation("经济型酒店")
                .preferences(List.of("历史文化"))
                .language("zh")
                .build();
    }

    public static TripRequest buildMultiCityTripRequest() {
        return TripRequest.builder()
                .city("")
                .cities(List.of(
                        CityStay.builder().city("北京").days(2).build(),
                        CityStay.builder().city("上海").days(1).build()
                ))
                .startDate("2025-06-01")
                .endDate("2025-06-03")
                .travelDays(3)
                .transportation("公共交通")
                .accommodation("经济型酒店")
                .preferences(List.of("历史文化", "美食"))
                .language("zh")
                .build();
    }

    public static AppSettings buildAppSettings() {
        AppSettings settings = new AppSettings();
        settings.setName("HelloAgents智能旅行助手");
        settings.setVersion("2.0.0");
        settings.setDebug(true);
        settings.setCorsOrigins("http://localhost:5173,http://localhost:3000");
        settings.setTencentMapsKey("test-tencent-key");
        settings.setGoogleMapsApiKey("");
        settings.setXhsCookie("test_cookie=value");
        settings.setLlmActiveProvider("openai");

        AppSettings.LlmConfig llmConfig = settings.getLlm();
        llmConfig.setTimeout(60);

        AppSettings.LlmProviderProps openai = new AppSettings.LlmProviderProps();
        openai.setName("GPT (OpenAI)");
        openai.setApiKey("test-api-key");
        openai.setBaseUrl("http://localhost:0/v1");
        openai.setModel("gpt-4");
        llmConfig.getProviders().put("openai", openai);

        return settings;
    }

    public static String buildLlmChatResponse(String content) {
        return "{\"id\":\"chatcmpl-test\",\"object\":\"chat.completion\",\"choices\":[{\"message\":{\"role\":\"assistant\",\"content\":\"" + content + "\"},\"finish_reason\":\"stop\"}]}";
    }
}
