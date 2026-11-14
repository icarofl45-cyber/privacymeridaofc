const PLANS = [
  { id: "plano-1", name: "1 Mês", price: 9.90, duration_months: 1 },
  { id: "plano-2", name: "3 Meses + (Bônus)", price: 14.90, duration_months: 3, discount_percent: 50 },
  { id: "plano-3", name: "Vitalício + (WhatsApp)", price: 19.90, duration_months: 999 },
  { id: "combo", name: "Super Combo Exclusivo", price: 24.90, duration_months: 999 }
];

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  return res.status(200).json({ plans: PLANS });
};
