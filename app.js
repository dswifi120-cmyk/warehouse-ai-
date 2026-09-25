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

  const files =
    Array.from(invoiceInput.files || []);

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
// LOAD DATA
// ===============================

async function loadRows() {
  try {
    const { data, error } =
      await db
        .from("warehouse_entries")
        .select("*")
        .order("entry_date", {
          ascending: false
        })
        .order("created_at", {
          ascending: true
        });

    if (error) throw error;

    rows = (data || []).map(item => ({
      id: item.id,
      date: item.entry_date,
      product: item.product_name,
      quantity: Number(
        item.quantity || 0
      ),
      unit: item.unit || "pcs",
      reference: item.reference || "",
      entry_by: item.entry_by || ""
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
// UUID CHECK
// ===============================

function isUUID(value) {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      .test(value)
  );
}

// ===============================
// SAVE ROW
// ===============================

async function saveRow(row) {

  const payload = {
    entry_date:
      row.date ||
      new Date()
        .toISOString()
        .slice(0, 10),

    product_name:
      row.product ||
      "Unknown Product",

    quantity:
      Number(row.quantity || 0),

    unit:
      row.unit || "pcs",

    reference:
      row.reference || "",

    entry_by:
      row.entry_by ||
      userSelect.value
  };

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

    if (error) throw error;

    row.id = data.id;

    return row;
  }

  const { data, error } =
    await db
      .from("warehouse_entries")
      .insert(payload)
      .select()
      .single();

  if (error) throw error;

  row.id = data.id;

  return row;
}

// ===============================
// DELETE ROW
// ===============================

async function deleteRow(index) {

  const row = rows[index];

  if (!row) return;

  if (
    !confirm(
      `Delete "${row.product}"?`
    )
  ) {
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

      if (error) throw error;
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

  if (existingIndex !== -1) {

    rows[existingIndex].quantity =
      Number(
        rows[existingIndex].quantity || 0
      ) +
      Number(
        newRow.quantity || 0
      );

    const oldRef =
      rows[existingIndex]
        .reference || "";

    const newRef =
      newRow.reference || "";

    if (
      newRef &&
      !oldRef
        .split(",")
        .map(x => x.trim())
        .includes(newRef)
    ) {

      rows[existingIndex].reference =
        oldRef
          ? `${oldRef}, ${newRef}`
          : newRef;
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
              body: formData
            }
          );

        let result = {};

        try {

          result =
            await response.json();

        } catch (jsonError) {

          throw new Error(
            `Server returned invalid response. HTTP ${response.status}`
          );
        }

        // IMPORTANT:
        // Show the real backend error

        if (!response.ok) {

          const realError =
            result.details ||
            result.error ||
            `HTTP ${response.status}`;

          throw new Error(
            realError
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
          Array.isArray(
            result.items
          )
            ? result.items
            : [];

        if (!items.length) {

          console.warn(
            "No products found:",
            file.name
          );

          continue;
        }

        for (
          const item of items
        ) {

          const row = {

            date: date,

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

            reference:
              reference,

            entry_by:
              userSelect.value
          };

          addOrMergeRow(row);
        }
      }

      scanStatus.textContent =
        "💾 Saving data to database...";

      // Save new rows and
      // update merged existing rows

      for (
        const row of rows
      ) {

        await saveRow(row);
      }

      scanStatus.textContent =
        "✅ Scan completed and saved!";

      invoiceInput.value = "";

      selectedFiles.innerHTML = "";

      renderTable();

    } catch (error) {

      console.error(
        "AI
