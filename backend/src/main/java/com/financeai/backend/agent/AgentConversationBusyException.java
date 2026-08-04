package com.financeai.backend.agent;

public class AgentConversationBusyException extends RuntimeException {
    public AgentConversationBusyException() {
        super("Esta conversa já possui uma resposta em processamento");
    }
}
