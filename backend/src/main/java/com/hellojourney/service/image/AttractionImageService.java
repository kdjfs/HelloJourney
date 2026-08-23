package com.hellojourney.service.image;

import com.hellojourney.model.vo.AttractionImageResult;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Slf4j
@Service
public class AttractionImageService {
    private static final int MAX_CACHE_ENTRIES = 1_000;
    private static final Duration VERIFIED_TTL = Duration.ofHours(24);
    private static final Duration NOT_FOUND_TTL = Duration.ofMinutes(10);

    private final List<AttractionImageProvider> providers;
    private final Map<String, CacheEntry> cache = Collections.synchronizedMap(
            new LinkedHashMap<>(128, 0.75f, true) {
                @Override
                protected boolean removeEldestEntry(Map.Entry<String, CacheEntry> eldest) {
                    return size() > MAX_CACHE_ENTRIES;
                }
            });

    public AttractionImageService(List<AttractionImageProvider> providers) {
        this.providers = List.copyOf(providers);
    }

    public AttractionImageResult resolveImage(String attractionName, String city, String poiId) {
        if (!validQuery(attractionName, city)) {
            return AttractionImageResult.notFound();
        }

        String cacheKey = cacheKey(city, attractionName);
        AttractionImageResult cached = getCached(cacheKey);
        if (cached != null) {
            return cached;
        }

        for (AttractionImageProvider provider : providers) {
            try {
                AttractionImageResult result = provider.resolveImage(attractionName.trim(), city.trim(), cleanPoiId(poiId));
                if (result != null && result.isVerified() && !result.getImageUrl().isBlank()) {
                    putCached(cacheKey, result, VERIFIED_TTL);
                    return result;
                }
            } catch (RuntimeException exception) {
                log.warn("attraction_image_provider_failed provider={} type={}",
                        provider.providerId(), exception.getClass().getSimpleName());
            }
        }

        AttractionImageResult notFound = AttractionImageResult.notFound();
        putCached(cacheKey, notFound, NOT_FOUND_TTL);
        return notFound;
    }

    private AttractionImageResult getCached(String key) {
        synchronized (cache) {
            CacheEntry entry = cache.get(key);
            if (entry == null) return null;
            if (entry.expiresAt().isBefore(Instant.now())) {
                cache.remove(key);
                return null;
            }
            return entry.result();
        }
    }

    private void putCached(String key, AttractionImageResult result, Duration ttl) {
        cache.put(key, new CacheEntry(result, Instant.now().plus(ttl)));
    }

    private String cacheKey(String city, String attractionName) {
        return normalize(city) + ":" + normalize(attractionName);
    }

    private String normalize(String value) {
        return value.trim().toLowerCase(Locale.ROOT).replaceAll("[\\p{P}\\p{Z}\\s]", "");
    }

    private String cleanPoiId(String poiId) {
        if (poiId == null) return "";
        String value = poiId.trim();
        return value.length() <= 128 ? value : "";
    }

    private boolean validQuery(String attractionName, String city) {
        return attractionName != null && !attractionName.isBlank() && attractionName.length() <= 80
                && city != null && !city.isBlank() && city.length() <= 80;
    }

    private record CacheEntry(AttractionImageResult result, Instant expiresAt) {}
}
