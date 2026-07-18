package com.financeai.backend.transaction;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface TransactionCategoryRepository extends JpaRepository<TransactionCategory, UUID> {

    Optional<TransactionCategory> findByCode(String code);
}
