// Update the IAttachment interface
export interface IAttachment {
    id: string;
    source: string;
    text: string;
    title: string;
    description: string;
    url: string;
    contentType?: string;
}