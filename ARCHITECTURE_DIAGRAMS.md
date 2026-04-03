# Architecture Diagrams

This document contains two Mermaid diagrams for the AI-powered chatbot architecture:

1. High-level architecture view
2. Low-level query routing and response flow

These diagrams are intended for developer handoff, architecture review, and stakeholder presentations.

## High-Level Architecture Diagram

Key points:
- The frontend sends user queries to the backend chat service.
- The backend uses an LLM-based query router as the first step.
- Queries can go to conversational handling, RAG retrieval, tool orchestration, or a hybrid path.
- External APIs and tools are accessed through an orchestration layer.
- The LLM is used both for routing and for final response generation/synthesis.

```mermaid
flowchart LR
    %% User-facing layer
    U[User] -->|asks question| FE[Frontend Chat Interface\nAngular / Web UI]
    FE -->|HTTPS / REST| BE[Backend Chat Service\nAPI + Session Handling]
    BE -->|final response| FE

    %% Core orchestration
    subgraph Core[Core Orchestration]
        QR[Query Router\nLLM-based intent classification]
        ORCH[MCP / Tool Orchestration Layer\nTool selection + execution policy]
        RESP[Response Generation LLM\nAnswering / reasoning / synthesis]
    end

    %% RAG subsystem
    subgraph RAG[RAG Subsystem]
        RET[Retriever]
        EMB[Embedding Model]
        VDB[Vector Database\nPinecone / Local Vector Store]
        DOCS[Document Store / Uploaded Files]
    end

    %% Tools
    subgraph Tools[External Tool Layer]
        WTH[Weather API]
        SHIP[Shipment Tracking API]
        CALC[Calculator / Deterministic Tool]
        OTH[Other Business Tools / APIs]
    end

    %% LLM services
    subgraph Models[Model Layer]
        ROUTERLLM[Router LLM]
        GENLLM[Generation LLM]
    end

    BE -->|Step 1: classify query| QR
    QR -->|intent classification request| ROUTERLLM
    ROUTERLLM -->|route: conversational / document / tool / hybrid| QR

    QR -->|Conversational| RESP
    QR -->|Document query| RET
    QR -->|Tool-based query| ORCH
    QR -->|Hybrid query| RET
    QR -->|Hybrid query| ORCH

    RET -->|embed user query| EMB
    EMB -->|query vector| VDB
    DOCS -->|chunked + embedded corpus| VDB
    VDB -->|top-k chunks| RET
    RET -->|retrieved context| RESP

    ORCH -->|tool call| WTH
    ORCH -->|tool call| SHIP
    ORCH -->|tool call| CALC
    ORCH -->|tool call| OTH
    WTH -->|structured result| ORCH
    SHIP -->|structured result| ORCH
    CALC -->|computed result| ORCH
    OTH -->|API result| ORCH
    ORCH -->|tool outputs| RESP

    RESP -->|reasoning + grounded answer generation| GENLLM
    GENLLM -->|draft answer / synthesis| RESP
    RESP -->|final answer payload| BE

    classDef ui fill:#e8f1ff,stroke:#2d5baf,stroke-width:1.5px,color:#111;
    classDef core fill:#fff3e6,stroke:#b86b00,stroke-width:1.5px,color:#111;
    classDef rag fill:#e9f8ef,stroke:#2f855a,stroke-width:1.5px,color:#111;
    classDef tool fill:#fff0f0,stroke:#c53030,stroke-width:1.5px,color:#111;
    classDef model fill:#f5ecff,stroke:#6b46c1,stroke-width:1.5px,color:#111;

    class U,FE,BE ui;
    class QR,ORCH,RESP core;
    class RET,EMB,VDB,DOCS rag;
    class WTH,SHIP,CALC,OTH tool;
    class ROUTERLLM,GENLLM model;
```

## Low-Level Sequence / Flow Diagram

Key points:
- Every query first goes through the LLM query router.
- The router classifies the request into conversational, document query, tool-based, or hybrid.
- RAG flows include embeddings, retrieval, chunk selection, and grounded generation.
- Tool-based flows use external APIs or deterministic tools, then pass structured output to the LLM.
- Hybrid flows combine both RAG context and tool results before final synthesis.
- Fallback handling is included when document retrieval does not return relevant chunks.

```mermaid
flowchart TD
    S0([Step 0\nUser sends query in chat UI]) --> S1[Backend Chat Service receives request]
    S1 --> S2[Step 1\nLLM Query Router classifies intent]

    S2 -->|CONVERSATIONAL| C1[Skip retrieval and tools]
    C1 --> C2[Send query to response LLM]
    C2 --> C3[Return direct conversational response]

    S2 -->|DOCUMENT_QUERY / RAG| R1[Generate query embedding]
    R1 --> R2[Search vector database]
    R2 --> R3[Retrieve top-k relevant chunks]
    R3 --> R4{Relevant chunks found?}
    R4 -->|Yes| R5[Compose prompt with user query + retrieved context]
    R5 --> R6[LLM generates grounded answer]
    R6 --> OUT[Return final response to frontend]
    R4 -->|No| F1[Fallback path]
    F1 --> F2{Fallback strategy}
    F2 -->|General knowledge allowed| F3[Send query to LLM without document context]
    F2 -->|Need more specificity| F4[Ask user for clarification]
    F3 --> OUT
    F4 --> OUT

    S2 -->|TOOL_BASED| T1[MCP / Tool Orchestrator selects tool]
    T1 --> T2{Which tool?}
    T2 -->|Weather| T3[Call Weather API]
    T2 -->|Shipment| T4[Call Shipment Tracking API]
    T2 -->|Math / deterministic| T5[Call Calculator Tool]
    T2 -->|Other domain tool| T6[Call External Business API]
    T3 --> T7[Receive structured tool result]
    T4 --> T7
    T5 --> T7
    T6 --> T7
    T7 --> T8[Provide tool result + user query to LLM]
    T8 --> T9[LLM formats and explains answer]
    T9 --> OUT

    S2 -->|HYBRID| H1[Run retrieval pipeline and tool orchestration in parallel or sequence]
    H1 --> H2[Get RAG context from vector DB]
    H1 --> H3[Get structured tool outputs from APIs]
    H2 --> H4[Merge retrieved chunks + tool results + original query]
    H3 --> H4
    H4 --> H5[LLM synthesizes final answer with citations / grounded facts]
    H5 --> OUT

    OUT --> S3([Frontend displays response])

    %% Optional notes
    N1[LLM is used multiple times:\n1. Routing\n2. Reasoning / answer generation\n3. Tool result formatting\n4. Hybrid synthesis]
    N2[MCP-style orchestration allows the LLM-driven system\nto decide which external capability to call]

    S2 -.-> N1
    T1 -.-> N2

    classDef start fill:#e8f1ff,stroke:#2d5baf,stroke-width:1.5px,color:#111;
    classDef decision fill:#fff4cc,stroke:#b8860b,stroke-width:1.5px,color:#111;
    classDef rag fill:#e9f8ef,stroke:#2f855a,stroke-width:1.5px,color:#111;
    classDef tool fill:#fff0f0,stroke:#c53030,stroke-width:1.5px,color:#111;
    classDef llm fill:#f5ecff,stroke:#6b46c1,stroke-width:1.5px,color:#111;
    classDef note fill:#f7fafc,stroke:#4a5568,stroke-dasharray: 4 4,color:#111;

    class S0,S1,S3,OUT start;
    class S2,R4,F2,T2 decision;
    class R1,R2,R3,R5,H1,H2,H4 rag;
    class T1,T3,T4,T5,T6,T7,H3 tool;
    class C2,R6,F3,T8,T9,H5 llm;
    class N1,N2 note;
```