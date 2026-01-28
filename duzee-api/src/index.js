export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Only handle /api/*
    if (!url.pathname.startsWith("/api/")) {
      return new Response("Not found", { status: 404 });
    }

    // Public health check (lets us verify deploy + routing)
    if (url.pathname === "/api/health") {
      return json({ ok: true });
    }

    // Cloudflare Access identity headers (present when Access is enabled)
    const email =
      request.headers.get("Cf-Access-Authenticated-User-Email") ||
      request.headers.get("cf-access-authenticated-user-email");

    const userId =
      request.headers.get("Cf-Access-Authenticated-User-Id") ||
      request.headers.get("cf-access-authenticated-user-id") ||
      email;

    if (!email || !userId) {
      return json({ error: "Unauthorized (Access headers missing)" }, 401);
    }

    // State endpoints
    if (url.pathname !== "/api/state") {
      return json({ error: "Not found" }, 404);
    }

    if (request.method === "GET") {
      const row = await env.DB
        .prepare("SELECT state_json, updated_at FROM user_state WHERE user_id = ?")
        .bind(userId)
        .first();

      if (!row) return new Response(null, { status: 204 });

      return json(
        { state: JSON.parse(row.state_json), updated_at: row.updated_at },
        200,
        { ETag: String(row.updated_at), "Cache-Control": "no-store" }
      );
    }

    if (request.method === "PUT") {
      const force = url.searchParams.get("force") === "1";

      let incoming;
      try {
        incoming = await request.json();
      } catch {
        return json({ error: "Invalid JSON body" }, 400);
      }

      if (!incoming || typeof incoming !== "object") {
        return json({ error: "Body must be an object" }, 400);
      }

      const nowMs = Date.now();
      const ifMatch = request.headers.get("If-Match");

      const current = await env.DB
        .prepare("SELECT updated_at FROM user_state WHERE user_id = ?")
        .bind(userId)
        .first();

      if (!force && ifMatch && current && String(current.updated_at) !== String(ifMatch)) {
        return json(
          { error: "Conflict", current_updated_at: current.updated_at },
          409,
          { ETag: String(current.updated_at) }
        );
      }

      await env.DB
        .prepare(
          `INSERT INTO user_state (user_id, state_json, updated_at)
           VALUES (?, ?, ?)
           ON CONFLICT(user_id) DO UPDATE SET
             state_json = excluded.state_json,
             updated_at = excluded.updated_at`
        )
        .bind(userId, JSON.stringify(incoming), nowMs)
        .run();

      return json(
        { ok: true, updated_at: nowMs },
        200,
        { ETag: String(nowMs), "Cache-Control": "no-store" }
      );
    }

    return json({ error: "Method not allowed" }, 405);
  },
};

function json(obj, status = 200, headers = {}) {
  const h = new Headers(headers);
  h.set("Content-Type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(obj), { status, headers: h });
}
