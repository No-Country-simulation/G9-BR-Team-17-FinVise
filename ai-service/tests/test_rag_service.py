from app.agent.rag_service import rag_service


def test_generate_embedding_vector_length():
    embedding = rag_service.generate_embedding("Supermercado Extra R$ 150.75")
    assert isinstance(embedding, list)
    assert len(embedding) == 1536
    assert all(isinstance(v, float) for v in embedding)


def test_retrieve_context_handles_empty_user_id():
    results = rag_service.retrieve_context("", "gastos")
    assert results == []
