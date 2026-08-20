package com.hellojourney.service.image;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hellojourney.config.AppSettings;
import com.hellojourney.model.vo.AttractionImageResult;
import lombok.extern.slf4j.Slf4j;
import okhttp3.HttpUrl;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.TimeUnit;

@Slf4j
@Component
@Order(10)
public class AmapAttractionImageProvider implements AttractionImageProvider {
    private static final int MAX_RESULTS = 10;

    private final AppSettings appSettings;
    private final ObjectMapper objectMapper;
    private final OkHttpClient httpClient;

    public AmapAttractionImageProvider(AppSettings appSettings, ObjectMapper objectMapper) {
        this.appSettings = appSettings;
        this.objectMapper = objectMapper;
        this.httpClient = new OkHttpClient.Builder()
                .connectTimeout(8, TimeUnit.SECONDS)
                .readTimeout(10, TimeUnit.SECONDS)
                .writeTimeout(8, TimeUnit.SECONDS)
                .callTimeout(12, TimeUnit.SECONDS)
                .build();
    }

    @Override
    public String providerId() {
        return "amap";
    }

    @Override
    public AttractionImageResult resolveImage(String attractionName, String city, String poiId) {
        if (!validQuery(attractionName, city) || appSettings.getAmapMapsKey().isBlank()) {
            return AttractionImageResult.notFound();
        }

        HttpUrl url = buildSearchUrl(attractionName.trim(), city.trim());
        if (url == null) {
            return AttractionImageResult.notFound();
        }

        Request request = new Request.Builder()
                .url(url)
                .header("Accept", "application/json")
                .header("User-Agent", "HelloJourney/3.1")
                .get()
                .build();

        try (Response response = httpClient.newCall(request).execute()) {
            if (!response.isSuccessful() || response.body() == null) {
                log.warn("amap_attraction_image_failed status={}", response.code());
                return AttractionImageResult.notFound();
            }
            JsonNode root = objectMapper.readTree(response.body().string());
            if (!"1".equals(root.path("status").asText())) {
                log.warn("amap_attraction_image_rejected infoCode={}", safeInfoCode(root.path("infocode").asText()));
                return AttractionImageResult.notFound();
            }
            return selectBestMatch(root.path("pois"), attractionName, city, poiId);
        } catch (Exception exception) {
            log.warn("amap_attraction_image_failed type={}", exception.getClass().getSimpleName());
            return AttractionImageResult.notFound();
        }
    }

    private HttpUrl buildSearchUrl(String attractionName, String city) {
        HttpUrl base = HttpUrl.parse(appSettings.getAmapMaps().getBaseUrl());
        if (base == null || !"https".equalsIgnoreCase(base.scheme()) && !isLoopback(base.host())) {
            return null;
        }
        return base.newBuilder()
                .addPathSegments("v5/place/text")
                .addQueryParameter("key", appSettings.getAmapMapsKey())
                .addQueryParameter("keywords", attractionName)
                .addQueryParameter("region", city)
                .addQueryParameter("city_limit", "true")
                .addQueryParameter("show_fields", "photos,business")
                .addQueryParameter("page_size", String.valueOf(MAX_RESULTS))
                .addQueryParameter("page_num", "1")
                .build();
    }

    private AttractionImageResult selectBestMatch(JsonNode pois, String attractionName, String city, String poiId) {
        if (!pois.isArray()) {
            return AttractionImageResult.notFound();
        }

        Candidate best = null;
        for (JsonNode poi : pois) {
            String matchedName = poi.path("name").asText("").trim();
            String matchedCity = poi.path("cityname").asText("").trim();
            if (!sameCity(city, matchedCity)) {
                continue;
            }

            double confidence = matchConfidence(attractionName, matchedName, aliases(poi));
            if (confidence == 0.0) {
                continue;
            }

            String imageUrl = firstSafePhoto(poi.path("photos"));
            if (imageUrl.isEmpty()) {
                continue;
            }

            String matchedPoiId = poi.path("id").asText("").trim();
            int identityBonus = poiId != null && !poiId.isBlank() && poiId.trim().equals(matchedPoiId) ? 1 : 0;
            Candidate candidate = new Candidate(imageUrl, matchedName, matchedPoiId, confidence, identityBonus);
            if (best == null || candidate.rank() > best.rank()) {
                best = candidate;
            }
        }

        if (best == null) {
            return AttractionImageResult.notFound();
        }
        return AttractionImageResult.verified(best.imageUrl(), providerId(), best.name(), best.poiId(), best.confidence());
    }

    private double matchConfidence(String requestedName, String officialName, List<String> aliases) {
        String requested = normalizeName(requestedName);
        String official = normalizeName(officialName);
        if (requested.equals(official)) {
            return 1.0;
        }
        if (aliases.stream().map(this::normalizeName).anyMatch(requested::equals)) {
            return 0.98;
        }
        // Colloquial suffix variants are common in official POI data (e.g. 长隆野生动物园 vs
        // 长隆野生动物世界, 华南植物园 vs 华南国家植物园). Accept them only when the stripped
        // core is identical and non-trivial; unrelated near-matches (e.g. 广州塔蜡像馆) stay rejected.
        String requestedCore = stripCommonSuffixes(requested);
        if (!requestedCore.equals(requested) && requestedCore.equals(stripCommonSuffixes(official))) {
            return 0.95;
        }
        if (!requestedCore.equals(requested)
                && aliases.stream().map(this::normalizeName).map(this::stripCommonSuffixes)
                .anyMatch(requestedCore::equals)) {
            return 0.93;
        }
        return 0.0;
    }

    private String stripCommonSuffixes(String name) {
        String core = name.replaceFirst(
                "(野生动物园|野生动物世界|国家植物园|动物园|动物世界|植物园|风景名胜区|风景区|景区|公园|世界|园|国家)$", "");
        return core.length() >= 2 ? core : name;
    }

    private List<String> aliases(JsonNode poi) {
        List<String> result = new ArrayList<>();
        addAliases(result, poi.path("alias"));
        addAliases(result, poi.path("business").path("alias"));
        return result;
    }

    private void addAliases(List<String> target, JsonNode value) {
        if (value.isArray()) {
            value.forEach(item -> target.add(item.asText("")));
            return;
        }
        String text = value.asText("");
        if (!text.isBlank()) {
            for (String alias : text.split("[|,，;/、]")) {
                if (!alias.isBlank()) target.add(alias.trim());
            }
        }
    }

    private String firstSafePhoto(JsonNode photos) {
        if (!photos.isArray()) {
            return "";
        }
        for (JsonNode photo : photos) {
            String rawUrl = photo.path("url").asText("").trim();
            try {
                URI uri = URI.create(rawUrl);
                String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase(Locale.ROOT);
                String host = uri.getHost() == null ? "" : uri.getHost().toLowerCase(Locale.ROOT);
                if (host.isEmpty()) {
                    continue;
                }
                if (!"https".equals(scheme)) {
                    // AMap CDN hosts serve the same files over TLS; upgrade their http URLs
                    // so the frontend never loads mixed content. Foreign hosts stay rejected.
                    if (!"http".equals(scheme) || !isTrustedAmapImageHost(host)) {
                        continue;
                    }
                    uri = new URI("https", uri.getUserInfo(), host, uri.getPort(), uri.getPath(), uri.getQuery(), uri.getFragment());
                }
                return uri.toASCIIString();
            } catch (IllegalArgumentException | java.net.URISyntaxException ignored) {
                // Ignore malformed provider data and continue looking for a safe photo.
            }
        }
        return "";
    }

    private boolean isTrustedAmapImageHost(String host) {
        return host.endsWith(".is.autonavi.com") || host.endsWith(".amap.com");
    }

    private boolean sameCity(String expected, String actual) {
        return !actual.isBlank() && normalizeCity(expected).equals(normalizeCity(actual));
    }

    private String normalizeCity(String value) {
        return normalizeName(value).replaceFirst("(特别行政区|维吾尔自治区|壮族自治区|回族自治区|自治区|省|市)$", "");
    }

    private String normalizeName(String value) {
        return value == null ? "" : value
                .toLowerCase(Locale.ROOT)
                .replaceAll("[\\p{P}\\p{Z}\\s]", "");
    }

    private boolean validQuery(String attractionName, String city) {
        return attractionName != null && !attractionName.isBlank() && attractionName.length() <= 80
                && city != null && !city.isBlank() && city.length() <= 80;
    }

    private boolean isLoopback(String host) {
        return "localhost".equalsIgnoreCase(host) || "127.0.0.1".equals(host);
    }

    private String safeInfoCode(String infoCode) {
        return infoCode != null && infoCode.matches("[A-Za-z0-9_-]{1,32}") ? infoCode : "unknown";
    }

    private record Candidate(String imageUrl, String name, String poiId, double confidence, int identityBonus) {
        double rank() {
            return confidence + identityBonus;
        }
    }
}
