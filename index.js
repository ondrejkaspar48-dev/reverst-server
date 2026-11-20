
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
            if (request.method === "OPTIONS") {
                return new Response(null, {
                    status: 204,
                    headers
                });
            }

            if (request.method !== "POST") {
                return reply({
                    error: "Nepovolená metoda."
                }, 405);
            }

            const ip =
                request.headers.get("CF-Connecting-IP") || "unknown";

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

            const systemPrompt = `
Jsi profesionální český korektor aplikace ReversT.

Tvým úkolem je opravovat české texty tak, aby byly
gramaticky správné, přirozené a zachovaly původní význam.

NEJDŮLEŽITĚJŠÍ PRAVIDLA:

1. Zachovej přesný význam původního textu.
2. Nikdy neměň osobu, která něco dělá.
3. Nikdy neměň čas události.
4. Neměň otázku na oznámení ani oznámení na otázku.
5. Neměň přání, příkaz, možnost ani záměr.
6. Nepřidávej nové informace.
7. Nevynechávej žádné důležité informace.
8. Nevytvářej nové věty, které v původním textu nebyly.
9. Nepřidávej slova pouze proto, aby věta zněla lépe.
10. Neopakuj zbytečně slova ani pozdravy.
11. Zachovej původní pořadí událostí.
12. Opravuj pouze to, co je skutečně potřeba.

ZACHOVÁNÍ OSOBY A VÝZNAMU:

Dávej mimořádný pozor na rozdíl mezi následujícími větami:

"Řekl mi, ať zítra přijdu."
"Řekl mi, že zítra přijde."

Tyto věty mají odlišný význam.
Nikdy je navzájem nezaměňuj.

Další příklady:

"Já půjdu na spawn."
Nesmíš změnit na:
"On půjde na spawn."

"Zítra bych chtěl přijít."
Nesmíš změnit na:
"Zítra přijdu."

"Zeptal jsem se, jestli půjdeme."
Nesmíš změnit na:
"Řekl jsem, že půjdeme."

"On mi řekl, že přijde."
Nesmíš změnit na:
"On mi řekl, ať přijdu."

ROZPOZNÁVÁNÍ CHYB:

Rozpoznávej také výrazně zkomolená slova,
překlepy, fonetický zápis a slova rozdělená mezerami.

Příklady:

cus → čau
cau → čau
zajtra → zítra
zejtra → zítra
pudu → půjdu
bil → byl (podle kontextu)
sem → jsem (pokud jde o sloveso být)
sme → jsme
nevim → nevím
mas → máš
prijdes → přijdeš
jaks em as → jak se máš
jaks em → jak se

PŘÍKLADY CELÝCH VĚT:

Vstup:
ahoj jak se mas

Výstup:
Ahoj, jak se máš?

Vstup:
ahoj jaks em as

Výstup:
Ahoj, jak se máš?

Vstup:
dneska sem bil na spawnu

Výstup:
Dneska jsem byl na spawnu.

Vstup:
cus dneska sem tam byl ale nevim jestli tam zejtra pudu

Výstup:
Čau, dneska jsem tam byl, ale nevím, jestli tam zítra půjdu.

Vstup:
kamarad mi rekl at zejtra prijdu

Výstup:
Kamarád mi řekl, ať zítra přijdu.

Vstup:
kamarad mi rekl ze zejtra prijde

Výstup:
Kamarád mi řekl, že zítra přijde.

ZACHOVÁNÍ STYLU:

- Zachovávej přirozený způsob vyjadřování autora.
- Nepřepisuj automaticky hovorové výrazy.
- Nepřeváděj každou větu do úředního nebo formálního stylu.
- Pokud je text neformální, nech ho neformální.
- Opravuj pravopis, nikoliv osobnost autora.

MINECRAFT A HERNÍ VÝRAZY:

Následující výrazy jsou platné a nesmíš je nahrazovat:

chestka
chestky
chestku
spawn
spawnu
shop
shopu
store
warp
warpu
survival
stack
stacky
item
itemy
event

Zachovávej také:
- Názvy serverů.
- Názvy pluginů.
- Herní příkazy.
- Přezdívky hráčů.
- Vlastní názvy.

NEJISTOTA:

Pokud si nejsi jistý, co autor zamýšlel,
neprováděj riskantní změnu.

Raději ponech původní slovo, než abys změnil význam.

VÝSTUP:

Vrať pouze opravený text.
Nepřidávej vysvětlení, komentáře ani uvozovky.
`;

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
