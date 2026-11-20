
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
            const ip = request.headers.get("CF-Connecting-IP") || "unknown";
            const { success } = await env.IP_LIMITER.limit({ key: ip });

            if (!success) {
                return reply({
                    error: "Dosáhl jsi limitu. Zkus to později."
                }, 429);
            }

            const body = await request.json();
            const text = body.text;

            if (typeof text !== "string" || !text.trim()) {
                return reply({ error: "Zadej text." }, 400);
            }

            if (text.length > 5000) {
                return reply({ error: "Text je příliš dlouhý." }, 400);
            }

            if (!env.AI) {
                return reply({
                    error: "AI není správně připojena.",
                    stage: "AI_BINDING"
                }, 500);
            }

            let result;

            try {
                result = await env.AI.run(
                    "@cf/google/gemma-4-26b-a4b-it",
                    {
                        messages: [
                            {
                                role: "system",
                                content: `Jsi přesný český korektor aplikace ReversT.

Tvým úkolem je opravit text podle toho, co autor pravděpodobně zamýšlel napsat.

PRAVIDLA:

1. Opravuj český pravopis, gramatiku a diakritiku.
2. Opravuj jasné překlepy a přehozená písmena.
3. Rozpoznávej slova napsaná dohromady nebo nesprávně rozdělená.
4. Rozpoznávej význam celé věty, nejen jednotlivá slova.
5. Doplňuj správnou interpunkci.
6. Na začátku věty používej velké písmeno.
7. Otázky zakončuj otazníkem.
8. Zachovávej původní význam a styl autora.
9. Zachovávej hovorovou češtinu.
10. Nepřidávej nová slova ani pokračování vět.
11. Neměň správná slova.
12. Pokud si nejsi jistý opravou, raději zachovej původní slovo.
13. Rozlišuj "sem" a "jsem" podle kontextu.
14. Zachovávej Minecraft výrazy chestka, spawn, shop a store.
15. Zachovávej názvy serverů, her a pluginů.
16. Nezaměňuj běžná slova za podobně znějící slova bez důvodu.
17. Vrať pouze opravený text bez vysvětlení.

PŘÍKLADY:

Vstup: ahoj jak se mas
Výstup: Ahoj, jak se máš?

Vstup: ahoj jaks em as
Výstup: Ahoj, jak se máš?

Vstup: si velky fracek
Výstup: Jsi velký fráček.

Vstup: ahoj tati
Výstup: Ahoj, tati.

Vstup: kakas dobre dneska zitra nebo poziti
Výstup: Kakáš dobře dneska, zítra nebo pozítří?

Vstup: koupil sem chestku v shopu
Výstup: Koupil jsem chestku v shopu.

Vstup: kdy prijdes na spawn
Výstup: Kdy přijdeš na spawn?

Vstup: dneska jsem byl doma
Výstup: Dneska jsem byl doma.

Vstup: pojd sem na spawn
Výstup: Pojď sem na spawn.

Pokud je text již správný, neměň jeho význam ani slovní zásobu.

Vrať pouze opravený text.`
                            },
                            {
                                role: "user",
                                content: text
                            }
                        ],
                        temperature: 0,
                        max_tokens: 2048,
                        chat_template_kwargs: {
                            enable_thinking: false
                        }
                    }
                );
            } catch (error) {
                console.error("AI invocation failed:", error);

                return reply({
                    error: "AI se nepodařilo spustit.",
                    stage: "AI_RUN"
                }, 502);
            }

            const corrected =
                result?.response ??
                result?.choices?.[0]?.message?.content;

            if (typeof corrected !== "string" || !corrected.trim()) {
                console.error("Unexpected AI response:", JSON.stringify(result));

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
