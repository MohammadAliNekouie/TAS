const { createCrudRouter } = require("../lib/crud");
module.exports = createCrudRouter("modayan_submissions", [
  "invoice_ref", "submission_date", "tax_id", "status", "description",
]);
