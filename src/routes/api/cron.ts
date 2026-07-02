import { createFileRoute } from "@tanstack/react-router";
import { performRefreshOdds } from "@/lib/odds.functions";
import { performPollLive, performSyncFixtures, performSyncScorers } from "@/lib/admin.functions";

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
        
        // 1. FIRST: Fetch & lock odds (must complete before score updates)
        const oddsResult = await performRefreshOdds()
          .catch((e) => ({ error: (e as Error).message }));
        
        // 2. THEN: Fetch scores (odds are now locked, rescoring will see them)
        const [liveResult, syncResult, scorersResult] = await Promise.all([
          performPollLive().catch((e) => ({ error: (e as Error).message })),
          performSyncFixtures().catch((e) => ({ error: (e as Error).message })),
          performSyncScorers().catch((e) => ({ error: (e as Error).message }))
        ]);
        
        return new Response(JSON.stringify({
            ok: true,
            odds: oddsResult,
            live: liveResult,
            sync: syncResult,
            scorers: scorersResult
        }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});
