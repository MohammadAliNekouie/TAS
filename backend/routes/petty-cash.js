const { createCrudRouter } = require("../lib/crud");
module.exports = createCrudRouter("petty_cash", [
  "fund_name", "entry_date", "type", "category", "amount", "description",
]);
