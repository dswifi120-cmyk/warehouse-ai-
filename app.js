// ===============================
// SUPABASE CONFIG
// ===============================

const SUPABASE_URL =
  "https://ogcjzkqeijayawxlhmch.supabase.co";

const SUPABASE_ANON_KEY =
  "sb_publishable_wazNbKZiZVls_ENkZ-ElkA_VaAS1BUf";

const db = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);


// ===============================
// VERCEL AI API
// ===============================

const AI_API_URL =
  "https://warehouse-ai-dun.vercel.app/api/parse-invoice";


// ===============================
// GLOBAL DATA
// ===============================

let rows = [];


// ===============================
// ELEMENTS
// ===============================

const invoiceInput =
  document.getElementById("invoiceInput");

const selectedFiles =
  document.getElementById("selectedFiles");

const scanButton =
  document.getElementById("scanButton");

const scanStatus =
  document.getElementById("scanStatus");

const userSelect =
  document.getElementById("userSelect");

const tableBody =
  document.getElementById("productTableBody");

const totalRows =
  document.getElementById("totalRows");

const totalProducts =
  document.getElementById("totalProducts");

const fromDate =
  document.getElementById("fromDate");

const toDate =
  document.getElementById("toDate");

const filterButton =
  document.getElementById("filterButton");

const todayButton =
  document.getElementById("todayButton");

const printButton =
  document.getElementById("printButton");

const addRowButton =
  document.getElementById("addRowButton");


// ===============================
// FILE SELECTION
// ===============================

invoiceInput.addEventListener("change", () => {

  selectedFiles.innerHTML = "";

  const files = Array.from(
    invoiceInput.files || []
  );

  if (!files.length) {
    selectedFiles.textContent =
      "No image selected";
    return;
  }

  files.forEach((file, index) => {

    const div =
      document.createElement("div");

    div.textContent =
      `${index + 1}. ${file.name}`;

    selectedFiles.appendChild(div);

  });

});


// ===============================
// LOAD DATA FROM SUPABASE
// ===============================

async function loadRows() {

  try {

    const { data, error } =
      await db
        .from("warehouse_entries")
        .select("*")
        .order("entry_date", {
          ascending: false,
        })
        .order("created_at", {
          ascending: true,
        });

    if (error) {
      throw error;
    }

    rows = (data || []).map(item => ({

      id: item.id,

      date: item.entry_date,

      product: item.product_name,

      quantity: Number(item.quantity || 0),

      unit: item.unit || "pcs",

      reference:
        item.reference || "",

      entry_by:
        item.entry_by || "",

    }));

    renderTable();

  } catch (error) {

    console.error(error);

    alert(
      "Supabase data load failed:\n" +
      error.message
    );

  }

}


// ===============================
// SAVE ONE ROW
// ===============================

async function saveRow(row) {

  const payload = {

    entry_date:
      row.date ||
      new Date()
        .toISOString()
        .slice(0, 10),

    product_name:
      row.product || "Unknown Product",

    quantity:
      Number(row.quantity || 0),

    unit:
      row.unit || "pcs",

    reference:
      row.reference || "",

    entry_by:
      row.entry_by ||
      userSelect.value,

  };


  // Existing database row
  if (
    row.id &&
    isUUID(row.id)
  ) {

    const { data, error } =
      await db
        .from("warehouse_entries")
        .update(payload)
        .eq("id", row.id)
        .select()
        .single();

    if (error) {
      throw error;
    }

    row.id = data.id;

    return row;
  }


  // New row
  const { data, error } =
    await db
      .from("warehouse_entries")
      .insert(payload)
      .select()
      .single();

  if (error) {
    throw error;
  }

  row.id = data.id;

  return row;

}


// ===============================
// DELETE ROW
// ===============================

async function deleteRow(index) {

  const row = rows[index];

  if (!row) return;

  const confirmDelete =
    confirm(
      `Delete "${row.product}"?`
    );

  if (!confirmDelete) {
    return;
  }


  try {

    if (
      row.id &&
      isUUID(row.id)
    ) {

      const { error } =
        await db
          .from("warehouse_entries")
          .delete()
          .eq("id", row.id);

      if (error) {
        throw error;
      }

    }

    rows.splice(index, 1);

    renderTable();

  } catch (error) {

    alert(
      "Delete failed:\n" +
      error.message
    );

  }

}


// ===============================
// CHECK UUID
// ===============================

function isUUID(value) {

  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value
    );

}


// ===============================
// ADD / MERGE ROW
// ===============================

function addOrMergeRow(newRow) {

  const existingIndex =
    rows.findIndex(row =>

      row.date === newRow.date &&

      row.product
        .trim()
        .toLowerCase() ===
      newRow.product
        .trim()
        .toLowerCase() &&

      row.unit === newRow.unit
    );


  // Merge same product/date/unit
  if (existingIndex !== -1) {

    rows[existingIndex].quantity =
      Number(rows[existingIndex].quantity || 0) +
      Number(newRow.quantity || 0);

    if (
      newRow.reference &&
      !rows[existingIndex].reference
        .split(",")
        .map(x => x.trim())
        .includes(newRow.reference)
    ) {

      rows[existingIndex].reference =
        rows[existingIndex].reference
          ? `${rows[existingIndex].reference}, ${newRow.reference}`
          : newRow.reference;

    }

    return rows[existingIndex];
  }


  rows.push(newRow);

  return newRow;

}


// ===============================
// SCAN WITH AI
// ===============================

scanButton.addEventListener(
  "click",
  async () => {

    const files =
      Array.from(
        invoiceInput.files || []
      );

    if (!files.length) {

      alert(
        "Please select invoice/chalan image first."
      );

      return;
    }


    scanButton.disabled = true;

    scanStatus.textContent =
      "🤖 AI scanning... Please wait";


    try {

      for (
        let i = 0;
        i < files.length;
        i++
      ) {

        const file = files[i];

        scanStatus.textContent =
          `🤖 Scanning ${i + 1} of ${files.length}...`;


        const formData =
          new FormData();

        formData.append(
          "invoice",
          file
        );


        const response =
          await fetch(
            AI_API_URL,
            {
              method: "POST",
              body: formData,
            }
          );


        const result =
          await response.json();


        if (!response.ok) {

          throw new Error(
            result.error ||
            "AI scanning failed"
          );

        }


        const date =
          result.date ||
          new Date()
            .toISOString()
            .slice(0, 10);

        const reference =
          result.reference || "";


        const items =
          Array.isArray(result.items)
            ? result.items
            : [];


        if (!items.length) {

          console.warn(
            "No products found:",
            file.name
          );

          continue;

        }


        for (const item of items) {

          const row = {

            date,

            product:
              item.product ||
              "Unknown Product",

            quantity:
              Number(
                item.quantity || 0
              ),

            unit:
              item.unit ||
              "pcs",

            reference,

            entry_by:
              userSelect.value,

          };


          addOrMergeRow(row);

        }

      }


      // Save all rows
      scanStatus.textContent =
        "💾 Saving data to database...";


      for (const row of rows) {

        if (
          row.id &&
          isUUID(row.id)
        ) {

          continue;

        }

        await saveRow(row);

      }


      scanStatus.textContent =
        "✅ Scan completed and saved!";

      invoiceInput.value = "";

      selectedFiles.innerHTML = "";

      renderTable();


    } catch (error) {

      console.error(error);

      scanStatus.textContent =
        "❌ Scan failed";

      alert(
        "AI Scan Error:\n" +
        error.message
      );

    } finally {

      scanButton.disabled = false;

    }

  }
);


// ===============================
// RENDER TABLE
// ===============================

function renderTable() {

  tableBody.innerHTML = "";


  let filteredRows =
    getFilteredRows();


  filteredRows.forEach(
    (row, filteredIndex) => {

      const realIndex =
        rows.indexOf(row);


      const tr =
        document.createElement("tr");


      tr.innerHTML = `

        <td>
          <input
            type="date"
            value="${escapeHtml(row.date || "")}"
            data-field="date"
          >
        </td>

        <td>
          <input
            type="text"
            value="${escapeHtml(row.product || "")}"
            data-field="product"
          >
        </td>

        <td>
          <input
            type="number"
            value="${Number(row.quantity || 0)}"
            data-field="quantity"
          >
        </td>

        <td>
          <input
            type="text"
            value="${escapeHtml(row.unit || "pcs")}"
            data-field="unit"
          >
        </td>

        <td>
          <input
            type="text"
            value="${escapeHtml(row.reference || "")}"
            data-field="reference"
          >
        </td>

        <td>
          <input
            type="text"
            value="${escapeHtml(row.entry_by || "")}"
            data-field="entry_by"
          >
        </td>

        <td>

          <button
            class="save-row"
            data-index="${realIndex}"
          >
            💾
          </button>

          <button
            class="delete-row"
            data-index="${realIndex}"
          >
            🗑️
          </button>

        </td>

      `;


      tableBody.appendChild(tr);

    }
  );


  updateSummary(
    filteredRows
  );


  // Save buttons
  document
    .querySelectorAll(".save-row")
    .forEach(button => {

      button.addEventListener(
        "click",
        async () => {

          const index =
            Number(
              button.dataset.index
            );

          const row =
            rows[index];

          const tr =
            button.closest("tr");


          tr
            .querySelectorAll(
              "input"
            )
            .forEach(input => {

              const field =
                input.dataset.field;

              if (
                field === "quantity"
              ) {

                row[field] =
                  Number(
                    input.value || 0
                  );

              } else {

                row[field] =
                  input.value;

              }

            });


          try {

            await saveRow(row);

            alert(
              "✅ Saved successfully"
            );

            renderTable();

          } catch (error) {

            alert(
              "Save failed:\n" +
              error.message
            );

          }

        }
      );

    });


  // Delete buttons
  document
    .querySelectorAll(".delete-row")
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          deleteRow(
            Number(
              button.dataset.index
            )
          );

        }
      );

    });

}


// ===============================
// FILTER
// ===============================

function getFilteredRows() {

  const from =
    fromDate.value;

  const to =
    toDate.value;


  return rows.filter(row => {

    if (
      from &&
      row.date < from
    ) {

      return false;

    }


    if (
      to &&
      row.date > to
    ) {

      return false;

    }


    return true;

  });

}


filterButton.addEventListener(
  "click",
  () => {

    renderTable();

  }
);


// ===============================
// TODAY
// ===============================

todayButton.addEventListener(
  "click",
  () => {

    const today =
      new Date()
        .toISOString()
        .slice(0, 10);

    fromDate.value = today;

    toDate.value = today;

    renderTable();

  }
);


// ===============================
// ADD MANUAL PRODUCT
// ===============================

addRowButton.addEventListener(
  "click",
  async () => {

    const row = {

      date:
        new Date()
          .toISOString()
          .slice(0, 10),

      product: "",

      quantity: 0,

      unit: "pcs",

      reference: "",

      entry_by:
        userSelect.value,

    };


    rows.unshift(row);

    renderTable();

  }
);


// ===============================
// PRINT
// ===============================

printButton.addEventListener(
  "click",
  () => {

    const printArea =
      document.getElementById(
        "printArea"
      );

    const filteredRows =
      getFilteredRows();


    let html = `

      <h2>Warehouse Daily OUT Report</h2>

      <table border="1"
             cellspacing="0"
             cellpadding="6"
             style="width:100%;border-collapse:collapse">

        <thead>

          <tr>
            <th>Date</th>
            <th>Product Name</th>
            <th>Quantity</th>
            <th>Unit</th>
            <th>Invoice / Chalan</th>
            <th>Entry By</th>
          </tr>

        </thead>

        <tbody>
    `;


    filteredRows.forEach(row => {

      html += `

        <tr>

          <td>${escapeHtml(row.date)}</td>

          <td>${escapeHtml(row.product)}</td>

          <td>${Number(row.quantity || 0)}</td>

          <td>${escapeHtml(row.unit)}</td>

          <td>${escapeHtml(row.reference)}</td>

          <td>${escapeHtml(row.entry_by)}</td>

        </tr>

      `;

    });


    html += `

        </tbody>

      </table>

    `;


    printArea.innerHTML = html;


    const win =
      window.open(
        "",
        "_blank"
      );


    win.document.write(`

      <html>

        <head>

          <title>Warehouse Report</title>

          <style>

            body {
              font-family: Arial;
              padding: 20px;
            }

            table {
              width: 100%;
              border-collapse: collapse;
            }

            th,
            td {
              border: 1px solid #000;
              padding: 6px;
            }

            th {
              font-weight: bold;
            }

          </style>

        </head>

        <body>

          ${html}

        </body>

      </html>

    `);


    win.document.close();

    win.print();

  }
);


// ===============================
// SUMMARY
// ===============================

function updateSummary(
  filteredRows
) {

  totalRows.textContent =
    filteredRows.length;


  const total =
    filteredRows.reduce(
      (sum, row) =>
        sum +
        Number(
          row.quantity || 0
        ),
      0
    );


  totalProducts.textContent =
    total;

}


// ===============================
// ESCAPE HTML
// ===============================

function escapeHtml(value) {

  return String(value ?? "")
    .replace(
      /&/g,
      "&amp;"
    )
    .replace(
      /</g,
      "&lt;"
    )
    .replace(
      />/g,
      "&gt;"
    )
    .replace(
      /"/g,
      "&quot;"
    )
    .replace(
      /'/g,
      "&#039;"
    );

}


// ===============================
// START APP
// ===============================

loadRows();
