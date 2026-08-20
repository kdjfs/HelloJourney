package com.hellojourney.agent.planning;

import com.hellojourney.model.dto.TripRequest;
import com.hellojourney.model.entity.Attraction;
import com.hellojourney.model.entity.Budget;
import com.hellojourney.model.entity.DayPlan;
import com.hellojourney.model.entity.Location;
import com.hellojourney.model.entity.TripPlan;
import com.hellojourney.model.entity.WeatherInfo;
import com.hellojourney.model.vo.review.ReviewIssue;
import com.hellojourney.model.vo.review.ReviewSeverity;
import com.hellojourney.model.vo.review.TripReviewResult;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.LocalTime;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Component
public class TripReviewAgent {

    public TripReviewResult review(TripPlan plan, TripRequest request) {
        List<ReviewIssue> warnings = new ArrayList<>();
        List<ReviewIssue> errors = new ArrayList<>();
        List<String> fixes = new ArrayList<>();

        LocalDate requestedStart = parseDate(request.getStartDate(), "$.request.start_date", errors);
        LocalDate requestedEnd = parseDate(request.getEndDate(), "$.request.end_date", errors);
        LocalDate planStart = parseDate(plan.getStartDate(), "$.start_date", errors);
        LocalDate planEnd = parseDate(plan.getEndDate(), "$.end_date", errors);
        if (requestedStart != null && !requestedStart.equals(planStart)) {
            error(errors, "$.start_date", "date_mismatch", "行程开始日期与请求不一致");
        }
        if (requestedEnd != null && !requestedEnd.equals(planEnd)) {
            error(errors, "$.end_date", "date_mismatch", "行程结束日期与请求不一致");
        }

        List<DayPlan> days = plan.getDays() == null ? List.of() : plan.getDays();
        if (days.size() != request.getTravelDays()) {
            error(errors, "$.days", "day_count_mismatch", "每日行程数量与旅行天数不一致");
            fixes.add("按请求天数补齐或删除每日行程");
        }
        Set<String> allowedCities = new HashSet<>(request.getCities().stream().map(city -> city.getCity()).toList());
        Set<LocalDate> seenDates = new HashSet<>();
        for (int index = 0; index < days.size(); index++) {
            DayPlan day = days.get(index);
            String path = "$.days[" + index + "]";
            LocalDate date = parseDate(day.getDate(), path + ".date", errors);
            if (requestedStart != null && date != null && !date.equals(requestedStart.plusDays(index))) {
                error(errors, path + ".date", "non_contiguous_date", "每日日期必须连续且按顺序排列");
            }
            if (date != null && !seenDates.add(date)) {
                error(errors, path + ".date", "duplicate_date", "每日日期不能重复");
            }
            if (day.getDayIndex() != index) {
                error(errors, path + ".day_index", "invalid_day_index", "day_index 必须从 0 连续递增");
            }
            if (!allowedCities.contains(day.getCity())) {
                error(errors, path + ".city", "unexpected_city", "每日城市不在请求城市范围内");
            }
            reviewAttractions(day, path, warnings, errors, fixes);
            if (day.getHotel() == null || day.getHotel().getName() == null || day.getHotel().getName().isBlank()) {
                error(errors, path + ".hotel", "missing_hotel", "每天必须有酒店候选");
            } else if (!"verified".equals(day.getHotel().getVerificationStatus())) {
                warning(warnings, path + ".hotel", "hotel_needs_verification", "酒店仍需地图服务确认");
            } else {
                validateVerifiedClaim(path + ".hotel", day.getHotel().getSource(), day.getHotel().getProvider(),
                        day.getHotel().getVerifiedAt(), day.getHotel().getPoiId(), errors);
            }
            Set<String> mealTypes = new HashSet<>();
            if (day.getMeals() != null) {
                day.getMeals().forEach(meal -> mealTypes.add(meal.getType()));
            }
            if (!mealTypes.containsAll(Set.of("breakfast", "lunch", "dinner"))) {
                error(errors, path + ".meals", "missing_required_meals", "每天必须包含早餐、午餐和晚餐");
            }
        }
        reviewWeather(plan, days, warnings, errors);
        reviewBudget(plan.getBudget(), errors, fixes);

        if (!errors.isEmpty() && fixes.isEmpty()) {
            fixes.add("根据 errors 中的路径修复数据后重新执行 Review Agent");
        }
        return new TripReviewResult(errors.isEmpty(), List.copyOf(warnings), List.copyOf(errors), List.copyOf(fixes));
    }

    private void reviewAttractions(DayPlan day, String dayPath, List<ReviewIssue> warnings,
                                   List<ReviewIssue> errors, List<String> fixes) {
        List<Attraction> attractions = day.getAttractions() == null ? List.of() : day.getAttractions();
        if (attractions.isEmpty()) {
            error(errors, dayPath + ".attractions", "missing_attractions", "每天至少需要一个活动");
            return;
        }
        LocalTime previousEnd = null;
        for (int index = 0; index < attractions.size(); index++) {
            Attraction attraction = attractions.get(index);
            String path = dayPath + ".attractions[" + index + "]";
            Location location = attraction.getLocation();
            if (location == null || (location.getLongitude() == 0 && location.getLatitude() == 0)) {
                error(errors, path + ".location", "invalid_coordinate", "景点缺少可用坐标");
            }
            if (!"verified".equals(attraction.getVerificationStatus())) {
                warning(warnings, path, "poi_needs_verification", "景点仍需地图服务确认");
            } else {
                validateVerifiedClaim(path, attraction.getSource(), attraction.getProvider(),
                        attraction.getVerifiedAt(), attraction.getPoiId(), errors);
            }
            LocalTime start = parseTime(attraction.getStartTime(), path + ".start_time", warnings);
            LocalTime end = parseTime(attraction.getEndTime(), path + ".end_time", warnings);
            if (start != null && end != null) {
                if (!end.isAfter(start)) {
                    error(errors, path, "invalid_time_range", "活动结束时间必须晚于开始时间");
                }
                if (previousEnd != null && start.isBefore(previousEnd)) {
                    error(errors, path, "time_conflict", "活动时间发生冲突");
                    fixes.add("调整冲突活动的开始时间或停留时长");
                }
                previousEnd = end;
            }
        }
        if (attractions.size() > 1) {
            warning(warnings, dayPath + ".attractions", "route_needs_verification", "相邻景点路线需地图服务确认");
        }
    }

    private void reviewWeather(TripPlan plan, List<DayPlan> days, List<ReviewIssue> warnings,
                               List<ReviewIssue> errors) {
        Map<String, WeatherInfo> byDate = new HashMap<>();
        if (plan.getWeatherInfo() != null) {
            plan.getWeatherInfo().forEach(weather -> byDate.put(weather.getDate(), weather));
        }
        for (int index = 0; index < days.size(); index++) {
            DayPlan day = days.get(index);
            WeatherInfo weather = byDate.get(day.getDate());
            String path = "$.weather_info[date=" + day.getDate() + "]";
            if (weather == null) {
                error(errors, path, "missing_weather", "每个旅行日期都必须有天气信息");
            } else {
                if (!day.getCity().equals(weather.getCity())) {
                    error(errors, path + ".city", "weather_city_mismatch", "天气城市与当天城市不一致");
                }
                if (!"live_weather".equals(weather.getVerificationStatus())) {
                    warning(warnings, path, "weather_needs_verification", "天气不是实时验证数据");
                } else {
                    validateVerifiedClaim(path, weather.getSource(), weather.getProvider(),
                            weather.getVerifiedAt(), "weather", errors);
                }
            }
        }
    }

    private void reviewBudget(Budget budget, List<ReviewIssue> errors, List<String> fixes) {
        if (budget == null) {
            error(errors, "$.budget", "missing_budget", "必须提供预算汇总");
            return;
        }
        int calculated = budget.getTotalAttractions() + budget.getTotalHotels() + budget.getTotalMeals()
                + budget.getTotalTransportation() + budget.getTotalInterCityTransport();
        if (calculated != budget.getTotal()) {
            error(errors, "$.budget.total", "budget_total_mismatch", "预算总额必须等于各项费用之和");
            fixes.add("重新计算 budget.total");
        }
    }

    private void validateVerifiedClaim(String path, String source, String provider,
                                       String verifiedAt, String externalId, List<ReviewIssue> errors) {
        if (!"map_api".equals(source) || provider == null || provider.isBlank()
                || verifiedAt == null || verifiedAt.isBlank()
                || externalId == null || externalId.isBlank()) {
            error(errors, path, "invalid_verified_claim", "已验证状态必须带地图来源、provider、验证时间和外部标识");
        }
    }

    private LocalDate parseDate(String value, String path, List<ReviewIssue> errors) {
        try {
            return LocalDate.parse(value);
        } catch (DateTimeParseException | NullPointerException exception) {
            error(errors, path, "invalid_date", "日期必须使用 YYYY-MM-DD");
            return null;
        }
    }

    private LocalTime parseTime(String value, String path, List<ReviewIssue> warnings) {
        if (value == null || value.isBlank()) {
            warning(warnings, path, "missing_time", "活动缺少明确时间，编辑工作台可补充");
            return null;
        }
        try {
            return LocalTime.parse(value);
        } catch (DateTimeParseException exception) {
            warning(warnings, path, "invalid_time", "活动时间格式应为 HH:mm");
            return null;
        }
    }

    private void warning(List<ReviewIssue> target, String path, String code, String message) {
        target.add(new ReviewIssue(path, code, message, ReviewSeverity.WARNING));
    }

    private void error(List<ReviewIssue> target, String path, String code, String message) {
        target.add(new ReviewIssue(path, code, message, ReviewSeverity.ERROR));
    }
}
