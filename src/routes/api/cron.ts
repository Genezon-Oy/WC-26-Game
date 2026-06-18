import { createFileRoute } from "@tanstack/react-router";
import { performRefreshOdds } from "@/lib/odds.functions";
import { performPollLive, performSyncFixtures } from "@/lib/admin.functions";

export const Route = createFileRoute("/api/cron")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const secretParam = url.searchParams.get("secret");
        const authHeader = request.headers.get("authorization");
        
        const configuredSecret = import.meta.env.VITE_CRON_SECRET || process.env.CRON_SECRET;
        
        if (!configuredSecret) {
          return new Response(JSON.stringify({ error: "CRON_SECRET not configured on server" }), { 
            status: 500, 
            headers: { "content-type": "application/json" } 
          });
        }
        
        let isAuthorized = false;
        if (secretParam === configuredSecret) isAuthorized = true;
        if (authHeader === `Bearer ${configuredSecret}`) isAuthorized = true;
        
        if (!isAuthorized) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), { 
            status: 401, 
            headers: { "content-type": "application/json" } 
          });
        }
        
        const [oddsResult, liveResult, syncResult] = await Promise.all([
          performRefreshOdds().catch((e) => ({ error: (e as Error).message })),
          performPollLive().catch((e) => ({ error: (e as Error).message })),
          performSyncFixtures().catch((e) => ({ error: (e as Error).message }))
        ]);
        
        return new Response(JSON.stringify({
            ok: true,
            odds: oddsResult,
            live: liveResult,
            sync: syncResult
        }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});
