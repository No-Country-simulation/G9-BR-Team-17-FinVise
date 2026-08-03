package com.financeai.backend;

import com.financeai.backend.analysis.AnalysisService;
import com.financeai.backend.importation.CsvImportPersistenceService;
import com.financeai.backend.importation.CsvImportService;
import com.financeai.backend.openfinance.OpenFinancePersistenceService;
import com.financeai.backend.openfinance.OpenFinanceService;
import org.junit.jupiter.api.Test;
import org.springframework.transaction.annotation.Transactional;

import java.lang.reflect.Method;
import java.util.Arrays;

import static org.assertj.core.api.Assertions.assertThat;

class NetworkTransactionBoundaryTest {

    @Test
    void shouldKeepNetworkOrchestratorsOutsideDeclarativeTransactions() {
        assertThat(method(CsvImportService.class, "importTransactionsCsv")
            .isAnnotationPresent(Transactional.class)).isFalse();
        assertThat(method(OpenFinanceService.class, "synchronize")
            .isAnnotationPresent(Transactional.class)).isFalse();
        assertThat(method(AnalysisService.class, "createAnalysis")
            .isAnnotationPresent(Transactional.class)).isFalse();
        assertThat(method(AnalysisService.class, "analyzeStoredTransactions")
            .isAnnotationPresent(Transactional.class)).isFalse();
    }

    @Test
    void shouldKeepDatabaseWritesInsideDedicatedTransactions() {
        assertThat(method(CsvImportPersistenceService.class, "persist")
            .isAnnotationPresent(Transactional.class)).isTrue();
        assertThat(method(OpenFinancePersistenceService.class, "persist")
            .isAnnotationPresent(Transactional.class)).isTrue();
    }

    private Method method(Class<?> type, String name) {
        return Arrays.stream(type.getDeclaredMethods())
            .filter(candidate -> candidate.getName().equals(name))
            .findFirst()
            .orElseThrow();
    }
}
