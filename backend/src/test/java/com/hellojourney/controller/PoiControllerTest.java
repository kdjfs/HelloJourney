package com.hellojourney.controller;

import com.hellojourney.config.AppSettings;
import com.hellojourney.service.GoogleMapService;
import com.hellojourney.service.MapDispatcher;
import com.hellojourney.service.TencentMapService;
import com.hellojourney.service.image.AttractionImageService;
import com.hellojourney.util.TestDataFactory;
import com.hellojourney.model.vo.AttractionImageResult;
import com.hellojourney.model.vo.POIInfo;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Map;

import static org.mockito.Mockito.when;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(PoiController.class)
class PoiControllerTest {
    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private MapDispatcher mapDispatcher;

    @MockBean
    private AttractionImageService attractionImageService;

    @MockBean
    private AppSettings appSettings;

    @MockBean
    private GoogleMapService googleMapService;

    @MockBean
    private TencentMapService tencentMapService;

    @Test
    void getPoiDetail_validId_returnsDetail() throws Exception {
        Map<String, Object> detail = Map.of(
                "id", "test-id",
                "title", "故宫博物院",
                "address", "北京市东城区景山前街4号"
        );
        when(mapDispatcher.getPoiDetailUnified("test-id")).thenReturn(detail);

        mockMvc.perform(get("/api/poi/detail/test-id"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.message").value("获取POI详情成功"))
                .andExpect(jsonPath("$.data.id").value("test-id"))
                .andExpect(jsonPath("$.data.title").value("故宫博物院"));
    }

    @Test
    void searchPoi_validParams_returnsResults() throws Exception {
        POIInfo poi = POIInfo.builder()
                .id("poi-001")
                .name("故宫")
                .type("景点")
                .address("北京")
                .location(TestDataFactory.buildLocation())
                .build();
        when(mapDispatcher.searchPoiUnified("故宫", "北京", true))
                .thenReturn(List.of(poi));

        mockMvc.perform(get("/api/poi/search")
                        .param("keywords", "故宫")
                        .param("city", "北京"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.message").value("搜索成功"))
                .andExpect(jsonPath("$.data[0].name").value("故宫"));
    }

    @Test
    void getAttractionPhoto_validName_returnsPhotoUrl() throws Exception {
        when(attractionImageService.resolveImage("广州塔", "广州", "B00140TY2A"))
                .thenReturn(AttractionImageResult.verified(
                        "https://aos-cdn-image.amap.com/guangzhou-tower.jpg",
                        "amap", "广州塔", "B00140TY2A", 1.0));

        mockMvc.perform(get("/api/poi/photo")
                        .param("name", "广州塔")
                        .param("city", "广州")
                        .param("poiId", "B00140TY2A"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.imageUrl").value("https://aos-cdn-image.amap.com/guangzhou-tower.jpg"))
                .andExpect(jsonPath("$.data.provider").value("amap"))
                .andExpect(jsonPath("$.data.matchedName").value("广州塔"))
                .andExpect(jsonPath("$.data.matchedPoiId").value("B00140TY2A"))
                .andExpect(jsonPath("$.data.confidence").value(1.0))
                .andExpect(jsonPath("$.data.verified").value(true));

        verify(attractionImageService).resolveImage("广州塔", "广州", "B00140TY2A");
    }

    @Test
    void getAttractionPhoto_emptyUrl_returnsEmptyString() throws Exception {
        when(attractionImageService.resolveImage("陈家祠", "广州", null))
                .thenReturn(AttractionImageResult.notFound());

        mockMvc.perform(get("/api/poi/photo")
                        .param("name", "陈家祠")
                        .param("city", "广州"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.message").value("暂无已验证图片"))
                .andExpect(jsonPath("$.data.imageUrl").value(""))
                .andExpect(jsonPath("$.data.provider").value("none"))
                .andExpect(jsonPath("$.data.verified").value(false));
    }

    @Test
    void getAttractionPhoto_missingCity_returnsBadRequest() throws Exception {
        mockMvc.perform(get("/api/poi/photo").param("name", "广州塔"))
                .andExpect(status().isBadRequest());
    }
}
