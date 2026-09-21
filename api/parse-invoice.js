import formidable from "formidable";
import fs from "fs";

export const config = {
  api: {
    bodyParser: false
  }
};


export default async function handler(
  req,
  res
) {

  if (req.method !== "POST") {

    return res.status(405).json({
      error: "Method not allowed"
    });

  }


  try {

    const form =
      formidable({
        multiples: false
      });


    const [fields, files] =
      await form.parse(req);


    const uploaded =
      files.invoice?.[0];


    if (!uploaded) {

      return res.status(400).json({
        error: "Invoice image missing"
      });

    }


    /*
      AI OCR CODE WILL BE CONNECTED
      HERE IN THE NEXT STEP.

      For now this endpoint confirms
      that the image reached the server.
    */


    const imageBuffer =
      fs.readFileSync(
        uploaded.filepath
      );


    console.log(
      "Image received:",
      imageBuffer.length
    );


    return res.status(200).json({

      success: true,

      date:
        new Date()
          .toISOString()
          .slice(0, 10),

      reference:
        "",

      items: []

    });


  } catch (error) {

    console.error(error);

    return res.status(500).json({

      error:
        "Invoice processing failed"

    });

  }

}
