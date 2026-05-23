package com.hellojourney.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.hellojourney.config.AppSettings;
import lombok.extern.slf4j.Slf4j;
import okhttp3.*;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.TimeUnit;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Slf4j
@Service
public class XhsService {
    private final AppSettings appSettings;
    private final ObjectMapper objectMapper;
    private final LlmService llmService;
    private final MapDispatcher mapDispatcher;
    private final OkHttpClient httpClient;

    private static final Pattern INITIAL_STATE_PATTERN =
            Pattern.compile("window\\.__INITIAL_STATE__\\s*=\\s*(\\{.*?\\})\\s*</script>", Pattern.DOTALL);

    public XhsService(AppSettings appSettings, ObjectMapper objectMapper, LlmService llmService, MapDispatcher mapDispatcher) {
        this.appSettings = appSettings;
        this.objectMapper = objectMapper;
        this.llmService = llmService;
        this.mapDispatcher = mapDispatcher;
        this.httpClient = new OkHttpClient.Builder()
                .connectTimeout(15, TimeUnit.SECONDS)
                .readTimeout(15, TimeUnit.SECONDS)
                .followRedirects(true)
                .followSslRedirects(true)
                .build();
    }

    public static class XhsCookieExpiredError extends RuntimeException {
        public XhsCookieExpiredError(String message) {
            super(message);
        }
    }

    public String normalizeXhsCookie(String cookie) {
        if (cookie == null) return "";
        String normalized = cookie.trim();
        if (normalized.isEmpty()) return normalized;
        if (normalized.length() >= 2 && normalized.charAt(0) == normalized.charAt(normalized.length() - 1)
                && (normalized.charAt(0) == '\'' || normalized.charAt(0) == '"')) {
            normalized = normalized.substring(1, normalized.length() - 1).trim();
        }
        if (normalized.startsWith("[") && normalized.endsWith("]")) {
            try {
                List<Map<String, String>> items = objectMapper.readValue(normalized,
                        objectMapper.getTypeFactory().constructCollectionType(List.class, Map.class));
                List<String> pairs = new ArrayList<>();
                for (Map<String, String> item : items) {
                    String name = item.getOrDefault("name", "").trim();
                    String value = item.getOrDefault("value", "").trim();
                    if (!name.isEmpty()) pairs.add(name + "=" + value);
                }
                if (!pairs.isEmpty()) return String.join("; ", pairs);
            } catch (Exception ignored) {}
        }
        return normalized;
    }

    private Map<String, String> transCookies(String cookiesStr) {
        Map<String, String> ck = new LinkedHashMap<>();
        String sep = cookiesStr.contains("; ") ? "; " : ";";
        for (String item : cookiesStr.split(sep)) {
            String[] parts = item.split("=", 2);
            if (parts.length == 2) {
                ck.put(parts[0].trim(), parts[1].trim());
            }
        }
        return ck;
    }

    private String buildCookieHeader() {
        String cookieStr = normalizeXhsCookie(appSettings.getXhsCookie());
        if (cookieStr.isEmpty()) return "";
        Map<String, String> cookies = transCookies(cookieStr);
        StringBuilder sb = new StringBuilder();
        cookies.forEach((k, v) -> sb.append(k).append("=").append(v).append("; "));
        return sb.toString();
    }

    private Request.Builder basePageRequest(String url) {
        return new Request.Builder()
                .url(url)
                .addHeader("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36")
                .addHeader("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8")
                .addHeader("Accept-Language", "zh-CN,zh;q=0.9")
                .addHeader("Cache-Control", "no-cache")
                .addHeader("Pragma", "no-cache")
                .get();
    }

    private JsonNode fetchSsrPage(String url) throws IOException {
        String cookieHeader = buildCookieHeader();
        if (cookieHeader.isEmpty()) {
            throw new XhsCookieExpiredError("小红书 Cookie 未配置");
        }

        Request request = basePageRequest(url)
                .addHeader("Cookie", cookieHeader)
                .build();

        try (Response response = httpClient.newCall(request).execute()) {
            String html = response.body() != null ? response.body().string() : "";

            String finalUrl = response.request().url().toString();
            if (finalUrl.contains("login") || finalUrl.contains("login_url")) {
                throw new XhsCookieExpiredError("小红书 Cookie 已失效，页面跳转到了登录页");
            }

            Matcher match = INITIAL_STATE_PATTERN.matcher(html);
            if (!match.find()) {
                if (html.contains("login") || html.length() < 500) {
                    throw new XhsCookieExpiredError("小红书 Cookie 已失效或页面未正常加载");
                }
                throw new IOException("未能从小红书页面提取到 INITIAL_STATE 数据");
            }

            String stateJsonStr = match.group(1).replace("undefined", "null");
            return objectMapper.readTree(stateJsonStr);
        }
    }

    private JsonNode searchNotes(String keyword, int page, int sortType, int pageSize) throws IOException {
        String encodedKeyword = URLEncoder.encode(keyword, StandardCharsets.UTF_8);
        String url = "https://www.xiaohongshu.com/search_result?keyword=" + encodedKeyword
                + "&type=51&page=" + page + "&sort=general";

        log.info("[XHS_SSR] 搜索小红书页面: {}", url);
        JsonNode state = fetchSsrPage(url);

        JsonNode searchNode = state.path("search");
        JsonNode noteItems = searchNode.path("notes").path("noteList");
        if (noteItems.isMissingNode() || !noteItems.isArray()) {
            noteItems = searchNode.path("note").path("noteList");
        }

        ArrayNode items = objectMapper.createArrayNode();
        if (noteItems.isArray()) {
            for (JsonNode item : noteItems) {
                ObjectNode apiItem = objectMapper.createObjectNode();
                String noteId = item.path("noteId").asText("");
                if (noteId.isEmpty()) noteId = item.path("id").asText("");

                apiItem.put("id", noteId);
                apiItem.put("model_type", "note");
                apiItem.put("xsec_token", item.path("xsecToken").asText(""));

                ObjectNode noteCard = objectMapper.createObjectNode();
                noteCard.put("display_title", item.path("displayTitle").asText(""));
                noteCard.put("desc", item.path("desc").asText(""));

                JsonNode cover = item.path("cover");
                if (!cover.isMissingNode()) {
                    ArrayNode imageList = objectMapper.createArrayNode();
                    ObjectNode img = objectMapper.createObjectNode();
                    img.put("url", cover.path("url").asText(""));
                    img.put("url_default", cover.path("urlDefault").asText(""));
                    imageList.add(img);
                    noteCard.set("image_list", imageList);
                }

                apiItem.set("note_card", noteCard);
                items.add(apiItem);
            }
        }

        ObjectNode result = objectMapper.createObjectNode();
        result.put("success", true);
        ObjectNode data = objectMapper.createObjectNode();
        data.set("items", items);
        data.put("has_more", searchNode.path("hasMore").asBoolean(false));
        result.set("data", data);

        log.info("[XHS_SSR] 搜索到 {} 条笔记", items.size());
        return result;
    }

    private JsonNode getNoteDetail(String noteId, String xsecToken) throws IOException {
        String url = "https://www.xiaohongshu.com/explore/" + noteId;
        if (xsecToken != null && !xsecToken.isEmpty()) {
            url += "?xsec_token=" + xsecToken + "&xsec_source=pc_search";
        }

        log.info("[XHS_SSR] 获取笔记详情: {}", url);
        JsonNode state = fetchSsrPage(url);

        JsonNode noteDetailMap = state.path("note").path("noteDetailMap");
        JsonNode noteDetail = noteDetailMap.path(noteId).path("note");
        if (noteDetail.isMissingNode()) {
            Iterator<String> fieldNames = noteDetailMap.fieldNames();
            if (fieldNames.hasNext()) {
                noteDetail = noteDetailMap.path(fieldNames.next()).path("note");
            }
        }

        ObjectNode noteCard = objectMapper.createObjectNode();
        noteCard.put("display_title", noteDetail.path("title").asText(""));
        noteCard.put("desc", noteDetail.path("desc").asText(""));

        JsonNode imageList = noteDetail.path("imageList");
        ArrayNode apiImageList = objectMapper.createArrayNode();
        if (imageList.isArray()) {
            for (JsonNode img : imageList) {
                ObjectNode apiImg = objectMapper.createObjectNode();
                String imgUrl = img.path("urlDefault").asText("");
                if (imgUrl.isEmpty()) imgUrl = img.path("url").asText("");
                apiImg.put("url_default", imgUrl);
                apiImg.put("url", imgUrl);

                ArrayNode infoList = objectMapper.createArrayNode();
                ObjectNode thumb = objectMapper.createObjectNode();
                thumb.put("url", img.path("traceId").asText("").isEmpty()
                        ? imgUrl : img.path("url").asText(""));
                infoList.add(thumb);
                apiImg.set("info_list", infoList);

                apiImageList.add(apiImg);
            }
        }
        noteCard.set("image_list", apiImageList);

        ObjectNode apiItem = objectMapper.createObjectNode();
        apiItem.set("note_card", noteCard);

        ArrayNode items = objectMapper.createArrayNode();
        items.add(apiItem);

        ObjectNode result = objectMapper.createObjectNode();
        ObjectNode data = objectMapper.createObjectNode();
        data.set("items", items);
        result.set("data", data);

        return result;
    }

    public String searchXhsAttractions(String city, String keywords, String language) {
        log.info("[XHS_SERVICE] 正在呼叫小红书 API 搜索: {} {}", city, keywords);
        String query = city + " " + keywords + " 旅游 景点攻略";

        String combinedText;
        try {
            JsonNode resJson = searchNotes(query, 1, 0, 20);
            JsonNode items = resJson.path("data").path("items");
            StringBuilder sb = new StringBuilder();
            int count = 0;
            for (JsonNode note : items) {
                if (count >= 4) break;
                if (!"note".equals(note.path("model_type").asText(""))) continue;
                JsonNode noteCard = note.path("note_card");
                String title = noteCard.path("display_title").asText("");
                String desc = "";
                try {
                    String noteId = note.path("id").asText("");
                    String xsecToken = note.path("xsec_token").asText("");
                    if (!noteId.isEmpty()) {
                        JsonNode detailRes = getNoteDetail(noteId, xsecToken);
                        JsonNode detailItems = detailRes.path("data").path("items");
                        if (detailItems.isArray() && !detailItems.isEmpty()) {
                            desc = detailItems.get(0).path("note_card").path("desc").asText("");
                        }
                    }
                } catch (Exception ignored) {}

                count++;
                sb.append("\n笔记").append(count).append(":\n标题: ").append(title).append("\n正文内容: ").append(desc).append("\n");
            }
            combinedText = sb.toString();
        } catch (XhsCookieExpiredError e) {
            throw e;
        } catch (Exception e) {
            log.error("小红书接口抓取崩盘: {}", e.getMessage());
            throw new XhsCookieExpiredError("小红书访问超时或 Cookie 失效(风控拦截)，抓取失败。请更新 XHS_COOKIE");
        }

        if (combinedText.isEmpty()) {
            return "未在小红书检索到关于 " + city + " " + keywords + " 的内容。";
        }

        log.info("[XHS_SERVICE] 正在调用内联模型提纯小红书游记参数...");

        String lang = (language == null ? "zh" : language).trim().toLowerCase().split("-")[0];
        Map<String, String> langNames = Map.of("en", "English", "ja", "Japanese", "ko", "Korean", "fr", "French", "de", "German", "es", "Spanish");
        String translationInstruction = "";
        if (!"zh".equals(lang) && langNames.containsKey(lang)) {
            String targetLang = langNames.get(lang);
            translationInstruction = "\n**极其重要的翻译要求:**\n目标语言为 " + targetLang + "。你必须将提取结果中的 \"name\", \"reason\", \"reservation_tips\" 字段的内容翻译为 " + targetLang + "。\n"
                    + "- \"name\" 字段使用目标语言 " + targetLang + " 的景点名称。\n"
                    + "- \"reason\" 和 \"reservation_tips\" 也必须翻译为 " + targetLang + "。\n"
                    + "- \"duration\" 和 \"reservation_required\" 保持原始数值/布尔值不变。\n"
                    + "- **注意**: \"name_zh\" 必须始终保持简体中文名称，\"name_en\" 必须始终保持英文名称，不受目标语言影响！\n"
                    + "- 严格保持 JSON schema 格式不变！\n";
        }

        String extractPrompt = "请从以下真实的素人小红书打卡游记中，提纯出真实存在的【游玩景点】。\n"
                + "要求返回严格的 JSON 数组格式(哪怕只提取到了1个)，切勿返回除了JSON以外的任何冗余 markdown 文字！\n"
                + translationInstruction + "\n"
                + "数组中每个对象必须包含以下字段:\n"
                + "\"name\": 景点官方名称\n"
                + "\"name_zh\": 景点的中文简体名称\n"
                + "\"name_en\": 景点的英文名称\n"
                + "\"reason\": 小红书用户的真实评价/避坑指南\n"
                + "\"duration\": 游玩时长(数字, 分钟)\n"
                + "\"reservation_required\": 是否需要提前预约(布尔值)\n"
                + "\"reservation_tips\": 预约相关提示(字符串)\n\n"
                + "游记杂文内容如下:\n" + combinedText + "\n\n"
                + "JSON 返回示例:\n"
                + "[\n"
                + "  {\"name\": \"故宫博物院\", \"name_zh\": \"故宫博物院\", \"name_en\": \"The Palace Museum\", \"reason\": \"必去打卡，建议走中轴线。\", \"duration\": 240, \"reservation_required\": true, \"reservation_tips\": \"需要提前7天在故宫官网预约\"},\n"
                + "  {\"name\": \"老君山金顶\", \"name_zh\": \"老君山金顶\", \"name_en\": \"Laojun Mountain Golden Summit\", \"reason\": \"网红打卡点\", \"duration\": 180, \"reservation_required\": false, \"reservation_tips\": \"\"}\n"
                + "]";

        try {
            List<Map<String, String>> messages = List.of(Map.of("role", "user", "content", extractPrompt));
            String content = llmService.chat(messages, 0.1, 2000);

            String jsonStr = content;
            if (content.contains("[")) {
                int start = content.indexOf("[");
                int end = content.lastIndexOf("]");
                if (end > start) jsonStr = content.substring(start, end + 1);
            }

            List<Map<String, Object>> extracted = objectMapper.readValue(jsonStr,
                    objectMapper.getTypeFactory().constructCollectionType(List.class, Map.class));

            StringBuilder finalResult = new StringBuilder("这是小红书热门精选游记的提取结果，附带确切坐标（图片由前端单独搜索获取）：\n");
            for (Map<String, Object> item : extracted) {
                String name = item.getOrDefault("name", "").toString();
                if (name.isEmpty()) continue;
                String nameZh = item.getOrDefault("name_zh", name).toString();
                String nameEn = item.getOrDefault("name_en", name).toString();
                Map<String, Double> loc = mapDispatcher.geocodeUnified(name, city, nameZh, nameEn);
                item.put("location", loc);
                finalResult.append(objectMapper.writeValueAsString(item)).append("\n");
            }
            log.info("[XHS_SERVICE] 小红书数据挖掘完毕，已装载进上下文。");
            return finalResult.toString();
        } catch (Exception e) {
            log.error("大模型提纯小红书数据异常: {}", e.getMessage());
            return "尝试提取小红书结构化数据失败，降级回常规处理。";
        }
    }

    public String getPhotoFromXhs(String keyword) {
        try {
            JsonNode resJson = searchNotes(keyword, 1, 0, 20);
            JsonNode items = resJson.path("data").path("items");
            String targetNoteId = null;
            String targetXsecToken = "";
            for (JsonNode note : items) {
                if ("note".equals(note.path("model_type").asText(""))) {
                    targetNoteId = note.path("id").asText("");
                    targetXsecToken = note.path("xsec_token").asText("");
                    break;
                }
            }
            if (targetNoteId == null || targetNoteId.isEmpty()) return "";

            try {
                JsonNode detailRes = getNoteDetail(targetNoteId, targetXsecToken);
                JsonNode detailItems = detailRes.path("data").path("items");
                if (detailItems.isArray() && !detailItems.isEmpty()) {
                    JsonNode imageList = detailItems.get(0).path("note_card").path("image_list");
                    if (imageList.isArray() && !imageList.isEmpty()) {
                        JsonNode firstImg = imageList.get(0);
                        JsonNode infoList = firstImg.path("info_list");
                        if (infoList.size() > 1) return infoList.get(1).path("url").asText("");
                        if (!infoList.isEmpty()) return infoList.get(0).path("url").asText("");
                        String urlDefault = firstImg.path("url_default").asText("");
                        if (!urlDefault.isEmpty()) return urlDefault;
                        return firstImg.path("url").asText("");
                    }
                }
            } catch (Exception ignored) {}
        } catch (Exception e) {
            log.error("小红书单图抓取失败 ({}): {}", keyword, e.getMessage());
        }
        return "";
    }
}
