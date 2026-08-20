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
    void resolveImage_exactNameAndCity_returnsVerifiedPhoto() throws InterruptedException {
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

        var requestUrl = server.takeRequest().getRequestUrl();
        assertThat(requestUrl).isNotNull();
        assertThat(requestUrl.encodedPath()).isEqualTo("/v5/place/text");
        assertThat(requestUrl.queryParameter("keywords")).isEqualTo("广州塔");
        assertThat(requestUrl.queryParameter("region")).isEqualTo("广州");
        assertThat(requestUrl.queryParameter("city_limit")).isEqualTo("true");
        assertThat(requestUrl.queryParameter("show_fields")).isEqualTo("photos,business");
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
    void resolveImage_suffixVariantOfficialName_returnsVerified() {
        enqueuePoi("长隆野生动物世界", "广州市", "B0FFFYPEE9", "香江野生动物世界",
                "http://store.is.autonavi.com/showpic/a918f102ea95db24dba028144b854df0");

        AttractionImageResult result = provider.resolveImage("长隆野生动物园", "广州", null);

        assertThat(result.isVerified()).isTrue();
        assertThat(result.getMatchedName()).isEqualTo("长隆野生动物世界");
        assertThat(result.getConfidence()).isEqualTo(0.95);
        assertThat(result.getImageUrl()).isEqualTo(
                "https://store.is.autonavi.com/showpic/a918f102ea95db24dba028144b854df0");
    }

    @Test
    void resolveImage_suffixVariantNationalPrefix_returnsVerified() {
        enqueuePoi("华南国家植物园", "广州市", "B00141U8TO", "植物园|中国科学院华南植物园",
                "http://store.is.autonavi.com/showpic/5a4052c4d5cc29c94f986f5e6e75b8a2");

        AttractionImageResult result = provider.resolveImage("华南植物园", "广州", null);

        assertThat(result.isVerified()).isTrue();
        assertThat(result.getMatchedName()).isEqualTo("华南国家植物园");
        assertThat(result.getConfidence()).isEqualTo(0.95);
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

    @Test
    void resolveImage_httpAmapCdnPhoto_isUpgradedToHttps() {
        enqueuePoi("广州塔", "广州市", "B00140WBI1", "",
                "http://store.is.autonavi.com/showpic/d5b56df50d024cbd33e4e1a16f77d419");

        AttractionImageResult result = provider.resolveImage("广州塔", "广州", null);

        assertThat(result.isVerified()).isTrue();
        assertThat(result.getImageUrl()).isEqualTo(
                "https://store.is.autonavi.com/showpic/d5b56df50d024cbd33e4e1a16f77d419");
    }

    @Test
    void resolveImage_httpForeignHostPhoto_staysRejected() {
        enqueuePoi("广州塔", "广州市", "B00140WBI1", "", "http://evil.example.com/guangzhou-tower.jpg");

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
