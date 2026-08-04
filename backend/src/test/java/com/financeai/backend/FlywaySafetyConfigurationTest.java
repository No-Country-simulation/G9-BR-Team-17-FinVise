package com.financeai.backend;

import org.junit.jupiter.api.Test;
import org.springframework.boot.env.YamlPropertySourceLoader;
import org.springframework.core.env.MutablePropertySources;
import org.springframework.core.env.PropertySource;
import org.springframework.core.env.PropertySourcesPropertyResolver;
import org.springframework.core.io.ClassPathResource;

import java.io.IOException;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class FlywaySafetyConfigurationTest {

    @Test
    void shouldKeepSafeFlywayDefaults() throws IOException {
        PropertySourcesPropertyResolver properties = propertiesFrom("application.yml");

        assertThat(properties.getProperty(
            "spring.flyway.validate-on-migrate", Boolean.class)).isTrue();
        assertThat(properties.getProperty(
            "spring.flyway.clean-disabled", Boolean.class)).isTrue();
        assertThat(properties.getProperty(
            "spring.flyway.baseline-on-migrate", Boolean.class)).isFalse();
        assertThat(properties.containsProperty(
            "spring.flyway.repair-on-migrate")).isFalse();
    }

    @Test
    void shouldAllowCleanOnlyForIsolatedTestDatabase() throws IOException {
        PropertySourcesPropertyResolver local = propertiesFrom("application-local.yml");
        PropertySourcesPropertyResolver test = propertiesFrom("application-test.yml");

        assertThat(local.containsProperty("spring.flyway.clean-disabled")).isFalse();
        assertThat(test.getProperty(
            "spring.flyway.clean-disabled", Boolean.class)).isFalse();
        assertThat(test.getProperty(
            "spring.flyway.validate-on-migrate", Boolean.class)).isTrue();
    }

    private PropertySourcesPropertyResolver propertiesFrom(String resource) throws IOException {
        List<PropertySource<?>> loaded = new YamlPropertySourceLoader()
            .load(resource, new ClassPathResource(resource));
        MutablePropertySources propertySources = new MutablePropertySources();
        loaded.forEach(propertySources::addLast);
        return new PropertySourcesPropertyResolver(propertySources);
    }
}
