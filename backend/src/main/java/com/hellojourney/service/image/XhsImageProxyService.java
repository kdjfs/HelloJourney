package com.hellojourney.service.image;

import com.hellojourney.service.XhsService;
import lombok.extern.slf4j.Slf4j;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import okhttp3.ResponseBody;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.net.URI;
import java.time.Duration;
import java.time.Instant;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.TimeUnit;

/**
 * 小红书景点图片代理。
 *
 * <p>小红书返回的图片直链带签名、分钟级失效，且对 Referer 有校验（非 localhost 部署直接 403）。
 * 因此前端不直连小红书 CDN，而是请求本服务的 {@code /api/poi/xhs-image}：
 * 服务端按景点名实时解析直链 → 带 Referer 下载 → 内存缓存后回吐字节流。</p>
 */
@Slf4j
@Service
public class XhsImageProxyService {
    private static final Duration CACHE_TTL = Duration.ofHours(6);
    /** 直链本身分钟级失效，缓存久了会拿到过期 URL，这里只留 20 分钟 */
    private static final Duration DIRECT_URL_TTL = Duration.ofMinutes(20);
    private static final int MAX_CACHE_ENTRIES = 200;
    private static final long MAX_BYTES = 8L * 1024 * 1024;
    private static final String XHS_REFERER = "https://www.xiaohongshu.com/";
    private static final String USER_AGENT =
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36";

    private final XhsService xhsService;
    private final OkHttpClient httpClient;
    private final Map<String, CacheEntry> cache = Collections.synchronizedMap(
            new LinkedHashMap<>(64, 0.75f, true) {
                @Override
                protected boolean removeEldestEntry(Map.Entry<String, CacheEntry> eldest) {
                    return size() > MAX_CACHE_ENTRIES;
                }
            });
    /** 已解析出的直链缓存：避免「校验存在性」和「图片代理」各抓一次小红书 */
    private final Map<String, DirectUrlEntry> directUrlCache = Collections.synchronizedMap(
            new LinkedHashMap<>(64, 0.75f, true) {
                @Override
                protected boolean removeEldestEntry(Map.Entry<String, DirectUrlEntry> eldest) {
                    return size() > MAX_CACHE_ENTRIES;
                }
            });

    private record DirectUrlEntry(String url, Instant expiresAt) {
        boolean isAlive() {
            return Instant.now().isBefore(expiresAt);
        }
    }

    public XhsImageProxyService(XhsService xhsService) {
        this.xhsService = xhsService;
        this.httpClient = new OkHttpClient.Builder()
                .connectTimeout(10, TimeUnit.SECONDS)
                .readTimeout(15, TimeUnit.SECONDS)
                .callTimeout(25, TimeUnit.SECONDS)
                .retryOnConnectionFailure(true)
                .followRedirects(true)
                .build();
    }

    /** 代理返回的图片内容 */
    public record ImagePayload(byte[] bytes, String contentType) {
    }

    private record CacheEntry(byte[] bytes, String contentType, Instant expiresAt) {
        boolean isAlive() {
            return Instant.now().isBefore(expiresAt);
        }
    }

    public Optional<ImagePayload> loadImage(String attractionName, String city) {
        if (attractionName == null || attractionName.isBlank()) {
            return Optional.empty();
        }

        String cacheKey = cacheKey(city, attractionName);
        CacheEntry cached = cache.get(cacheKey);
        if (cached != null && cached.isAlive()) {
            return Optional.of(new ImagePayload(cached.bytes(), cached.contentType()));
        }

        Optional<String> directUrl = resolveDirectUrl(attractionName, city);
        if (directUrl.isEmpty()) {
            return Optional.empty();
        }

        Optional<ImagePayload> downloaded = download(directUrl.get());
        downloaded.ifPresent(payload ->
                cache.put(cacheKey, new CacheEntry(payload.bytes(), payload.contentType(), Instant.now().plus(CACHE_TTL))));
        return downloaded;
    }

    /**
     * 解析某个景点在小红书上的首图直链（带短时缓存）。
     * 供图片 Provider 判断「这个景点到底有没有小红书图」，同时被 {@link #loadImage} 复用。
     */
    public Optional<String> resolveDirectUrl(String attractionName, String city) {
        if (attractionName == null || attractionName.isBlank()) {
            return Optional.empty();
        }

        String key = cacheKey(city, attractionName);
        DirectUrlEntry cached = directUrlCache.get(key);
        if (cached != null) {
            if (cached.isAlive()) {
                return Optional.of(cached.url());
            }
            directUrlCache.remove(key);
        }

        String directUrl;
        try {
            directUrl = xhsService.getPhotoFromXhs(attractionName.trim() + " 风景");
        } catch (RuntimeException exception) {
            log.warn("xhs_image_resolve_failed name={} type={}", attractionName,
                    exception.getClass().getSimpleName());
            return Optional.empty();
        }

        if (directUrl == null || directUrl.isBlank() || !isAllowedHost(directUrl)) {
            return Optional.empty();
        }

        directUrlCache.put(key, new DirectUrlEntry(directUrl, Instant.now().plus(DIRECT_URL_TTL)));
        return Optional.of(directUrl);
    }

    private String cacheKey(String city, String attractionName) {
        return (city == null ? "" : city.trim()) + "|" + attractionName.trim();
    }

    /** 只允许小红书自家 CDN，避免被当作开放代理 */
    private boolean isAllowedHost(String url) {
        try {
            String host = URI.create(url).getHost();
            if (host == null) return false;
            String lower = host.toLowerCase(Locale.ROOT);
            return lower.endsWith("xhscdn.com") || lower.endsWith("xiaohongshu.com");
        } catch (IllegalArgumentException exception) {
            return false;
        }
    }

    private Optional<ImagePayload> download(String url) {
        Request request = new Request.Builder()
                .url(url)
                .addHeader("User-Agent", USER_AGENT)
                .addHeader("Referer", XHS_REFERER)
                .addHeader("Accept", "image/avif,image/webp,image/apng,image/*,*/*;q=0.8")
                .get()
                .build();

        try (Response response = httpClient.newCall(request).execute()) {
            if (!response.isSuccessful()) {
                log.debug("xhs_image_http_error status={}", response.code());
                return Optional.empty();
            }

            String contentType = response.header("Content-Type", "image/jpeg");
            if (!contentType.toLowerCase(Locale.ROOT).startsWith("image/")) {
                return Optional.empty();
            }

            ResponseBody body = response.body();
            if (body == null) return Optional.empty();
            if (body.contentLength() > MAX_BYTES) {
                log.debug("xhs_image_too_large size={}", body.contentLength());
                return Optional.empty();
            }

            byte[] bytes = body.bytes();
            if (bytes.length == 0 || bytes.length > MAX_BYTES) return Optional.empty();
            return Optional.of(new ImagePayload(bytes, contentType));
        } catch (IOException exception) {
            log.debug("xhs_image_download_failed: {}", exception.getMessage());
            return Optional.empty();
        }
    }
}
