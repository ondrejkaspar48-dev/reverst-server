
export default {
    async fetch(request, env) {
        const headers = {
            "Content-Type": "application/json",
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

        if (!env.GROQ_API_KEY) {
            return reply({ error: "Server není nakonfigurován." }, 500);
        }

        try {
            const body = await request.json();
            const text = body.text;

            if (typeof text !== "string" || !text.trim()) {
                return reply({ error: "Zadej text." }, 400);
            }

            if (text.length > 5000) {
                return reply({ error: "Text je příliš dlouhý." }, 400);
            }

            const response = await fetch(
                "https://api.groq.com/openai/v1/chat/completions",
                {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${env.GROQ_API_KEY}`,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        model: "openai/gpt-oss-20b",
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
                        max_completion_tokens: 2048
                    })
                }
            );

            if (!response.ok) {
                return reply({
                    error: "AI momentálně není dostupná."
                }, 502);
            }

            const result = await response.json();
            const corrected =
                result.choices?.[0]?.message?.content;

            if (!corrected) {
                return reply({ error: "AI nevrátila text." }, 502);
            }

            return reply({
                correctedText: corrected.trim()
            });

        } catch {
            return reply({
                error: "Nepodařilo se zpracovat text."
            }, 500);
        }
    }
};
