async function loadFinancialSummary() {
    const response = await fetch("/repairs");
    const repairs = await response.json();

    const approved = repairs.filter(
        r => r.quotation_status === "Approved"
    );

    const totalSpend = approved.reduce(
        (sum, repair) => sum + Number(repair.quotation_amount || 0),
        0
    );

    const averageCost = approved.length
        ? Math.round(totalSpend / approved.length)
        : 0;

    const amounts = approved.map(
        repair => Number(repair.quotation_amount || 0)
    );

    const highestRepair = amounts.length ? Math.max(...amounts) : 0;
    const lowestRepair = amounts.length ? Math.min(...amounts) : 0;

    const cards = document.getElementById("financialCards");

    cards.innerHTML = `
        <div class="summary-card">
            <h3>Total Approved Repairs</h3>
            <h1>${approved.length}</h1>
        </div>

        <div class="summary-card">
            <h3>Total Spend</h3>
            <h1>$${totalSpend}</h1>
        </div>

        <div class="summary-card">
            <h3>Average Repair Cost</h3>
            <h1>$${averageCost}</h1>
        </div>

        <div class="summary-card">
            <h3>Highest Repair</h3>
            <h1>$${highestRepair}</h1>
        </div>

        <div class="summary-card">
        <h3>Lowest Repair</h3>
        <h1>$${lowestRepair}</h1>
        </div>

        <div class="summary-card">
        <h3>Completed Repairs</h3>
        <h1>${repairs.filter(r => r.status === "Completed").length}</h1>
        </div>

        <div class="summary-card">
        <h3>Outstanding Quotes</h3>
        <h1>${repairs.filter(r => r.quotation_status === "Pending").length}</h1>
        </div>

        <div class="summary-card">
        <h3>High Priority Repairs</h3>
        <h1>${repairs.filter(r => r.priority === "High").length}</h1>
        </div>
        `;

    const spendByProperty = {};
    const spendBySupplier = {}; 


    approved.forEach(repair => {

    const property = repair.property_name || "Unknown Property";
    const amount = Number(repair.quotation_amount || 0);

    const supplier = repair.technician || "Unassigned";

    if (!spendBySupplier[supplier]) {
        spendBySupplier[supplier] = 0;
    }

    spendBySupplier[supplier] += amount;

    if (!spendByProperty[property]) {
        spendByProperty[property] = 0;
    }

    spendByProperty[property] += amount;

});

    const spendContainer = document.getElementById("spendByProperty");

    spendContainer.innerHTML = Object.entries(spendByProperty)
        .map(([property, amount]) => `
            <div class="quote-card approved-card">
                <div class="quote-header">
                    <div>
                        <h3>${property}</h3>
                        <p>Total approved repair spend</p>
                    </div>

                    <div class="amount-badge">
                        USD ${amount.toLocaleString()}
                    </div>
                </div>
            </div>
        `)
        .join("");

const supplierContainer = document.getElementById("spendBySupplier");

supplierContainer.innerHTML = Object.entries(spendBySupplier)
  .sort((a, b) => b[1] - a[1])
  .map(([supplier, amount]) => `
    <div class="quote-card approved-card">
      <div class="quote-header">
        <div>
          <h3>${supplier}</h3>
          <p>Total approved supplier spend</p>
        </div>

        <div class="amount-badge">
            USD ${amount.toLocaleString()}
         </div>
      </div>
    </div>
  `)
  .join("");
}

loadFinancialSummary();