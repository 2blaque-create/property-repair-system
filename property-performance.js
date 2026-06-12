async function loadPropertyPerformance() {
    const response = await fetch("/repairs");
    const repairs = await response.json();

    const propertyStats = {};

    repairs.forEach(repair => {
        const property = repair.property_name || "Unknown Property";
        const amount = Number(repair.quotation_amount || 0);

        if (!propertyStats[property]) {
            propertyStats[property] = {
                repairs: 0,
                approvedRepairs: 0,
                spend: 0
            };
        }

        propertyStats[property].repairs += 1;

        if (repair.quotation_status === "Approved") {
            propertyStats[property].approvedRepairs += 1;
            propertyStats[property].spend += amount;
        }
    });

    const statsArray = Object.entries(propertyStats);

    const totalProperties = statsArray.length;
    const totalRepairs = repairs.length;
    const totalSpend = statsArray.reduce(
        (sum, [, stats]) => sum + stats.spend,
        0
    );

    document.getElementById("performanceCards").innerHTML = `
        <div class="summary-card">
            <h3>Total Properties</h3>
            <h1>${totalProperties}</h1>
        </div>

        <div class="summary-card">
            <h3>Total Repairs</h3>
            <h1>${totalRepairs}</h1>
        </div>

        <div class="summary-card">
            <h3>Total Approved Spend</h3>
            <h1>$${totalSpend}</h1>
        </div>
    `;

    document.getElementById("propertyPerformance").innerHTML =
        statsArray.map(([property, stats]) => `
            <div class="quote-card approved-card">
                <div class="quote-header">
                    <div>
                        <h3>${property}</h3>
                        <p><strong>Total Repairs:</strong> ${stats.repairs}</p>
                        <p><strong>Approved Repairs:</strong> ${stats.approvedRepairs}</p>
                        <p><strong>Total Spend:</strong> $${stats.spend}</p>
                    </div>

                    <div class="amount-badge">
                        $${stats.spend}
                    </div>
                </div>
            </div>
        `).join("");
}

loadPropertyPerformance();