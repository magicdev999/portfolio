# Deployment setup for Discord visit notifications

The site reads the Discord webhook URL from the environment variable `DISCORD_WEBHOOK_URL`.

## Local development
Create a `.env` file in the project root with:

```env
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/your-webhook-id/your-webhook-token
```

Then restart the server.

## Vercel
1. Open your Vercel project dashboard.
2. Go to Settings -> Environment Variables.
3. Add a variable named `DISCORD_WEBHOOK_URL`.
4. Set the value to your Discord webhook URL.
5. Redeploy the project.

## Netlify
1. Open your Netlify site dashboard.
2. Go to Site configuration -> Environment variables.
3. Add a variable named `DISCORD_WEBHOOK_URL`.
4. Set the value to your Discord webhook URL.
5. Trigger a new deploy.

## Render / other hosts
Add the same environment variable in your host dashboard and restart or redeploy the service.
