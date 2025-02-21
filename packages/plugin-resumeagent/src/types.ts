import type { State as CoreState, IAgentRuntime, UUID } from "@elizaos/core";

export interface ParsedResume {
    skills: string[];
    experience: {
        company: string;
        title: string;
        duration: string;
        description: string[];
    }[];
    education: {
        school: string;
        degree: string;
        year: string;
    }[];
    keywords: string[];
}

export interface ResumeAgentState extends CoreState {
    resume?: ParsedResume;
}

export interface ResumeAgentRuntime extends Omit<IAgentRuntime, 'agentId'> {
    userId: string;
    agentId: UUID;
    roomId: string;
} 