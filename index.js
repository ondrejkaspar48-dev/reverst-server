
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
                                content: `Jsi přesný český korektor.

Tvým úkolem je opravit pravopis, gramatiku, diakritiku a interpunkci.

DŮLEŽITÁ PRAVIDLA:

1. Na začátku každé věty používej velké písmeno.
2. Doplňuj správnou českou diakritiku.
3. Doplňuj čárky mezi větami a ve větách.
4. Na konci oznamovací věty doplň tečku, pokud chybí.
5. Na konci otázky doplň otazník.
6. Rozpoznávej otázky podle jejich významu, nejen podle slovosledu.
7. Zachovávej původní význam textu.
8. Zachovávej původní slovní zásobu.
9. Nepřidávej slova, která autor nenapsal.
10. Neodebírej slova, která jsou správná.
11. Nikdy nepřidávej například slovo "si", pokud v textu není.
12. Rozlišuj "sem" a "jsem" podle kontextu.
13. Zachovávej hovorový styl autora.
14. Zachovávej Minecraft slang a herní výrazy.
15. Výrazy chestka, spawn, shop a store zachovávej přesně.
16. Neměň názvy serverů, her, pluginů ani technické výrazy.
17. Nepřidávej vysvětlení ani komentáře.
18. Vrať pouze opravený text.

PŘÍKLADY:

Vstup: ahoj jak se mas
Výstup: Ahoj, jak se máš?

Vstup: dneska jsem byl doma
Výstup: Dneska jsem byl doma.

Vstup: kdy prijdes
Výstup: Kdy přijdeš?

Vstup: ahoj dneska sem byl na spawnu
Výstup: Ahoj, dneska jsem byl na spawnu.

Vstup: koupil sem chestku v shopu
Výstup: Koupil jsem chestku v shopu.

Vstup: pojd sem na spawn
Výstup: Pojď sem na spawn.

Vstup: Dneska jsem byl na spawnu.
Výstup: Dneska jsem byl na spawnu.

Pokud je text již správný, neměň jeho význam ani slovní zásobu.

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
