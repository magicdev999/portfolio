const test = require("node:test");
const assert = require("node:assert/strict");
const { sendToDiscord } = require("../api/discord");

test("sendToDiscord throws when no webhook URL is configured", async () => {
    await assert.rejects(
        () => sendToDiscord({ content: "test" }, ""),
        /DISCORD_WEBHOOK_URL is not configured/
    );
});

test("sendToDiscord surfaces webhook failures", async () => {
    const originalFetch = global.fetch;
    global.fetch = async () => ({
        ok: false,
        status: 401,
        text: async () => "invalid webhook",
    });

    try {
        await assert.rejects(
            () => sendToDiscord({ content: "test" }, "https://example.com/hook"),
            /Discord webhook failed: 401 invalid webhook/
        );
    } finally {
        global.fetch = originalFetch;
    }
});
