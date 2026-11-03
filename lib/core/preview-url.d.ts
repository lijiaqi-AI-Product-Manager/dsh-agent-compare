/** Preview hosts are local browser names; never resolve arbitrary stored
 * names when probing a recorded preview from the host process. */
export declare const PREVIEW_HOST: RegExp;
export declare function parsePreviewUrl(value: string, port?: number): URL;
/** Keep the logical Host header while connecting directly to loopback. Node
 * and system resolvers need not implement the browser's .localhost rule. */
export declare function previewRequest(value: string): {
    url: string;
    headers: {
        Host: string;
    };
};
export declare function fetchPreview(value: string, init?: Pick<RequestInit, 'headers' | 'signal'>): Promise<Response>;
