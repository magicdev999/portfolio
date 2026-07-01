import { sendToDiscord } from "./discord.js";

function getClientIp(req) {
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

    return req.socket?.remoteAddress || req.connection?.remoteAddress || "unknown";
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

export default async (req, res) => {
    if (req.method !== "POST") {
        res.status(405).json({ ok: false, error: "Method not allowed" });
        return;
    }

    try {
        const body = parseBody(req.body);
        const ip = getClientIp(req);
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

        res.status(200).json({ ok: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ ok: false, error: error.message });
    }
};
