import { type Action, type Memory, type IAgentRuntime, type Media } from "@elizaos/core";
import { randomUUID } from "crypto";
import * as fs from 'fs/promises';
import * as path from 'path';
import pkg from 'pdfjs-dist';

const { getDocument } = pkg;

interface MemoryWithAttachments extends Memory {
    attachments?: Media[];
}

export const uploadResumeAction: Action = {
    name: "UPLOAD_RESUME",
    description: "Upload and process a resume file",
    similes: ["UPLOAD_CV", "SUBMIT_RESUME"],
    examples: [
        [  // Each example is an array of messages
            {
                user: "user1",
                content: {
                    text: "Here's my resume",
                    attachments: [{
                        id: "example-id",
                        source: 'pdf',
                        text: '<base64-encoded-pdf>',
                        url: "example.com/resume.pdf",
                        title: "resume.pdf",
                        description: "User's resume"
                    }]
                }
            },
            {
                user: "agent",
                content: {
                    text: "I'll analyze your resume and extract your skills and experience.",
                    action: "UPLOAD_RESUME"
                }
            }
        ]
    ],
    handler: async (runtime: IAgentRuntime, message: MemoryWithAttachments) => {
        console.log('🚀 Starting UPLOAD_RESUME action');
        
        // Look in the uploads directory
        const uploadsDir = path.join(process.cwd(), 'data', 'uploads');
        const files = await fs.readdir(uploadsDir);
        const pdfFile = files.find(f => f.endsWith('.pdf'));
        
        if (!pdfFile) {
            console.log('❌ No PDF file found in uploads directory');
            return "Please provide a resume in PDF format.";
        }

        try {
            const filePath = path.join(uploadsDir, pdfFile);
            console.log('📄 Processing PDF from path:', filePath);
            
            const pdfBytes = await fs.readFile(filePath);
            const pdf = await getDocument(new Uint8Array(pdfBytes)).promise;
            
            let pdfText = '';
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const content = await page.getTextContent();
                pdfText += content.items
                    .map(item => 'str' in item ? item.str : '')
                    .join(' ') + '\n';
            }
            
            console.log('✅ PDF processing complete, text length:', pdfText.length);

            const memoryData = {
                id: randomUUID(),
                userId: message.userId,
                agentId: message.agentId,
                roomId: message.roomId,
                content: {
                    text: "Parse this resume",
                    action: "PARSE_RESUME",
                    attachments: [{
                        id: randomUUID(),
                        source: 'pdf',
                        text: pdfText,
                        url: '',
                        title: pdfFile,
                        description: 'Extracted resume text'
                    }]
                }
            };

            await runtime.messageManager.createMemory(memoryData);
            console.log('🔍 Created PARSE_RESUME memory:', {
                memoryId: memoryData.id,
                action: memoryData.content.action,
                textLength: memoryData.content.attachments[0].text.length
            });

            return "I'll analyze your resume and extract relevant information.";
        } catch (error) {
            console.error('💥 Error processing PDF:', error);
            return "Sorry, I encountered an error while processing your resume.";
        }
    },
    validate: async (runtime: IAgentRuntime, message: MemoryWithAttachments) => {
        return !!message.attachments?.length;
    }
} as Action; 