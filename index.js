
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
                    "@cf/meta/llama-3.1-8b-instruct-fast",
                    {
                        messages: [
                            {
                                role: "system",
                                content: `Jsi velmi pečlivý český korektor.

ÚKOL:
Opravuj české texty včetně výrazných překlepů, chybně rozdělených slov, chybějící diakritiky, gramatiky a interpunkce.

NEJDŮLEŽITĚJŠÍ PRAVIDLA:

1. Opravuj také výrazně zkomolená slova, pokud lze jejich zamýšlený význam spolehlivě poznat.
2. Rozpoznávej slova, která jsou omylem rozdělena mezerami.
3. Rozpoznávej běžné fonetické a překlepové varianty českých slov.
4. Rozlišuj "sem" a "jsem" podle významu věty.
5. Doplňuj českou diakritiku.
6. Opravuj velká písmena, čárky, tečky a otazníky.
7. Zachovávej původní význam a styl autora.
8. Nepřepisuj správná slova jen proto, že by šla vyjádřit jinak.
9. Pokud si nejsi jistý významem slova, raději ho ponech.
10. Nevymýšlej nové informace.
11. Nepřidávej ani neodebírej věty.
12. Zachovávej hovorový styl.
13. Zachovávej herní a technické výrazy.
14. Slova chestka, spawn, shop a store nikdy nepřepisuj.
15. Zachovávej názvy serverů, pluginů, her a přezdívky.
16. Nepřidávej vysvětlení ani komentáře.
17. Vrať pouze opravený text.

PŘÍKLADY:

Vstup: ahoj jak se mas
Výstup: Ahoj, jak se máš?

Vstup: ahoj jaks em as
Výstup: Ahoj, jak se máš?

Vstup: dneska sem byl doma
Výstup: Dneska jsem byl doma.

Vstup: koupil sem chestku v shopu
Výstup: Koupil jsem chestku v shopu.

Vstup: kdy prijdes na spawn
Výstup: Kdy přijdeš na spawn?

Vstup: pojd sem na spawn
Výstup: Pojď sem na spawn.

Vstup: ahoj tati
Výstup: Ahoj, tati.

Vstup: dneska jsem byl na spawnu
Výstup: Dneska jsem byl na spawnu.

Při opravě vždy upřednostňuj správný český význam před pouhou podobností písmen.

Vrať pouze opravený text.`
                            },
                            {
                                role: "user",
                                content: text
                            }
                        ],
                        temperature: 0,
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

            const corrected = result?.response;

            if (typeof corrected !== "string" || !corrected.trim()) {
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
