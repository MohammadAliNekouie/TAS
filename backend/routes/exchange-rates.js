const express = require("express");
const exchangeRates = require("../lib/exchangeRates");

const router = express.Router();

router.get("/", (req, res) => {
  res.json(exchangeRates.getRates());
});

module.exports = router;
