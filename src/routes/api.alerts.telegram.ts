import { createFileRoute } from "@tanstack/react-router";

/**
 * Telegram alert webhook scaffold.
 * Once TELEGRAM_API_KEY + TELEGRAM_CHAT_ID are added as secrets, this route
 * will forward the message to the Telegram Bot API via the connector gateway.
 * Until then it logs the payload for inspection.
 */
export const Route = createFileRoute("/api/alerts/telegram")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: unknown = null;
        try {
          body = await request.json();
        } catch {
          body = null;
        }
        const TELEGRAM_API_KEY = process.env.TELEGRAM_API_KEY;
        const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
        const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;

        if (!TELEGRAM_API_KEY || !TELEGRAM_CHAT_ID || !LOVABLE_API_KEY) {
          console.log("[telegram-webhook] secrets not configured, logging only:", body);
          return Response.json({ delivered: false, reason: "telegram_not_configured", body });
        }

        const text =
          (body && typeof body === "object" && "text" in body && typeof (body as { text: unknown }).text === "string"
            ? (body as { text: string }).text
            : null) ?? "NOC alert";

        const res = await fetch("https://connector-gateway.lovable.dev/telegram/sendMessage", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "X-Connection-Api-Key": TELEGRAM_API_KEY,
          },
          body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text, parse_mode: "HTML" }),
        });
        const data = await res.json().catch(() => null);
        return Response.json({ delivered: res.ok, telegram: data }, { status: res.ok ? 200 : 502 });
      },
    },
  },
});