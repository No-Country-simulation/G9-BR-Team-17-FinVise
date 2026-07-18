package com.financeai.backend.analysis;

public record ProfileModelOptionResponse(
    ProfileAnalysisModel code,
    String name,
    String description
) {
}
