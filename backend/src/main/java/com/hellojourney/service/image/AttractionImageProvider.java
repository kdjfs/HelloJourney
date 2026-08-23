package com.hellojourney.service.image;

import com.hellojourney.model.vo.AttractionImageResult;

public interface AttractionImageProvider {
    String providerId();

    AttractionImageResult resolveImage(String attractionName, String city, String poiId);
}
