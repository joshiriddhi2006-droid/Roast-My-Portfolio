const express = require("express");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config();

const app = express();

const PORT =
    process.env.PORT || 3000;


app.use(express.json());

app.use(
    express.static(
        path.join(__dirname, "public")
    )
);


/* =========================
   GEMINI
========================= */

let GoogleGenAI;


async function getGemini() {

    if (!GoogleGenAI) {

        const module =
            await import("@google/genai");

        GoogleGenAI =
            module.GoogleGenAI;
    }


    return new GoogleGenAI({
        apiKey:
            process.env.GEMINI_API_KEY
    });
}


/* =========================
   HOME
========================= */

app.get("/", (req, res) => {

    res.sendFile(
        path.join(
            __dirname,
            "public",
            "index.html"
        )
    );

});


/* =========================
   REVIEW API
========================= */

app.post(
    "/api/review",
    async (req, res) => {

        try {

            const { url } =
                req.body;


            /* Check URL */

            if (!url) {

                return res.status(400).json({
                    error:
                        "Portfolio URL is required."
                });

            }


            let portfolioUrl;


            try {

                portfolioUrl =
                    new URL(url);

            } catch {

                return res.status(400).json({
                    error:
                        "Please enter a valid URL."
                });

            }


            if (
                portfolioUrl.protocol !== "http:" &&
                portfolioUrl.protocol !== "https:"
            ) {

                return res.status(400).json({
                    error:
                        "Only HTTP and HTTPS websites are supported."
                });

            }


            /*
             Try to download the website.
             Some websites reject one type
             of browser request, so we use
             a realistic User-Agent.
            */

            const response =
                await fetchWebsite(
                    portfolioUrl.href
                );


            if (!response.ok) {

                return res.status(400).json({
                    error:
                        `We couldn't access this website. The website returned status ${response.status}.`
                });

            }


            const html =
                await response.text();


            if (!html || html.length < 50) {

                return res.status(400).json({
                    error:
                        "This website did not provide enough readable content to analyse."
                });

            }


            /* =========================
               EXTRACT WEBSITE DATA
            ========================= */

            const title =
                html.match(
                    /<title[^>]*>([\s\S]*?)<\/title>/i
                )?.[1]
                || "No title found";


            const description =
                findMetaDescription(html);


            const headings =
                [
                    ...html.matchAll(
                        /<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi
                    )
                ]
                .map(
                    match =>
                        cleanText(match[1])
                )
                .filter(Boolean)
                .slice(0, 20);


            const links =
                [
                    ...html.matchAll(
                        /<a[^>]+href=["']([^"']+)["']/gi
                    )
                ]
                .map(
                    match =>
                        match[1]
                )
                .slice(0, 30);


            const images =
                (
                    html.match(
                        /<img\b/gi
                    ) || []
                ).length;


            const hasViewport =
                /<meta[^>]+name=["']viewport["']/i
                    .test(html);


            const hasHttps =
                portfolioUrl.protocol ===
                "https:";


            const visibleText =
                cleanText(
                    html
                        .replace(
                            /<script[\s\S]*?<\/script>/gi,
                            " "
                        )
                        .replace(
                            /<style[\s\S]*?<\/style>/gi,
                            " "
                        )
                        .replace(
                            /<noscript[\s\S]*?<\/noscript>/gi,
                            " "
                        )
                        .replace(
                            /<[^>]+>/g,
                            " "
                        )
                )
                .slice(0, 15000);


            const websiteData = {

                url:
                    portfolioUrl.href,

                title:
                    cleanText(title),

                description,

                headings,

                linkCount:
                    links.length,

                imageCount:
                    images,

                hasViewport,

                hasHttps,

                text:
                    visibleText

            };


            /* =========================
               GEMINI REVIEW
            ========================= */

            const ai =
                await getGemini();


            const prompt = `

You are reviewing a college student's developer portfolio.

Give practical, specific and constructive feedback.

The project is called "Roast My Portfolio",
so be slightly playful, but always respectful.

IMPORTANT:

The supplied information comes from the
website's HTML. It may not contain content
that is loaded later by JavaScript.

Do NOT pretend that you performed a real
Lighthouse performance test.

Performance and accessibility scores are
approximate estimates based on the available
website information.

Give scores from 1 to 10 for:

1. UI/UX
2. Performance
3. Accessibility
4. Overall

Return ONLY valid JSON.

Website information:

${JSON.stringify(
    websiteData,
    null,
    2
)}

`;


            const result =
                await ai.models.generateContent({

                    model: "gemini-3.5-flash-lite",

                    contents:
                        prompt,

                    config: {

                        responseMimeType:
                            "application/json",

                        responseSchema: {

                            type: "object",

                            properties: {

                                overallScore: {
                                    type: "number"
                                },

                                uiUxScore: {
                                    type: "number"
                                },

                                performanceScore: {
                                    type: "number"
                                },

                                accessibilityScore: {
                                    type: "number"
                                },

                                roast: {
                                    type: "string"
                                },

                                strengths: {

                                    type: "array",

                                    items: {
                                        type: "string"
                                    }

                                },

                                improvements: {

                                    type: "array",

                                    items: {
                                        type: "string"
                                    }

                                },

                                summary: {
                                    type: "string"
                                }

                            },

                            required: [

                                "overallScore",

                                "uiUxScore",

                                "performanceScore",

                                "accessibilityScore",

                                "roast",

                                "strengths",

                                "improvements",

                                "summary"

                            ]

                        }

                    }

                });


            const review =
                JSON.parse(
                    result.text
                );


            res.json({

                url:
                    portfolioUrl.href,

                review

            });


        } catch (error) {

            console.error(
                "Review error:",
                error
            );


            res.status(500).json({

                error:
                    "I couldn't analyse that website. Make sure the URL is public and reachable."

            });

        }

    }
);


/* =========================
   WEBSITE FETCHER
========================= */

async function fetchWebsite(url) {

    const userAgents = [

        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36",

        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile Safari/604.1"

    ];


    let lastResponse = null;


    for (const userAgent of userAgents) {

        try {

            const response =
                await fetch(
                    url,
                    {

                        headers: {

                            "User-Agent":
                                userAgent,

                            "Accept":
                                "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",

                            "Accept-Language":
                                "en-US,en;q=0.9"

                        },

                        redirect:
                            "follow",

                        signal:
                            AbortSignal.timeout(
                                15000
                            )

                    }
                );


            lastResponse =
                response;


            if (response.ok) {

                return response;

            }

        } catch (error) {

            console.log(
                "Fetch attempt failed:",
                error.message
            );

        }

    }


    return lastResponse;

}


/* =========================
   META DESCRIPTION
========================= */

function findMetaDescription(html) {

    const match1 =
        html.match(
            /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i
        );


    if (match1) {
        return cleanText(match1[1]);
    }


    const match2 =
        html.match(
            /<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i
        );


    if (match2) {
        return cleanText(match2[1]);
    }


    return "No description found";
}


/* =========================
   CLEAN TEXT
========================= */

function cleanText(text) {

    return String(text)

        .replace(
            /<[^>]*>/g,
            " "
        )

        .replace(
            /&nbsp;/gi,
            " "
        )

        .replace(
            /&amp;/gi,
            "&"
        )

        .replace(
            /&lt;/gi,
            "<"
        )

        .replace(
            /&gt;/gi,
            ">"
        )

        .replace(
            /&quot;/gi,
            '"'
        )

        .replace(
            /&#39;/gi,
            "'"
        )

        .replace(
            /\s+/g,
            " "
        )

        .trim();

}


/* =========================
   START SERVER
========================= */

app.listen(
    PORT,
    () => {

        console.log(
            `🔥 RoastMyPortfolio running at http://localhost:${PORT}`
        );

    }
);