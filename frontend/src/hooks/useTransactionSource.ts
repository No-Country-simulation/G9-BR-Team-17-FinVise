import { useState } from 'react';
import { TransactionSource } from '@/types/transaction';

const STORAGE_KEY = 'finance_ai_transaction_source';

function initialSource(): TransactionSource {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === 'OPEN_FINANCE_PLUGGY' ? stored : 'CSV_IMPORT';
}

export function useTransactionSource() {
  const [source, setSourceState] = useState<TransactionSource>(initialSource);

  const setSource = (next: TransactionSource) => {
    localStorage.setItem(STORAGE_KEY, next);
    setSourceState(next);
  };

  return { source, setSource };
}

export function rememberTransactionSource(source: TransactionSource) {
  localStorage.setItem(STORAGE_KEY, source);
}
