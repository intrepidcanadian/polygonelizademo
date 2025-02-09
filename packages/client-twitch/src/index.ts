import type { IAgentRuntime } from "@elizaos/core";
import { elizaLogger } from "@elizaos/core";
import WebSocket from "ws";
import { Memory } from "@elizaos/core";
import { stringToUuid } from "@elizaos/core";

export class TwitchClientInterface {
    private websocketClient: WebSocket | null = null;
    private websocketSessionID: string | null = null;
    private BOT_USER_ID: string | null = null;
    private CHAT_CHANNEL_USER_ID: string | null = null;

    constructor(private runtime: IAgentRuntime) {}

    static async start(runtime: IAgentRuntime) {
        const client = new TwitchClientInterface(runtime);
        await client.initialize();
        return client;
    }

    async initialize() {
        const OAUTH_TOKEN = this.runtime.getSetting("TWITCH_OAUTH_TOKEN");
        const CLIENT_ID = this.runtime.getSetting("TWITCH_CLIENT_ID");

        if (!OAUTH_TOKEN || !CLIENT_ID) {
            elizaLogger.error("Missing Twitch credentials");
            return null;
        }

        // Validate token and get user info
        await this.getAuth(OAUTH_TOKEN);
        
        // Start WebSocket connection
        this.startWebSocketClient();
    }

    private async getAuth(OAUTH_TOKEN: string) {
        const response = await fetch('https://id.twitch.tv/oauth2/validate', {
            headers: {
                'Authorization': 'OAuth ' + OAUTH_TOKEN
            }
        });

        if (response.status !== 200) {
            elizaLogger.error("Invalid Twitch token");
            return null;
        }

        const data = await response.json();
        this.BOT_USER_ID = data.user_id;
        this.CHAT_CHANNEL_USER_ID = data.user_id;
        
        elizaLogger.info("Validated Twitch token for user:", data.login);
    }

    private startWebSocketClient() {
        this.websocketClient = new WebSocket('wss://eventsub.wss.twitch.tv/ws');

        this.websocketClient.on('error', console.error);

        this.websocketClient.on('open', () => {
            elizaLogger.info('Connected to Twitch WebSocket');
        });

        this.websocketClient.on('message', (data) => {
            this.handleWebSocketMessage(JSON.parse(data.toString()));
        });
    }

    private async handleWebSocketMessage(data: any) {
        switch (data.metadata.message_type) {
            case 'session_welcome':
                this.websocketSessionID = data.payload.session.id;
                await this.registerEventSubListeners();
                break;
            case 'notification':
                if (data.metadata.subscription_type === 'channel.chat.message') {
                    const message = data.payload.event.message.text;
                    const username = data.payload.event.chatter_user_login;
                    
                    elizaLogger.info(`Twitch MSG <${username}> ${message}`);
                    
                    // Create a proper Memory object
                    const memoryInput: Memory = {
                        userId: stringToUuid(username),
                        agentId: stringToUuid(this.BOT_USER_ID!),
                        roomId: stringToUuid(this.CHAT_CHANNEL_USER_ID!),
                        content: { 
                            text: message,
                            source: 'twitch'
                        },
                        createdAt: Date.now()
                    };

                    // Process through Eliza
                    await this.runtime.messageManager.createMemory(memoryInput);

                    // Compose state for the message
                    const state = await this.runtime.composeState(memoryInput);

                    // Evaluate if we should respond
                    const shouldRespond = await this.runtime.evaluate(memoryInput, state);

                    if (shouldRespond) {
                        // Process the message and get response
                        const responses: Memory[] = []; // Array to collect responses
                        await this.runtime.processActions(memoryInput, responses, state);
                        
                        // Get the first response with text content
                        const response = responses.find(r => r.content?.text);
                        
                        if (response?.content?.text) {
                            await this.sendChatMessage(response.content.text);
                        }
                    }
                }
                break;
        }
    }

    async sendChatMessage(message: string) {
        const OAUTH_TOKEN = this.runtime.getSetting("TWITCH_OAUTH_TOKEN");
        const CLIENT_ID = this.runtime.getSetting("TWITCH_CLIENT_ID");

        const response = await fetch('https://api.twitch.tv/helix/chat/messages', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + OAUTH_TOKEN,
                'Client-Id': CLIENT_ID,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                broadcaster_id: this.CHAT_CHANNEL_USER_ID,
                sender_id: this.BOT_USER_ID,
                message: message
            })
        });

        if (response.status !== 200) {
            elizaLogger.error("Failed to send Twitch chat message");
        }
    }

    private async registerEventSubListeners() {
        const OAUTH_TOKEN = this.runtime.getSetting("TWITCH_OAUTH_TOKEN");
        const CLIENT_ID = this.runtime.getSetting("TWITCH_CLIENT_ID");

        const response = await fetch('https://api.twitch.tv/helix/eventsub/subscriptions', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + OAUTH_TOKEN,
                'Client-Id': CLIENT_ID,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                type: 'channel.chat.message',
                version: '1',
                condition: {
                    broadcaster_user_id: this.CHAT_CHANNEL_USER_ID,
                    user_id: this.BOT_USER_ID
                },
                transport: {
                    method: 'websocket',
                    session_id: this.websocketSessionID
                }
            })
        });

        if (response.status === 202) {
            elizaLogger.info("Subscribed to Twitch chat messages");
        } else {
            elizaLogger.error("Failed to subscribe to Twitch chat messages");
        }
    }
} 