async function loadDocuments() {
    const response = await fetch("/repairs");
    const repairs = await response.json();

    const approvedWithFiles = repairs.filter(
        r =>
            r.quotation_status === "Approved" &&
            (r.quotation_file || r.quote_file)
    );

    const container = document.getElementById("approvedDocuments");

    if (approvedWithFiles.length === 0) {
        container.innerHTML = "<p>No approved quotation documents yet.</p>";
        return;
    }

    container.innerHTML = approvedWithFiles.map(repair => `
        <div class="quote-card approved-card">
            <div class="quote-header">
                <div>
                    <h3>${repair.property_name} - Unit ${repair.unit_number || ""}</h3>
                    <p>${repair.description || repair.issue || ""}</p>
                    <p><strong>Amount:</strong> $${repair.quotation_amount || 0}</p>
                    <p><strong>Status:</strong> ${repair.quotation_status}</p>
                </div>

                <div class="amount-badge">
                    $${repair.quotation_amount || 0}
                </div>
            </div>

            <a class="download-link"
               href="${repair.quotation_file || repair.quote_file}"
               target="_blank">
               Download Quote
            </a>
        </div>
    `).join("");
}

loadDocuments();