
export default {
    async fetch(request, env) {
        const headers = {
            "Content-Type": "application/json",
            "Cache-Control": "no-store",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type"
        };

        const reply = (data, status = 200) =>
            new Response(JSON.stringify(data), {
                status,
                headers
            });

        if (request.method === "OPTIONS") {
            return new Response(null, { headers });
        }

        if (request.method !== "POST") {
            return reply({ error: "Použij POST." }, 405);
        }

        try {
            // Omezení počtu požadavků
            const ip = request.headers.get("CF-Connecting-IP") || "unknown";
            const { success } = await env.IP_LIMITER.limit({ key: ip });

            if (!success) {
                return reply({
                    error: "Dosáhl jsi limitu. Zkus to později."
                }, 429);
            }

            // Kontrola vstupního textu
            const body = await request.json();
            const text = body.text;

            if (typeof text !== "string" || !text.trim()) {
                return reply({ error: "Zadej text." }, 400);
            }

            if (text.length > 5000) {
                return reply({ error: "Text je příliš dlouhý." }, 400);
            }

            // Kontrola připojení AI
            if (!env.AI) {
                console.error("AI binding is missing.");

                return reply({
                    error: "AI není správně připojena.",
                    stage: "AI_BINDING"
                }, 500);
            }

            // Spuštění AI
            let result;

            try {
                result = await env.AI.run(
                    "@cf/meta/llama-3.1-8b-instruct-fast",
                    {
                        messages: [
                            {
                                role: "system",
                                content: `Jsi český korektor.
Opravuj pravopis, gramatiku, interpunkci a překlepy.
Zachovávej původní význam a styl autora.
Neměň slang ani herní výrazy.
Výrazy chestka, spawn, shop a store vždy zachovej přesně.
Nevymýšlej nové informace.
Vrať pouze opravený text bez vysvětlování.`
                            },
                            {
                                role: "user",
                                content: text
                            }
                        ],
                        temperature: 0.2,
                        max_tokens: 2048
                    }
                );
            } catch (error) {
                console.error("AI invocation failed:", error);

                return reply({
                    error: "AI se nepodařilo spustit.",
                    stage: "AI_RUN"
                }, 502);
            }

            // Kontrola odpovědi AI
            const corrected = result?.response;

            if (typeof corrected !== "string" || !corrected.trim()) {
                console.error("AI returned an empty response.");

                return reply({
                    error: "AI nevrátila opravený text.",
                    stage: "AI_RESPONSE"
                }, 502);
            }

            return reply({
                correctedText: corrected.trim()
            });

        } catch (error) {
            console.error("ReversT error:", error);

            return reply({
                error: "Nepodařilo se zpracovat text.",
                stage: "GENERAL"
            }, 500);
        }
    }
};
