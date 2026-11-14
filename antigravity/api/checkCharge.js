const https = require("https");

const NXGATE_API_KEY = process.env.NXGATE_API_KEY || "3c2dfcaf7f1906357932d7c920c41f30";

function postRequest(url, data) {
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
        "Content-Length": Buffer.byteLength(postData)
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
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    const body = req.body || {};
    const transactionId = body.order_code || body.transaction_id || body.access_token;

    if (!transactionId) {
      return res.status(400).json({ error: "Identificador de transação não informado." });
    }

    const nxgateRes = await postRequest("https://api.nxgate.com.br/v2/consultar", {
      api_key: NXGATE_API_KEY,
      transaction_id: transactionId
    });

    const data = nxgateRes.data || {};
    const rawStatus = (data.status || "").toLowerCase();

    // Na doc da NxGate: status "paid" ou "QR_CODE_COPY_AND_PASTE_PAID"
    const isPaid = rawStatus === "paid" || rawStatus === "qr_code_copy_and_paste_paid" || rawStatus === "approved";

    if (isPaid) {
      return res.status(200).json({
        status: "paid",
        transaction_id: transactionId,
        subscription: {
          plan_name: "Acesso Exclusivo",
          expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
        }
      });
    }

    return res.status(200).json({
      status: "pending",
      transaction_id: transactionId
    });

  } catch (error) {
    return res.status(500).json({ error: error.message || "Erro ao consultar status na NxGate." });
  }
};
