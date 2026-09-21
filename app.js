// ==========================================
// WAREHOUSE AI - MAIN APP
// ==========================================


// ---------- SUPABASE CONFIG ----------
// পরে এখানে Supabase URL + Key বসানো হবে.

const SUPABASE_URL = "";
const SUPABASE_ANON_KEY = "";

let db = null;

if (SUPABASE_URL && SUPABASE_ANON_KEY) {
  db = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
  );
}


// ---------- GLOBAL DATA ----------

let selectedFiles = [];
let rows = [];


// ---------- ELEMENTS ----------

const invoiceInput =
  document.getElementById("invoiceInput");

const selectedFilesBox =
  document.getElementById("selectedFiles");

const scanButton =
  document.getElementById("scanButton");

const scanStatus =
  document.getElementById("scanStatus");

const userSelect =
  document.getElementById("userSelect");

const tableBody =
  document.getElementById("productTableBody");

const addRowButton =
  document.getElementById("addRowButton");

const filterButton =
  document.getElementById("filterButton");

const todayButton =
  document.getElementById("todayButton");

const printButton =
  document.getElementById("printButton");


// ---------- DATE ----------

function getToday() {

  const now = new Date();

  const year =
    now.getFullYear();

  const month =
    String(now.getMonth() + 1)
      .padStart(2, "0");

  const day =
    String(now.getDate())
      .padStart(2, "0");

  return `${year}-${month}-${day}`;
}


// ---------- FILE SELECT ----------

invoiceInput.addEventListener(
  "change",
  function () {

    selectedFiles =
      Array.from(this.files);

    selectedFilesBox.innerHTML = "";

    if (selectedFiles.length === 0) {
      return;
    }

    const title =
      document.createElement("div");

    title.innerHTML =
      `<strong>${selectedFiles.length}</strong>টি ছবি selected`;

    selectedFilesBox.appendChild(title);


    selectedFiles.forEach(
      (file, index) => {

        const item =
          document.createElement("div");

        item.textContent =
          `${index + 1}. ${file.name}`;

        selectedFilesBox.appendChild(item);

      }
    );

  }
);


// ---------- SCAN ----------

scanButton.addEventListener(
  "click",
  async function () {

    if (selectedFiles.length === 0) {

      alert(
        "আগে Invoice/Chalan-এর ছবি নির্বাচন করুন।"
      );

      return;
    }


    scanButton.disabled = true;

    scanStatus.textContent =
      "🤖 AI invoice scan শুরু হয়েছে...";


    try {

      for (
        let i = 0;
        i < selectedFiles.length;
        i++
      ) {

        scanStatus.textContent =
          `🤖 ${i + 1}/${selectedFiles.length} invoice scan হচ্ছে...`;

        const file =
          selectedFiles[i];

        const formData =
          new FormData();

        formData.append(
          "invoice",
          file
        );


        const response =
          await fetch(
            "/api/parse-invoice",
            {
              method: "POST",
              body: formData
            }
          );


        if (!response.ok) {

          throw new Error(
            "AI server error"
          );

        }


        const result =
          await response.json();


        if (
          result.items &&
          Array.isArray(result.items)
        ) {

          result.items.forEach(
            item => {

              addOrMergeRow({
                date:
                  result.date || getToday(),

                product:
                  item.product || "",

                quantity:
                  Number(item.quantity) || 0,

                unit:
                  item.unit || "pcs",

                reference:
                  result.reference || "",

                entry_by:
                  userSelect.value
              });

            }
          );

        }

      }


      scanStatus.textContent =
        "✅ সব invoice scan শেষ হয়েছে।";


      renderTable();


    } catch (error) {

      console.error(error);

      scanStatus.textContent =
        "❌ Scan করতে সমস্যা হয়েছে।";

      alert(
        "AI scan করতে সমস্যা হয়েছে। পরে আবার চেষ্টা করুন।"
      );

    } finally {

      scanButton.disabled = false;

    }

  }
);


// ---------- ADD / MERGE ----------

function normalizeProductName(name) {

  return String(name)
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

}


function addOrMergeRow(item) {

  const normalized =
    normalizeProductName(
      item.product
    );


  const existing =
    rows.find(
      row =>
        normalizeProductName(
          row.product
        ) === normalized
        &&
        row.unit === item.unit
        &&
        row.date === item.date
    );


  if (existing) {

    existing.quantity =
      Number(existing.quantity)
      +
      Number(item.quantity);


    if (
      item.reference &&
      !existing.reference.includes(
        item.reference
      )
    ) {

      existing.reference +=
        existing.reference
          ? `, ${item.reference}`
          : item.reference;

    }


    if (
      existing.entry_by !==
      item.entry_by
    ) {

      const names =
        existing.entry_by
          .split(", ")
          .filter(Boolean);

      if (
        !names.includes(
          item.entry_by
        )
      ) {

        names.push(
          item.entry_by
        );

      }

      existing.entry_by =
        names.join(", ");

    }

  } else {

    rows.push({
      id:
        Date.now() +
        Math.random(),

      date:
        item.date || getToday(),

      product:
        item.product || "",

      quantity:
        Number(item.quantity) || 0,

      unit:
        item.unit || "pcs",

      reference:
        item.reference || "",

      entry_by:
        item.entry_by ||
        userSelect.value

    });

  }

}


// ---------- RENDER TABLE ----------

function renderTable() {

  tableBody.innerHTML = "";


  rows.forEach(
    (row, index) => {

      const tr =
        document.createElement("tr");


      tr.innerHTML = `

        <td>
          <input
            type="date"
            value="${escapeHtml(row.date)}"
            onchange="updateRow(${index}, 'date', this.value)"
          >
        </td>

        <td>
          <input
            type="text"
            value="${escapeHtml(row.product)}"
            onchange="updateRow(${index}, 'product', this.value)"
          >
        </td>

        <td>
          <input
            type="number"
            min="0"
            value="${row.quantity}"
            onchange="updateRow(${index}, 'quantity', this.value)"
          >
        </td>

        <td>
          <input
            type="text"
            value="${escapeHtml(row.unit)}"
            onchange="updateRow(${index}, 'unit', this.value)"
          >
        </td>

        <td>
          <input
            type="text"
            value="${escapeHtml(row.reference)}"
            onchange="updateRow(${index}, 'reference', this.value)"
          >
        </td>

        <td>
          ${escapeHtml(row.entry_by)}
        </td>

        <td>
          <button
            class="delete-btn"
            onclick="deleteRow(${index})"
          >
            Delete
          </button>
        </td>

      `;


      tableBody.appendChild(tr);

    }
  );


  updateSummary();

}


// ---------- UPDATE ----------

window.updateRow =
  function (
    index,
    field,
    value
  ) {

    if (
      field === "quantity"
    ) {

      value =
        Number(value) || 0;

    }


    rows[index][field] =
      value;

  };


// ---------- DELETE ----------

window.deleteRow =
  function (index) {

    if (
      !confirm(
        "এই row delete করবেন?"
      )
    ) {

      return;

    }


    rows.splice(
      index,
      1
    );

    renderTable();

  };


// ---------- ADD MANUAL ROW ----------

addRowButton.addEventListener(
  "click",
  function () {

    rows.push({

      id:
        Date.now(),

      date:
        getToday(),

      product:
        "",

      quantity:
        0,

      unit:
        "pcs",

      reference:
        "",

      entry_by:
        userSelect.value

    });


    renderTable();

  }
);


// ---------- SUMMARY ----------

function updateSummary() {

  document.getElementById(
    "totalRows"
  ).textContent =
    rows.length;


  document.getElementById(
    "totalProducts"
  ).textContent =
    rows.reduce(
      (total, row) =>
        total +
        Number(row.quantity || 0),
      0
    );

}


// ---------- TODAY ----------

todayButton.addEventListener(
  "click",
  function () {

    const today =
      getToday();

    document.getElementById(
      "fromDate"
    ).value = today;

    document.getElementById(
      "toDate"
    ).value = today;

    filterRows();

  }
);


// ---------- FILTER ----------

filterButton.addEventListener(
  "click",
  function () {

    filterRows();

  }
);


function filterRows() {

  const from =
    document.getElementById(
      "fromDate"
    ).value;

  const to =
    document.getElementById(
      "toDate"
    ).value;


  if (!from && !to) {

    renderTable();

    return;

  }


  const filtered =
    rows.filter(
      row => {

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

      }
    );


  const original =
    rows;

  rows =
    filtered;

  renderTable();

  rows =
    original;

}


// ---------- PRINT ----------

printButton.addEventListener(
  "click",
  function () {

    createPrint();

    window.print();

  }
);


function createPrint() {

  const printArea =
    document.getElementById(
      "printArea"
    );


  const from =
    document.getElementById(
      "fromDate"
    ).value;


  const to =
    document.getElementById(
      "toDate"
    ).value;


  let data =
    rows;


  if (from || to) {

    data =
      rows.filter(
        row => {

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

        }
      );

  }


  let html = `

    <div class="print-title">

      <h2>Warehouse OUT Report</h2>

      <p>
        ${from || "All"} 
        to 
        ${to || "All"}
      </p>

    </div>

    <table>

      <thead>

        <tr>

          <th>Date</th>
          <th>Product</th>
          <th>Quantity</th>
          <th>Unit</th>
          <th>Invoice / Chalan</th>
          <th>Entry By</th>

        </tr>

      </thead>

      <tbody>

  `;


  data.forEach(
    row => {

      html += `

        <tr>

          <td>${escapeHtml(row.date)}</td>

          <td>${escapeHtml(row.product)}</td>

          <td>${row.quantity}</td>

          <td>${escapeHtml(row.unit)}</td>

          <td>${escapeHtml(row.reference)}</td>

          <td>${escapeHtml(row.entry_by)}</td>

        </tr>

      `;

    }
  );


  html += `

      </tbody>

    </table>

  `;


  printArea.innerHTML =
    html;

}


// ---------- SECURITY ----------

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


// ---------- INITIAL ----------

renderTable();
