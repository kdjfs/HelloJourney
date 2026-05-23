package com.hellojourney.controller;

import com.hellojourney.config.AppSettings;
import com.hellojourney.service.GoogleMapService;
import com.hellojourney.service.MapDispatcher;
import com.hellojourney.service.TencentMapService;
import com.hellojourney.service.XhsService;
import com.hellojourney.util.TestDataFactory;
import com.hellojourney.model.vo.POIInfo;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Map;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(PoiController.class)
class PoiControllerTest {
    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private MapDispatcher mapDispatcher;

    @MockBean
    private XhsService xhsService;

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
        when(xhsService.getPhotoFromXhs("故宫 风景"))
                .thenReturn("https://example.com/gugong.jpg");

        mockMvc.perform(get("/api/poi/photo")
                        .param("name", "故宫"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.name").value("故宫"))
                .andExpect(jsonPath("$.data.photo_url").value("https://example.com/gugong.jpg"));
    }

    @Test
    void getAttractionPhoto_emptyUrl_returnsEmptyString() throws Exception {
        when(xhsService.getPhotoFromXhs("故宫 风景"))
                .thenReturn("");

        mockMvc.perform(get("/api/poi/photo")
                        .param("name", "故宫"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.photo_url").value(""));
    }
}
