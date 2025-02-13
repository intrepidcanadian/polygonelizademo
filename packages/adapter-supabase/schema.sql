-- Enable pgvector extension

-- -- Drop existing tables and extensions
-- DROP EXTENSION IF EXISTS vector CASCADE;
-- DROP TABLE IF EXISTS relationships CASCADE;
-- DROP TABLE IF EXISTS participants CASCADE;
-- DROP TABLE IF EXISTS logs CASCADE;
-- DROP TABLE IF EXISTS goals CASCADE;
-- DROP TABLE IF EXISTS memories CASCADE;
-- DROP TABLE IF EXISTS rooms CASCADE;
-- DROP TABLE IF EXISTS accounts CASCADE;
-- DROP TABLE IF EXISTS knowledge CASCADE;


-- Drop triggers first
DROP TRIGGER IF EXISTS insert_memory_trigger ON memories;

-- Drop functions
DROP FUNCTION IF EXISTS insert_memory();
DROP FUNCTION IF EXISTS create_room(UUID);
DROP FUNCTION IF EXISTS search_memories(TEXT, UUID, vector, FLOAT, INTEGER, BOOLEAN);
DROP FUNCTION IF EXISTS get_relationship(UUID, UUID);
DROP FUNCTION IF EXISTS remove_memories(TEXT, UUID);
DROP FUNCTION IF EXISTS count_memories(TEXT, UUID, BOOLEAN);

-- Drop views
DROP VIEW IF EXISTS memories;

-- Drop tables (in correct order due to foreign key constraints)
DROP TABLE IF EXISTS logs CASCADE;
DROP TABLE IF EXISTS goals CASCADE;
DROP TABLE IF EXISTS knowledge CASCADE;
DROP TABLE IF EXISTS memories_1536 CASCADE;
DROP TABLE IF EXISTS memories_1024 CASCADE;
DROP TABLE IF EXISTS memories_768 CASCADE;
DROP TABLE IF EXISTS memories_384 CASCADE;
DROP TABLE IF EXISTS relationships CASCADE;
DROP TABLE IF EXISTS participants CASCADE;
DROP TABLE IF EXISTS rooms CASCADE;
DROP TABLE IF EXISTS accounts CASCADE;
DROP TABLE IF EXISTS cache CASCADE;

-- Drop extensions
DROP EXTENSION IF EXISTS vector CASCADE;

-- Then run the original schema.sql to recreate everything


CREATE EXTENSION IF NOT EXISTS vector;

BEGIN;

CREATE TABLE accounts (
    "id" UUID PRIMARY KEY,
    "createdAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "name" TEXT,
    "username" TEXT,
    "email" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "details" JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE rooms (
    "id" UUID PRIMARY KEY,
    "createdAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Create tables for both vector sizes
CREATE TABLE memories_1536 (
    "id" UUID PRIMARY KEY,
    "type" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "content" JSONB NOT NULL,
    "embedding" vector(1536),
    "userId" UUID REFERENCES accounts("id"),
    "agentId" UUID REFERENCES accounts("id"),
    "roomId" UUID REFERENCES rooms("id"),
    "unique" BOOLEAN DEFAULT true NOT NULL,
    CONSTRAINT fk_room FOREIGN KEY ("roomId") REFERENCES rooms("id") ON DELETE CASCADE,
    CONSTRAINT fk_user FOREIGN KEY ("userId") REFERENCES accounts("id") ON DELETE CASCADE,
    CONSTRAINT fk_agent FOREIGN KEY ("agentId") REFERENCES accounts("id") ON DELETE CASCADE
);

CREATE TABLE memories_1024 (
    "id" UUID PRIMARY KEY,
    "type" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "content" JSONB NOT NULL,
    "embedding" vector(1024),  -- Ollama mxbai-embed-large
    "userId" UUID REFERENCES accounts("id"),
    "agentId" UUID REFERENCES accounts("id"),
    "roomId" UUID REFERENCES rooms("id"),
    "unique" BOOLEAN DEFAULT true NOT NULL,
    CONSTRAINT fk_room FOREIGN KEY ("roomId") REFERENCES rooms("id") ON DELETE CASCADE,
    CONSTRAINT fk_user FOREIGN KEY ("userId") REFERENCES accounts("id") ON DELETE CASCADE,
    CONSTRAINT fk_agent FOREIGN KEY ("agentId") REFERENCES accounts("id") ON DELETE CASCADE
);

CREATE TABLE memories_768 (
    "id" UUID PRIMARY KEY,
    "type" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "content" JSONB NOT NULL,
    "embedding" vector(768),  -- Gaianet nomic-embed
    "userId" UUID REFERENCES accounts("id"),
    "agentId" UUID REFERENCES accounts("id"),
    "roomId" UUID REFERENCES rooms("id"),
    "unique" BOOLEAN DEFAULT true NOT NULL,
    CONSTRAINT fk_room FOREIGN KEY ("roomId") REFERENCES rooms("id") ON DELETE CASCADE,
    CONSTRAINT fk_user FOREIGN KEY ("userId") REFERENCES accounts("id") ON DELETE CASCADE,
    CONSTRAINT fk_agent FOREIGN KEY ("agentId") REFERENCES accounts("id") ON DELETE CASCADE
);

CREATE TABLE memories_384 (
    "id" UUID PRIMARY KEY,
    "type" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "content" JSONB NOT NULL,
    "embedding" vector(384),
    "userId" UUID REFERENCES accounts("id"),
    "agentId" UUID REFERENCES accounts("id"),
    "roomId" UUID REFERENCES rooms("id"),
    "unique" BOOLEAN DEFAULT true NOT NULL,
    CONSTRAINT fk_room FOREIGN KEY ("roomId") REFERENCES rooms("id") ON DELETE CASCADE,
    CONSTRAINT fk_user FOREIGN KEY ("userId") REFERENCES accounts("id") ON DELETE CASCADE,
    CONSTRAINT fk_agent FOREIGN KEY ("agentId") REFERENCES accounts("id") ON DELETE CASCADE
);

-- Add after creating the memory tables but before the COMMIT;

-- Create a view combining all memory tables
CREATE OR REPLACE VIEW memories AS
    SELECT * FROM memories_1536
    UNION ALL 
    SELECT * FROM memories_1024
    UNION ALL
    SELECT * FROM memories_768
    UNION ALL
    SELECT * FROM memories_384;

-- Create function to remove memories
CREATE OR REPLACE FUNCTION remove_memories(
    query_table_name TEXT,
    query_roomId UUID
) RETURNS void AS $$
BEGIN
    EXECUTE format('
        DELETE FROM %I 
        WHERE "roomId" = $1
    ', query_table_name)
    USING query_roomId;
END;
$$ LANGUAGE plpgsql;

-- Create function to count memories
CREATE OR REPLACE FUNCTION count_memories(
    query_table_name TEXT,
    query_roomId UUID,
    query_unique BOOLEAN
) RETURNS integer AS $$
DECLARE
    count integer;
BEGIN
    EXECUTE format('
        SELECT COUNT(*) 
        FROM %I 
        WHERE "roomId" = $1
        AND ($2 IS NULL OR "unique" = $2)
    ', query_table_name)
    INTO count
    USING query_roomId, query_unique;
    RETURN count;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE goals (
    "id" UUID PRIMARY KEY,
    "createdAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "userId" UUID REFERENCES accounts("id"),
    "name" TEXT,
    "status" TEXT,
    "description" TEXT,
    "roomId" UUID REFERENCES rooms("id"),
    "objectives" JSONB DEFAULT '[]'::jsonb NOT NULL,
    CONSTRAINT fk_room FOREIGN KEY ("roomId") REFERENCES rooms("id") ON DELETE CASCADE,
    CONSTRAINT fk_user FOREIGN KEY ("userId") REFERENCES accounts("id") ON DELETE CASCADE
);

CREATE TABLE logs (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "createdAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "userId" UUID NOT NULL REFERENCES accounts("id"),
    "body" JSONB NOT NULL,
    "type" TEXT NOT NULL,
    "roomId" UUID NOT NULL REFERENCES rooms("id"),
    CONSTRAINT fk_room FOREIGN KEY ("roomId") REFERENCES rooms("id") ON DELETE CASCADE,
    CONSTRAINT fk_user FOREIGN KEY ("userId") REFERENCES accounts("id") ON DELETE CASCADE
);

CREATE TABLE participants (
    "id" UUID PRIMARY KEY,
    "createdAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "userId" UUID REFERENCES accounts("id"),
    "roomId" UUID REFERENCES rooms("id"),
    "userState" TEXT,
    "last_message_read" TEXT,
    UNIQUE("userId", "roomId"),
    CONSTRAINT fk_room FOREIGN KEY ("roomId") REFERENCES rooms("id") ON DELETE CASCADE,
    CONSTRAINT fk_user FOREIGN KEY ("userId") REFERENCES accounts("id") ON DELETE CASCADE
);

CREATE TABLE relationships (
    "id" UUID PRIMARY KEY,
    "createdAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "userA" UUID NOT NULL REFERENCES accounts("id"),
    "userB" UUID NOT NULL REFERENCES accounts("id"),
    "status" TEXT,
    "userId" UUID NOT NULL REFERENCES accounts("id"),
    CONSTRAINT fk_user_a FOREIGN KEY ("userA") REFERENCES accounts("id") ON DELETE CASCADE,
    CONSTRAINT fk_user_b FOREIGN KEY ("userB") REFERENCES accounts("id") ON DELETE CASCADE,
    CONSTRAINT fk_user FOREIGN KEY ("userId") REFERENCES accounts("id") ON DELETE CASCADE
);

CREATE TABLE cache (
    "key" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "value" JSONB DEFAULT '{}'::jsonb,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP,
    PRIMARY KEY ("key", "agentId")
);

CREATE TABLE knowledge (
    "id" UUID PRIMARY KEY,
    "agentId" UUID REFERENCES accounts("id"),
    "content" JSONB NOT NULL,
    "embedding" vector(1536),
    "createdAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "isMain" BOOLEAN DEFAULT FALSE,
    "originalId" UUID REFERENCES knowledge("id"),
    "chunkIndex" INTEGER,
    "isShared" BOOLEAN DEFAULT FALSE,
    CHECK(("isShared" = true AND "agentId" IS NULL) OR ("isShared" = false AND "agentId" IS NOT NULL))
);

-- Add index for Ollama table
CREATE INDEX idx_memories_1024_embedding ON memories_1024 USING hnsw ("embedding" vector_cosine_ops);
CREATE INDEX idx_memories_1024_type_room ON memories_1024("type", "roomId");
CREATE INDEX idx_memories_768_embedding ON memories_768 USING hnsw ("embedding" vector_cosine_ops);
CREATE INDEX idx_memories_768_type_room ON memories_768("type", "roomId");
CREATE INDEX idx_memories_1536_embedding ON memories_1536 USING hnsw ("embedding" vector_cosine_ops);
CREATE INDEX idx_memories_384_embedding ON memories_384 USING hnsw ("embedding" vector_cosine_ops);
CREATE INDEX idx_memories_1536_type_room ON memories_1536("type", "roomId");
CREATE INDEX idx_memories_384_type_room ON memories_384("type", "roomId");
CREATE INDEX idx_participants_user ON participants("userId");
CREATE INDEX idx_participants_room ON participants("roomId");
CREATE INDEX idx_relationships_users ON relationships("userA", "userB");
CREATE INDEX idx_knowledge_agent ON knowledge("agentId");
CREATE INDEX idx_knowledge_agent_main ON knowledge("agentId", "isMain");
CREATE INDEX idx_knowledge_original ON knowledge("originalId");
CREATE INDEX idx_knowledge_created ON knowledge("agentId", "createdAt");
CREATE INDEX idx_knowledge_shared ON knowledge("isShared");
CREATE INDEX idx_knowledge_embedding ON knowledge USING ivfflat (embedding vector_cosine_ops);

-- Add these functions after the table creation statements but before COMMIT;

-- Function to create a room
CREATE OR REPLACE FUNCTION public.create_room(roomId UUID DEFAULT gen_random_uuid())
RETURNS UUID AS $$
BEGIN
    INSERT INTO rooms (id) VALUES (roomId);
    RETURN roomId;
END;
$$ LANGUAGE plpgsql;

-- Function to search memories
CREATE OR REPLACE FUNCTION public.search_memories(
    query_table_name TEXT,
    query_roomId UUID,
    query_embedding vector,
    query_match_threshold FLOAT,
    query_match_count INTEGER,
    query_unique BOOLEAN
)
RETURNS TABLE (
    id UUID,
    type TEXT,
    "createdAt" TIMESTAMPTZ,
    content JSONB,
    embedding vector,
    "userId" UUID,
    "agentId" UUID,
    "roomId" UUID,
    "unique" BOOLEAN
) AS $$
BEGIN
    RETURN QUERY EXECUTE format('
        SELECT *
        FROM %I
        WHERE "roomId" = $1
        AND ($2 IS NULL OR (embedding <=> $2) < $3)
        ORDER BY "createdAt" DESC
        LIMIT $4
    ', query_table_name)
    USING query_roomId, query_embedding, query_match_threshold, query_match_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get relationship
CREATE OR REPLACE FUNCTION public.get_relationship(userA UUID, userB UUID)
RETURNS TABLE (
    id UUID,
    "createdAt" TIMESTAMPTZ,
    "userA" UUID,
    "userB" UUID,
    status TEXT,
    "userId" UUID
) AS $$
BEGIN
    RETURN QUERY
    SELECT r.*
    FROM relationships r
    WHERE (r."userA" = userA AND r."userB" = userB)
       OR (r."userA" = userB AND r."userB" = userA);
END;
$$ LANGUAGE plpgsql;

-- Create trigger function for memories view
CREATE OR REPLACE FUNCTION insert_memory()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.embedding IS NOT NULL THEN
        CASE array_length(NEW.embedding, 1)
            WHEN 1536 THEN 
                INSERT INTO memories_1536 VALUES (NEW.*);
            WHEN 1024 THEN 
                INSERT INTO memories_1024 VALUES (NEW.*);
            WHEN 768 THEN 
                INSERT INTO memories_768 VALUES (NEW.*);
            WHEN 384 THEN 
                INSERT INTO memories_384 VALUES (NEW.*);
            ELSE
                RAISE EXCEPTION 'Invalid embedding size: %', array_length(NEW.embedding, 1);
        END CASE;
    ELSE
        INSERT INTO memories_1536 VALUES (NEW.*);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create instead of trigger on memories view
CREATE TRIGGER insert_memory_trigger
    INSTEAD OF INSERT ON memories
    FOR EACH ROW
    EXECUTE FUNCTION insert_memory();

-- Function to get goals
CREATE OR REPLACE FUNCTION public.get_goals(
    only_in_progress BOOLEAN,
    query_roomId UUID,
    query_userId UUID DEFAULT NULL,
    row_count INTEGER DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    "createdAt" TIMESTAMPTZ,
    "userId" UUID,
    name TEXT,
    status TEXT,
    description TEXT,
    "roomId" UUID,
    objectives JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT g.*
    FROM goals g
    WHERE g."roomId" = query_roomId
    AND (query_userId IS NULL OR g."userId" = query_userId)
    AND (NOT only_in_progress OR g.status = 'IN_PROGRESS')
    ORDER BY g."createdAt" DESC
    LIMIT CASE 
        WHEN row_count IS NULL THEN NULL 
        ELSE row_count 
    END;
END;
$$ LANGUAGE plpgsql;

-- Function to search knowledge
CREATE OR REPLACE FUNCTION public.search_knowledge(
    query_embedding vector,
    query_agent_id UUID,
    match_threshold FLOAT,
    match_count INTEGER,
    search_text TEXT DEFAULT ''
)
RETURNS TABLE (
    id UUID,
    "agentId" UUID,
    content JSONB,
    embedding vector,
    "createdAt" TIMESTAMPTZ,
    "isMain" BOOLEAN,
    "originalId" UUID,
    "chunkIndex" INTEGER,
    "isShared" BOOLEAN,
    similarity FLOAT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        k.*,
        (k.embedding <=> query_embedding) as similarity
    FROM knowledge k
    WHERE (k."agentId" = query_agent_id OR k."isShared" = true)
    AND (
        search_text = '' 
        OR k.content->>'text' ILIKE '%' || search_text || '%'
    )
    AND (query_embedding IS NULL OR (k.embedding <=> query_embedding) < match_threshold)
    ORDER BY k.embedding <=> query_embedding
    LIMIT match_count;
END;
$$ LANGUAGE plpgsql;

-- Function to check similarity and insert memory
CREATE OR REPLACE FUNCTION public.check_similarity_and_insert(
    query_table_name TEXT,
    query_userId UUID,
    query_content TEXT,
    query_roomId UUID,
    query_embedding vector,
    query_createdAt TIMESTAMPTZ,
    similarity_threshold FLOAT
) RETURNS void AS $$
DECLARE
    exists_similar BOOLEAN;
BEGIN
    -- Check if similar memory exists
    EXECUTE format('
        SELECT EXISTS (
            SELECT 1 FROM %I 
            WHERE "roomId" = $1 
            AND "userId" = $2
            AND (content->>''text'' = $3)
            AND "createdAt" > $4 - interval ''1 hour''
        )', query_table_name)
    INTO exists_similar
    USING query_roomId, query_userId, query_content, query_createdAt;

    -- Only insert if no similar memory exists
    IF NOT exists_similar THEN
        EXECUTE format('
            INSERT INTO %I ("id", "type", "content", "embedding", "userId", "roomId", "createdAt")
            VALUES ($1, $2, $3, $4, $5, $6, $7)
        ', query_table_name)
        USING 
            gen_random_uuid(), 
            query_table_name,
            jsonb_build_object('text', query_content),
            query_embedding,
            query_userId,
            query_roomId,
            query_createdAt;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Add before COMMIT;

CREATE OR REPLACE FUNCTION public.get_embedding_list(
    query_table_name TEXT,
    query_threshold FLOAT,
    query_input TEXT,
    query_field_name TEXT,
    query_field_sub_name TEXT,
    query_match_count INTEGER
)
RETURNS TABLE (
    embedding vector,
    levenshtein_score INTEGER
) AS $$
BEGIN
    RETURN QUERY EXECUTE format('
        SELECT embedding, 
            levenshtein(content->>%L, %L) as levenshtein_score
        FROM %I 
        WHERE content->>%L IS NOT NULL
        AND levenshtein(content->>%L, %L) < %L
        ORDER BY levenshtein_score ASC
        LIMIT %L
    ', query_field_sub_name, query_input, query_table_name, 
       query_field_name, query_field_sub_name, query_input, 
       query_threshold, query_match_count);
END;
$$ LANGUAGE plpgsql;

-- Function to update goal status
CREATE OR REPLACE FUNCTION public.update_goal_status(
    goal_id UUID,
    new_status TEXT
) RETURNS void AS $$
BEGIN
    UPDATE goals 
    SET status = new_status
    WHERE id = goal_id;
END;
$$ LANGUAGE plpgsql;

-- Function to get cached embeddings with expiry
CREATE OR REPLACE FUNCTION public.get_cached_embeddings(
    cache_key TEXT,
    agent_id UUID
) RETURNS JSONB AS $$
BEGIN
    RETURN (
        SELECT value FROM cache 
        WHERE "key" = cache_key 
        AND "agentId" = agent_id::TEXT
        AND ("expiresAt" IS NULL OR "expiresAt" > NOW())
    );
END;
$$ LANGUAGE plpgsql;

-- Function to set cached embeddings
CREATE OR REPLACE FUNCTION public.set_cached_embeddings(
    cache_key TEXT,
    agent_id UUID,
    cache_value JSONB,
    expires_at TIMESTAMP DEFAULT NULL
) RETURNS void AS $$
BEGIN
    INSERT INTO cache ("key", "agentId", value, "expiresAt")
    VALUES (cache_key, agent_id::TEXT, cache_value, expires_at)
    ON CONFLICT ("key", "agentId") 
    DO UPDATE SET 
        value = EXCLUDED.value,
        "expiresAt" = EXCLUDED."expiresAt";
END;
$$ LANGUAGE plpgsql;

-- Add before COMMIT;

-- Function to calculate vector similarity using pgvector
CREATE OR REPLACE FUNCTION vec_distance_L2(
    a vector,
    b vector
) RETURNS float AS $$
BEGIN
    RETURN 1 - (a <=> b);  -- Convert cosine similarity to L2 distance
END;
$$ LANGUAGE plpgsql;

-- Function to search memories with vector similarity
CREATE OR REPLACE FUNCTION search_memories_vec(
    query_embedding vector,
    query_table_name TEXT,
    query_roomId UUID,
    query_threshold FLOAT DEFAULT 0.95,
    query_limit INTEGER DEFAULT 10
) RETURNS TABLE (
    id UUID,
    type TEXT,
    content JSONB,
    embedding vector,
    "userId" UUID,
    "roomId" UUID,
    "agentId" UUID,
    "createdAt" TIMESTAMPTZ,
    similarity FLOAT
) AS $$
BEGIN
    RETURN QUERY EXECUTE format('
        SELECT *, (1 - (embedding <=> $1)) as similarity
        FROM %I
        WHERE "roomId" = $2
        AND embedding IS NOT NULL
        AND (1 - (embedding <=> $1)) < $3
        ORDER BY similarity ASC
        LIMIT $4
    ', query_table_name)
    USING query_embedding, query_roomId, query_threshold, query_limit;
END;
$$ LANGUAGE plpgsql;

-- Function to search knowledge with vector similarity (like SQLite)
CREATE OR REPLACE FUNCTION search_knowledge_vec(
    query_embedding vector,
    query_agent_id UUID,
    query_threshold FLOAT DEFAULT 0.95,
    query_limit INTEGER DEFAULT 10,
    query_text TEXT DEFAULT ''
) RETURNS TABLE (
    id UUID,
    "agentId" UUID,
    content JSONB,
    embedding vector,
    "createdAt" TIMESTAMPTZ,
    "isMain" BOOLEAN,
    "originalId" UUID,
    "chunkIndex" INTEGER,
    "isShared" BOOLEAN,
    vector_score FLOAT,
    keyword_score FLOAT,
    combined_score FLOAT
) AS $$
BEGIN
    RETURN QUERY
    WITH vector_scores AS (
        SELECT id,
            1 / (1 + (embedding <=> query_embedding)) as vector_score
        FROM knowledge
        WHERE (agentId IS NULL AND isShared = true) OR agentId = query_agent_id
        AND embedding IS NOT NULL
    ),
    keyword_matches AS (
        SELECT id,
        CASE
            WHEN content->>'text' ILIKE '%' || query_text || '%' THEN 3.0
            ELSE 1.0
        END *
        CASE
            WHEN content->>'metadata.isChunk' = 'true' THEN 1.5
            WHEN content->>'metadata.isMain' = 'true' THEN 1.2
            ELSE 1.0
        END as keyword_score
        FROM knowledge
        WHERE (agentId IS NULL AND isShared = true) OR agentId = query_agent_id
    )
    SELECT k.*,
        v.vector_score,
        kw.keyword_score,
        (v.vector_score * kw.keyword_score) as combined_score
    FROM knowledge k
    JOIN vector_scores v ON k.id = v.id
    LEFT JOIN keyword_matches kw ON k.id = kw.id
    WHERE (k.agentId IS NULL AND k.isShared = true) OR k.agentId = query_agent_id
    AND (
        v.vector_score >= query_threshold
        OR (kw.keyword_score > 1.0 AND v.vector_score >= 0.3)
    )
    ORDER BY combined_score DESC
    LIMIT query_limit;
END;
$$ LANGUAGE plpgsql;

-- Function to batch insert memories with vector similarity check
CREATE OR REPLACE FUNCTION batch_insert_memories(
    query_table_name TEXT,
    memories JSONB
) RETURNS void AS $$
DECLARE
    memory JSONB;
BEGIN
    FOR memory IN SELECT * FROM jsonb_array_elements(memories)
    LOOP
        EXECUTE format('
            INSERT INTO %I (
                id, type, content, embedding, "userId", "roomId", "agentId", 
                "createdAt", "unique"
            )
            VALUES ($1, $2, $3, $4::text::vector, $5, $6, $7, $8, $9)
            ON CONFLICT (id) DO UPDATE SET
                content = EXCLUDED.content,
                embedding = EXCLUDED.embedding
        ', query_table_name)
        USING
            (memory->>'id')::UUID,
            memory->>'type',
            memory->'content',
            memory->>'embedding',
            (memory->>'userId')::UUID,
            (memory->>'roomId')::UUID,
            (memory->>'agentId')::UUID,
            COALESCE((memory->>'createdAt')::TIMESTAMPTZ, NOW()),
            COALESCE((memory->>'unique')::BOOLEAN, true);
    END LOOP;
END;
$$ LANGUAGE plpgsql;

COMMIT;
