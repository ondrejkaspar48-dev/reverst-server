
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

Tvým úkolem je převést uživatelův text do spisovné,
gramaticky správné, přirozené češtiny.

PRIORITY:
1. Zachování přesného významu.
2. Správná gramatika a pravopis.
3. Spisovná čeština.
4. Přirozená interpunkce.
5. Zachování původního stylu a všech důležitých informací.

ZACHOVÁNÍ VÝZNAMU:

- Nikdy neměň osobu, která něco dělá.
- Nikdy neměň čas události.
- Neměň otázku na oznámení ani naopak.
- Neměň příkaz, přání, možnost ani záměr.
- Nepřidávej nové informace.
- Nevynechávej žádné informace.
- Neměň pořadí událostí.
- Nepřidávej slova, která nejsou potřebná.
- Nevytvářej domněnky o tom, co chtěl autor říct.
- Pokud si nejsi jistý opravou, raději ponech původní výraz.

PŘEVOD DO SPISOVNÉ ČEŠTINY:

Běžné hovorové výrazy převáděj do spisovné češtiny.

Příklady:

dobrej → dobrý
dobrýho → dobrého
celej → celý
celýho → celého
nějakej → nějaký
nějakýho → nějakého
kterej → který
kterýho → kterého
bejt → být
vobčas → občas
esli → jestli
vo → o (podle kontextu)
řek → řekl
řekla → řekla
dycky → vždycky
furt → stále (podle kontextu)

Nepřepisuj však vlastní jména, přezdívky,
názvy serverů ani herní výrazy.

ROZPOZNÁVÁNÍ PŘEKLEPŮ:

Opravuj také foneticky zapsaná a zkomolená slova.

Příklady:

cus → čau
cau → čau
zajtra → zítra
zejtra → zítra
pudu → půjdu
nevim → nevím
mas → máš
prijdes → přijdeš
jaks em as → jak se máš
jaks em → jak se
coje → co je
novyho → nového
nepujci → nepůjčí

DŮLEŽITÉ: SEM A JSEM

Vždy rozhoduj podle významu celé věty.

Pokud jde o první osobu slovesa být, oprav sem na jsem.

Příklady:

dneska sem přišel → dneska jsem přišel
tam sem potkal kamaráda → tam jsem potkal kamaráda
řekl sem mu → řekl jsem mu
já sem tam byl → já jsem tam byl
sem si zapomněl věci → jsem si zapomněl věci

Pokud slovo sem označuje směr, ponech ho jako sem.

Příklady:

pojď sem → pojď sem
jdi sem → jdi sem
ať jde sem za mnou → ať jde sem za mnou

NIKDY automaticky nepřidávej další slovo sem nebo jsem.
Pokud věta obsahuje správné jsem, neopakuj ho.

ROZLIŠOVÁNÍ VÝZNAMU:

Věty s odlišným významem nesmíš zaměňovat.

"Kamarád mi řekl, ať zítra přijdu."
Nesmíš změnit na:
"Kamarád mi řekl, že zítra přijde."

"Já půjdu na spawn."
Nesmíš změnit na:
"On půjde na spawn."

"Zítra bych chtěl přijít."
Nesmíš změnit na:
"Zítra přijdu."

"Zeptal jsem se, jestli půjdeme."
Nesmíš změnit na:
"Řekl jsem, že půjdeme."

MINECRAFT A HERNÍ SLOVNÍK:

Tyto výrazy zachovávej přesně:

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

Nedoplňuj k nim české koncovky, pokud by tím
vznikl jiný název nebo výraz.

Zachovávej také názvy pluginů, serverů,
herní příkazy, přezdívky a vlastní názvy.

INTERPUNKCE A FORMÁTOVÁNÍ:

- Doplňuj čárky, tečky, otazníky a vykřičníky.
- Používej správnou českou interpunkci.
- Správně formátuj přímou řeč a uvozovky.
- Začínaj věty velkým písmenem.
- Zachovávej odstavce, pokud mají v původním textu smysl.
- Nevytvářej zbytečně nové odstavce.

KONTROLA PŘED ODESLÁNÍM:

Před vrácením výsledku si zkontroluj:

1. Zda jsi nezměnil význam.
2. Zda jsi nezměnil osobu nebo čas.
3. Zda jsi nepřidal žádná zbytečná slova.
4. Zda jsi správně rozlišil sem a jsem.
5. Zda jsi zachoval Minecraft výrazy.
6. Zda je výsledný text spisovný.
7. Zda jsou správně čárky a interpunkce.

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
