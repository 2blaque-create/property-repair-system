require("dotenv").config();
const twilio = require("twilio");

const technicianPhones = {
  "AquaFlow Plumbing": "whatsapp:+263773402513",
  "AquaFlow Plumbing": "whatsapp:+263773402513",
  "Bright Spark Electrical": "whatsapp:+263773402513",
  "Moyo Plumbing": "whatsapp:+263773402513",
  "BuildRight Maintenance": "whatsapp:+263773402513"
};

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const suppliersFile = path.join(__dirname, "suppliers.json");
const propertyDefaultsFile = path.join(__dirname, "property_defaults.json");
const propertiesFile = path.join(__dirname, "properties.json");

function readSuppliers() {
  try {
    const data = fs.readFileSync(suppliersFile, "utf8");
    return JSON.parse(data || "[]");
  } catch (error) {
    return [];
  }
}
function readProperties() {
  try {
    const data = fs.readFileSync(propertiesFile, "utf8");
    return JSON.parse(data || "[]");
  } catch (error) {
    return [];
  }
}

function writeSuppliers(suppliers) {
  fs.writeFileSync(suppliersFile, JSON.stringify(suppliers, null, 2));
}
function writeProperties(properties) {
  fs.writeFileSync(
    propertiesFile,
    JSON.stringify(properties, null, 2)
  );
}
function readPropertyDefaults() {
  try {
    const data = fs.readFileSync(propertyDefaultsFile, "utf8");
    return JSON.parse(data || "[]");
  } catch (error) {
    return [];
  }
}

function getPropertyDefaultSupplier(propertyName, trade) {
  if (!propertyName || !trade) return null;

  const defaults = readPropertyDefaults();

  const property = defaults.find(
    (p) =>
      p.property_name &&
      p.property_name.trim().toLowerCase() === propertyName.trim().toLowerCase()
  );

  if (!property) return null;

  return property[trade.trim().toLowerCase()] || null;
}
function normalizeTrade(trade) {
  return trade
    .toLowerCase()
    .replace(/_/g, " ")
    .trim();
}

function getSupplierByTrade(trade) {
  if (!trade) return null;

  const suppliers = readSuppliers();
  const repairs = readRepairs();

  const matchingSuppliers = suppliers.filter(
  (supplier) =>
    supplier.trade &&
    supplier.active &&
    normalizeTrade(supplier.trade) === normalizeTrade(trade)        
  );

  if (matchingSuppliers.length === 0) {
    return null;
  }

  const suppliersWithWorkload = matchingSuppliers.map((supplier) => {
    const activeJobs = repairs.filter(
      (repair) =>
        repair.technician === supplier.name &&
        repair.status !== "Completed"
    ).length;

    return {
      ...supplier,
      workload: activeJobs,
    };
  });

  suppliersWithWorkload.sort((a, b) => a.workload - b.workload);

  return suppliersWithWorkload[0];
}

const app = express();

app.use("/uploads", express.static("uploads", {
  fallthrough: false
}));
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
function findRepairById(repairs, repairId) {
  return repairs.find(r => r.repair_id === repairId);
}
async function notifyTenant(repair, message) {
  try {
    let tenantPhone = repair.people?.tenant?.phone;

    if (!tenantPhone) {
      console.log("❌ No tenant phone for", repair.repair_id);
      return;
    }

    if (tenantPhone.startsWith("0")) {
      tenantPhone = "+263" + tenantPhone.slice(1);
    } else if (!tenantPhone.startsWith("+")) {
      tenantPhone = "+263" + tenantPhone;
    }

    const to = tenantPhone.startsWith("whatsapp:")
      ? tenantPhone
      : `whatsapp:${tenantPhone}`;

    await sendWhatsApp(to, message);
    console.log("✅ Tenant notified:", repair.repair_id);
  } catch (error) {
    console.error("❌ Tenant notification error:", error.message || error);
  }
}
async function notifyCaretaker(repair, message) {
  try {
    let phone = repair.people?.caretaker?.phone;

    if (!phone) {
      console.log("❌ No caretaker phone for", repair.repair_id);
      return;
    }

    // Normalize number
    if (phone.startsWith("0")) {
      phone = "+263" + phone.slice(1);
    } else if (!phone.startsWith("+")) {
      phone = "+263" + phone;
    }

    const to = phone.startsWith("whatsapp:")
      ? phone
      : `whatsapp:${phone}`;

    await sendWhatsApp(to, message);

    console.log("👷 Caretaker notified:", repair.repair_id);

  } catch (error) {
    console.error("❌ Caretaker notification error:", error.message || error);
  }
}
async function notifyLandlord(repair, message) {
  try {
    let phone = repair.landlord_phone;

    if (!phone) {
      console.log("❌ No landlord phone for", repair.repair_id);
      return;
    }

    const to = phone.startsWith("whatsapp:")
      ? phone
      : `whatsapp:${phone}`;

    await sendWhatsApp(to, message);
    console.log("🏠 Landlord notified:", repair.repair_id);

  } catch (error) {
    console.error("❌ Landlord notification error:", error.message || error);
  }
}
app.post("/whatsapp-reply", async (req, res) => {
  console.log("🔥 WEBHOOK HIT");
  console.log("🔥 FULL BODY:", req.body);

  try {
    const incomingMessage = (req.body.Body || "").trim();
    console.log("📩 Message:", incomingMessage);

    const repairs = readRepairs();
    const incoming = incomingMessage.toLowerCase();
    const repairIdMatch = incoming.match(/r\d+/i);
    const repairId = repairIdMatch ? repairIdMatch[0].toUpperCase() : "";

    let command = "";
    let extraText = "";

   if (
  incoming.includes("accept") ||
  incoming === "yes" ||
  incoming.startsWith("yes ") ||
  incoming === "ok" ||
  incoming.startsWith("ok ")
) {
  command = "ACCEPT";

} else if (
  incoming.includes("decline") ||
  incoming === "no" ||
  incoming.startsWith("no ")
) {
  command = "DECLINE";

} else if (incoming.startsWith("time")) {
  command = "TIME";
  extraText = incomingMessage.replace(/time\s+r\d+/i, "").trim();

} else if (incoming.startsWith("complete")) {
  command = "COMPLETE";

} else if (incoming.startsWith("note")) {
  command = "NOTE";
  extraText = incomingMessage.replace(/note\s+r\d+/i, "").trim();
}

    let replyMessage = "";

    if (!command) {
      replyMessage =
        "Invalid format. Use ACCEPT R123, DECLINE R123, TIME R123 14:00, NOTE R123 your message, or COMPLETE R123.";
      console.log("📤 Reply:", replyMessage);
      return res.status(200).send("OK");
    }

    if (!repairId) {
      replyMessage = "Please include repair ID like ACCEPT R123";
      console.log("📤 Reply:", replyMessage);
      return res.status(200).send("OK");
    }
    
    const repair = repairs.find(
    r => String(r.repair_id).trim().toUpperCase() === String(repairId).trim().toUpperCase()
    );

    console.log("FOUND REPAIR:", repair);
    console.log("FOUND REPAIR:", JSON.stringify(repair, null, 2));

    if (!repair) {
      replyMessage = `Repair ${repairId} not found.`;
      console.log("📤 Reply:", replyMessage);
      return res.status(200).send("OK");
    }

    if (command === "ACCEPT") {
      repair.response = "Accepted";
      repair.status = "Accepted";
      repair.accepted_at = new Date().toISOString();
      addHistory(repair, "Technician response: Accepted");
      writeRepairs(repairs);

      await notifyTenant(
        repair,
         `✅ Your repair ${repairId} has been accepted. Work will begin shortly.`
      );

      await notifyCaretaker(
        repair,
      `🔧 Repair ${repairId} approved. Technician can proceed.`
      );  

      await notifyLandlord(
      repair,
       `🏠 Repair ${repairId} approved. Technician has been dispatched.`
      );

      replyMessage = `✅ Repair ${repairId} marked as accepted. Notifications sent.`;

      } else if (command === "COMPLETE") {

  repair.status = "Completed";
  repair.completed_at = new Date().toISOString();

  repair.completion = repair.completion || {};
  repair.completion.confirmed = true;
  repair.completion.invoice_file = repair.completion.invoice_file || "";
  repair.completion.completion_photo = repair.completion.completion_photo || "";

  addHistory(repair, "Technician marked repair complete");
  writeRepairs(repairs);

  await notifyTenant(
    repair,
    `✅ Repair ${repairId} has been marked complete. Please inspect the work.`
  );

  await notifyCaretaker(
    repair,
    `✅ Repair ${repairId} marked complete by technician.`
  );

  await notifyLandlord(
    repair,
    `✅ Repair ${repairId} completed. Awaiting invoice and completion photo.`
  );

      replyMessage = `✅ Repair ${repairId} marked complete.
      Please upload the tax invoice and a photo of the completed job.`;
      
        } else if (command === "COMPLETE") {
        repair.response = "Completed";
        repair.status = "Completed";
        repair.completed_at = new Date().toISOString();

        addHistory(repair, "Technician marked repair as completed");
        writeRepairs(repairs);

        await notifyTenant(
          repair,
          `✅ Your repair ${repairId} has been completed. Please confirm if everything is satisfactory.`
        );

       await notifyLandlord(
        repair,
        `Repair ${repairId} has been completed by the technician.`
        );

        replyMessage = `Repair ${repairId} marked as completed. Notifications sent.`;
       } else if (command === "DECLINE") {

      repair.response = "Declined";
      repair.status = "Declined";
      repair.declined_at = new Date().toISOString();
      addHistory(repair, "Technician response: Declined");
      writeRepairs(repairs);

      replyMessage = `Repair ${repairId} marked as declined.`;
    } else if (command === "TIME") {
      if (!extraText) {
        replyMessage = `Please include a time like TIME ${repairId} 14:00`;
      } else {
        repair.confirmed_time = extraText;
        repair.status = "Time Proposed";
        addHistory(repair, `Technician proposed time: ${extraText}`);
        writeRepairs(repairs);

        replyMessage = `Time updated for repair ${repairId}: ${extraText}`;
      }
    } else if (command === "NOTE") {
  if (!extraText) {
    replyMessage = `Please include a note like NOTE ${repairId} Need ladder`;
  } else {
    repair.technician_notes = extraText;
    repair.status = repair.status || "Note Added";
    addHistory(repair, `Technician note: ${extraText}`);
    writeRepairs(repairs);

    replyMessage = `Note added to repair ${repairId}.`;
  }
} else {
  replyMessage = "Unknown command.";
}

    console.log("📤 Reply:", replyMessage);

    try {
      await sendWhatsApp(req.body.From, replyMessage);
    } catch (sendError) {
      console.error("WhatsApp send error:", sendError.message || sendError);
    }

   return res.status(200).send("OK");

} catch (error) {
  console.error("WhatsApp reply error:", error);
  return res.status(200).send("ERROR");
}
});

function autoAssignExistingRepairs() {
  const repairs = readRepairs();
  let updated = 0;

  repairs.forEach((repair) => {
    if (repair.technician === "Unassigned" || repair.status === "New") {

      const defaultSupplierName = getPropertyDefaultSupplier(
        repair.property_name,
        repair.trade
      );

      if (defaultSupplierName) {
        repair.technician = defaultSupplierName;
        repair.status = "Assigned";
        updated++;
      } else {
        const assignedSupplier = getSupplierByTrade(repair.trade);

        if (assignedSupplier) {
          repair.technician = assignedSupplier.name;
          repair.status = "Assigned";
          updated++;
        }
      }
    }
  });

  writeRepairs(repairs);
  return updated;
}

app.get("/repairs/auto-assign-old", (req, res) => {
  try {
    const updated = autoAssignExistingRepairs();

    res.json({
      message: `${updated} old repair(s) auto-assigned successfully`
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error auto-assigning old repairs" });
  }
});
      if (!fs.existsSync("uploads")) {
  fs.mkdirSync("uploads", { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "uploads/");
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + "-" + file.originalname);
    }
});

const upload = multer({ storage });
const PORT = 3000;

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

async function sendWhatsApp(to, body) {
  try {
    const message = await client.messages.create({
    from: process.env.TWILIO_WHATSAPP_FROM,
      to,
      body
    });

    console.log("WhatsApp sent:", message.sid);
  } catch (error) {
    console.error("WhatsApp error:", error.message);
  }
}

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(__dirname));
app.use("/uploads", express.static("uploads"));
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

const repairsFile = path.join(__dirname, "repairs.json");

function readRepairs() {
    try {
        const data = fs.readFileSync(repairsFile, "utf8");
        return JSON.parse(data || "[]");
    } catch (error) {
        return [];
    }
}

function writeRepairs(repairs) {
    fs.writeFileSync(repairsFile, JSON.stringify(repairs, null, 2));
}

function addHistory(repair, action) {
    if (!repair.history) {
        repair.history = [];
    }

    repair.history.push({
        action,
        timestamp: new Date().toISOString()
    });
}

app.get("/repairs", (req, res) => {
    const repairs = readRepairs();
    res.json(repairs);
});
app.get("/landlord-portal", (req, res) => {
    res.sendFile(
        path.join(__dirname, "landlord-portal.html")
    );
});
function generateRepairId(repairs) {
    const year = new Date().getFullYear();

    const yearlyRepairs = repairs.filter(r =>
        r.repair_id && r.repair_id.startsWith(`RPR-${year}-`)
    );

    const nextNumber = yearlyRepairs.length + 1;

    return `RPR-${year}-${String(nextNumber).padStart(4, "0")}`;
}

app.post("/repairs", upload.single("photo"), (req, res) => {
    try {

        const repairsFile = "./repairs.json";

        let repairs = [];

        if (fs.existsSync(repairsFile)) {
            const data = fs.readFileSync(repairsFile);
            repairs = JSON.parse(data);
        }
        const properties = readProperties();

        const selectedProperty = properties.find(
         (p) =>
           p.property_name &&
          req.body.property_name &&
          p.property_name.trim().toLowerCase() ===
            req.body.property_name.trim().toLowerCase()
      );

        const newRepair = {
            repair_id: generateRepairId(repairs),

            property_type: req.body.property_type,
            property_name: req.body.property_name,
            address: req.body.address,
            unit_number: req.body.unit_number,

            landlord_name: selectedProperty?.landlord_name || "",
            landlord_phone: selectedProperty?.landlord_phone || "",

            agent_name: selectedProperty?.agent_name || "",
            agent_phone: selectedProperty?.agent_phone || "",

            caretaker_name: selectedProperty?.caretaker_name || "",
            caretaker_phone: selectedProperty?.caretaker_phone || "",

            quotation_status: "",
            quotation_amount: "",
            quotation_notes: "",
            quote_file: "",

            landlord_decision: "",
            landlord_notes: "",

            trade: req.body.trade,
            description: req.body.description,
            priority: req.body.priority,

            availability_date: req.body.availability_date,
            availability_time: req.body.availability_time,

            contact_name: req.body.contact_name,
            designation: req.body.designation,
            contact_phone: req.body.contact_phone,

            photo: req.file ? `/uploads/${req.file.filename}` : null,

            status: "Pending",
            created_at: new Date()
        };
const defaultSupplierName = getPropertyDefaultSupplier(
    newRepair.property_name,
    newRepair.trade
);
const assignedSupplier = getSupplierByTrade(newRepair.trade);

if (defaultSupplierName) {
    newRepair.technician = defaultSupplierName;
    newRepair.status = "Assigned";

} else if (assignedSupplier) {
    newRepair.technician = assignedSupplier.name;
    newRepair.status = "Assigned";

} else {
    newRepair.technician = "Unassigned";
    newRepair.status = "New";
}
const technicianNumber = technicianPhones[newRepair.technician];
console.log("Assigned technician:", newRepair.technician);
console.log("Repair status:", newRepair.status);
console.log("Technician number:", technicianNumber);

if (technicianNumber && newRepair.status === "Assigned") {
  sendWhatsApp(
  technicianNumber,
  `🔧 New Repair Assigned

🆔 Repair ID: ${newRepair.repair_id}
🏢 Property: ${newRepair.property_name}
🚪 Unit: ${newRepair.unit_number}
🛠 Issue: ${newRepair.description}
⚠️ Priority: ${newRepair.priority}
📅 Availability: ${newRepair.availability_date} ${newRepair.availability_time}

👤 Contact: ${newRepair.contact_name}
📞 Phone: ${newRepair.contact_phone}

Reply with:
ACCEPT ${newRepair.repair_id}
DECLINE ${newRepair.repair_id}
TIME ${newRepair.repair_id} 14:00
NOTE ${newRepair.repair_id} Need ladder

✅ Please review and attend to this repair.`
);
}

        addHistory(newRepair, "Repair submitted");

        repairs.push(newRepair);
        writeRepairs(repairs);

        res.json({
            message: "Repair submitted successfully",
            repair: newRepair
        });
    } catch (error) {
        console.error("Server error:", error);
        res.status(500).json({ message: "Error submitting repair" });
    }
});

app.get("/suppliers", (req, res) => {
  try {
    const suppliers = readSuppliers();
    res.json(suppliers);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error loading suppliers" });
  }
});

app.post("/suppliers", (req, res) => {
  try {
    const suppliers = readSuppliers();

    const { name, trade, phone, contact_person, active } = req.body;

    if (!name || !trade || !phone) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const newSupplier = {
      supplier_id: "S" + Date.now(),
      name,
      trade,
      phone,
      contact_person: contact_person || "",
      active: active === true
    };

    suppliers.push(newSupplier);
    writeSuppliers(suppliers);

    res.json({
      message: "Supplier saved",
      supplier: newSupplier
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error saving supplier" });
  }
});

app.put("/repairs/:repairId/status", (req, res) => {
    try {
        const repairs = readRepairs();
        const repairId = req.params.repairId;
        const { status } = req.body;

        const repair = repairs.find(r => r.repair_id === repairId);

        if (!repair) {
            return res.status(404).json({ message: "Repair not found" });
        }

        repair.status = status;
        addHistory(repair, `Status changed to ${status}`);

        writeRepairs(repairs);

        res.json({
            message: "Status updated successfully",
            repair
        });
    } catch (error) {
        console.error("Status update error:", error);
        res.status(500).json({ message: "Error updating status" });
    }
});

app.put("/repairs/:repairId/technician", async (req, res) => {
    try {
        const repairs = readRepairs();
        const repairId = req.params.repairId;
        const { technician } = req.body;

        const repair = repairs.find(r => r.repair_id === repairId);

        if (!repair) {
            return res.status(404).json({ message: "Repair not found" });
        }

        repair.technician = technician;
        repair.response = "";
        repair.confirmed_time = "";
        repair.technician_notes = "";
        repair.visit_confirmed = "";
        repair.visit_time = "";
        repair.visit_notes = "";
        repair.quotation_amount = "";
        repair.quotation_notes = "";
        repair.quotation_status = "";
        repair.landlord_notes = "";

        addHistory(repair, `Assigned to ${technician}`);

        repair.status = "Assigned";

        console.log("Technician route reached:", repair.repair_id, technician);

await sendWhatsApp(
  process.env.MY_WHATSAPP_TO,
  `🔧 New repair assigned

Property: ${repair.property_name || "Unknown"}
Unit: ${repair.unit_number || "-"}
Issue: ${repair.description || "Repair request"}
Priority: ${repair.priority || "-"}

Technician: ${technician}

Open job:
https://property-repair-system.onrender.com/technician.html?id=${repair.repair_id}
`
);

        writeRepairs(repairs);

        res.json({
            message: "Technician updated successfully",
            repair
        });
    } catch (error) {
        console.error("Technician update error:", error);
        res.status(500).json({ message: "Error updating technician" });
    }
});

app.put("/repairs/:repairId/response", (req, res) => {
    try {
        const repairs = readRepairs();
        const repairId = req.params.repairId;
       const {
            response,
            response_date,
            response_time,
            technician_notes
      } = req.body;

        const repair = repairs.find(r => r.repair_id === repairId);

        if (!repair) {
            return res.status(404).json({ message: "Repair not found" });
        }

        repair.response = response || "";
        repair.response_date = response_date || "";
        repair.response_time = response_time || "";
        repair.technician_notes = technician_notes || "";

        if (response) addHistory(repair, `Technician response: ${response}`);
        if (response_date)
    addHistory(repair, `Confirmed date: ${response_date}`);

        if (response_time)
    addHistory(repair, `Confirmed time: ${response_time}`);
        if (technician_notes) addHistory(repair, `Technician note added`);

        writeRepairs(repairs);

        res.json({
            message: "Technician response saved successfully",
            repair
        });
    } catch (error) {
        console.error("Response update error:", error);
        res.status(500).json({ message: "Error saving technician response" });
    }
});

app.put("/repairs/:repairId/visit", (req, res) => {
        
    try {
        const repairs = readRepairs();
        const repairId = req.params.repairId;
        const { visit_confirmed, visit_date, visit_time, visit_notes } = req.body;

        const repair = repairs.find(r => r.repair_id === repairId);

        if (!repair) {
            return res.status(404).json({ message: "Repair not found" });
        }

        repair.visit_confirmed = visit_confirmed || "";
        repair.visit_date = visit_date || "";
        repair.visit_time = visit_time || "";
        repair.visit_notes = visit_notes || "";

        if (visit_confirmed) addHistory(repair, `Visit status: ${visit_confirmed}`);
        if (visit_time) addHistory(repair, `Visit time: ${visit_time}`);
        if (visit_notes) addHistory(repair, `Visit note added`);

        writeRepairs(repairs);

        res.json({
            message: "Visit details saved successfully",
            repair
        });
    } catch (error) {
        console.error("Visit update error:", error);
        res.status(500).json({ message: "Error saving visit details" });
    }
});

        app.put("/repairs/:repairId/completion", (req, res) => {
  try {
    const repairs = readRepairs();
    const repairId = req.params.repairId;

    const {
      completion_date,
      completion_time,
      completion_notes,
      materials_used
    } = req.body;

    const repair = repairs.find(r => r.repair_id === repairId);

    if (!repair) {
      return res.status(404).json({ message: "Repair not found" });
    }

    repair.completion_date = completion_date || "";
    repair.completion_time = completion_time || "";
    repair.completion_notes = completion_notes || "";
    repair.materials_used = materials_used || "";
    repair.status = "Completed";

    if (completion_date) addHistory(repair, `Completion date: ${completion_date}`);
    if (completion_time) addHistory(repair, `Completion time: ${completion_time}`);
    if (completion_notes) addHistory(repair, "Completion notes added");
    if (materials_used) addHistory(repair, "Materials used added");

    writeRepairs(repairs);

    res.json({
      message: "Completion saved successfully",
      repair
    });

  } catch (error) {
    console.error("Completion update error:", error);
    res.status(500).json({ message: "Error saving completion" });
  }
});

    app.put("/repairs/:repairId/quotation", upload.single("quote_file"), (req, res) => {
    try {
        const repairs = readRepairs();
        const repairId = req.params.repairId;
        const { quotation_amount, quotation_notes } = req.body;

        console.log("BODY:", req.body);
        console.log("FILE:", req.file);
        const repair = repairs.find(r => r.repair_id === repairId);

        if (!repair) {
            return res.status(404).json({ message: "Repair not found" });
        }

        repair.quotation_amount = quotation_amount;
        repair.quotation_notes = quotation_notes;
        repair.quotation_status = "Pending";

        if (req.file) {
    const newQuotationFile = "/uploads/" + req.file.filename;

    if (repair.quotation_file !== newQuotationFile) {
        repair.quotation_file = newQuotationFile;
        addHistory(repair, "Quotation file uploaded");
    }
}
const quoteMessage = `Quotation submitted ($${quotation_amount})`;

const alreadyLogged = (repair.history || []).some(
    h => h.action === quoteMessage
);

if (!alreadyLogged) {
    addHistory(repair, quoteMessage);
}
       writeRepairs(repairs);

            res.json({
                message: "Quotation saved successfully",
                repair
        });
    } catch (error) {
        console.error("Quotation update error:", error);
        res.status(500).json({ message: "Error saving quotation" });
    }
});
      app.put("/repairs/:repairId/quote-decision", async (req, res) => {

    try {
        const repairs = readRepairs();
        const repairId = req.params.repairId;
        const { decision, landlord_notes } = req.body;

        const repair = repairs.find(r => r.repair_id === repairId);

        if (!repair) {
            return res.status(404).json({ message: "Repair not found" });
        }

        repair.landlord_notes = landlord_notes || "";

       if (decision === "Approved") {
         repair.quotation_status = "Approved";
         repair.status = "In Progress";

         addHistory(
            repair,
            `Quotation approved by landlord. Notes: ${landlord_notes || "-"}`
         );

         await sendWhatsApp(
            process.env.MY_WHATSAPP_TO,
            `🔧 Repair Approved

        🏢 Property: ${repair.property_name}
        🚪 Unit: ${repair.unit_number}
        🛠 Issue: ${repair.description}
        ⚠️ Priority: ${repair.priority}

        👤 Approved by landlord
        ⏱ ${new Date().toLocaleString()}

        ✅ Work may commence.`
        );
        const technicianNumber = technicianPhones[repair.technician];

        if (technicianNumber) {
          await sendWhatsApp(
            technicianNumber,
            `🔧 Repair Approved

        🏢 Property: ${repair.property_name}
        🚪 Unit: ${repair.unit_number}
        🛠 Issue: ${repair.description}

        ✅ Work may commence.`
            );
        }
        } else if (decision === "Declined") {
            repair.quotation_status = "Declined";

            addHistory(
                repair,
                `Quotation declined by landlord. Notes: ${landlord_notes || "-"}`
            );

        } else {
            return res.status(400).json({ message: "Invalid decision" });
        }

        writeRepairs(repairs);

        res.json({
            message: `Quotation ${decision.toLowerCase()} successfully`,
            repair
        });
    } catch (error) {
        console.error("Quote decision error:", error);
        res.status(500).json({ message: "Error saving quote decision" });
    }
});
app.get("/properties-page", (req, res) => {
  res.sendFile(__dirname + "/properties.html");
});
app.get("/properties", (req, res) => {
  const properties = readProperties();
  res.json(properties);
});

app.post("/properties", (req, res) => {
  const properties = readProperties();
  const newProperty = req.body;

  properties.push(newProperty);
  writeProperties(properties);

  res.json({ success: true, property: newProperty });
});
app.get("/test-page", (req, res) => {
    res.send("TEST PAGE WORKING");
});

app.get("/test-whatsapp", async (req, res) => {
  await sendWhatsApp(
    process.env.MY_WHATSAPP_TO,
    "🔥 Your repair system is now sending WhatsApp messages!"
  );

  res.send("WhatsApp test sent!");
});

app.get("/financial-summary", (req, res) => {
    res.sendFile(__dirname + "/financial-summary.html");
});

app.get("/documents", (req, res) => {
    res.sendFile(__dirname + "/documents.html");
});

app.get("/property-performance", (req, res) => {
    res.sendFile(__dirname + "/property-performance.html");
});

app.get("/tenant-directory", (req, res) => {
    res.sendFile(__dirname + "/tenant-directory.html");
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});