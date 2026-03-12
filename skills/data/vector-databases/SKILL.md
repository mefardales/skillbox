---
name: vector-databases
description: >
  Vector database patterns for AI/ML applications including semantic search,
  retrieval-augmented generation (RAG), and recommendation systems. Covers
  embedding generation, Pinecone, pgvector, ChromaDB, Weaviate, similarity
  search strategies, and chunking. Use this skill when building AI-powered
  search or RAG pipelines.
license: MIT
metadata:
  author: skillbox
  version: "1.0"
  category: data
  tags: vector, embeddings, ai, rag, similarity
---

# Vector Database Patterns

## When to Use Vector Databases

Use vector databases when you need to find items by semantic meaning rather than exact keyword match:

- **Semantic search**: find documents related to a query even without shared keywords.
- **RAG (Retrieval-Augmented Generation)**: retrieve relevant context for LLM prompts.
- **Recommendations**: find similar products, articles, or users.
- **Image/audio search**: find visually or acoustically similar media.
- **Deduplication**: detect near-duplicate content.

Do not use vector databases for exact lookups, filtering on structured fields alone, or transactional workloads.

## Embedding Generation

### OpenAI Embeddings

```python
from openai import OpenAI

client = OpenAI()

def get_embeddings(texts: list[str]) -> list[list[float]]:
    response = client.embeddings.create(
        model="text-embedding-3-small",  # 1536 dimensions, good default
        input=texts
    )
    return [item.embedding for item in response.data]

# Batch for efficiency -- up to 2048 inputs per call
embeddings = get_embeddings(["What is PostgreSQL?", "Redis caching patterns"])
```

Use `text-embedding-3-small` for cost-effective general use. Use `text-embedding-3-large` (3072 dimensions) when you need higher retrieval accuracy.

### Sentence Transformers (Local)

Use for self-hosted embedding generation with no API costs:

```python
from sentence_transformers import SentenceTransformer

model = SentenceTransformer("all-MiniLM-L6-v2")  # 384 dimensions, fast
embeddings = model.encode(["What is PostgreSQL?", "Redis caching patterns"])
```

Do not mix embeddings from different models in the same index. Dimensions and semantic spaces are incompatible.

## Pinecone

### Index Management

```python
from pinecone import Pinecone

pc = Pinecone(api_key="YOUR_KEY")

# Create index
pc.create_index(
    name="articles",
    dimension=1536,
    metric="cosine",
    spec={"serverless": {"cloud": "aws", "region": "us-east-1"}}
)

index = pc.Index("articles")
```

### Upsert and Query

```python
# Upsert vectors with metadata
index.upsert(vectors=[
    {
        "id": "article-1",
        "values": embedding_vector,
        "metadata": {
            "title": "PostgreSQL Indexing",
            "category": "database",
            "published": "2025-01-15"
        }
    }
])

# Query with metadata filter
results = index.query(
    vector=query_embedding,
    top_k=10,
    include_metadata=True,
    filter={"category": {"$eq": "database"}}
)

for match in results.matches:
    print(f"{match.id}: {match.score:.4f} - {match.metadata['title']}")
```

Use namespaces to logically separate data within one index (e.g., per tenant).

## Pgvector (PostgreSQL Extension)

Use pgvector when you already run PostgreSQL and want vector search without a separate database:

### Setup

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE documents (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    content     TEXT NOT NULL,
    metadata    JSONB DEFAULT '{}',
    embedding   vector(1536) NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Indexing

Use HNSW for best query performance. Use IVFFlat for faster index build times on large datasets:

```sql
-- HNSW index (recommended for most cases)
CREATE INDEX idx_documents_embedding ON documents
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 200);

-- IVFFlat index (faster build, slightly lower recall)
CREATE INDEX idx_documents_embedding_ivf ON documents
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);
-- Set lists = sqrt(row_count) for up to 1M rows, rows/1000 for larger
```

### Querying

```sql
-- Cosine similarity search
SELECT id, content, metadata,
    1 - (embedding <=> $1::vector) AS similarity
FROM documents
WHERE metadata->>'category' = 'database'
ORDER BY embedding <=> $1::vector
LIMIT 10;

-- Set probes for IVFFlat (higher = better recall, slower)
SET ivfflat.probes = 10;

-- Set ef_search for HNSW (higher = better recall, slower)
SET hnsw.ef_search = 100;
```

Pgvector supports exact search (no index) for small datasets. For tables under 10,000 rows, you may not need an index.

## ChromaDB for Local Development

Use ChromaDB for prototyping and local development. Do not use it for production workloads:

```python
import chromadb

client = chromadb.Client()  # in-memory
# Or: client = chromadb.PersistentClient(path="./chroma_data")

collection = client.create_collection(
    name="articles",
    metadata={"hnsw:space": "cosine"}
)

# Add documents -- ChromaDB can auto-embed with default model
collection.add(
    ids=["doc1", "doc2"],
    documents=["PostgreSQL indexing guide", "Redis caching patterns"],
    metadatas=[{"category": "database"}, {"category": "cache"}]
)

# Query
results = collection.query(
    query_texts=["How to optimize database queries?"],
    n_results=5,
    where={"category": "database"}
)
```

## Weaviate

```python
import weaviate

client = weaviate.connect_to_local()  # or connect_to_wcs for cloud

# Define collection with vectorizer
articles = client.collections.create(
    name="Article",
    vectorizer_config=weaviate.classes.config.Configure.Vectorizer.text2vec_openai(),
    properties=[
        weaviate.classes.config.Property(name="title", data_type=weaviate.classes.config.DataType.TEXT),
        weaviate.classes.config.Property(name="content", data_type=weaviate.classes.config.DataType.TEXT),
    ]
)

# Weaviate auto-vectorizes on insert
articles.data.insert({"title": "PostgreSQL Guide", "content": "..."})

# Hybrid search (vector + keyword)
response = articles.query.hybrid(
    query="database optimization",
    alpha=0.75,  # 0 = pure keyword, 1 = pure vector
    limit=10
)
```

## Similarity Search Strategies

- **Cosine similarity**: Use for normalized text embeddings. Most common default.
- **Euclidean (L2) distance**: Use when magnitude matters (e.g., image features).
- **Dot product**: Use when vectors are already normalized. Faster than cosine.

Always use the same distance metric at index creation and query time.

## Hybrid Search

Combine vector similarity with keyword matching for better retrieval:

```python
# Reciprocal Rank Fusion (RRF) -- merge two ranked lists
def rrf_merge(vector_results, keyword_results, k=60):
    scores = {}
    for rank, doc_id in enumerate(vector_results):
        scores[doc_id] = scores.get(doc_id, 0) + 1 / (k + rank + 1)
    for rank, doc_id in enumerate(keyword_results):
        scores[doc_id] = scores.get(doc_id, 0) + 1 / (k + rank + 1)
    return sorted(scores.items(), key=lambda x: x[1], reverse=True)
```

## Chunking Strategies

Split documents before embedding. Chunk size affects retrieval quality:

```python
from langchain.text_splitter import RecursiveCharacterTextSplitter

splitter = RecursiveCharacterTextSplitter(
    chunk_size=512,        # tokens/characters per chunk
    chunk_overlap=50,      # overlap between adjacent chunks
    separators=["\n\n", "\n", ". ", " "]
)

chunks = splitter.split_text(long_document)
```

- Use 256-512 tokens for precise retrieval (Q&A, support docs).
- Use 512-1024 tokens for broader context (summarization, analysis).
- Always include overlap (10-20% of chunk size) to avoid splitting mid-sentence.
- Store the source document ID, chunk index, and section title as metadata for every chunk.

## RAG Pipeline Architecture

```python
def rag_query(question: str) -> str:
    # 1. Embed the question
    query_embedding = get_embeddings([question])[0]

    # 2. Retrieve relevant chunks
    results = index.query(vector=query_embedding, top_k=5, include_metadata=True)
    context_chunks = [match.metadata["text"] for match in results.matches]

    # 3. Build prompt with retrieved context
    context = "\n\n---\n\n".join(context_chunks)
    prompt = f"""Answer the question based on the provided context.
If the context does not contain enough information, say so.

Context:
{context}

Question: {question}"""

    # 4. Generate answer
    response = openai_client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": prompt}],
        temperature=0
    )
    return response.choices[0].message.content
```

- Re-rank results before passing to the LLM. Use a cross-encoder or Cohere Rerank for better precision.
- Include metadata (source URL, title) in the prompt so the LLM can cite sources.
- Monitor retrieval quality by logging queries, retrieved chunks, and user feedback.
