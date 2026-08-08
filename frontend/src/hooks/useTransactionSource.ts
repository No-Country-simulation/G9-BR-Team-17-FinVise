import { useState } from 'react';
import { TransactionSource } from '@/types/transaction';

const STORAGE_KEY = 'finance_ai_transaction_source';
const SOURCE_CHANGED_EVENT = 'finance-ai:transaction-source-changed';

function initialSource(): TransactionSource {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === 'OPEN_FINANCE_PLUGGY' ? stored : 'CSV_IMPORT';
}

export function useTransactionSource() {
  const [source, setSourceState] = useState<TransactionSource>(initialSource);

  const setSource = (next: TransactionSource) => {
    localStorage.setItem(STORAGE_KEY, next);
    window.dispatchEvent(new Event(SOURCE_CHANGED_EVENT));
    setSourceState(next);
  };

  return { source, setSource };
}

export function rememberTransactionSource(source: TransactionSource) {
  localStorage.setItem(STORAGE_KEY, source);
  window.dispatchEvent(new Event(SOURCE_CHANGED_EVENT));
}
