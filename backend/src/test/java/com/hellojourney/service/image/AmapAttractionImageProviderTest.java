package com.hellojourney.service.image;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hellojourney.config.AppSettings;
import com.hellojourney.model.vo.AttractionImageResult;
import okhttp3.mockwebserver.MockResponse;
import okhttp3.mockwebserver.MockWebServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.io.IOException;

import static org.assertj.core.api.Assertions.assertThat;

class AmapAttractionImageProviderTest {
    private MockWebServer server;
    private AmapAttractionImageProvider provider;
    private AppSettings settings;

    @BeforeEach
    void setUp() throws IOException {
        server = new MockWebServer();
        server.start();

        settings = new AppSettings();
        settings.getAmapMaps().setKey("amap-test-key");
        settings.getAmapMaps().setBaseUrl(server.url("/").newBuilder().host("127.0.0.1").build().toString());
        provider = new AmapAttractionImageProvider(settings, new ObjectMapper());
    }

    @AfterEach
    void tearDown() throws IOException {
        server.shutdown();
    }

    @Test
    void resolveImage_exactNameAndCity_returnsVerifiedPhoto() {
        enqueuePoi("广州塔", "广州市", "B00140TY2A", "", "https://aos-cdn-image.amap.com/guangzhou-tower.jpg");

        assertThat(settings.getAmapMapsKey()).isEqualTo("amap-test-key");
        assertThat(settings.getAmapMaps().getBaseUrl()).startsWith("http://127.0.0.1:");

        AttractionImageResult result = provider.resolveImage("广州塔", "广州", "");

        assertThat(server.getRequestCount()).isEqualTo(1);
        assertThat(result.isVerified()).as(result.toString()).isTrue();
        assertThat(result.getProvider()).isEqualTo("amap");
        assertThat(result.getMatchedName()).isEqualTo("广州塔");
        assertThat(result.getMatchedPoiId()).isEqualTo("B00140TY2A");
        assertThat(result.getImageUrl()).isEqualTo("https://aos-cdn-image.amap.com/guangzhou-tower.jpg");
        assertThat(result.getConfidence()).isEqualTo(1.0);
    }

    @Test
    void resolveImage_officialAlias_returnsVerifiedPhoto() {
        enqueuePoi("广州长隆野生动物世界", "广州市", "B00140KXGJ", "长隆野生动物园",
                "https://aos-cdn-image.amap.com/chimelong.jpg");

        AttractionImageResult result = provider.resolveImage("长隆野生动物园", "广州", null);

        assertThat(result.isVerified()).as(result.toString()).isTrue();
        assertThat(result.getMatchedName()).isEqualTo("广州长隆野生动物世界");
        assertThat(result.getConfidence()).isEqualTo(0.98);
    }

    @Test
    void resolveImage_similarNameButNotExact_returnsNotFound() {
        enqueuePoi("广州塔蜡像馆", "广州市", "nearby", "", "https://aos-cdn-image.amap.com/wrong.jpg");

        AttractionImageResult result = provider.resolveImage("广州塔", "广州", null);

        assertThat(result.isVerified()).isFalse();
        assertThat(result.getImageUrl()).isEmpty();
    }

    @Test
    void resolveImage_cityMismatch_returnsNotFound() {
        enqueuePoi("广州塔", "佛山市", "wrong-city", "", "https://aos-cdn-image.amap.com/wrong-city.jpg");

        AttractionImageResult result = provider.resolveImage("广州塔", "广州", null);

        assertThat(result.isVerified()).isFalse();
        assertThat(result.getImageUrl()).isEmpty();
    }

    @Test
    void resolveImage_unsafePhotoScheme_returnsNotFound() {
        enqueuePoi("广州塔", "广州市", "unsafe", "", "javascript:alert(1)");

        AttractionImageResult result = provider.resolveImage("广州塔", "广州", null);

        assertThat(result.isVerified()).isFalse();
        assertThat(result.getImageUrl()).isEmpty();
    }

    private void enqueuePoi(String name, String city, String id, String alias, String photoUrl) {
        server.enqueue(new MockResponse()
                .setHeader("Content-Type", "application/json")
                .setBody("""
                        {
                          "status": "1",
                          "pois": [{
                            "id": "%s",
                            "name": "%s",
                            "cityname": "%s",
                            "business": {"alias": "%s"},
                            "photos": [{"title": "实景", "url": "%s"}]
                          }]
                        }
                        """.formatted(id, name, city, alias, photoUrl)));
    }
}
