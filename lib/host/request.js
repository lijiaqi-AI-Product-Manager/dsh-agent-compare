export class HttpError extends Error {
    status;
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}
/** Bounded object payloads; malformed input must not expose its contents. */
export async function readBody(req) {
    const chunks = [];
    let size = 0;
    // Keep the socket open long enough to return 413 when the limit is reached.
    for await (const chunk of req.iterator({ destroyOnReturn: false })) {
        const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        size += bytes.length;
        if (size > 256 * 1024) {
            req.resume();
            throw new HttpError(413, 'body too large');
        }
        chunks.push(bytes);
    }
    if (size === 0)
        return {};
    let parsed;
    try {
        parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    }
    catch (error) {
        if (error instanceof SyntaxError)
            throw new HttpError(400, '请求格式无效：需要有效的 JSON 对象');
        throw error;
    }
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed))
        throw new HttpError(400, 'body must be a JSON object');
    return parsed;
}
