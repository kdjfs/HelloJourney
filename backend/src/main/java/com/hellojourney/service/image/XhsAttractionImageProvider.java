package com.hellojourney.service.image;

import com.hellojourney.config.AppSettings;
import com.hellojourney.model.vo.AttractionImageResult;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.Optional;

/**
 * 小红书景点实拍图（移植自 TripStar 的「景点图片来自小红书真实笔记」能力）。
 *
 * <p>排在 {@link AmapAttractionImageProvider} 之后作为补充：只有高德解析不出已验证图片时才走这里。
 * 返回的地址是本服务的代理路由 {@code /api/poi/xhs-image}，而不是小红书直链——
 * 直链带 Referer 校验且分钟级失效，直出给浏览器会 403 / 破图。</p>
 */
@Slf4j
@Component
@Order(20)
@RequiredArgsConstructor
public class XhsAttractionImageProvider implements AttractionImageProvider {

    private final AppSettings appSettings;
    private final XhsImageProxyService xhsImageProxyService;

    @Override
    public String providerId() {
        return "xiaohongshu";
    }

    @Override
    public AttractionImageResult resolveImage(String attractionName, String city, String poiId) {
        if (!xhsConfigured()) {
            return null;
        }

        Optional<String> directUrl = xhsImageProxyService.resolveDirectUrl(attractionName, city);
        if (directUrl.isEmpty()) {
            return null;
        }

        String proxyUrl = "/api/poi/xhs-image?name=" + encode(attractionName) + "&city=" + encode(city);
        return AttractionImageResult.verified(proxyUrl, providerId(), attractionName, "", 0.72);
    }

    private boolean xhsConfigured() {
        try {
            String cookie = appSettings.getXhsCookie();
            return cookie != null && !cookie.isBlank();
        } catch (RuntimeException exception) {
            return false;
        }
    }

    private String encode(String value) {
        return URLEncoder.encode(value == null ? "" : value.trim(), StandardCharsets.UTF_8)
                .toLowerCase(Locale.ROOT)
                .replace("+", "%20");
    }
}
