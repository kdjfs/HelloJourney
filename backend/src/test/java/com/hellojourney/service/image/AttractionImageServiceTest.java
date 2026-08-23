package com.hellojourney.service.image;

import com.hellojourney.model.vo.AttractionImageResult;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;

class AttractionImageServiceTest {

    @Test
    void resolveImage_sameCityAndName_usesLocalCache() {
        AtomicInteger calls = new AtomicInteger();
        AttractionImageProvider provider = new AttractionImageProvider() {
            @Override
            public String providerId() {
                return "amap";
            }

            @Override
            public AttractionImageResult resolveImage(String attractionName, String city, String poiId) {
                calls.incrementAndGet();
                return AttractionImageResult.verified(
                        "https://aos-cdn-image.amap.com/canton-tower.jpg",
                        "amap", "广州塔", "poi-1", 1.0);
            }
        };
        AttractionImageService service = new AttractionImageService(List.of(provider));

        AttractionImageResult first = service.resolveImage(" 广州塔 ", "广州", null);
        AttractionImageResult second = service.resolveImage("广州塔", " 广州 ", "another-id");

        assertThat(first).isEqualTo(second);
        assertThat(calls).hasValue(1);
    }

    @Test
    void resolveImage_noProviderMatch_returnsDeterministicEmptyResult() {
        AtomicInteger calls = new AtomicInteger();
        AttractionImageProvider provider = new AttractionImageProvider() {
            @Override
            public String providerId() {
                return "amap";
            }

            @Override
            public AttractionImageResult resolveImage(String attractionName, String city, String poiId) {
                calls.incrementAndGet();
                return AttractionImageResult.notFound();
            }
        };
        AttractionImageService service = new AttractionImageService(List.of(provider));

        AttractionImageResult result = service.resolveImage("陈家祠", "广州", null);
        AttractionImageResult cachedResult = service.resolveImage("陈家祠", "广州", null);

        assertThat(result.isVerified()).isFalse();
        assertThat(result.getImageUrl()).isEmpty();
        assertThat(result.getConfidence()).isZero();
        assertThat(result.getProvider()).isEqualTo("none");
        assertThat(cachedResult).isEqualTo(result);
        assertThat(calls).hasValue(1);
    }
}
