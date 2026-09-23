import formidable from "formidable";
import fs from "fs";
import OpenAI from "openai";

export const config = {
  api: {
    bodyParser: false,
  },
};

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req, res) {
  // CORS
  res.setHeader(
    "Access-Control-Allow-Origin",
    "https://dswifi120-cmyk.github.io"
  );
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type"
  );

  // Browser preflight
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed",
    });
  }

  try {
    const form = formidable({
      multiples: false,
    });

    const [fields, files] = await form.parse(req);

    const uploaded = files.invoice?.[0];

    if (!uploaded) {
      return res.status(400).json({
        error: "Invoice image missing",
      });
    }

    const imageBuffer = fs.readFileSync(uploaded.filepath);

    const base64Image = imageBuffer.toString("base64");

    const mimeType =
      uploaded.mimetype || "image/jpeg";

    const response = await openai.responses.create({
      model: "gpt-5.6-luna",

      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `
You are an invoice and chalan data extraction AI.

Read the uploaded invoice/chalan image carefully.

The document may contain Bangla, English, or mixed Bangla-English text.

Extract all product line items.

Return ONLY valid JSON in this exact structure:

{
  "date": "YYYY-MM-DD",
  "reference": "invoice or chalan number",
  "items": [
    {
      "product": "product name",
      "quantity": 0,
      "unit": "pcs"
    }
  ]
}

Rules:

1. Extract EVERY product line.
2. Do not skip repeated products.
3. Preserve the product name as written.
4. Convert Bangla numerals to normal numbers.
5. Quantity must be numeric.
6. If unit is missing, use "pcs".
7. If the date is clearly visible, use it.
8. If invoice/chalan number is visible, put it in reference.
9. Do not add explanations.
10. Return JSON only.
              `,
            },
            {
              type: "input_image",
              image_url: `data:${mimeType};base64,${base64Image}`,
            },
          ],
        },
      ],
    });

    let resultText = response.output_text;

    // Remove markdown code fences if AI returns them
    resultText = resultText
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    const result = JSON.parse(resultText);

    return res.status(200).json({
      success: true,
      date: result.date || new Date().toISOString().slice(0, 10),
      reference: result.reference || "",
      items: Array.isArray(result.items)
        ? result.items
        : [],
    });

  } catch (error) {
    console.error("Invoice processing error:", error);

    return res.status(500).json({
      error: "Invoice processing failed",
      details: error.message,
    });
  }
}
