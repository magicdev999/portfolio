const http = require("http");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { URL } = require("url");
const { sendToDiscord } = require("./api/discord");

const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || "0.0.0.0";
const BUILD_DIR = path.join(__dirname, "build");

function getClientIp(req) {
    const forwardedFor = req.headers["x-forwarded-for"] || req.headers["x-real-ip"];
    if (typeof forwardedFor === "string") {
        return forwardedFor.split(",")[0].trim();
    }
    return req.socket?.remoteAddress || req.connection?.remoteAddress || "unknown";
}

function getLocalAddresses() {
    const addresses = new Set();
    const interfaces = os.networkInterfaces();

    Object.values(interfaces).forEach((details) => {
        details?.forEach((detail) => {
            if (detail.family === "IPv4" && !detail.internal) {
                addresses.add(detail.address);
            }
        });
    });

    if (addresses.size === 0) {
        addresses.add("localhost");
    }

    return [...addresses];
}

function sendJson(res, statusCode, payload) {
    res.writeHead(statusCode, { "Content-Type": "application/json" });
    res.end(JSON.stringify(payload));
}

function parseBody(body) {
    if (!body) {
        return {};
    }

    const trimmed = body.trim();
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

function getContentType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    switch (ext) {
        case ".html":
            return "text/html; charset=utf-8";
        case ".css":
            return "text/css; charset=utf-8";
        case ".js":
            return "application/javascript; charset=utf-8";
        case ".json":
            return "application/json; charset=utf-8";
        case ".png":
            return "image/png";
        case ".jpg":
        case ".jpeg":
            return "image/jpeg";
        case ".svg":
            return "image/svg+xml";
        case ".ico":
            return "image/x-icon";
        case ".txt":
            return "text/plain; charset=utf-8";
        default:
            return "application/octet-stream";
    }
}

function serveStaticFile(res, filePath) {
    fs.readFile(filePath, (error, data) => {
        if (error) {
            sendJson(res, 404, { ok: false, error: "Not found" });
            return;
        }

        const contentType = getContentType(filePath);
        const isHtml = filePath.endsWith(".html");
        res.writeHead(200, {
            "Content-Type": contentType,
            "Cache-Control": isHtml ? "no-cache" : "public, max-age=31536000",
        });
        res.end(data);
    });
}

function serveSpa(res) {
    const indexPath = path.join(BUILD_DIR, "index.html");
    serveStaticFile(res, indexPath);
}

function serveStatic(res, requestPath) {
    const normalizedPath = decodeURIComponent(requestPath || "/");
    const safePath = path.normalize(path.join(BUILD_DIR, normalizedPath));

    if (!safePath.startsWith(BUILD_DIR)) {
        sendJson(res, 400, { ok: false, error: "Invalid path" });
        return;
    }

    const filePath = normalizedPath === "/" ? path.join(BUILD_DIR, "index.html") : safePath;

    fs.existsSync(filePath) && fs.statSync(filePath).isFile()
        ? serveStaticFile(res, filePath)
        : serveSpa(res);
}

const server = http.createServer(async (req, res) => {
    const requestUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return;
    }

    if (req.method === "POST" && requestUrl.pathname === "/api/visit") {
        let body = "";
        req.on("data", (chunk) => {
            body += chunk;
        });

        req.on("end", async () => {
            try {
                const parsed = parseBody(body);
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
                                { name: "Path", value: parsed.path || requestUrl.pathname },
                                { name: "User Agent", value: parsed.userAgent || "unknown" },
                                { name: "Time", value: timestamp },
                            ],
                        },
                    ],
                });

                sendJson(res, 200, { ok: true });
            } catch (error) {
                sendJson(res, 500, { ok: false, error: error.message });
            }
        });
        return;
    }

    if (req.method === "GET" && requestUrl.pathname === "/api/health") {
        sendJson(res, 200, { ok: true });
        return;
    }

    if (req.method === "GET") {
        serveStatic(res, requestUrl.pathname);
        return;
    }

    sendJson(res, 404, { ok: false, error: "Not found" });
});

server.listen(PORT, HOST, () => {
    const localAddresses = getLocalAddresses();
    const urls = localAddresses.map((address) => `http://${address}:${PORT}`);
    console.log(`Visitor notifier running on ${urls.join(" | ")} | http://localhost:${PORT}`);
});
