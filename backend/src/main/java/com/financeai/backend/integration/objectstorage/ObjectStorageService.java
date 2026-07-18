package com.financeai.backend.integration.objectstorage;

import java.io.InputStream;

public interface ObjectStorageService {

    String store(InputStream data, String originalName, long size);

    InputStream retrieve(String storedName);

    void delete(String storedName);
}
