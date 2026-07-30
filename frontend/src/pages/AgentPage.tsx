import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowUpRight,
  Bot,
  CheckCircle2,
  Loader2,
  Search,
  Send,
  Sparkles,
  User,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/Alert';
import { AgentContextPanel } from '@/components/agent/AgentContextPanel';
import { retrievalDepthLabel } from '@/components/agent/agentContextOptions';
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
  content: 'Pronto para ajudar você a entender seus dados.',
  timestamp: new Date().toISOString(),
};

const suggestionQuestions = [
  'Quais padrões existem nos meus gastos?',
  'Explique meu saldo mensal em linguagem simples',
  'Onde tenho oportunidade de economizar?',
  'Compare minhas receitas e despesas',
];

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
  const [filtersOpen, setFiltersOpen] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
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
    if (selectedSourceIds.length === 0) {
      setFiltersOpen(true);
      setError('Selecione ao menos um arquivo para que eu possa consultar seus dados.');
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
    setFiltersOpen(false);
    if (inputRef.current) inputRef.current.style.height = '44px';
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

  return (
    <div className="mx-auto flex h-[calc(100dvh-9rem)] min-h-[38rem] max-w-5xl flex-col lg:h-[calc(100vh-10rem)]">
      <div className="mb-4 min-w-0">
        <h1 className="text-2xl font-bold text-slate-900">Assistente Financeiro</h1>
        <p className="mt-1 text-sm text-slate-500 sm:text-base">
          Entenda suas finanças com respostas baseadas nos seus próprios dados
        </p>
      </div>

      <Card className="flex flex-1 flex-col overflow-hidden border-slate-200 shadow-md shadow-slate-200/40">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-600 text-white shadow-sm shadow-primary-200">
              <Bot className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900">FinVise</p>
              <p className="truncate text-xs text-slate-500">Seus dados explicados com clareza</p>
            </div>
          </div>
          <div className={`hidden items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium sm:flex ${
            isLoading || isStreaming
              ? 'bg-primary-50 text-primary-700'
              : 'bg-emerald-50 text-emerald-700'
          }`}>
            <span className={`h-2 w-2 rounded-full ${
              isLoading || isStreaming ? 'animate-pulse bg-primary-500' : 'bg-emerald-500'
            }`} />
            {isLoading || isStreaming ? 'Analisando dados' : 'Pronto para ajudar'}
          </div>
        </div>

        <AgentContextPanel
          source={source}
          availableSources={availableSources}
          selectedSourceIds={selectedSourceIds}
          topK={topK}
          isOpen={filtersOpen}
          disabled={isLoading || isStreaming}
          sourcesLoading={sourcesLoading}
          onToggleOpen={() => setFiltersOpen((current) => !current)}
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
          onTopKChange={(nextTopK) => {
            setTopK(nextTopK);
            resetConversation();
          }}
        />

        <CardContent className="flex flex-1 flex-col overflow-hidden p-0">
          <div className="flex-1 space-y-4 overflow-y-auto bg-slate-50/50 p-4 sm:p-5">
            {messages.map((message) => {
              if (message.id.startsWith('welcome')) {
                return (
                  <div
                    key={message.id}
                    className="mx-auto flex max-w-2xl flex-col items-center px-1 py-4 text-center sm:py-7"
                  >
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-100 text-primary-700">
                      <Sparkles className="h-7 w-7" />
                    </div>
                    <h2 className="mt-4 text-lg font-bold text-slate-900">
                      O que você quer entender hoje?
                    </h2>
                    <p className="mt-1 max-w-lg text-sm leading-6 text-slate-500">
                      {selectedSourceIds.length > 0
                        ? `Vou consultar ${selectedSourceIds.length} ${
                          selectedSourceIds.length === 1 ? 'arquivo' : 'arquivos'
                        } e mostrar as evidências usadas na resposta.`
                        : 'Selecione ao menos um arquivo acima para começar a análise.'}
                    </p>

                    <div className="mt-5 grid w-full gap-2 sm:grid-cols-2">
                      {suggestionQuestions.map((question) => (
                        <button
                          key={question}
                          type="button"
                          disabled={
                            sourcesLoading
                            || isLoading
                            || isStreaming
                            || selectedSourceIds.length === 0
                          }
                          onClick={() => handleSend(question)}
                          className="group flex min-h-14 items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-left text-xs font-medium leading-5 text-slate-700 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary-200 hover:text-primary-800 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
                        >
                          <span>{question}</span>
                          <ArrowUpRight className="h-4 w-4 shrink-0 text-slate-400 transition-colors group-hover:text-primary-600" />
                        </button>
                      ))}
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={message.id}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`flex max-w-[92%] flex-col gap-2 rounded-2xl px-4 py-3 sm:max-w-[82%] ${
                    message.role === 'user'
                      ? 'bg-primary-600 text-white shadow-sm shadow-primary-200'
                      : 'border border-slate-200 bg-white text-slate-900 shadow-sm'
                  }`}>
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
                              className="flex min-w-0 items-start gap-2 rounded-lg bg-slate-50 p-2 text-[11px] text-slate-600"
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
                <div className="flex max-w-[92%] flex-col gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 shadow-sm">
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

          <div className="border-t border-slate-200 bg-white p-3 sm:p-4">
            <div className="mb-2 flex min-w-0 items-center justify-between gap-3 px-0.5 text-[11px] text-slate-500">
              <span className="truncate">
                {selectedSourceIds.length > 0
                  ? `${selectedSourceIds.length} ${
                    selectedSourceIds.length === 1 ? 'arquivo' : 'arquivos'
                  } · Busca ${retrievalDepthLabel(topK).toLocaleLowerCase('pt-BR')}`
                  : 'Selecione um arquivo para conversar'}
              </span>
              <span className="hidden shrink-0 sm:inline">Enter envia · Shift + Enter quebra a linha</span>
            </div>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                handleSend(input);
              }}
              className="flex items-end gap-2 rounded-xl border border-slate-300 bg-white p-1.5 shadow-sm transition-shadow focus-within:border-primary-400 focus-within:ring-2 focus-within:ring-primary-100"
            >
              <textarea
                ref={inputRef}
                placeholder="Pergunte sobre os dados selecionados..."
                value={input}
                rows={1}
                onChange={(event) => {
                  setInput(event.target.value);
                  event.target.style.height = '44px';
                  event.target.style.height = `${Math.min(event.target.scrollHeight, 128)}px`;
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    handleSend(input);
                  }
                }}
                disabled={sourcesLoading || isLoading || isStreaming}
                className="min-h-11 max-h-32 flex-1 resize-none bg-transparent px-2.5 py-3 text-sm leading-5 text-slate-900 outline-none placeholder:text-slate-400 disabled:cursor-not-allowed disabled:opacity-50"
              />
              <Button
                type="submit"
                aria-label="Enviar mensagem"
                className="mb-0.5 h-10 shrink-0 gap-2 rounded-lg px-3 sm:px-4"
                disabled={
                  isLoading
                  || isStreaming
                  || sourcesLoading
                  || !input.trim()
                  || selectedSourceIds.length === 0
                }
              >
                <Send className="h-4 w-4" />
                <span className="hidden sm:inline">Enviar</span>
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
