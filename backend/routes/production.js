const { createCrudRouter } = require("../lib/crud");
module.exports = createCrudRouter("production_orders", [
  "order_date", "product_name", "quantity", "status", "description",
]);
