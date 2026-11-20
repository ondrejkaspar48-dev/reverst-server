
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

            // Kontrola textu
            const body = await request.json();
            const text = body.text;

            if (typeof text !== "string" || !text.trim()) {
                return reply({ error: "Zadej text." }, 400);
            }

            if (text.length > 5000) {
                return reply({ error: "Text je příliš dlouhý." }, 400);
            }

            if (!env.AI) {
                console.error("AI binding is missing.");

                return reply({
                    error: "AI není správně připojena.",
                    stage: "AI_BINDING"
                }, 500);
            }

            // Korektura
            let result;

            try {
                result = await env.AI.run(
                    "@cf/meta/llama-3.1-8b-instruct-fast",
                    {
                        messages: [
                            {
                                role: "system",
                                content: `Jsi přesný český korektor. Nejsi přepisovač ani spisovatel.

TVŮJ ÚKOL:
Oprav pouze skutečné pravopisné, gramatické a interpunkční chyby.

NEJDŮLEŽITĚJŠÍ PRAVIDLA:

1. Zachovej původní význam každé věty.
2. Zachovej původní slovní zásobu a pořadí slov, pokud oprava chyby nevyžaduje změnu.
3. Nikdy nepřidávej slova jen proto, aby věta zněla přirozeněji.
4. Nikdy neodebírej slova, která jsou v původním textu správně.
5. Nepřidávej například slovo "si", pokud v původním textu není.
6. Opravuj nespisovné tvary, pokud jde o skutečnou gramatickou chybu.
7. Rozlišuj slovo "sem" podle kontextu:
   - "Dneska sem byl doma." → "Dneska jsem byl doma."
   - "Pojď sem." → "Pojď sem."
8. Zachovávej hovorový styl autora, pokud není potřeba opravit gramatickou chybu.
9. Zachovávej Minecraft slang a herní výrazy.
10. Výrazy chestka, spawn, shop a store zachovávej přesně.
11. Neměň názvy serverů, her, pluginů ani technické výrazy.
12. Nepřidávej vysvětlení, komentáře ani uvozovky.
13. Pokud je text správně, vrať ho beze změny.

PŘÍKLADY:

Vstup: Ahoj dneska sem byl na spawnu.
Výstup: Ahoj, dneska jsem byl na spawnu.

Vstup: Koupil sem chestku v shopu.
Výstup: Koupil jsem chestku v shopu.

Vstup: Pojď sem na spawn.
Výstup: Pojď sem na spawn.

Vstup: Dneska jsem byl na spawnu.
Výstup: Dneska jsem byl na spawnu.

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
