import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Bot,
  Database,
  FileText,
  Loader2,
  Send,
  SlidersHorizontal,
  Sparkles,
  User,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/Alert';
import { TransactionSourceSelector } from '@/components/transactions/TransactionSourceSelector';
import { MarkdownText } from '@/components/ui/MarkdownText';
import { useTransactionSource } from '@/hooks/useTransactionSource';
import { agentService } from '@/services/agentService';
import { importSourceService, ImportSource } from '@/services/importSourceService';
import { AgentMessage, RagSource } from '@/types/agent';
import { TransactionSource } from '@/types/transaction';
import { extractErrorMessage } from '@/lib/api';

const welcomeMessage: AgentMessage = {
  id: 'welcome',
  role: 'assistant',
  content: 'Olá! Selecione as fontes e faça uma pergunta. Vou explicar os dados e citar o contexto recuperado.',
  timestamp: new Date().toISOString(),
};

const suggestionQuestions = [
  'Quais padrões aparecem nos meus gastos?',
  'Explique meu saldo mensal de forma simples',
  'Onde posso reduzir despesas?',
  'Compare receitas e despesas por categoria',
];

const defaultThinkingTools = ['rag_retrieval', 'financial_tools'];
const emptyImportSources: ImportSource[] = [];

function sourceMatches(source: ImportSource, transactionSource: TransactionSource) {
  return transactionSource === 'CSV_IMPORT'
    ? source.type === 'CSV'
    : source.type === 'OPEN_FINANCE';
}

function chunkLabel(type: string) {
  if (type === 'MONTHLY_SUMMARY') return 'Resumo mensal';
  if (type === 'CATEGORY_SUMMARY') return 'Resumo por categoria';
  return 'Transação';
}

export function AgentPage() {
  const { source, setSource } = useTransactionSource();
  const [messages, setMessages] = useState<AgentMessage[]>([welcomeMessage]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [thinkingTools, setThinkingTools] = useState(defaultThinkingTools);
  const [error, setError] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string>();
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([]);
  const [topK, setTopK] = useState(5);
  const bottomRef = useRef<HTMLDivElement>(null);
  const activeStreamRef = useRef<AbortController | null>(null);
  const { data: loadedImportSources, isLoading: sourcesLoading } = useQuery({
    queryKey: ['import-sources'],
    queryFn: importSourceService.getAll,
  });
  const importSources = loadedImportSources ?? emptyImportSources;

  const availableSources = useMemo(
    () => importSources.filter((item) => sourceMatches(item, source)),
    [importSources, source]
  );
  useEffect(() => {
    const availableIds = new Set(availableSources.map((item) => item.id));
    setSelectedSourceIds((current) => {
      const validSelection = current.filter((id) => availableIds.has(id));
      return validSelection.length > 0
        ? validSelection
        : availableSources.map((item) => item.id);
    });
  }, [availableSources]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  useEffect(() => () => activeStreamRef.current?.abort(), []);

  const resetConversation = (nextSource: TransactionSource = source) => {
    activeStreamRef.current?.abort();
    activeStreamRef.current = null;
    setConversationId(undefined);
    setIsLoading(false);
    setIsStreaming(false);
    setError(null);
    setMessages([{
      ...welcomeMessage,
      id: `welcome-${nextSource}-${Date.now()}`,
      timestamp: new Date().toISOString(),
    }]);
  };

  const updateSourceSelection = (id: string) => {
    setSelectedSourceIds((current) =>
      current.includes(id)
        ? current.filter((sourceId) => sourceId !== id)
        : [...current, id]
    );
    resetConversation();
  };

  const handleSend = async (text: string) => {
    if (!text.trim() || isLoading || isStreaming || sourcesLoading) return;
    if (availableSources.length > 0 && selectedSourceIds.length === 0) {
      setError('Selecione ao menos uma fonte para a recuperação RAG.');
      return;
    }

    const userMessage: AgentMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };
    setMessages((current) => [...current, userMessage]);
    setInput('');
    setIsLoading(true);
    setThinkingTools(defaultThinkingTools);
    setError(null);

    const assistantId = `stream-${Date.now()}`;
    let assistantAdded = false;
    let latestTools: string[] = [];
    let latestSources: RagSource[] = [];
    const abortController = new AbortController();
    activeStreamRef.current = abortController;

    const ensureAssistantMessage = () => {
      if (assistantAdded) return;
      assistantAdded = true;
      setMessages((current) => [
        ...current,
        {
          id: assistantId,
          role: 'assistant',
          content: '',
          timestamp: new Date().toISOString(),
          tools: latestTools,
          sources: latestSources,
        },
      ]);
    };

    try {
      const response = await agentService.sendMessageStream(
        {
          message: text,
          conversationId,
          source,
          sourceIds: selectedSourceIds,
          topK,
        },
        {
          onConversation: setConversationId,
          onTools: (tools) => {
            latestTools = tools;
            setThinkingTools(tools.length > 0 ? tools : defaultThinkingTools);
          },
          onSources: (sources) => {
            latestSources = sources;
            setMessages((current) => current.map((message) =>
              message.id === assistantId ? { ...message, sources } : message
            ));
          },
          onToken: (token) => {
            ensureAssistantMessage();
            setIsLoading(false);
            setIsStreaming(true);
            setMessages((current) => current.map((message) =>
              message.id === assistantId
                ? { ...message, content: message.content + token }
                : message
            ));
          },
          onDone: (message) => {
            ensureAssistantMessage();
            setIsLoading(false);
            setMessages((current) => current.map((item) =>
              item.id === assistantId ? message : item
            ));
          },
        },
        abortController.signal
      );
      setConversationId(response.conversationId);
    } catch (exception) {
      if (abortController.signal.aborted) return;
      setError(extractErrorMessage(exception));
      setMessages((current) => current.filter((message) =>
        message.id !== assistantId || message.content.length > 0
      ));
    } finally {
      if (activeStreamRef.current === abortController) {
        activeStreamRef.current = null;
        setIsLoading(false);
        setIsStreaming(false);
      }
    }
  };

  return (
    <div className="mx-auto flex h-[calc(100dvh-10rem)] min-h-[34rem] max-w-4xl flex-col lg:h-[calc(100vh-12rem)]">
      <div className="mb-4 flex min-w-0 flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-slate-900">Assistente Financeiro</h1>
          <p className="text-slate-500">Respostas educativas fundamentadas nos seus próprios dados</p>
        </div>
        <TransactionSourceSelector
          value={source}
          disabled={isLoading || isStreaming}
          onChange={(next) => {
            setSource(next);
            setSelectedSourceIds(
              importSources.filter((item) => sourceMatches(item, next)).map((item) => item.id)
            );
            resetConversation(next);
          }}
          label="Tipo de fonte"
        />
      </div>

      <Card className="flex flex-1 flex-col overflow-hidden shadow-sm">
        <CardHeader className="space-y-3 border-b border-slate-100 bg-slate-50">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Bot className="h-5 w-5 text-primary-600" />
                FinVise Assistant
              </CardTitle>
              <CardDescription>Recuperação vetorial com evidências e filtros por fonte</CardDescription>
            </div>
            <label className="flex w-full items-center gap-2 text-xs font-medium text-slate-600 sm:w-44">
              <SlidersHorizontal className="h-4 w-4" />
              <span className="whitespace-nowrap">Top-k</span>
              <Select
                aria-label="Quantidade de contextos recuperados"
                value={String(topK)}
                disabled={isLoading || isStreaming}
                onChange={(event) => {
                  setTopK(Number(event.target.value));
                  resetConversation();
                }}
                options={[3, 5, 8, 10, 15].map((value) => ({
                  value: String(value),
                  label: `${value} contextos`,
                }))}
              />
            </label>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <Database className="h-3.5 w-3.5" />
                Fontes permitidas
              </span>
              {availableSources.length > 0 && (
                <button
                  type="button"
                  className="text-xs font-medium text-primary-700 hover:text-primary-800"
                  disabled={isLoading || isStreaming}
                  onClick={() => {
                    setSelectedSourceIds(
                      selectedSourceIds.length === availableSources.length
                        ? []
                        : availableSources.map((item) => item.id)
                    );
                    resetConversation();
                  }}
                >
                  {selectedSourceIds.length === availableSources.length
                    ? 'Limpar seleção'
                    : 'Selecionar todas'}
                </button>
              )}
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {sourcesLoading && (
                <span className="inline-flex items-center gap-2 text-xs text-slate-500">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Carregando fontes
                </span>
              )}
              {!sourcesLoading && availableSources.length === 0 && (
                <span className="text-xs text-slate-500">
                  Nenhuma fonte desse tipo foi importada.
                </span>
              )}
              {availableSources.map((item) => (
                <label
                  key={item.id}
                  className="inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700"
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                    checked={selectedSourceIds.includes(item.id)}
                    disabled={isLoading || isStreaming}
                    onChange={() => updateSourceSelection(item.id)}
                  />
                  {item.type === 'CSV'
                    ? <FileText className="h-3.5 w-3.5 text-primary-600" />
                    : <Database className="h-3.5 w-3.5 text-primary-600" />}
                  <span className="max-w-48 truncate" title={item.displayName}>
                    {item.displayName}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex flex-1 flex-col overflow-hidden p-0">
          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`flex max-w-[90%] flex-col gap-2 rounded-2xl px-4 py-3 sm:max-w-[82%] ${
                  message.role === 'user'
                    ? 'bg-primary-600 text-white'
                    : 'bg-slate-100 text-slate-900'
                }`}>
                  <div className="flex items-center gap-2">
                    {message.role === 'user'
                      ? <User className="h-4 w-4 shrink-0" />
                      : <Bot className="h-4 w-4 shrink-0 text-primary-600" />}
                    <span className="text-xs font-semibold opacity-75">
                      {message.role === 'user' ? 'Você' : 'FinVise Agent'}
                    </span>
                  </div>
                  <MarkdownText content={message.content} />

                  {message.role === 'assistant' && message.sources && message.sources.length > 0 && (
                    <div className="mt-2 border-t border-slate-200/70 pt-2">
                      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                        Evidências recuperadas
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {message.sources.map((ragSource, index) => (
                          <span
                            key={`${ragSource.id}-${index}`}
                            className="inline-flex items-center gap-1 rounded-full border border-primary-100 bg-white px-2 py-0.5 text-[10px] font-medium text-slate-600"
                            title={`${chunkLabel(ragSource.chunk_type)}${
                              ragSource.score != null
                                ? ` · relevância ${Math.round(ragSource.score * 100)}%`
                                : ''
                            }`}
                          >
                            <FileText className="h-2.5 w-2.5 text-primary-600" />
                            <span>S{index + 1}: {ragSource.source_name || 'Fonte selecionada'}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {message.role === 'assistant' && message.tools && message.tools.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1.5 border-t border-slate-200/60 pt-2">
                      {message.tools.map((toolName) => (
                        <span
                          key={toolName}
                          className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-slate-600"
                        >
                          <span className="h-1 w-1 rounded-full bg-emerald-500" />
                          {toolName}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start">
                <div className="flex max-w-[88%] flex-col gap-2 rounded-2xl bg-slate-100 px-4 py-3 text-slate-900">
                  <div className="flex items-center gap-2">
                    <Bot className="h-4 w-4 shrink-0 text-primary-600" />
                    <span className="text-xs font-semibold text-slate-700">FinVise Agent</span>
                    <Loader2 className="ml-1 h-3.5 w-3.5 shrink-0 animate-spin text-primary-600" />
                    <span className="text-xs text-slate-500">Pensando...</span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {thinkingTools.map((toolName) => (
                      <span
                        key={toolName}
                        className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-[10px] font-medium text-slate-600"
                      >
                        <Loader2 className="h-3 w-3 shrink-0 animate-spin text-primary-600" />
                        {toolName}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {error && (
              <Alert variant="danger">
                <AlertTitle>Erro</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div ref={bottomRef} />
          </div>

          {messages.length === 1 && (
            <div className="border-t border-slate-100 bg-slate-50 p-3">
              <p className="mb-2 flex items-center gap-1 text-xs font-medium text-slate-500">
                <Sparkles className="h-3 w-3" />
                Sugestões
              </p>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {suggestionQuestions.map((question) => (
                  <button
                    key={question}
                    type="button"
                    onClick={() => handleSend(question)}
                    className="min-h-9 shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-700 transition-colors hover:bg-slate-100"
                  >
                    {question}
                  </button>
                ))}
              </div>
            </div>
          )}

          <form
            onSubmit={(event) => {
              event.preventDefault();
              handleSend(input);
            }}
            className="flex gap-2 border-t border-slate-100 p-3"
          >
            <Input
              placeholder="Pergunte sobre os dados selecionados..."
              value={input}
              onChange={(event) => setInput(event.target.value)}
              disabled={sourcesLoading || isLoading || isStreaming}
              className="flex-1"
            />
            <Button
              type="submit"
              aria-label="Enviar mensagem"
              disabled={
                isLoading
                || isStreaming
                || sourcesLoading
                || !input.trim()
                || (availableSources.length > 0 && selectedSourceIds.length === 0)
              }
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
