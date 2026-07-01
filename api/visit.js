import { sendToDiscord } from "./discord.js";

function getClientIp(req, context) {
    // Netlify Functions provide IP via context
    if (context?.clientContext?.sourceIp) {
        return context.clientContext.sourceIp;
    }

    // Fallback to headers for other platforms
    const headerCandidates = [
        req.headers["x-nf-client-connection-ip"],
        req.headers["cf-connecting-ip"],
        req.headers["x-forwarded-for"],
        req.headers["x-real-ip"],
        req.headers["client-ip"],
    ];

    for (const value of headerCandidates) {
        if (typeof value === "string") {
            const ip = value.split(",")[0].trim();
            if (ip) {
                return ip;
            }
        }
    }

    return "unknown";
}

function parseBody(body) {
    if (!body) {
        return {};
    }

    if (typeof body === "object") {
        return body;
    }

    const trimmed = String(body).trim();
    if (!trimmed) {
        return {};
    }

    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
        try {
            return JSON.parse(trimmed);
        } catch (error) {
            return {};
        }
    }

    try {
        const params = new URLSearchParams(trimmed);
        return Object.fromEntries(params.entries());
    } catch (error) {
        return {};
    }
}

export default async (req, context) => {
    if (req.method !== "POST") {
        return new Response(JSON.stringify({ ok: false, error: "Method not allowed" }), {
            status: 405,
            headers: { "Content-Type": "application/json" },
        });
    }

    try {
        const body = parseBody(req.body);
        const ip = getClientIp(req, context);
        const timestamp = new Date().toISOString();

        await sendToDiscord({
            content: "New portfolio visit",
            embeds: [
                {
                    title: "Visitor detected",
                    color: 5814783,
                    fields: [
                        { name: "IP", value: ip || "unknown" },
                        { name: "Path", value: body.path || req.url },
                        { name: "User Agent", value: body.userAgent || "unknown" },
                        { name: "Time", value: timestamp },
                    ],
                },
            ],
        });

        return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
        });
    } catch (error) {
        console.error(error);
        return new Response(JSON.stringify({ ok: false, error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        });
    }
};
