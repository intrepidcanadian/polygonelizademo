import { Provider, type Memory, type IAgentRuntime } from "@elizaos/core";
import pkg from 'pdfjs-dist';
import type { PDFDocumentProxy } from 'pdfjs-dist/types/src/display/api';
import type { ResumeAgentState, ParsedResume } from "../types";

const { getDocument } = pkg;

const resumeParserProvider: Provider = {
    get: async (runtime: IAgentRuntime, message: Memory, state?: ResumeAgentState) => {
        // Only process if there's a PDF attachment
        const pdfAttachment = message.content?.attachments?.find(
            attachment => attachment.source === 'pdf'
        );

        if (!pdfAttachment?.text) {
            return null;
        }

        try {
            // 1. Convert base64 to Buffer
            const pdfBuffer = Buffer.from(pdfAttachment.text, 'base64');
            
            // 2. Extract text from PDF
            const pdf = await getDocument(pdfBuffer).promise;
            const text = await extractTextFromPdf(pdf);

            // 3. Use LLM to parse text into structured data
            const prompt = `
            Parse this resume text into structured data. Here are examples:

            Skills: ["JavaScript", "React", "Node.js", "Project Management"]
            
            Experience: [{
                "company": "Tech Corp",
                "title": "Senior Developer",
                "duration": "2020-2022",
                "description": [
                    "Led team of 5 developers",
                    "Implemented microservices architecture",
                    "Reduced deployment time by 50%"
                ]
            }]

            Education: [{
                "school": "University of Technology",
                "degree": "BS Computer Science",
                "year": "2019"
            }]

            Resume text:
            ${text}

            Parse the above resume text into the same format.`;

            // Create evaluation memory
            const parseMemory: Memory = {
                id: message.id,
                userId: message.userId,
                agentId: message.agentId,
                roomId: message.roomId,
                createdAt: Date.now(),
                content: {
                    text: prompt,
                    action: "PARSE_RESUME",
                    attachments: [{
                        id: message.id,
                        source: 'text',
                        text: text,
                        url: `memory://${message.id}/text`,
                        title: 'Extracted Resume Text',
                        description: 'Plain text extracted from resume PDF'
                    }]
                }
            };

            // Use evaluate to get structured data
            const evaluations = await runtime.evaluate(parseMemory);
            const rawResponse = evaluations[0];

            // Clean the response - remove markdown code blocks if present
            const jsonStr = rawResponse.replace(/```json\n?|\n?```/g, '').trim();
            const parsedResume = JSON.parse(jsonStr) as ParsedResume;

            // Store in memory
            await runtime.messageManager.createMemory({
                ...parseMemory,
                content: {
                    text: "Resume parsed successfully",
                    type: 'PARSED_RESUME',
                    attachments: [{
                        id: message.id,
                        source: 'json',
                        text: JSON.stringify(parsedResume),
                        url: `memory://${message.id}/json`,
                        title: 'Parsed Resume Data',
                        description: 'Structured resume data'
                    }]
                }
            });

            return parsedResume;
        } catch (error) {
            console.error("Failed to parse resume:", error);
            return null;
        }
    }
};

async function extractTextFromPdf(pdf: PDFDocumentProxy): Promise<string> {
    const pages = await Promise.all(
        Array.from({length: pdf.numPages}, (_, i) => 
            pdf.getPage(i + 1).then(page => page.getTextContent())
        )
    );
    
    return pages
        .map(content => content.items
            .map((item: any) => item.str).join(' '))
        .join('\n');
} 

export { resumeParserProvider };