const QRCode = require("qrcode");
const {
  MOMO_CONFIG,
  PAYMENT_STATUS,
  PAYMENT_TIMEOUT_MS
} = require("../config/payment");
const { findByCode, updateByCode } = require("../store/serviceApplicationStore");

function resolveDossierId(payload = {}) {
  return String(
    payload.dossierId ||
    payload.dossierCode ||
    payload.applicationCode ||
    payload.applicationId ||
    ""
  ).trim();
}

function buildPaymentResponse(application, dossierId) {
  return {
    dossierId,
    dossierCode: application.dossierCode || application.applicationCode || dossierId,
    paymentStatus: application.paymentStatus || PAYMENT_STATUS.PENDING,
    paymentAmount: application.paymentAmount,
    paymentExpireAt: application.paymentExpireAt,
    serviceName: application.serviceName,
    message:
      application.paymentStatus === PAYMENT_STATUS.COMPLETED
        ? "Thanh to?n th?nh c?ng!"
        : application.paymentStatus === PAYMENT_STATUS.PENDING
          ? "Chua thanh to?n. Vui l?ng qu?t m? QR ?'?f ti?p t?c."
          : "Thanh to?n th?t b?i ho?c h?t h?n."
  };
}

exports.generatePaymentQr = async (req, res) => {
  try {
    const dossierId = resolveDossierId(req.body);
    const amount = Number(req.body.amount);
    const serviceDescription = String(req.body.serviceDescription || "Thanh to?n ph? d?<ch v?").trim();

    if (!dossierId || !Number.isFinite(amount)) {
      return res.status(400).json({
        message: "Thi?u dossierId ho?c amount"
      });
    }

    const application = await findByCode(dossierId);
    if (!application) {
      return res.status(404).json({
        message: "Kh?ng t?m th?y h?" so"
      });
    }

    await updateByCode(dossierId, {
      paymentStatus: PAYMENT_STATUS.PENDING,
      paymentExpireAt: new Date(Date.now() + PAYMENT_TIMEOUT_MS).toISOString(),
      paymentAmount: amount,
      paymentDescription: serviceDescription
    });

    const backendUrl = process.env.BACKEND_URL || "http://localhost:3000";
    const callbackUrl = `${backendUrl}/api/services/payment/verify/${dossierId}`;

    const qrData = {
      partnerCode: MOMO_CONFIG.partnerCode,
      amount: Math.round(amount),
      description: serviceDescription,
      callbackUrl,
      dossierId,
      timestamp: Date.now()
    };

    const qrDataString = JSON.stringify(qrData);
    const qrDataUrl = await QRCode.toDataURL(qrDataString, {
      errorCorrectionLevel: "H",
      type: "image/png",
      width: 300,
      margin: 2,
      color: {
        dark: "#000000",
        light: "#FFFFFF"
      }
    });

    res.json({
      success: true,
      dossierId,
      dossierCode: application.dossierCode || application.applicationCode || dossierId,
      amount,
      description: serviceDescription,
      qrCode: qrDataUrl,
      paymentExpireAt: new Date(Date.now() + PAYMENT_TIMEOUT_MS).toISOString(),
      instruction: "Qu?t m? QR b?ng ?ng d?ng MoMo, ZaloPay ho?c ?ng d?ng ng?n h?ng ?'?f thanh to?n"
    });
  } catch (err) {
    console.error("generatePaymentQr error:", err);
    res.status(500).json({
      message: "L?-i t?o m? QR thanh to?n",
      error: err.message
    });
  }
};

exports.verifyPaymentStatus = async (req, res) => {
  try {
    const dossierId = resolveDossierId(req.params);

    if (!dossierId) {
      return res.status(400).json({
        message: "Thi?u dossierId"
      });
    }

    const application = await findByCode(dossierId);
    if (!application) {
      return res.status(404).json({
        message: "Kh?ng t?m th?y h?" so"
      });
    }

    if (
      application.paymentStatus === PAYMENT_STATUS.PENDING &&
      application.paymentExpireAt &&
      new Date(application.paymentExpireAt) < new Date()
    ) {
      await updateByCode(dossierId, {
        paymentStatus: PAYMENT_STATUS.EXPIRED
      });
      return res.json({
        ...buildPaymentResponse({ ...application, paymentStatus: PAYMENT_STATUS.EXPIRED }, dossierId),
        message: "H?t th?i gian thanh to?n (60 ph?t). H?" so ?'? b?< h?y."
      });
    }

    res.json(buildPaymentResponse(application, dossierId));
  } catch (err) {
    console.error("verifyPaymentStatus error:", err);
    res.status(500).json({
      message: "L?-i ki?fm tra tr?ng th?i thanh to?n",
      error: err.message
    });
  }
};

exports.paymentWebhook = async (req, res) => {
  try {
    const dossierId = resolveDossierId(req.body);
    const status = String(req.body.status || "").trim();
    const transactionId = String(req.body.transactionId || "").trim();

    if (!dossierId || !status) {
      return res.status(400).json({
        message: "Missing required fields"
      });
    }

    const application = await findByCode(dossierId);
    if (!application) {
      return res.status(404).json({
        message: "Application not found"
      });
    }

    const newStatus =
      status === "success" || status === "completed"
        ? PAYMENT_STATUS.COMPLETED
        : PAYMENT_STATUS.FAILED;

    const updated = await updateByCode(dossierId, {
      paymentStatus: newStatus,
      paymentTransactionId: transactionId || null,
      paymentCompletedAt: newStatus === PAYMENT_STATUS.COMPLETED ? new Date().toISOString() : null,
      status: newStatus === PAYMENT_STATUS.COMPLETED ? "?? ti?p nh?n" : "Chua thanh to?n"
    });

    console.log(`[Payment Webhook] ${dossierId}: ${newStatus}`);

    res.json({
      success: true,
      message: `Payment ${newStatus}`,
      dossierId,
      dossierCode: updated?.dossierCode || application.dossierCode || dossierId,
      paymentStatus: newStatus
    });
  } catch (err) {
    console.error("paymentWebhook error:", err);
    res.status(500).json({
      success: false,
      message: "Webhook processing failed",
      error: err.message
    });
  }
};

exports.mockPaymentComplete = async (req, res) => {
  try {
    const dossierId = resolveDossierId(req.body);

    if (!dossierId) {
      return res.status(400).json({
        message: "Missing dossierId"
      });
    }

    const application = await findByCode(dossierId);
    if (!application) {
      return res.status(404).json({
        message: "Application not found"
      });
    }

    const updated = await updateByCode(dossierId, {
      paymentStatus: PAYMENT_STATUS.COMPLETED,
      paymentCompletedAt: new Date().toISOString(),
      status: "PENDING"
    });

    res.json({
      success: true,
      message: "Payment marked as completed (MOCK)",
      dossierId,
      dossierCode: updated?.dossierCode || application.dossierCode || dossierId,
      paymentStatus: PAYMENT_STATUS.COMPLETED,
      application: updated
    });
  } catch (err) {
    console.error("mockPaymentComplete error:", err);
    res.status(500).json({
      message: "Error updating payment",
      error: err.message
    });
  }
};
