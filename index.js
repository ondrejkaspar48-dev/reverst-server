
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

            // Kontrola AI
            if (!env.AI) {
                console.error("AI binding is missing.");

                return reply({
                    error: "AI není správně připojena.",
                    stage: "AI_BINDING"
                }, 500);
            }

            // Spuštění korektury
            let result;

            try {
                result = await env.AI.run(
                    "@cf/meta/llama-3.1-8b-instruct-fast",
                    {
                        messages: [
                            {
                                role: "system",
                                content: `Jsi profesionální korektor českého jazyka.

Tvým úkolem je důkladně opravovat:
- pravopisné chyby,
- gramatické chyby,
- nesprávné tvary slov,
- interpunkci,
- překlepy,
- chybějící nebo nadbytečná slova.

DŮLEŽITÁ PRAVIDLA:

1. Opravuj běžnou hovorovou češtinu do spisovné češtiny.
2. Pokud je "sem" použito jako nespisovná náhrada slovesa "jsem", oprav ho na "jsem".
3. Rozlišuj význam slov podle kontextu. Například "pojď sem" je správně a nesmíš to změnit.
4. Zachovávej původní význam a styl autora.
5. Zachovávej herní slang a názvy.
6. Výrazy chestka, spawn, shop a store vždy zachovej přesně.
7. Neměň názvy her, serverů, pluginů ani technické výrazy.
8. Nevymýšlej žádné nové informace.
9. Pokud je věta správně, zbytečně ji nepřepisuj.
10. Vrať pouze opravený text bez vysvětlování.

PŘÍKLADY:

"Ahoj dneska sem byl na spawnu."
→ "Ahoj, dneska jsem byl na spawnu."

"Koupil sem si chestku v shopu."
→ "Koupil jsem si chestku v shopu."

"Pojď sem na spawn."
→ "Pojď sem na spawn."`
                            },
                            {
                                role: "user",
                                content: text
                            }
                        ],
                        temperature: 0.1,
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

            // Kontrola výsledku
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
