import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
    type Memory,
    type Goal,
    type Relationship,
    type Actor,
    type GoalStatus,
    type Account,
    type UUID,
    type Participant,
    type Room,
    type RAGKnowledgeItem,
    elizaLogger,
} from "@elizaos/core";
import { DatabaseAdapter } from "@elizaos/core";
import { v4 as uuidv4 } from 'uuid';

export class SupabaseDatabaseAdapter extends DatabaseAdapter {
    private cosineSimilarity(a: number[], b: number[]): number {
        const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
        const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
        const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
        return dotProduct / (magnitudeA * magnitudeB);
    }

    async getRoom(roomId: UUID): Promise<UUID | null> {
        const { data, error } = await this.supabase
            .from("rooms")
            .select("id")
            .eq("id", roomId)
            .maybeSingle();

        if (error) {
            elizaLogger.error(`Error getting room: ${error.message}`);
            return null;
        }
        return data ? (data.id as UUID) : null;
    }

    async getParticipantsForAccount(userId: UUID): Promise<Participant[]> {
        const { data, error } = await this.supabase
            .from("participants")
            .select("*")
            .eq("userId", userId);

        if (error) {
            throw new Error(
                `Error getting participants for account: ${error.message}`
            );
        }

        return data as Participant[];
    }

    async getParticipantUserState(
        roomId: UUID,
        userId: UUID
    ): Promise<"FOLLOWED" | "MUTED" | null> {
        const { data, error } = await this.supabase
            .from("participants")
            .select("userState")
            .eq("roomId", roomId)
            .eq("userId", userId)
            .single();

        if (error) {
            elizaLogger.error("Error getting participant user state:", error);
            return null;
        }

        return data?.userState as "FOLLOWED" | "MUTED" | null;
    }

    async setParticipantUserState(
        roomId: UUID,
        userId: UUID,
        state: "FOLLOWED" | "MUTED" | null
    ): Promise<void> {
        const { error } = await this.supabase
            .from("participants")
            .update({ userState: state })
            .eq("roomId", roomId)
            .eq("userId", userId);

        if (error) {
            elizaLogger.error("Error setting participant user state:", error);
            throw new Error("Failed to set participant user state");
        }
    }

    async getParticipantsForRoom(roomId: UUID): Promise<UUID[]> {
        const { data, error } = await this.supabase
            .from("participants")
            .select("userId")
            .eq("roomId", roomId);

        if (error) {
            throw new Error(
                `Error getting participants for room: ${error.message}`
            );
        }

        return data.map((row) => row.userId as UUID);
    }

    supabase: SupabaseClient;

    constructor(supabaseUrl: string, supabaseKey: string) {
        super();
        if (!supabaseUrl || !supabaseKey) {
            throw new Error('Supabase URL and key are required');
        }
        this.supabase = createClient(supabaseUrl, supabaseKey);
    }

    async init() {
        try {
            // Test connection and table existence
            const { error } = await this.supabase
                .from("accounts")
                .select("id")
                .limit(1);

            if (error) {
                elizaLogger.error('Supabase initialization error:', error);
                throw new Error(`Failed to connect to Supabase: ${error.message}`);
            }
        } catch (error) {
            elizaLogger.error('Failed to initialize Supabase:', error);
            throw error;
        }
    }

    async close() {
        // noop
    }

    async getMemoriesByRoomIds(params: {
        roomIds: UUID[];
        agentId?: UUID;
        tableName: string;
        limit?: number;
    }): Promise<Memory[]> {
        let query = this.supabase
            .from(params.tableName)
            .select("*")
            .in("roomId", params.roomIds)
            .order("createdAt", { ascending: false });

        if (params.agentId) {
            query = query.eq("agentId", params.agentId);
        }

        if (params.limit) {
            query = query.limit(params.limit);
        }

        const { data, error } = await query;

        if (error) {
            elizaLogger.error("Error retrieving memories by room IDs:", error);
            return [];
        }

        // map createdAt to Date
        const memories = data.map((memory) => ({
            ...memory,
        }));

        return memories as Memory[];
    }

    async getAccountById(userId: UUID): Promise<Account | null> {
        const { data, error } = await this.supabase
            .from("accounts")
            .select("*")
            .eq("id", userId);
        if (error) {
            throw new Error(error.message);
        }
        return (data?.[0] as Account) || null;
    }

    async createAccount(account: Account): Promise<boolean> {
        const { error } = await this.supabase
            .from("accounts")
            .upsert([account]);
        if (error) {
            elizaLogger.error(error.message);
            return false;
        }
        return true;
    }

    async getActorDetails(params: { roomId: UUID }): Promise<Actor[]> {
        try {
            const response = await this.supabase
                .from("rooms")
                .select(
                    `
          participants:participants(
            account:accounts(id, name, username, details)
          )
      `
                )
                .eq("id", params.roomId);

            if (response.error) {
                elizaLogger.error("Error!" + response.error);
                return [];
            }
            const { data } = response;

            return data
                .flatMap((room) =>
                    room.participants.map((participant) => {
                        const user = participant.account as unknown as Actor;
                        return {
                            name: user?.name,
                            details: user?.details,
                            id: user?.id,
                            username: user?.username,
                        };
                    })
                );
        } catch (error) {
            elizaLogger.error("error", error);
            throw error;
        }
    }

    async searchMemories(params: {
        tableName: string;
        roomId: UUID;
        embedding: number[];
        match_threshold: number;
        match_count: number;
        unique: boolean;
    }): Promise<Memory[]> {
        const { data, error } = await this.supabase.rpc('search_memories_vec', {
            query_embedding: params.embedding,
            query_table_name: params.tableName,
            query_roomId: params.roomId,
            query_threshold: params.match_threshold,
            query_limit: params.match_count
        });

        if (error) {
            elizaLogger.error('Error searching memories:', error);
            throw error;
        }

        return data.map(memory => ({
            ...memory,
            content: typeof memory.content === 'string' ? JSON.parse(memory.content) : memory.content
        }));
    }

    async getCachedEmbeddings(opts: {
        query_table_name: string;
        query_threshold: number;
        query_input: string;
        query_field_name: string;
        query_field_sub_name: string;
        query_match_count: number;
    }): Promise<{ embedding: number[]; levenshtein_score: number; }[]> {
        const { data, error } = await this.supabase
            .from("memories")
            .select('embedding, content')
            .filter(`content->>'text'`, 'ilike', `%${opts.query_input}%`)
            .limit(opts.query_match_count);

        if (error) {
            elizaLogger.error('Error getting cached embeddings:', error);
            throw error;
        }

        return data.map(row => ({
            embedding: row.embedding,
            levenshtein_score: 0  // Simplified for now
        }));
    }

    async updateGoalStatus(params: {
        goalId: UUID;
        status: GoalStatus;
    }): Promise<void> {
        await this.supabase
            .from("goals")
            .update({ status: params.status })
            .match({ id: params.goalId });
    }

    async log(params: {
        body: { [key: string]: unknown };
        userId: UUID;
        roomId: UUID;
        type: string;
    }): Promise<void> {
        const { error } = await this.supabase.from("logs").insert({
            body: params.body,
            userId: params.userId,
            roomId: params.roomId,
            type: params.type,
        });

        if (error) {
            elizaLogger.error("Error inserting log:", error);
            throw new Error(error.message);
        }
    }

    async getMemories(params: {
        roomId: UUID;
        count?: number;
        unique?: boolean;
        tableName: string;
        agentId?: UUID;
        start?: number;
        end?: number;
    }): Promise<Memory[]> {
        elizaLogger.debug('getMemories called with params:', params);

        const query = this.supabase
            .from("memories")
            .select("*")
            .eq("roomId", params.roomId)
            .eq("type", params.tableName);

        if (params.start) {
            query.gte("createdAt", params.start);
        }

        if (params.end) {
            query.lte("createdAt", params.end);
        }

        if (params.unique) {
            query.eq("unique", true);
        }

        if (params.agentId) {
            query.eq("agentId", params.agentId);
        }

        query.order("createdAt", { ascending: false });

        if (params.count) {
            query.limit(params.count);
        }

        const { data, error } = await query;

        if (error) {
            elizaLogger.error('getMemories error:', { error, params });
            throw new Error(`Error retrieving memories: ${error.message}`);
        }

        return data as Memory[];
    }

    async searchMemoriesByEmbedding(
        embedding: number[],
        params: {
            match_threshold?: number;
            count?: number;
            roomId?: UUID;
            agentId?: UUID;
            unique?: boolean;
            tableName: string;
        }
    ): Promise<Memory[]> {
        let query = this.supabase
            .from(params.tableName)
            .select('*')
            .not('embedding', 'is', null);

        if (params.roomId) {
            query = query.eq('roomId', params.roomId);
        }
        if (params.agentId) {
            query = query.eq('agentId', params.agentId);
        }
        if (params.unique) {
            query = query.eq('unique', true);
        }
        if (params.count) {
            query = query.limit(params.count);
        }

        const { data, error } = await query;

        if (error) {
            elizaLogger.error('Error searching memories:', error);
            throw error;
        }

        // Filter and sort by cosine similarity in memory
        return data
            .map(memory => ({
                ...memory,
                similarity: this.cosineSimilarity(embedding, memory.embedding)
            }))
            .filter(memory => memory.similarity < (params.match_threshold || 0.95))
            .sort((a, b) => a.similarity - b.similarity)
            .slice(0, params.count || 10);
    }

    async getMemoryById(memoryId: UUID): Promise<Memory | null> {
        const { data, error } = await this.supabase
            .from("memories")
            .select("*")
            .eq("id", memoryId)
            .single();

        if (error) {
            elizaLogger.error("Error retrieving memory by ID:", error);
            return null;
        }

        return data as Memory;
    }

    async getMemoriesByIds(
        memoryIds: UUID[],
        tableName?: string
    ): Promise<Memory[]> {
        if (memoryIds.length === 0) return [];

        let query = this.supabase
            .from("memories")
            .select("*")
            .in("id", memoryIds);

        if (tableName) {
            query = query.eq("type", tableName);
        }

        const { data, error } = await query;

        if (error) {
            console.error("Error retrieving memories by IDs:", error);
            return [];
        }

        return data as Memory[];
    }

    async createMemory(memory: Memory): Promise<void> {
        try {
            const memories = [{
                id: memory.id || uuidv4(),
                type: memory.content.source,
                content: memory.content,
                embedding: memory.embedding ? 
                    `{${Array.from(memory.embedding).join(',')}}` : null,
                userId: memory.userId,
                agentId: memory.agentId,
                roomId: memory.roomId,
                createdAt: memory.createdAt ? 
                    new Date(memory.createdAt).toISOString() : 
                    new Date().toISOString(),
                unique: true
            }];

            const { error } = await this.supabase.rpc('batch_insert_memories', {
                query_table_name: `memories_${memory.embedding?.length || 1536}`,
                memories: JSON.stringify(memories)
            });

            if (error) {
                elizaLogger.error('Error in batch_insert_memories:', error);
                throw error;
            }
        } catch (error) {
            elizaLogger.error('Error creating memory:', error);
            throw error;
        }
    }

    async removeMemory(memoryId: UUID): Promise<void> {
        const result = await this.supabase
            .from("memories")
            .delete()
            .eq("id", memoryId);
        const { error } = result;
        if (error) {
            throw new Error(JSON.stringify(error));
        }
    }

    async removeAllMemories(roomId: UUID, tableName: string): Promise<void> {
        const result = await this.supabase.rpc("remove_memories", {
            query_table_name: tableName,
            query_roomId: roomId,
        });

        if (result.error) {
            throw new Error(JSON.stringify(result.error));
        }
    }

    async countMemories(
        roomId: UUID,
        unique = true,
        tableName: string
    ): Promise<number> {
        if (!tableName) {
            throw new Error("tableName is required");
        }
        const query = {
            query_table_name: tableName,
            query_roomId: roomId,
            query_unique: !!unique,
        };
        const result = await this.supabase.rpc("count_memories", query);

        if (result.error) {
            throw new Error(JSON.stringify(result.error));
        }

        return result.data;
    }

    async getGoals(params: {
        roomId: UUID;
        userId?: UUID | null;
        onlyInProgress?: boolean;
        count?: number;
    }): Promise<Goal[]> {
        let query = this.supabase
            .from("goals")
            .select("*")
            .eq("roomId", params.roomId);

        if (params.userId) {
            query = query.eq("userId", params.userId);
        }
        if (params.onlyInProgress) {
            query = query.eq("status", "IN_PROGRESS");
        }
        if (params.count) {
            query = query.limit(params.count);
        }

        const { data, error } = await query.order("createdAt", { ascending: false });

        if (error) {
            throw new Error(`Error getting goals: ${error.message}`);
        }

        return data as Goal[];
    }

    async updateGoal(goal: Goal): Promise<void> {
        const { error } = await this.supabase
            .from("goals")
            .update(goal)
            .match({ id: goal.id });
        if (error) {
            throw new Error(`Error creating goal: ${error.message}`);
        }
    }

    async createGoal(goal: Goal): Promise<void> {
        const { error } = await this.supabase.from("goals").insert(goal);
        if (error) {
            throw new Error(`Error creating goal: ${error.message}`);
        }
    }

    async removeGoal(goalId: UUID): Promise<void> {
        const { error } = await this.supabase
            .from("goals")
            .delete()
            .eq("id", goalId);
        if (error) {
            throw new Error(`Error removing goal: ${error.message}`);
        }
    }

    async removeAllGoals(roomId: UUID): Promise<void> {
        const { error } = await this.supabase
            .from("goals")
            .delete()
            .eq("roomId", roomId);
        if (error) {
            throw new Error(`Error removing goals: ${error.message}`);
        }
    }

    async getRoomsForParticipant(userId: UUID): Promise<UUID[]> {
        const { data, error } = await this.supabase
            .from("participants")
            .select("roomId")
            .eq("userId", userId);

        if (error) {
            throw new Error(
                `Error getting rooms by participant: ${error.message}`
            );
        }

        return data.map((row) => row.roomId as UUID);
    }

    async getRoomsForParticipants(userIds: UUID[]): Promise<UUID[]> {
        const { data, error } = await this.supabase
            .from("participants")
            .select("roomId")
            .in("userId", userIds);

        if (error) {
            throw new Error(
                `Error getting rooms by participants: ${error.message}`
            );
        }

        return [...new Set(data.map((row) => row.roomId as UUID))] as UUID[];
    }

    async createRoom(roomId?: UUID): Promise<UUID> {
        try {
            const newRoomId = roomId || uuidv4() as UUID;
            const { error } = await this.supabase
                .from('rooms')
                .insert({ id: newRoomId });

            if (error) {
                elizaLogger.error('Error creating room:', error);
                throw error;
            }

            return newRoomId;
        } catch (error) {
            elizaLogger.error('Error in createRoom:', error);
            throw error;
        }
    }

    async removeRoom(roomId: UUID): Promise<void> {
        const { error } = await this.supabase
            .from("rooms")
            .delete()
            .eq("id", roomId);

        if (error) {
            throw new Error(`Error removing room: ${error.message}`);
        }
    }

    async addParticipant(userId: UUID, roomId: UUID): Promise<boolean> {
        const { error } = await this.supabase
            .from("participants")
            .insert({ 
                id: uuidv4() as UUID,
                userId: userId, 
                roomId: roomId 
            });

        if (error) {
            elizaLogger.error(`Error adding participant: ${error.message}`);
            return false;
        }
        return true;
    }

    async removeParticipant(userId: UUID, roomId: UUID): Promise<boolean> {
        const { error } = await this.supabase
            .from("participants")
            .delete()
            .eq("userId", userId)
            .eq("roomId", roomId);

        if (error) {
            elizaLogger.error(`Error removing participant: ${error.message}`);
            return false;
        }
        return true;
    }

    async createRelationship(params: {
        userA: UUID;
        userB: UUID;
    }): Promise<boolean> {
        const allRoomData = await this.getRoomsForParticipants([
            params.userA,
            params.userB,
        ]);

        let roomId: UUID;

        if (!allRoomData || allRoomData.length === 0) {
            // If no existing room is found, create a new room
            const { data: newRoomData, error: roomsError } = await this.supabase
                .from("rooms")
                .insert({})
                .single();

            if (roomsError) {
                throw new Error("Room creation error: " + roomsError.message);
            }

            roomId = (newRoomData as Room)?.id as UUID;
        } else {
            // If an existing room is found, use the first room's ID
            roomId = allRoomData[0];
        }

        const { error: participantsError } = await this.supabase
            .from("participants")
            .insert([
                { userId: params.userA, roomId },
                { userId: params.userB, roomId },
            ]);

        if (participantsError) {
            throw new Error(
                "Participants creation error: " + participantsError.message
            );
        }

        // Create or update the relationship between the two users
        const { error: relationshipError } = await this.supabase
            .from("relationships")
            .upsert({
                userA: params.userA,
                userB: params.userB,
                userId: params.userA,
                status: "FRIENDS",
            })
            .eq("userA", params.userA)
            .eq("userB", params.userB);

        if (relationshipError) {
            throw new Error(
                "Relationship creation error: " + relationshipError.message
            );
        }

        return true;
    }

    async getRelationship(params: {
        userA: UUID;
        userB: UUID;
    }): Promise<Relationship | null> {
        const { data, error } = await this.supabase.rpc("get_relationship", {
            usera: params.userA,
            userb: params.userB,
        });

        if (error) {
            throw new Error(error.message);
        }

        return data[0];
    }

    async getRelationships(params: { userId: UUID }): Promise<Relationship[]> {
        const { data, error } = await this.supabase
            .from("relationships")
            .select("*")
            .or(`userA.eq.${params.userId},userB.eq.${params.userId}`)
            .eq("status", "FRIENDS");

        if (error) {
            throw new Error(error.message);
        }

        return data as Relationship[];
    }

    async getCache(params: {
        key: string;
        agentId: UUID;
    }): Promise<string | undefined> {
        const { data, error } = await this.supabase
            .from("cache")
            .select("value")
            .eq("key", params.key)
            .eq("agentId", params.agentId)
            .single();

        if (error) {
            elizaLogger.error("Error fetching cache:", error);
            return undefined;
        }

        return data?.value;
    }

    async setCache(params: {
        key: string;
        agentId: UUID;
        value: string;
    }): Promise<boolean> {
        const { error } = await this.supabase.from("cache").upsert({
            key: params.key,
            agentId: params.agentId,
            value: params.value,
            createdAt: new Date(),
        });

        if (error) {
            elizaLogger.error("Error setting cache:", error);
            return false;
        }

        return true;
    }

    async deleteCache(params: {
        key: string;
        agentId: UUID;
    }): Promise<boolean> {
        try {
            const { error } = await this.supabase
                .from("cache")
                .delete()
                .eq("key", params.key)
                .eq("agentId", params.agentId);

            if (error) {
                elizaLogger.error("Error deleting cache", {
                    error: error.message,
                    key: params.key,
                    agentId: params.agentId,
                });
                return false;
            }
            return true;
        } catch (error) {
            elizaLogger.error(
                "Database connection error in deleteCache",
                error instanceof Error ? error.message : String(error)
            );
            return false;
        }
    }

    async getKnowledge(params: {
        id?: UUID;
        agentId: UUID;
        limit?: number;
        query?: string;
    }): Promise<RAGKnowledgeItem[]> {
        let query = this.supabase
            .from("knowledge")
            .select("*")
            .or(`agentId.eq.${params.agentId},isShared.eq.true`);

        if (params.id) {
            query = query.eq("id", params.id);
        }

        if (params.limit) {
            query = query.limit(params.limit);
        }

        const { data, error } = await query;

        if (error) {
            throw new Error(`Error getting knowledge: ${error.message}`);
        }

        return data.map((row) => ({
            id: row.id,
            agentId: row.agentId,
            content:
                typeof row.content === "string"
                    ? JSON.parse(row.content)
                    : row.content,
            embedding: row.embedding
                ? new Float32Array(row.embedding)
                : undefined,
            createdAt: new Date(row.createdAt).getTime(),
        }));
    }

    async searchKnowledge(params: {
        agentId: UUID;
        embedding: Float32Array;
        match_threshold: number;
        match_count: number;
        searchText?: string;
    }): Promise<RAGKnowledgeItem[]> {
        const { data, error } = await this.supabase.rpc('search_knowledge_vec', {
            query_embedding: Array.from(params.embedding),
            query_agent_id: params.agentId,
            query_threshold: params.match_threshold,
            query_limit: params.match_count,
            query_text: params.searchText || ''
        });

        if (error) {
            elizaLogger.error('Error searching knowledge:', error);
            throw error;
        }

        return data.map(item => ({
            ...item,
            embedding: item.embedding ? new Float32Array(item.embedding) : undefined,
            similarity: item.combined_score
        }));
    }

    async createKnowledge(knowledge: RAGKnowledgeItem): Promise<void> {
        try {
            const metadata = knowledge.content.metadata || {};

            const { error } = await this.supabase.from("knowledge").insert({
                id: knowledge.id,
                agentId: metadata.isShared ? null : knowledge.agentId,
                content: knowledge.content,
                embedding: knowledge.embedding
                    ? Array.from(knowledge.embedding)
                    : null,
                createdAt: knowledge.createdAt || new Date(),
                isMain: metadata.isMain || false,
                originalId: metadata.originalId || null,
                chunkIndex: metadata.chunkIndex || null,
                isShared: metadata.isShared || false,
            });

            if (error) {
                if (metadata.isShared && error.code === "23505") {
                    // Unique violation
                    elizaLogger.info(
                        `Shared knowledge ${knowledge.id} already exists, skipping`
                    );
                    return;
                }
                throw error;
            }
        } catch (error: any) {
            elizaLogger.error(`Error creating knowledge ${knowledge.id}:`, {
                error,
                embeddingLength: knowledge.embedding?.length,
                content: knowledge.content,
            });
            throw error;
        }
    }

    async removeKnowledge(id: UUID): Promise<void> {
        const { error } = await this.supabase
            .from("knowledge")
            .delete()
            .eq("id", id);

        if (error) {
            throw new Error(`Error removing knowledge: ${error.message}`);
        }
    }

    async clearKnowledge(agentId: UUID, shared?: boolean): Promise<void> {
        if (shared) {
            const { error } = await this.supabase
                .from("knowledge")
                .delete()
                .filter("agentId", "eq", agentId)
                .filter("isShared", "eq", true);

            if (error) {
                elizaLogger.error(
                    `Error clearing shared knowledge for agent ${agentId}:`,
                    error
                );
                throw error;
            }
        } else {
            const { error } = await this.supabase
                .from("knowledge")
                .delete()
                .eq("agentId", agentId);

            if (error) {
                elizaLogger.error(
                    `Error clearing knowledge for agent ${agentId}:`,
                    error
                );
                throw error;
            }
        }
    }
}
