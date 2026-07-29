import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles } from 'lucide-react';
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

export function AgentPage() {
  const { source, setSource } = useTransactionSource();
  const [messages, setMessages] = useState<AgentMessage[]>([welcomeMessage]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (text: string) => {
    if (!text.trim() || isLoading) return;

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
      setMessages((prev) => [...prev, response.message]);
    } catch (err) {
      setError(extractErrorMessage(err));
      setMessages((prev) => prev.filter((m) => m.id !== userMessage.id));
    } finally {
      setIsLoading(false);
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
        <p className="text-slate-500">Tire dúvidas e receba dicas personalizadas</p>
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

      <Card className="flex flex-1 flex-col overflow-hidden">
        <CardHeader className="border-b border-slate-100 bg-slate-50">
          <CardTitle className="flex items-center gap-2 text-base">
            <Bot className="h-5 w-5 text-primary-600" />
            FinVise Assistant
          </CardTitle>
          <CardDescription>Powered by inteligência artificial</CardDescription>
        </CardHeader>

        <CardContent className="flex flex-1 flex-col overflow-hidden p-0">
          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`flex max-w-[88%] gap-2.5 rounded-2xl px-3.5 py-2.5 sm:max-w-[80%] sm:gap-3 sm:px-4 sm:py-3 ${
                    message.role === 'user'
                      ? 'bg-primary-600 text-white'
                      : 'bg-slate-100 text-slate-900'
                  }`}
                >
                  <div className="mt-0.5 shrink-0">
                    {message.role === 'user' ? (
                      <User className="h-4 w-4" />
                    ) : (
                      <Bot className="h-4 w-4 text-primary-600" />
                    )}
                  </div>
                  <p className="text-sm leading-relaxed">{message.content}</p>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-2xl bg-slate-100 px-4 py-3">
                  <Spinner size="sm" />
                  <span className="text-xs text-slate-500">Pensando...</span>
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
            <Button type="submit" disabled={isLoading || !input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
