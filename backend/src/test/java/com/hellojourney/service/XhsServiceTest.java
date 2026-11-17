package com.hellojourney.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.type.TypeFactory;
import com.hellojourney.config.AppSettings;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class XhsServiceTest {

    @Mock
    private AppSettings appSettings;

    @Mock
    private ObjectMapper objectMapper;

    @Mock
    private LlmService llmService;

    @Mock
    private MapDispatcher mapDispatcher;

    @InjectMocks
    private XhsService xhsService;

    private final TypeFactory realTypeFactory = new ObjectMapper().getTypeFactory();

    @Nested
    @DisplayName("normalizeXhsCookie")
    class NormalizeXhsCookie {

        @Test
        @DisplayName("null returns empty string")
        void normalizeXhsCookie_null_returnsEmpty() {
            assertThat(xhsService.normalizeXhsCookie(null)).isEmpty();
        }

        @Test
        @DisplayName("empty string returns empty string")
        void normalizeXhsCookie_empty_returnsEmpty() {
            assertThat(xhsService.normalizeXhsCookie("")).isEmpty();
        }

        @Test
        @DisplayName("blank string returns empty string")
        void normalizeXhsCookie_blank_returnsEmpty() {
            assertThat(xhsService.normalizeXhsCookie("   ")).isEmpty();
        }

        @Test
        @DisplayName("double-quoted string is stripped")
        void normalizeXhsCookie_doubleQuoted_stripped() {
            assertThat(xhsService.normalizeXhsCookie("\"a=1; b=2\"")).isEqualTo("a=1; b=2");
        }

        @Test
        @DisplayName("single-quoted string is stripped")
        void normalizeXhsCookie_singleQuoted_stripped() {
            assertThat(xhsService.normalizeXhsCookie("'a=1; b=2'")).isEqualTo("a=1; b=2");
        }

        @Test
        @DisplayName("plain string returned as-is")
        void normalizeXhsCookie_plainString_returnedAsIs() {
            assertThat(xhsService.normalizeXhsCookie("a=1; b=2")).isEqualTo("a=1; b=2");
        }

        @Test
        @DisplayName("plain string with surrounding spaces trimmed")
        void normalizeXhsCookie_plainStringWithSpaces_trimmed() {
            assertThat(xhsService.normalizeXhsCookie("  a=1; b=2  ")).isEqualTo("a=1; b=2");
        }

        @Test
        @DisplayName("JSON array format converted to cookie string")
        void normalizeXhsCookie_jsonArray_converted() throws Exception {
            String json = "[{\"name\":\"web_session\",\"value\":\"abc123\"},{\"name\":\"xhsuid\",\"value\":\"xyz789\"}]";
            when(objectMapper.getTypeFactory()).thenReturn(realTypeFactory);
            when(objectMapper.readValue(json,
                    realTypeFactory.constructCollectionType(java.util.List.class, java.util.Map.class)))
                    .thenReturn(java.util.List.of(
                            java.util.Map.of("name", "web_session", "value", "abc123"),
                            java.util.Map.of("name", "xhsuid", "value", "xyz789")
                    ));

            String result = xhsService.normalizeXhsCookie(json);

            assertThat(result).isEqualTo("web_session=abc123; xhsuid=xyz789");
        }

        @Test
        @DisplayName("JSON array with empty name skipped")
        void normalizeXhsCookie_jsonArrayEmptyName_skipped() throws Exception {
            String json = "[{\"name\":\"\",\"value\":\"abc\"},{\"name\":\"sid\",\"value\":\"123\"}]";
            when(objectMapper.getTypeFactory()).thenReturn(realTypeFactory);
            when(objectMapper.readValue(json,
                    realTypeFactory.constructCollectionType(java.util.List.class, java.util.Map.class)))
                    .thenReturn(java.util.List.of(
                            java.util.Map.of("name", "", "value", "abc"),
                            java.util.Map.of("name", "sid", "value", "123")
                    ));

            String result = xhsService.normalizeXhsCookie(json);

            assertThat(result).isEqualTo("sid=123");
        }

        @Test
        @DisplayName("JSON array with missing name field skipped")
        void normalizeXhsCookie_jsonArrayMissingName_skipped() throws Exception {
            String json = "[{\"value\":\"abc\"},{\"name\":\"sid\",\"value\":\"123\"}]";
            when(objectMapper.getTypeFactory()).thenReturn(realTypeFactory);
            when(objectMapper.readValue(json,
                    realTypeFactory.constructCollectionType(java.util.List.class, java.util.Map.class)))
                    .thenReturn(java.util.List.of(
                            java.util.Map.of("value", "abc"),
                            java.util.Map.of("name", "sid", "value", "123")
                    ));

            String result = xhsService.normalizeXhsCookie(json);

            assertThat(result).isEqualTo("sid=123");
        }

        @Test
        @DisplayName("Invalid JSON array falls back to trimmed original")
        void normalizeXhsCookie_invalidJsonArray_fallsBack() throws Exception {
            String json = "[not valid json]";
            when(objectMapper.getTypeFactory()).thenReturn(realTypeFactory);
            when(objectMapper.readValue(json,
                    realTypeFactory.constructCollectionType(java.util.List.class, java.util.Map.class)))
                    .thenThrow(new RuntimeException("parse error"));

            String result = xhsService.normalizeXhsCookie(json);

            assertThat(result).isEqualTo("[not valid json]");
        }

        @Test
        @DisplayName("Mismatched quotes not stripped")
        void normalizeXhsCookie_mismatchedQuotes_notStripped() {
            assertThat(xhsService.normalizeXhsCookie("\"a=1'")).isEqualTo("\"a=1'");
        }

        @Test
        @DisplayName("Only quotes string returns empty after stripping")
        void normalizeXhsCookie_onlyQuotes_returnsEmptyAfterStrip() {
            assertThat(xhsService.normalizeXhsCookie("\"\"")).isEmpty();
            assertThat(xhsService.normalizeXhsCookie("''")).isEmpty();
        }
    }

    @Nested
    @DisplayName("extractInitialState（SSR 页面解析）")
    class ExtractInitialState {

        private final ObjectMapper mapper = new ObjectMapper();

        private XhsService serviceWithRealMapper() {
            return new XhsService(appSettings, mapper, llmService, mapDispatcher);
        }

        @Test
        @DisplayName("普通 JSON 结构能解析")
        void plainJson_parsed() {
            String html = "<script>window.__INITIAL_STATE__={\"feed\":{\"notes\":[{\"id\":\"n1\"}]}}</script>";

            var state = serviceWithRealMapper().extractInitialState(html);

            assertThat(state).isNotNull();
            assertThat(state.path("feed").path("notes").get(0).path("id").asText()).isEqualTo("n1");
        }

        @Test
        @DisplayName("undefined 被清洗成 null")
        void undefined_isSanitized() {
            String html = "<script>window.__INITIAL_STATE__={\"user\":undefined,\"feed\":{\"xsecToken\":undefined}}</script>";

            var state = serviceWithRealMapper().extractInitialState(html);

            assertThat(state).isNotNull();
            assertThat(state.path("user").isNull()).isTrue();
            assertThat(state.path("feed").path("xsecToken").isNull()).isTrue();
        }

        @Test
        @DisplayName("new Map([]) / new Set([]) 被替换成 JSON 结构（2026-11 起小红书页面出现）")
        void jsConstructors_areReplaced() {
            String html = "<script>window.__INITIAL_STATE__={"
                    + "\"AiNoteDetailStore\":{\"noteDetailMap\":new Map([])},"
                    + "\"tags\":new Set([\"a\",\"b\"]),"
                    + "\"feed\":{\"noteList\":[{\"id\":\"n1\"}]}"
                    + "}</script>";

            var state = serviceWithRealMapper().extractInitialState(html);

            assertThat(state).isNotNull();
            // new Map([]) -> {}（空对象），new Set([...]) -> []（数组）
            assertThat(state.path("AiNoteDetailStore").path("noteDetailMap").isObject()).isTrue();
            assertThat(state.path("tags").isArray()).isTrue();
            assertThat(state.path("feed").path("noteList").get(0).path("id").asText()).isEqualTo("n1");
        }

        @Test
        @DisplayName("带嵌套括号的 new Map 也能整体替换")
        void nestedJsConstructor_replaced() {
            String html = "<script>window.__INITIAL_STATE__={\"m\":new Map([[\"a\",{\"b\":[1,2]}]])}</script>";

            var state = serviceWithRealMapper().extractInitialState(html);

            assertThat(state).isNotNull();
            assertThat(state.path("m").isObject()).isTrue();
        }

        @Test
        @DisplayName("找不到 INITIAL_STATE 返回 null")
        void missingMarker_returnsNull() {
            assertThat(serviceWithRealMapper().extractInitialState("<html></html>")).isNull();
        }
    }

    @Nested
    @DisplayName("searchXhsAttractions")
    class SearchXhsAttractions {

        @Test
        @DisplayName("Cookie not configured throws XhsCookieExpiredError")
        void searchXhsAttractions_cookieNotConfigured_throwsXhsCookieExpiredError() {
            when(appSettings.getXhsCookie()).thenReturn(null);

            assertThatThrownBy(() -> xhsService.searchXhsAttractions("北京", "景点", "zh"))
                    .isInstanceOf(XhsService.XhsCookieExpiredError.class)
                    .hasMessageContaining("Cookie");
        }

        @Test
        @DisplayName("Empty cookie throws XhsCookieExpiredError")
        void searchXhsAttractions_emptyCookie_throwsXhsCookieExpiredError() {
            when(appSettings.getXhsCookie()).thenReturn("");

            assertThatThrownBy(() -> xhsService.searchXhsAttractions("北京", "景点", "zh"))
                    .isInstanceOf(XhsService.XhsCookieExpiredError.class);
        }

        @Test
        @DisplayName("Blank cookie throws XhsCookieExpiredError")
        void searchXhsAttractions_blankCookie_throwsXhsCookieExpiredError() {
            when(appSettings.getXhsCookie()).thenReturn("   ");

            assertThatThrownBy(() -> xhsService.searchXhsAttractions("北京", "景点", "zh"))
                    .isInstanceOf(XhsService.XhsCookieExpiredError.class);
        }
    }

    @Nested
    @DisplayName("getPhotoFromXhs")
    class GetPhotoFromXhs {

        @Test
        @DisplayName("Cookie not configured returns empty string")
        void getPhotoFromXhs_cookieNotConfigured_returnsEmpty() {
            when(appSettings.getXhsCookie()).thenReturn(null);

            assertThat(xhsService.getPhotoFromXhs("故宫")).isEmpty();
        }

        @Test
        @DisplayName("Empty cookie returns empty string")
        void getPhotoFromXhs_emptyCookie_returnsEmpty() {
            when(appSettings.getXhsCookie()).thenReturn("");

            assertThat(xhsService.getPhotoFromXhs("故宫")).isEmpty();
        }
    }
}
