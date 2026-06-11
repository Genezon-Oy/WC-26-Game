import { createFileRoute } from "@tanstack/react-router";

// One-time admin seeding endpoint.
// Only succeeds if there are zero admins in the DB yet. Safe to leave deployed.
export const Route = createFileRoute("/api/public/seed-admin")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const body = (await request.json()) as {
          username?: string;
          password?: string;
          display_name?: string;
        };
        if (!body.username || !body.password) {
          return new Response(JSON.stringify({ error: "username + password required" }), {
            status: 400,
            headers: { "content-type": "application/json" },
          });
        }
        const { data: admins, error: rolesErr } = await supabaseAdmin
          .from("user_roles")
          .select("user_id")
          .eq("role", "admin")
          .limit(1);
        if (rolesErr) {
          return new Response(JSON.stringify({ error: rolesErr.message }), { status: 500 });
        }
        if ((admins ?? []).length > 0) {
          return new Response(JSON.stringify({ error: "Admin already exists" }), { status: 403 });
        }
        const email = `${body.username.trim().toLowerCase()}@league.local`;
        const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
          email,
          password: body.password,
          email_confirm: true,
          user_metadata: {
            username: body.username.toLowerCase(),
            display_name: body.display_name || body.username,
          },
        });
        if (error || !created.user) {
          return new Response(JSON.stringify({ error: error?.message ?? "create failed" }), {
            status: 500,
          });
        }
        await supabaseAdmin.from("user_roles").insert({ user_id: created.user.id, role: "admin" });
        return new Response(JSON.stringify({ ok: true, user_id: created.user.id }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});