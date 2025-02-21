import { type Action, type Memory, type IAgentRuntime } from "@elizaos/core";
import { ServiceType } from "@elizaos/core";
import { ITextGenerationService } from "@elizaos/core";


export const parseResumeAction: Action = {
    name: "PARSE_RESUME",
    description: "Parse resume text into structured data",
    similes: ["EXTRACT_RESUME_DATA"],
    examples: [
        [
            {
                user: "user1",
                content: {
                    text: "Here's my resume",
                    action: "PARSE_RESUME",
                    attachments: [
                        {
                            id: "example-id",
                            source: "pdf",
                            text: "<base64-encoded-pdf>",
                            url: "example.com/resume.pdf",
                            title: "resume.pdf",
                            description: "User's resume"
                        }
                    ]
                }
            },
            {
                user: "agent",
                content: {
                    text: "I'll analyze your resume and extract your skills and experience.",
                    action: "PARSE_RESUME"
                }
            }
        ]
    ],
    handler: async (runtime: IAgentRuntime, message: Memory) => {
        console.log('🎯 Starting PARSE_RESUME action');
        
        const pdfText = message.content?.attachments?.[0]?.text;
        if (!pdfText) {
            console.log('❌ No resume text found in attachment');
            return "Sorry, I couldn't find any text to analyze in the resume.";
        }

        console.log('📝 Analyzing resume text, length:', pdfText.length);

        try {
            const prompt = `Analyze this resume and extract key information in JSON format:

Resume text:
${pdfText}

Please provide a JSON response with the following structure:
{
    "professional_experience": [
        {
            "company": "string",
            "title": "string",
            "period": "string",
            "responsibilities": ["string"]
        }
    ],
    "education": [
        {
            "degree": "string",
            "institution": "string",
            "year": "string"
        }
    ],
    "skills": {
        "technical": ["string"],
        "soft": ["string"]
    },
    "certifications": ["string"],
    "achievements": ["string"]
}`;

            const textService = runtime.getService(ServiceType.TEXT_GENERATION) as ITextGenerationService;
            const analysis = await textService?.queueTextCompletion(prompt, 0.7, [], 0, 0, 2000);

            console.log('✅ Resume analysis complete');
            
            try {
                // Try to parse as JSON for validation
                const parsed = JSON.parse(analysis);
                return `Here's what I found in your resume:

🏢 Professional Experience:
${parsed.professional_experience.map(exp => 
    `• ${exp.title} at ${exp.company} (${exp.period})`
).join('\n')}

🎓 Education:
${parsed.education.map(edu => 
    `• ${edu.degree} from ${edu.institution}`
).join('\n')}

💡 Skills:
• Technical: ${parsed.skills.technical.join(', ')}
• Soft: ${parsed.skills.soft.join(', ')}

🏆 Notable Achievements:
${parsed.achievements.map(achievement => 
    `• ${achievement}`
).join('\n')}`;
            } catch (e) {
                console.error('💥 Error parsing JSON response:', e);
                return analysis;
            }
        } catch (error) {
            console.error('💥 Error analyzing resume:', error);
            return "Sorry, I encountered an error while analyzing your resume.";
        }
    },
    validate: async (runtime: IAgentRuntime, message: Memory) => {
        const pdfAttachment = message.content?.attachments?.find(
            attachment => attachment.source === 'pdf'
        );
        return !!pdfAttachment;
    }
} as Action; 