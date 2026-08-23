package com.hellojourney.agent.planning;

import com.hellojourney.model.dto.TripRequest;
import com.hellojourney.model.entity.Attraction;
import com.hellojourney.model.entity.Budget;
import com.hellojourney.model.entity.DayPlan;
import com.hellojourney.model.entity.Hotel;
import com.hellojourney.model.entity.Location;
import com.hellojourney.model.entity.Meal;
import com.hellojourney.model.entity.TripPlan;
import com.hellojourney.model.entity.WeatherInfo;

import java.util.List;

final class PlanningTestData {
    private PlanningTestData() {
    }

    static TripRequest request() {
        return TripRequest.builder()
                .city("北京")
                .startDate("2026-08-21")
                .endDate("2026-08-21")
                .travelDays(1)
                .transportation("公共交通")
                .accommodation("舒适型酒店")
                .preferences(List.of("历史文化"))
                .language("zh")
                .build();
    }

    static TripPlan plan() {
        Attraction attraction = Attraction.builder()
                .name("故宫博物院").address("北京市东城区景山前街4号")
                .location(Location.builder().longitude(116.4034).latitude(39.9241).build())
                .visitDuration(180).description("明清皇家宫殿").category("历史文化")
                .ticketPrice(60).reservationRequired(true).reservationTips("提前预约")
                .startTime("09:00").endTime("12:00").build();
        Hotel hotel = Hotel.builder()
                .name("北京饭店").address("东长安街33号")
                .location(Location.builder().longitude(116.406).latitude(39.908).build())
                .priceRange("600-900元").rating("4.7").distance("距故宫2公里")
                .type("舒适型").estimatedCost(700).build();
        List<Meal> meals = List.of(
                meal("breakfast", "早餐", 30), meal("lunch", "午餐", 80), meal("dinner", "晚餐", 100));
        DayPlan day = DayPlan.builder()
                .date("2026-08-21").dayIndex(0).city("北京")
                .isTransferDay(false).transferInfo("").description("故宫文化一日游")
                .transportation("公共交通").accommodation("舒适型酒店")
                .hotel(hotel).attractions(List.of(attraction)).meals(meals).build();
        WeatherInfo weather = WeatherInfo.builder()
                .date("2026-08-21").city("北京").dayWeather("晴").nightWeather("多云")
                .dayTemp(30).nightTemp(22).windDirection("南风").windPower("2级").build();
        Budget budget = Budget.builder()
                .totalAttractions(60).totalHotels(700).totalMeals(210)
                .totalTransportation(50).totalInterCityTransport(0).total(1020).build();
        return TripPlan.builder()
                .city("北京").cities(List.of("北京"))
                .startDate("2026-08-21").endDate("2026-08-21")
                .days(List.of(day)).weatherInfo(List.of(weather))
                .overallSuggestions("提前预约并携带身份证").budget(budget).build();
    }

    private static Meal meal(String type, String name, int cost) {
        return Meal.builder().type(type).name(name).address("北京市东城区")
                .description("当地餐饮").estimatedCost(cost).build();
    }
}
