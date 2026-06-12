async function loadQuotes() {
    const response = await fetch("/repairs");
    const repairs = await response.json();
    console.log(repairs);

    const pending = repairs.filter(
        r => r.quotation_status === "Pending"
    );

    const approved = repairs.filter(
        r => r.quotation_status === "Approved"
    );
      console.log("Approved quotations:", approved);

    const totalSpend = approved.reduce(
    (sum, repair) => sum + Number(repair.quotation_amount || 0),
    0
);

const summaryCards = document.getElementById("summaryCards");

summaryCards.innerHTML = `
    <div class="summary-card">
        <h3>Pending Quotes</h3>
        <h1>${pending.length}</h1>
    </div>

    <div class="summary-card">
        <h3>Approved Quotations</h3>
        <h1>${approved.length}</h1>
    </div>

    <div class="summary-card">
        <h3>Total Spend</h3>
        <h1>$${totalSpend}</h1>
    </div>
`;
    const pendingContainer = document.getElementById("pendingQuotes");
    const approvedContainer = document.getElementById("approvedQuotes");

    if (pending.length === 0) {
        pendingContainer.innerHTML = "<p>No pending quotations.</p>";
    } else {
        pendingContainer.innerHTML = pending.map(repair => `
            <div style="border:1px solid #ccc; padding:15px; margin:15px;">
                <h3>${repair.property_name} - Unit ${repair.unit_number || ""}</h3>
                <p><strong>Issue:</strong> ${repair.description || repair.issue || ""}</p>
                <p><strong>Quote Amount:</strong> $${repair.quotation_amount || ""}</p>
                <p><strong>Quote Notes:</strong> ${repair.quotation_notes || ""}</p>

                ${repair.quotation_file || repair.quote_file ? `
                    <p>
                        <a href="${repair.quotation_file || repair.quote_file}" target="_blank">
                            Download Quote
                        </a>
                    </p>
                ` : ""}

                <button onclick="approveQuote('${repair.repair_id}')">
                    Approve Quote
                </button>

                <button onclick="declineQuote('${repair.repair_id}')">
                    Decline Quote
                </button>
            </div>
        `).join("");
    }

    if (approved.length === 0) {
    approvedContainer.innerHTML = "<p>No approved quotations yet.</p>";
} else {
    approvedContainer.innerHTML = approved.map(repair => `
        <div class="quote-card approved-card">
            <div class="quote-header">
                <div>
                    <h3>${repair.property_name} - Unit ${repair.unit_number || ""}</h3>
                    <p>${repair.description || repair.issue || ""}</p>
                </div>

                <div class="amount-badge">
                    $${repair.quotation_amount || 0}
                </div>
            </div>

            <p><strong>Status:</strong> ${repair.quotation_status}</p>

            ${
                repair.quotation_file || repair.quote_file
                ? `
                    <a class="download-link"
                       href="${repair.quotation_file || repair.quote_file}"
                       target="_blank">
                       Download Quote
                    </a>
                  `
                : ""
            }
        </div>
    `).join("");
}
}

async function approveQuote(repairId) {
    await fetch(`/repairs/${repairId}/quote-decision`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            decision: "Approved",
            landlord_notes: ""
        })
    });

    loadQuotes();
}

async function declineQuote(repairId) {
    const reason = prompt("Reason for declining?") || "";

    await fetch(`/repairs/${repairId}/quote-decision`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            decision: "Declined",
            landlord_notes: reason
        })
    });

    loadQuotes();
}

loadQuotes();