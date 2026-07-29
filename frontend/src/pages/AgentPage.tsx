import { useState, useRef, useEffect } from 'react';
import {
  Send,
  Bot,
  User,
  Sparkles,
  Tag,
  BarChart3,
  Lightbulb,
  CreditCard,
  Search,
  TrendingUp,
  Target,
  Repeat,
  Zap,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/Alert';
import { agentService } from '@/services/agentService';
import { AgentMessage } from '@/types/agent';
import { extractErrorMessage } from '@/lib/api';
import { useTransactionSource } from '@/hooks/useTransactionSource';
import { TransactionSourceSelector } from '@/components/transactions/TransactionSourceSelector';

const welcomeMessage: AgentMessage = {
  id: 'welcome',
  role: 'assistant',
  content: 'Olá! Sou seu assistente financeiro. Como posso ajudar você hoje?',
  timestamp: new Date().toISOString(),
};

const suggestionQuestions = [
  'Como posso economizar mais?',
  'O que é reserva de emergência?',
  'Como reduzir meus gastos?',
  'Quais investimentos são seguros?',
];

function ToolBadgeIcon({ toolName }: { toolName: string }) {
  const iconClass = 'h-3.5 w-3.5 shrink-0';
  switch (toolName) {
    case 'get_financial_profile':
    case 'profile_classifier':
      return <Tag className={iconClass} />;
    case 'get_financial_indicators':
      return <BarChart3 className={iconClass} />;
    case 'get_recommendations':
      return <Lightbulb className={iconClass} />;
    case 'get_spending_summary':
    case 'get_transactions':
      return <CreditCard className={iconClass} />;
    case 'rag_retrieval':
      return <Search className={iconClass} />;
    case 'compare_periods':
      return <TrendingUp className={iconClass} />;
    case 'simulate_savings_plan':
      return <Target className={iconClass} />;
    case 'get_recurring_expenses':
      return <Repeat className={iconClass} />;
    default:
      return <Zap className={iconClass} />;
  }
}

function getToolBadgeDetails(toolName: string) {
  switch (toolName) {
    case 'get_financial_profile':
    case 'profile_classifier':
      return { label: 'Perfil Financeiro', color: 'bg-blue-50 text-blue-700 border-blue-200' };
    case 'get_financial_indicators':
      return { label: 'Indicadores', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    case 'get_recommendations':
      return { label: 'Recomendações IA', color: 'bg-amber-50 text-amber-700 border-amber-200' };
    case 'get_spending_summary':
    case 'get_transactions':
      return { label: 'Análise de Gastos', color: 'bg-purple-50 text-purple-700 border-purple-200' };
    case 'rag_retrieval':
      return { label: 'Banco Vetorial RAG', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' };
    case 'compare_periods':
      return { label: 'Comparativo', color: 'bg-cyan-50 text-cyan-700 border-cyan-200' };
    case 'simulate_savings_plan':
      return { label: 'Simulação de Metas', color: 'bg-rose-50 text-rose-700 border-rose-200' };
    case 'get_recurring_expenses':
      return { label: 'Gastos Recorrentes', color: 'bg-orange-50 text-orange-700 border-orange-200' };
    default:
      return { label: 'Ferramenta IA', color: 'bg-slate-100 text-slate-700 border-slate-200' };
  }
}

export function AgentPage() {
  const { source, setSource } = useTransactionSource();
  const [messages, setMessages] = useState<AgentMessage[]>([welcomeMessage]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  const handleSend = async (text: string) => {
    if (!text.trim() || isLoading || isStreaming) return;

    const userMessage: AgentMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setError(null);

    try {
      const response = await agentService.sendMessage({
        message: text,
        conversationId,
        source,
      });
      setConversationId(response.conversationId);

      setIsLoading(false);
      setIsStreaming(true);

      const fullText = response.message.content;
      const assistantId = response.message.id || Date.now().toString();

      // Inicia com mensagem vazia para streaming
      setMessages((prev) => [
        ...prev,
        { ...response.message, id: assistantId, content: '' },
      ]);

      let index = 0;
      const chunkSize = 3;
      const interval = setInterval(() => {
        index += chunkSize;
        if (index >= fullText.length) {
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, content: fullText } : m))
          );
          clearInterval(interval);
          setIsStreaming(false);
        } else {
          const currentContent = fullText.slice(0, index);
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, content: currentContent } : m))
          );
        }
      }, 20);
    } catch (err) {
      setError(extractErrorMessage(err));
      setMessages((prev) => prev.filter((m) => m.id !== userMessage.id));
      setIsLoading(false);
      setIsStreaming(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSend(input);
  };

  return (
    <div className="mx-auto flex h-[calc(100dvh-10rem)] min-h-[30rem] max-w-3xl flex-col lg:h-[calc(100vh-12rem)]">
      <div className="mb-4 flex min-w-0 flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-slate-900">Assistente Financeiro</h1>
          <p className="text-slate-500">Tire dúvidas e receba dicas personalizadas com IA e RAG</p>
        </div>
        <TransactionSourceSelector
          value={source}
          onChange={(next) => {
            setSource(next);
            setConversationId(undefined);
            setMessages([{ ...welcomeMessage, id: `welcome-${next}`, timestamp: new Date().toISOString() }]);
          }}
          label="Contexto do assistente"
        />
      </div>

      <Card className="flex flex-1 flex-col overflow-hidden shadow-sm">
        <CardHeader className="border-b border-slate-100 bg-slate-50">
          <CardTitle className="flex items-center gap-2 text-base">
            <Bot className="h-5 w-5 text-primary-600" />
            FinVise Assistant
          </CardTitle>
          <CardDescription>Powered by inteligência artificial e estrutura RAG</CardDescription>
        </CardHeader>

        <CardContent className="flex flex-1 flex-col overflow-hidden p-0">
          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`flex max-w-[88%] flex-col gap-2 rounded-2xl px-4 py-3 sm:max-w-[80%] ${
                    message.role === 'user'
                      ? 'bg-primary-600 text-white'
                      : 'bg-slate-100 text-slate-900'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className="shrink-0">
                      {message.role === 'user' ? (
                        <User className="h-4 w-4" />
                      ) : (
                        <Bot className="h-4 w-4 text-primary-600" />
                      )}
                    </div>
                    <span className="text-xs font-semibold opacity-75">
                      {message.role === 'user' ? 'Você' : 'FinVise Agent'}
                    </span>
                  </div>

                  {/* Clean Visual Icon Badges for Executed Tools and RAG */}
                  {message.role === 'assistant' && message.tools && message.tools.length > 0 && (
                    <div className="my-1 flex flex-wrap gap-1.5">
                      {message.tools.map((t, i) => {
                        const badge = getToolBadgeDetails(t);
                        return (
                          <span
                            key={i}
                            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-all ${badge.color}`}
                          >
                            <ToolBadgeIcon toolName={t} />
                            <span>{badge.label}</span>
                          </span>
                        );
                      })}
                    </div>
                  )}

                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-2xl bg-slate-100 px-4 py-3">
                  <Spinner size="sm" />
                  <span className="text-xs text-slate-500">Consultando banco vetorial e executando ferramentas...</span>
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
                    onClick={() => handleSend(question)}
                    className="min-h-9 shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-700 transition-colors hover:bg-slate-100"
                  >
                    {question}
                  </button>
                ))}
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex gap-2 border-t border-slate-100 p-3">
            <Input
              placeholder="Digite sua pergunta..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="flex-1"
            />
            <Button type="submit" disabled={isLoading || isStreaming || !input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
