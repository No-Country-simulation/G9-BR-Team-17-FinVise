package com.financeai.backend;

import com.financeai.backend.config.StorageProperties;
import com.financeai.backend.integration.objectstorage.LocalObjectStorageService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;

class ObjectStorageServiceTest {

    private LocalObjectStorageService storageService;

    @TempDir
    Path tempDir;

    @BeforeEach
    void setUp() {
        StorageProperties properties = new StorageProperties();
        properties.getLocal().setBasePath(tempDir.toString());
        storageService = new LocalObjectStorageService(properties);
        storageService.init();
    }

    @Test
    void shouldStoreRetrieveAndDeleteFile() throws Exception {
        String originalName = "relatório.csv";
        String content = "description,amount\nMercado,150.00\n";

        String storedName = storageService.store(
            new ByteArrayInputStream(content.getBytes(StandardCharsets.UTF_8)),
            originalName,
            content.length()
        );

        assertThat(storedName).isNotBlank().contains("relat_rio.csv");

        try (InputStream is = storageService.retrieve(storedName)) {
            String retrieved = new String(is.readAllBytes(), StandardCharsets.UTF_8);
            assertThat(retrieved).isEqualTo(content);
        }

        storageService.delete(storedName);
        assertThat(tempDir.resolve(storedName)).doesNotExist();
    }

    @Test
    void shouldSanitizeUnsafePaths() throws Exception {
        String originalName = "../../../etc/passwd";
        String content = "dados";

        String storedName = storageService.store(
            new ByteArrayInputStream(content.getBytes(StandardCharsets.UTF_8)),
            originalName,
            content.length()
        );

        assertThat(storedName).doesNotContain("/").doesNotContain("\\");
        assertThat(tempDir.resolve(storedName)).exists();
    }
}
