import { useState, useRef, useEffect } from 'react';
import {
  Send,
  Bot,
  User,
  Sparkles,
  Loader2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
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

                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start">
                <div className="flex max-w-[88%] flex-col gap-2.5 rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3.5 text-slate-100 shadow-md sm:max-w-[80%]">
                  <div className="flex items-center gap-2">
                    <Bot className="h-4 w-4 text-emerald-400" />
                    <span className="text-xs font-semibold text-slate-300">FinVise Agent</span>
                  </div>

                  {/* Claude Code Style Animated Tool Execution */}
                  <div className="flex flex-col gap-2 font-mono text-xs">
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-400 shrink-0" />
                      <span className="text-emerald-400 font-semibold tracking-wide uppercase text-[10px]">
                        Executing Tool
                      </span>
                      <span className="rounded bg-slate-800 px-2 py-0.5 text-[11px] text-slate-200 border border-slate-700 font-mono">
                        rag_retrieval & tools
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-slate-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping shrink-0" />
                      <span>Consultando vetor RAG no PostgreSQL e calculando indicadores...</span>
                    </div>
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
