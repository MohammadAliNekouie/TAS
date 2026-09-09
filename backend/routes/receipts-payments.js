const { createCrudRouter } = require("../lib/crud");
module.exports = createCrudRouter("receipts_payments", [
  "type", "party", "method", "payment_date", "amount", "description",
]);
