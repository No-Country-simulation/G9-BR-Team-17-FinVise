package com.financeai.backend.integration.objectstorage;

import com.financeai.backend.config.StorageProperties;
import com.financeai.backend.common.exception.BusinessException;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.nio.file.StandardOpenOption;
import java.util.UUID;

@Service
@ConditionalOnProperty(prefix = "finance-ai.storage", name = "type", havingValue = "local", matchIfMissing = true)
public class LocalObjectStorageService implements ObjectStorageService {

    private static final Logger log = LoggerFactory.getLogger(LocalObjectStorageService.class);

    private final StorageProperties properties;
    private Path basePath;

    public LocalObjectStorageService(StorageProperties properties) {
        this.properties = properties;
    }

    @PostConstruct
    public void init() {
        try {
            this.basePath = Path.of(properties.getLocal().getBasePath()).toAbsolutePath().normalize();
            Files.createDirectories(basePath);
            log.info("Armazenamento local inicializado em {}", basePath);
        } catch (IOException e) {
            throw new BusinessException("STORAGE_INIT_ERROR", "Falha ao inicializar diretório de uploads", e);
        }
    }

    @Override
    public String store(InputStream data, String originalName, long size) {
        String storedName = generateStoredName(originalName);
        Path target = basePath.resolve(storedName);
        try {
            Files.createDirectories(target.getParent());
            Files.copy(data, target, StandardCopyOption.REPLACE_EXISTING);
            log.debug("Arquivo salvo localmente: {}", target);
            return storedName;
        } catch (IOException e) {
            throw new BusinessException("STORAGE_WRITE_ERROR", "Falha ao salvar arquivo localmente: " + storedName, e);
        }
    }

    @Override
    public InputStream retrieve(String storedName) {
        Path target = resolveSafe(storedName);
        try {
            return Files.newInputStream(target, StandardOpenOption.READ);
        } catch (IOException e) {
            throw new BusinessException("STORAGE_READ_ERROR", "Falha ao ler arquivo: " + storedName, e);
        }
    }

    @Override
    public void delete(String storedName) {
        Path target = resolveSafe(storedName);
        try {
            Files.deleteIfExists(target);
        } catch (IOException e) {
            throw new BusinessException("STORAGE_DELETE_ERROR", "Falha ao remover arquivo: " + storedName, e);
        }
    }

    private String generateStoredName(String originalName) {
        String safeName = sanitizeFileName(originalName);
        return UUID.randomUUID() + "_" + safeName;
    }

    private Path resolveSafe(String storedName) {
        Path resolved = basePath.resolve(storedName).normalize();
        if (!resolved.startsWith(basePath)) {
            throw new BusinessException("STORAGE_INVALID_PATH", "Caminho de arquivo inválido: " + storedName);
        }
        return resolved;
    }

    private String sanitizeFileName(String originalName) {
        if (originalName == null || originalName.isBlank()) {
            return "upload";
        }
        String name = originalName.replaceAll("[^a-zA-Z0-9.\\-\\_]", "_");
        if (name.length() > 200) {
            name = name.substring(0, 200);
        }
        return name;
    }
}
