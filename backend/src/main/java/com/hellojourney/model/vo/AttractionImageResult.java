package com.hellojourney.model.vo;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "景点图片身份匹配结果")
public class AttractionImageResult {
    @Builder.Default
    private String imageUrl = "";
    @Builder.Default
    private String provider = "none";
    @Builder.Default
    private String matchedName = "";
    @Builder.Default
    private String matchedPoiId = "";
    @Builder.Default
    private double confidence = 0.0;
    @Builder.Default
    private boolean verified = false;

    public static AttractionImageResult verified(String imageUrl, String provider,
                                                  String matchedName, String matchedPoiId,
                                                  double confidence) {
        return AttractionImageResult.builder()
                .imageUrl(imageUrl)
                .provider(provider)
                .matchedName(matchedName)
                .matchedPoiId(matchedPoiId)
                .confidence(confidence)
                .verified(true)
                .build();
    }

    public static AttractionImageResult notFound() {
        return AttractionImageResult.builder().build();
    }
}
