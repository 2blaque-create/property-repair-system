async function loadTenantDirectory() {
    const response = await fetch("/repairs");
    const repairs = await response.json();

    const tenantMap = {};

    repairs.forEach(repair => {
        const key = `${repair.property_name}-${repair.unit_number}`;

        if (!tenantMap[key]) {
            tenantMap[key] = {
                property: repair.property_name || "Unknown Property",
                unit: repair.unit_number || "-",
                tenant: repair.tenant_name || repair.contact_name || "-",
                phone: repair.tenant_phone || repair.contact_phone || "-",
                repairs: 0
            };
        }

        tenantMap[key].repairs += 1;
    });

    const tenants = Object.values(tenantMap);

    const container = document.getElementById("tenantDirectory");

    if (tenants.length === 0) {
        container.innerHTML = "<p>No tenant records found yet.</p>";
        return;
    }

    container.innerHTML = `
        <table class="data-table">
            <thead>
                <tr>
                    <th>Property</th>
                    <th>Unit</th>
                    <th>Tenant / Contact</th>
                    <th>Phone</th>
                    <th>Repairs Logged</th>
                </tr>
            </thead>
            <tbody>
                ${tenants.map(t => `
                    <tr>
                        <td>${t.property}</td>
                        <td>${t.unit}</td>
                        <td>${t.tenant}</td>
                        <td>${t.phone}</td>
                        <td>${t.repairs}</td>
                    </tr>
                `).join("")}
            </tbody>
        </table>
    `;
}

loadTenantDirectory();