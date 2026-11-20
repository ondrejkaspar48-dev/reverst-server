
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

        try {
            // Povolení CORS
            if (request.method === "OPTIONS") {
                return new Response(null, {
                    status: 204,
                    headers
                });
            }

            // Povolit pouze POST
            if (request.method !== "POST") {
                return reply({
                    error: "Nepovolená metoda."
                }, 405);
            }

            // Omezení počtu požadavků
            const ip = request.headers.get("CF-Connecting-IP") || "unknown";

            if (env.IP_LIMITER) {
                const limit = await env.IP_LIMITER.limit({
                    key: ip
                });

                if (!limit.success) {
                    return reply({
                        error: "Příliš mnoho požadavků. Zkus to později."
                    }, 429);
                }
            }

            // Načtení vstupu
            const body = await request.json();
            const text = body?.text;

            if (typeof text !== "string" || !text.trim()) {
                return reply({
                    error: "Nebyl zadán žádný text."
                }, 400);
            }

            if (text.length > 5000) {
                return reply({
                    error: "Text je příliš dlouhý. Maximum je 5000 znaků."
                }, 400);
            }

            // Instrukce pro českou korekturu
            const systemPrompt = `
Jsi profesionální český korektor integrovaný do aplikace ReversT.

Tvým jediným úkolem je opravit text uživatele.

HLAVNÍ PRAVIDLA:

1. Opravuj český pravopis, gramatiku, diakritiku a interpunkci.
2. Opravuj také výrazně zkomolená slova, překlepy a foneticky zapsaná slova.
3. Rozpoznávej slova omylem rozdělená mezerami.
4. Rozpoznávej běžné české hovorové výrazy a jejich správný český zápis.
5. Zachovávej původní význam a styl textu.
6. Nepřepisuj věty zbytečně do spisovného nebo formálního stylu.
7. Nevymýšlej nové informace ani věty.
8. Pokud si nejsi jistý opravou, raději ponech původní slovo.
9. Vrať pouze opravený text. Žádné vysvětlení, komentář ani uvozovky.

ROZPOZNÁVÁNÍ ZKOMOLENÝCH SLOV:

Věnuj zvláštní pozornost následujícím výrazům:

- cus → čau
- cau → čau
- zajtra → zítra
- zejtra → zítra
- zejtrá → zítra
- pudu → půjdu
- pudu tam → půjdu tam
- bil → byl (pokud to odpovídá kontextu)
- sem → jsem (pokud jde o sloveso být)
- jaks em → jak se
- jaks em as → jak se máš
- prijdes → přijdeš
- nevim → nevím
- mas → máš
- nemam → nemám
- pojd → pojď

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

Vstup: dneska sem bil na spawnu a koupil sem si chestku
Výstup: Dneska jsem byl na spawnu a koupil jsem si chestku.

Vstup: cus dneska sem tam byl ale nevim jestli tam zejtra pudu
Výstup: Čau, dneska jsem tam byl, ale nevím, jestli tam zítra půjdu.

OCHRANA MINECRAFT VÝRAZŮ:

Nikdy automaticky neopravuj ani nepřekládej tyto výrazy:

- chestka
- chestky
- chestku
- spawn
- spawnu
- shop
- shopu
- store
- warp
- warpu

Zachovávej také názvy Minecraft serverů, pluginů, her, přezdívky a vlastní názvy.

DŮLEŽITÉ:

Výrazy jako chestka, spawn a shop nejsou pravopisné chyby.
Nesnaž se je nahrazovat spisovnými českými slovy.

Výsledkem musí být pouze opravený text.
`;

            // Volání Cloudflare Workers AI
            const result = await env.AI.run(
                "@cf/google/gemma-4-26b-a4b-it",
                {
                    messages: [
                        {
                            role: "system",
                            content: systemPrompt
                        },
                        {
                            role: "user",
                            content: text.trim()
                        }
                    ],
                    temperature: 0.1,
                    max_tokens: 2048,
                    chat_template_kwargs: {
                        enable_thinking: false
                    }
                }
            );

            // Získání odpovědi
            const corrected =
                result?.response ??
                result?.choices?.[0]?.message?.content;

            if (!corrected || typeof corrected !== "string") {
                return reply({
                    error: "AI nevrátila opravený text."
                }, 502);
            }

            return reply({
                correctedText: corrected.trim()
            });

        } catch (error) {
            return reply({
                error: "Chyba při korektuře textu.",
                details: String(error?.message || error)
            }, 500);
        }
    }
};
