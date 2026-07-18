package com.financeai.backend.integration.objectstorage;

import com.financeai.backend.config.StorageProperties;
import com.oracle.bmc.Region;
import com.oracle.bmc.auth.ConfigFileAuthenticationDetailsProvider;
import com.oracle.bmc.objectstorage.ObjectStorageClient;
import com.oracle.bmc.objectstorage.requests.DeleteObjectRequest;
import com.oracle.bmc.objectstorage.requests.GetObjectRequest;
import com.oracle.bmc.objectstorage.requests.PutObjectRequest;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.InputStream;
import java.util.UUID;

@Service
@ConditionalOnProperty(prefix = "finance-ai.storage", name = "type", havingValue = "oci")
public class OciObjectStorageService implements ObjectStorageService {

    private static final Logger log = LoggerFactory.getLogger(OciObjectStorageService.class);

    private final StorageProperties properties;
    private ObjectStorageClient client;
    private String namespace;
    private String bucketName;

    public OciObjectStorageService(StorageProperties properties) {
        this.properties = properties;
    }

    @PostConstruct
    public void init() {
        StorageProperties.Oci oci = properties.getOci();
        if (isBlank(oci.getNamespace()) || isBlank(oci.getBucketName()) || isBlank(oci.getRegion())) {
            throw new IllegalStateException(
                "Configuração OCI incompleta. Defina OCI_NAMESPACE, OCI_BUCKET_NAME e OCI_REGION.");
        }

        this.namespace = oci.getNamespace();
        this.bucketName = oci.getBucketName();

        try {
            ConfigFileAuthenticationDetailsProvider provider = new ConfigFileAuthenticationDetailsProvider("DEFAULT");
            Region region = Region.valueOf(oci.getRegion().toUpperCase());
            this.client = ObjectStorageClient.builder()
                .region(region)
                .build(provider);
            log.info("Cliente OCI Object Storage inicializado na região {}", region.getRegionId());
        } catch (IOException e) {
            throw new IllegalStateException("Falha ao carregar credenciais OCI. Verifique o arquivo ~/.oci/config.", e);
        } catch (IllegalArgumentException e) {
            throw new IllegalStateException("Região OCI inválida: " + oci.getRegion(), e);
        }
    }

    @Override
    public String store(InputStream data, String originalName, long size) {
        String objectName = generateStoredName(originalName);
        PutObjectRequest request = PutObjectRequest.builder()
            .namespaceName(namespace)
            .bucketName(bucketName)
            .objectName(objectName)
            .putObjectBody(data)
            .contentLength(size)
            .build();

        client.putObject(request);
        log.debug("Objeto enviado para OCI: {}/{}/{}", namespace, bucketName, objectName);
        return objectName;
    }

    @Override
    public InputStream retrieve(String storedName) {
        GetObjectRequest request = GetObjectRequest.builder()
            .namespaceName(namespace)
            .bucketName(bucketName)
            .objectName(storedName)
            .build();

        return client.getObject(request).getInputStream();
    }

    @Override
    public void delete(String storedName) {
        DeleteObjectRequest request = DeleteObjectRequest.builder()
            .namespaceName(namespace)
            .bucketName(bucketName)
            .objectName(storedName)
            .build();

        client.deleteObject(request);
        log.debug("Objeto removido do OCI: {}/{}/{}", namespace, bucketName, storedName);
    }

    @PreDestroy
    public void close() {
        if (client != null) {
            client.close();
        }
    }

    private String generateStoredName(String originalName) {
        String safeName = originalName != null ? originalName.replaceAll("[^a-zA-Z0-9.\\-\\_]", "_") : "upload";
        return UUID.randomUUID() + "_" + safeName;
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}
