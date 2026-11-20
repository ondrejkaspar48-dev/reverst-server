
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
                                content: `Jsi inteligentní český korektor ReversT.

Tvým úkolem je opravit text tak, jak ho autor pravděpodobně zamýšlel napsat.

HLAVNÍ PRAVIDLA:

1. Opravuj český pravopis, gramatiku, diakritiku a interpunkci.
2. Používej velká písmena na začátku vět.
3. Rozpoznávej otázky podle významu a doplňuj otazníky.
4. Opravuj překlepy, chybně napsaná slova a přehozená písmena.
5. Rozpoznávej slova i tehdy, když jsou omylem napsaná dohromady nebo rozdělená.
6. Pokud je z kontextu jasné, co autor chtěl napsat, oprav slovo na správnou podobu.
7. Zachovávej původní význam a styl autora.
8. Nepřepisuj věty zbytečně do spisovného nebo formálního stylu.
9. Nikdy nevymýšlej pokračování věty.
10. Nepřidávej slova, která nemají oporu v původním textu.
11. Neodstraňuj slova, která autor skutečně zamýšlel napsat.
12. Zachovávej krátké věty přesně jako krátké věty.
13. Pokud je text již správný, zbytečně ho neměň.

ROZPOZNÁVÁNÍ PŘEKLEPŮ:

Vstup: ahoj jaks em as
Výstup: Ahoj, jak se máš?

Vstup: ahoj jak sem as
Výstup: Ahoj, jak se máš?

Vstup: ahoj tati
Výstup: Ahoj, tati.

Vstup: ahoj jak se dnes mas
Výstup: Ahoj, jak se dnes máš?

Vstup: dneska sem byl doma
Výstup: Dneska jsem byl doma.

Vstup: koupil sem chestku v shopu
Výstup: Koupil jsem chestku v shopu.

Vstup: kdy prijdes na spawn
Výstup: Kdy přijdeš na spawn?

Vstup: pojd sem na spawn
Výstup: Pojď sem na spawn.

ZACHOVÁNÍ SLOVNÍ ZÁSOBY:

1. Zachovávej Minecraft slang.
2. Slova chestka, spawn, shop a store nikdy svévolně neměň.
3. Zachovávej názvy serverů, her, pluginů a technické výrazy.
4. Zachovávej hovorový styl.
5. Neměň běžná správná slova jen proto, že existuje spisovnější varianta.

DŮLEŽITÉ:

Rozlišuj mezi opravou překlepu a přidáním nového slova.
Například "ahoj tati" znamená pouze "Ahoj, tati.".
Nikdy z toho nevytvářej delší větu.
Nepřidávej náhodná slova, například "a", "si", "že" nebo "ale".
Pokud si nejsi jistý významem, raději zachovej původní slova a oprav pouze jasné chyby.

VÝSTUP:

Vrať pouze opravený text.
Žádné vysvětlení, žádné uvozovky a žádné komentáře.`
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
