import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Bot,
  CheckCircle2,
  Loader2,
  Plus,
  Search,
  Send,
  Square,
  User,
  X,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/Alert';
import { AgentContextPanel } from '@/components/agent/AgentContextPanel';
import { AgentDepthSelector } from '@/components/agent/AgentDepthSelector';
import { MarkdownText } from '@/components/ui/MarkdownText';
import { useTransactionSource } from '@/hooks/useTransactionSource';
import { agentService } from '@/services/agentService';
import { importSourceService, ImportSource } from '@/services/importSourceService';
import { AgentMessage, RagSource } from '@/types/agent';
import { TransactionSource } from '@/types/transaction';
import { extractErrorMessage } from '@/lib/api';
import { cn } from '@/lib/utils';

const welcomeMessage: AgentMessage = {
  id: 'welcome',
  role: 'assistant',
  content: 'Pronto para ajudar você a entender seus dados.',
  timestamp: new Date().toISOString(),
};

const defaultThinkingTools = ['rag_retrieval', 'financial_tools'];
const emptyImportSources: ImportSource[] = [];
const toolLabels: Record<string, string> = {
  rag_retrieval: 'Buscando evidências',
  financial_tools: 'Calculando indicadores',
  get_financial_profile: 'Lendo perfil financeiro',
  get_financial_indicators: 'Calculando indicadores',
  get_spending_summary: 'Analisando despesas',
  get_transactions: 'Consultando transações',
  get_recurring_expenses: 'Verificando gastos recorrentes',
  compare_periods: 'Comparando períodos',
  simulate_savings_plan: 'Simulando plano de economia',
  get_recommendations: 'Preparando recomendações',
  resposta_segura: 'Resposta de segurança',
  regra_financeira_fallback: 'Análise financeira local',
};

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

function toolLabel(name: string) {
  return toolLabels[name] ?? name.replaceAll('_', ' ');
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
  const [filtersOpen, setFiltersOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
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
    if (!sourcesLoading && availableSources.length === 0) {
      setFiltersOpen(true);
    }
  }, [availableSources.length, sourcesLoading]);

  useEffect(() => {
    if (!filtersOpen) return;

    const closeContextMenu = (event: PointerEvent) => {
      if (!contextMenuRef.current?.contains(event.target as Node)) {
        setFiltersOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setFiltersOpen(false);
    };

    document.addEventListener('pointerdown', closeContextMenu);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeContextMenu);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [filtersOpen]);

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

  const stopResponse = () => {
    activeStreamRef.current?.abort();
    activeStreamRef.current = null;
    setIsLoading(false);
    setIsStreaming(false);
    setThinkingTools(defaultThinkingTools);
  };

  const handleSend = async (text: string) => {
    if (!text.trim() || isLoading || isStreaming || sourcesLoading) return;
    if (selectedSourceIds.length === 0) {
      setFiltersOpen(true);
      setError('Selecione ao menos um arquivo para que eu possa consultar seus dados.');
      return;
    }

    const userMessage: AgentMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };
    setMessages((current) => [...current, userMessage]);
    setInput('');
    setFiltersOpen(false);
    if (inputRef.current) inputRef.current.style.height = '36px';
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
          clientMessageId: userMessage.id,
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
              item.id === assistantId
                ? {
                  ...message,
                  content: message.content.trim() ? message.content : item.content,
                  tools: message.tools?.length ? message.tools : item.tools,
                  sources: message.sources?.length ? message.sources : item.sources,
                }
                : item
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

  const isEmptyState = messages.length === 1 && messages[0].id.startsWith('welcome');

  return (
    <div className="mx-auto flex h-[calc(100dvh-8rem)] min-h-0 w-full max-w-none flex-col lg:h-[calc(100vh-7rem)] xl:h-[calc(100vh-8rem)]">
      <Card className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-none border-0 bg-white shadow-none lg:bg-transparent">
        <CardContent className="relative flex min-h-0 flex-1 flex-col overflow-hidden p-0">
          <div
            className={cn(
              'min-h-0 flex-1 overflow-y-auto',
              isEmptyState
                ? 'flex flex-col items-center justify-center bg-white px-6 pb-16 text-center lg:bg-transparent lg:pb-0'
                : 'space-y-3 bg-slate-50/50 p-3 sm:space-y-4 sm:p-5'
            )}
          >
            {messages.map((message) => {
              if (message.id.startsWith('welcome')) {
                if (!isEmptyState) return null;

                return (
                  <div
                    key={message.id}
                    className="mx-auto flex max-w-2xl flex-col items-center lg:-translate-y-10"
                  >
                    <h1 className="text-2xl font-medium tracking-tight text-slate-900 sm:text-3xl lg:text-4xl">
                      Vamos começar?
                    </h1>
                  </div>
                );
              }

              return (
                <div
                  key={message.id}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    data-message-role={message.role}
                    className={`flex max-w-[92%] flex-col gap-2 rounded-2xl px-4 py-3 sm:max-w-[82%] ${
                    message.role === 'user'
                      ? 'bg-primary-600 text-white shadow-sm shadow-primary-200'
                      : 'border border-slate-200 bg-slate-100/80 text-slate-900 shadow-sm'
                  }`}
                  >
                    <div className="flex items-center gap-2">
                      {message.role === 'user'
                        ? <User className="h-4 w-4 shrink-0" />
                        : <Bot className="h-4 w-4 shrink-0 text-primary-600" />}
                      <span className="text-xs font-semibold opacity-75">
                        {message.role === 'user' ? 'Você' : 'FinVise'}
                      </span>
                    </div>
                    <MarkdownText content={message.content} />

                    {message.role === 'assistant' && message.sources && message.sources.length > 0 && (
                      <details className="mt-2 border-t border-slate-200 pt-2">
                        <summary className="flex cursor-pointer list-none items-center gap-2 text-xs font-semibold text-primary-700">
                          <Search className="h-3.5 w-3.5" />
                          {message.sources.length}{' '}
                          {message.sources.length === 1 ? 'evidência consultada' : 'evidências consultadas'}
                        </summary>
                        <div className="mt-2 grid gap-2">
                          {message.sources.map((ragSource, index) => (
                            <div
                              key={`${ragSource.id}-${index}`}
                              className="flex min-w-0 items-start gap-2 rounded-lg bg-white/80 p-2 text-[11px] text-slate-600"
                            >
                              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-md bg-primary-100 px-1 font-bold text-primary-700">
                                S{index + 1}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate font-semibold text-slate-700">
                                  {ragSource.source_name || 'Fonte selecionada'}
                                </span>
                                <span>
                                  {chunkLabel(ragSource.chunk_type)}
                                  {ragSource.score != null
                                    ? ` · ${Math.round(ragSource.score * 100)}% de relevância`
                                    : ''}
                                </span>
                              </span>
                            </div>
                          ))}
                        </div>
                      </details>
                    )}

                    {message.role === 'assistant' && message.tools && message.tools.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1.5 border-t border-slate-200 pt-2">
                        {message.tools.map((toolName) => (
                          <span
                            key={toolName}
                            className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-medium text-emerald-700"
                          >
                            <CheckCircle2 className="h-3 w-3" />
                            {toolLabel(toolName)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {isLoading && (
              <div className="flex justify-start">
                <div className="flex max-w-[92%] flex-col gap-2 rounded-2xl border border-slate-200 bg-slate-100/80 px-4 py-3 text-slate-900 shadow-sm">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary-50">
                      <Bot className="h-4 w-4 shrink-0 text-primary-600" />
                    </span>
                    <div>
                      <p className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                        Pensando...
                        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-primary-600" />
                      </p>
                      <p className="text-[10px] text-slate-500">Analisando seus dados com segurança</p>
                    </div>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {thinkingTools.map((toolName) => (
                      <span
                        key={toolName}
                        className="inline-flex items-center gap-1.5 rounded-full border border-primary-100 bg-primary-50 px-2.5 py-1 text-[10px] font-medium text-primary-700"
                      >
                        <Loader2 className="h-3 w-3 shrink-0 animate-spin" />
                        {toolLabel(toolName)}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {error && (
              <Alert variant="danger">
                <AlertTitle>Não foi possível responder</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div ref={bottomRef} />
          </div>

          <div
            className={cn(
              'bg-white',
              isEmptyState
                ? 'border-0 px-3 pb-3 pt-2 lg:absolute lg:left-1/2 lg:top-1/2 lg:w-full lg:max-w-2xl lg:-translate-x-1/2 lg:translate-y-6 lg:bg-transparent lg:p-0'
                : 'border-t border-slate-200 p-2 sm:p-4'
            )}
          >
            <form
              onSubmit={(event) => {
                event.preventDefault();
                handleSend(input);
              }}
              className={cn(
                'flex min-h-12 min-w-0 items-center gap-0.5 rounded-full border border-slate-300 bg-slate-50 p-1 shadow-sm transition-shadow focus-within:border-primary-400 focus-within:ring-2 focus-within:ring-primary-100 sm:min-h-14 sm:gap-1 sm:p-1.5',
                isEmptyState && 'lg:min-h-16 lg:border-slate-200 lg:bg-white lg:px-2 lg:shadow-lg lg:shadow-slate-300/30'
              )}
            >
              <div ref={contextMenuRef} className="relative shrink-0">
                <button
                  type="button"
                  aria-label={`Selecionar fontes. ${selectedSourceIds.length} ${
                    selectedSourceIds.length === 1 ? 'arquivo selecionado' : 'arquivos selecionados'
                  }`}
                  aria-expanded={filtersOpen}
                  aria-controls="agent-context-controls"
                  disabled={isLoading || isStreaming}
                  onClick={() => setFiltersOpen((current) => !current)}
                  className={cn(
                    'relative flex h-11 w-11 items-center justify-center rounded-full text-slate-600 transition-colors hover:bg-slate-200 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:cursor-not-allowed disabled:opacity-50',
                    filtersOpen && 'bg-primary-100 text-primary-700'
                  )}
                >
                  {filtersOpen
                    ? <X className="h-5 w-5" />
                    : <Plus className="h-5 w-5" />}
                  {!filtersOpen && selectedSourceIds.length > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary-600 px-1 text-[9px] font-bold text-white">
                      {selectedSourceIds.length > 9 ? '9+' : selectedSourceIds.length}
                    </span>
                  )}
                </button>

                <AgentContextPanel
                  source={source}
                  availableSources={availableSources}
                  selectedSourceIds={selectedSourceIds}
                  isOpen={filtersOpen}
                  disabled={isLoading || isStreaming}
                  sourcesLoading={sourcesLoading}
                  onSourceChange={(next) => {
                    if (next === source) return;
                    setSource(next);
                    setSelectedSourceIds(
                      importSources.filter((item) => sourceMatches(item, next)).map((item) => item.id)
                    );
                    resetConversation(next);
                  }}
                  onToggleSource={updateSourceSelection}
                  onToggleAll={() => {
                    setSelectedSourceIds(
                      selectedSourceIds.length === availableSources.length
                        ? []
                        : availableSources.map((item) => item.id)
                    );
                    resetConversation();
                  }}
                />
              </div>

              <textarea
                ref={inputRef}
                placeholder="Pergunte sobre seus dados..."
                aria-describedby="agent-input-hint"
                value={input}
                rows={1}
                onChange={(event) => {
                  setInput(event.target.value);
                  event.target.style.height = '36px';
                  event.target.style.height = `${Math.min(event.target.scrollHeight, 112)}px`;
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    handleSend(input);
                  }
                }}
                disabled={sourcesLoading || isLoading || isStreaming}
                className="min-h-11 min-w-0 max-h-28 flex-1 resize-none bg-transparent px-1.5 py-2 text-sm leading-5 text-slate-900 outline-none placeholder:text-slate-400 disabled:cursor-not-allowed disabled:opacity-50 sm:max-h-32 sm:px-2 sm:py-2.5"
              />

              <AgentDepthSelector
                value={topK}
                disabled={isLoading || isStreaming}
                onChange={(nextTopK) => {
                  setTopK(nextTopK);
                  resetConversation();
                }}
              />

              {isLoading || isStreaming ? (
                <Button
                  type="button"
                  aria-label="Parar resposta"
                  title="Parar resposta"
                  onClick={stopResponse}
                  className="h-11 w-11 shrink-0 rounded-full p-0"
                >
                  <Square className="h-3.5 w-3.5 fill-current" />
                </Button>
              ) : (
                <Button
                  type="submit"
                  aria-label="Enviar mensagem"
                  className="h-11 w-11 shrink-0 rounded-full p-0"
                  disabled={
                    sourcesLoading
                    || !input.trim()
                    || selectedSourceIds.length === 0
                  }
                >
                  <Send className="h-4 w-4" />
                </Button>
              )}
            </form>
            <p id="agent-input-hint" className="sr-only">
              Use o botão de adicionar para escolher os arquivos. Selecione a profundidade para
              definir quantas evidências serão consultadas. Enter envia; Shift mais Enter quebra
              a linha. Durante a resposta, use o botão parar para interromper.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
