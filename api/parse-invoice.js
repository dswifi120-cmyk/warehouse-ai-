import OpenAI from "openai";
import formidable from "formidable";
import fs from "fs";

export const config = {
  api: {
    bodyParser: false
  }
};

export default async function handler(req, res) {

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {

    if (!process.env.OPENAI_API_KEY) {

      return res.status(500).json({
        error: "OPENAI_API_KEY is not configured"
      });

    }

    const form = formidable({
      multiples: false
    });

    const [fields, files] = await form.parse(req);

    const uploaded = files.invoice?.[0];

    if (!uploaded) {

      return res.status(400).json({
        error: "Invoice image missing"
      });

    }

    const imageBuffer =
      fs.readFileSync(uploaded.filepath);

    const base64Image =
      imageBuffer.toString("base64");

    const mimeType =
      uploaded.mimetype || "image/jpeg";

    const openai =
      new OpenAI({
        apiKey:
          process.env.OPENAI_API_KEY
      });


    const response =
      await openai.responses.create({

        model: "gpt-5.6-luna",

        input: [

          {
            role: "user",

            content: [

              {
                type: "input_text",

                text: `
You are an invoice/chalan OCR assistant for a warehouse in Bangladesh.

Read the uploaded invoice/chalan image carefully.

The document may contain:
- Bangla text
- English text
- Bangla + English mixed text
- Product names
- Quantity
- Unit
- Invoice/chalan number
- Date

Extract ONLY the information that is actually visible in the image.

Return ONLY valid JSON.

Required JSON format:

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

1. Keep product names as close as possible to the original document.
2. Do not invent products.
3. Do not invent quantities.
4. Convert Bangla numerals to normal numbers.
5. If quantity is decimal, keep the decimal.
6. If unit is visible, use it.
7. If unit is not visible, use "pcs".
8. If date is visible, convert it to YYYY-MM-DD.
9. If date is not visible, use today's date.
10. If invoice/chalan number is visible, put it in "reference".
11. If there are many product rows, extract all of them.
12. Ignore prices, discounts, VAT, totals and unrelated information.
13. Do not combine different products.
14. Return JSON only. No markdown.
`
              },

              {
                type: "input_image",

                image_url:
                  `data:${mimeType};base64,${base64Image}`
              }

            ]
          }

        ]

      });


    const text =
      response.output_text;


    let result;


    try {

      result =
        JSON.parse(text);

    } catch (jsonError) {

      console.error(
        "AI returned invalid JSON:",
        text
      );

      return res.status(500).json({

        error:
          "AI returned invalid JSON",

        raw:
          text

      });

    }


    if (!result.items) {

      result.items = [];

    }


    return res.status(200).json({

      success: true,

      date:
        result.date || 
        new Date()
          .toISOString()
          .slice(0, 10),

      reference:
        result.reference || "",

      items:
        result.items

    });


  } catch (error) {

    console.error(
      "Invoice AI Error:",
      error
    );

    return res.status(500).json({

      error:
        error.message ||
        "Invoice processing failed"

    });

  }

}
