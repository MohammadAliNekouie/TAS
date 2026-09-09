const { createCrudRouter } = require("../lib/crud");
module.exports = createCrudRouter("cheques", [
  "type", "party", "amount", "due_date", "status", "sayad_id", "endorsed_to",
]);
