const https = require("https");
const crypto = require("crypto");

// Chave da NxGate (pode vir de variável de ambiente ou padrão configurado)
const NXGATE_API_KEY = process.env.NXGATE_API_KEY || "3c2dfcaf7f1906357932d7c920c41f30";

const PLANS = {
  "plano-1": { id: "plano-1", name: "1 Mês", price: 9.90, duration_months: 1 },
  "plano-2": { id: "plano-2", name: "3 Meses + (Bônus)", price: 14.90, duration_months: 3, discount_percent: 50 },
  "plano-3": { id: "plano-3", name: "Vitalício + (WhatsApp)", price: 19.90, duration_months: 999 },
  "combo": { id: "combo", name: "Super Combo Exclusivo", price: 24.90, duration_months: 999 }
};

function postRequest(url, data, headers = {}) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const postData = JSON.stringify(data);

    const options = {
      hostname: parsedUrl.hostname,
      port: 443,
      path: parsedUrl.pathname,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(postData),
        ...headers
      }
    };

    const req = https.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => body += chunk);
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on("error", (e) => reject(e));
    req.write(postData);
    req.end();
  });
}

module.exports = async (req, res) => {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    const body = req.body || {};
    const planId = body.plan_id || "plano-1";
    const plan = PLANS[planId] || { name: "Acesso Exclusivo", price: body.amount || 9.90, duration_months: 1 };

    const valor = Number(plan.price || 9.90);
    const magicId = "ped_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
    const idempotencyKey = crypto.randomUUID();

    // Payload para a API NxGate conforme a documentação oficial
    const nxgatePayload = {
      api_key: NXGATE_API_KEY,
      valor: valor,
      nome_pagador: body.nome || "Cliente VIP",
      documento_pagador: body.documento || "52998224725", // CPF válido de fallback
      magic_id: magicId
    };

    const nxgateRes = await postRequest(
      "https://api.nxgate.com.br/v2/cobranca",
      nxgatePayload,
      { "X-Idempotency-Key": idempotencyKey }
    );

    const respData = nxgateRes.data || {};
    const transactionId = respData.idTransaction || respData.transaction_id || magicId;
    const pixCode = respData.paymentCode || (respData.paymentInstruction && respData.paymentInstruction.pixCopyAndPaste) || "";
    const pixQrBase64 = respData.paymentCodeBase64 ? `data:image/png;base64,${respData.paymentCodeBase64}` : "";

    if (!pixCode && !respData.idTransaction) {
      return res.status(400).json({
        error: respData.message || respData.error || "Não foi possível gerar a cobrança na NxGate."
      });
    }

    return res.status(200).json({
      order_code: transactionId,
      access_token: transactionId,
      order: {
        plan_name: plan.name,
        amount: valor,
        duration_months: plan.duration_months,
        pix_code: pixCode
      },
      qr: pixQrBase64,
      transaction_id: transactionId
    });

  } catch (error) {
    return res.status(500).json({ error: error.message || "Erro interno ao processar cobrança." });
  }
};
