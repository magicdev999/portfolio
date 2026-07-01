import { sendToDiscord } from "./discord.js";

function getHeaderValue(req, headerName) {
    if (!req || !req.headers) {
        return undefined;
    }

    if (typeof req.headers.get === "function") {
        const direct = req.headers.get(headerName);
        if (direct) {
            return direct;
        }

        const lower = headerName.toLowerCase();
        const lowerValue = req.headers.get(lower);
        if (lowerValue) {
            return lowerValue;
        }
    }

    const candidates = [headerName, headerName.toLowerCase(), headerName.toUpperCase()];
    for (const key of candidates) {
        const value = req.headers[key];
        if (typeof value === "string") {
            return value;
        }
    }

    return undefined;
}

function getClientIp(req, context) {
    const directCandidates = [
        context?.ip,
        context?.clientContext?.sourceIp,
        context?.clientContext?.ip,
        context?.request?.ip,
        context?.request?.headers?.["x-forwarded-for"],
        context?.ipAddress,
        context?.geo?.ip,
    ];

    for (const value of directCandidates) {
        if (typeof value === "string" && value.trim()) {
            return value.trim();
        }
    }

    const headerCandidates = [
        "x-nf-client-connection-ip",
        "cf-connecting-ip",
        "x-forwarded-for",
        "x-real-ip",
        "client-ip",
        "x-client-ip",
        "true-client-ip",
    ];

    for (const headerName of headerCandidates) {
        const value = getHeaderValue(req, headerName);
        if (typeof value === "string") {
            const ip = value.split(",")[0].trim();
            if (ip) {
                return ip;
            }
        }
    }

    return "unknown";
}

function getUserAgent(req, body) {
    if (body?.userAgent) {
        return body.userAgent;
    }

    const value = getHeaderValue(req, "user-agent");
    if (typeof value === "string" && value.trim()) {
        return value.trim();
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
    // Handle CORS preflight
    if (req.method === "OPTIONS") {
        return new Response(null, {
            status: 204,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type",
            },
        });
    }

    if (!["POST", "GET"].includes(req.method)) {
        return new Response(JSON.stringify({ ok: false, error: "Method not allowed" }), {
            status: 405,
            headers: { "Content-Type": "application/json" },
        });
    }

    try {
        let body = {};
        let pathValue = req.url;

        if (req.method === "POST") {
            body = parseBody(req.body);
        } else {
            // For GET requests, try to parse query params from the URL
            try {
                const base = req.headers && req.headers.host ? `https://${req.headers.host}` : "https://example.com";
                const url = new URL(req.url, base);
                body = Object.fromEntries(url.searchParams.entries());
                pathValue = body.path || url.pathname || req.url;
            } catch (e) {
                body = {};
            }
        }

        const ip = getClientIp(req, context);
        const timestamp = new Date().toISOString();
        const userAgent = getUserAgent(req, body);
        const pathField = body.path || pathValue || req.url;

        // Optional debug: include raw header candidates and context when DEBUG_VISIT=true
        const debugEnabled = String(process.env.DEBUG_VISIT || "").toLowerCase() === "true";
        let debugFields = [];
        if (debugEnabled) {
            const headerCandidates = {
                "x-nf-client-connection-ip": req.headers["x-nf-client-connection-ip"],
                "cf-connecting-ip": req.headers["cf-connecting-ip"],
                "x-forwarded-for": req.headers["x-forwarded-for"],
                "x-real-ip": req.headers["x-real-ip"],
                "client-ip": req.headers["client-ip"],
                "via": req.headers["via"],
                "host": req.headers["host"],
            };

            try {
                const headerDebug = Object.entries(headerCandidates)
                    .map(([k, v]) => `${k}: ${v || "(none)"}`)
                    .join("\n");

                debugFields.push({ name: "Raw IP headers", value: headerDebug.substring(0, 1024) });
            } catch (e) {
                // ignore
            }

            try {
                const ctx = context ? JSON.stringify(context).substring(0, 1024) : "(none)";
                debugFields.push({ name: "Context", value: ctx });
            } catch (e) {
                // ignore
            }
        }

        const embed = {
            title: "Visitor detected",
            color: 5814783,
            fields: [
                { name: "IP", value: ip || "unknown" },
                { name: "Path", value: String(pathField) },
                { name: "User Agent", value: String(userAgent) },
                { name: "Time", value: timestamp },
            ].concat(debugFields),
        };

        await sendToDiscord({ content: "New portfolio visit", embeds: [embed] });

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
