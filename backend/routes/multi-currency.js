const { createCrudRouter } = require("../lib/crud");
module.exports = createCrudRouter("fx_transactions", [
  "entry_date", "currency", "rate", "amount_fc", "amount_rial", "description",
]);
