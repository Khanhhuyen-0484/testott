const express = require("express");
const crypto = require("crypto");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const { findByCode, updateByCode } = require("../store/serviceApplicationStore");
const { createNotification } = require("../store/notificationStore");
const { getIo } = require("../socket");

const {
  createPayment,
  getPaymentByDossierId,
  updatePayment,
  findPendingByTransferContent,
  hasTransactionId,
} = require("../store/sepayStore");

const BANK_CODE = process.env.BANK_CODE || "";
const BANK_ACCOUNT = process.env.BANK_ACCOUNT || "";
const BANK_ACCOUNT_NAME = process.env.BANK_ACCOUNT_NAME || "";
const QR_IMAGE_BASE = process.env.VIETQR_IMAGE_BASE || "https://img.vietqr.io/image";

function nowIso() {
  return new Date().toISOString();
}

function amountToVnd(amount) {
  return Math.max(0, Math.round(Number(amount || 0)));
}

function buildTransferContent() {
  return `DH${Date.now()}`;
}

function buildQrUrl(amount, transferContent) {
  return `${QR_IMAGE_BASE}/${BANK_CODE}-${BANK_ACCOUNT}-compact2.png?amount=${amountToVnd(
    amount
  )}&addInfo=${encodeURIComponent(transferContent)}&accountName=${encodeURIComponent(
    BANK_ACCOUNT_NAME
  )}`;
}

function resolveDossierId(payload = {}) {
  return String(
    payload.dossierId ||
      payload.dossierCode ||
      payload.applicationId ||
      payload.applicationCode ||
      ""
  ).trim();
}

function verifyWebhook(req) {
  const secret = process.env.SEPAY_WEBHOOK_SECRET || "";
  const rawSignature = String(req.headers["x-sepay-signature"] || "").trim();
  const signature = rawSignature.replace(/^sha256=/i, "").trim();

  if (!secret || !signature || !req.rawBody) {
    console.warn("[sepay-webhook] missing secret/signature/rawBody");
    return false;
  }

  const computed = crypto
    .createHmac("sha256", secret)
    .update(req.rawBody)
    .digest("hex");

  console.log("[sepay-webhook] signature:", signature);
  console.log("[sepay-webhook] computed:", computed);

  try {
    const a = Buffer.from(signature, "hex");
    const b = Buffer.from(computed, "hex");
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

router.get("/sepay-webhook", (_req, res) => {
  res.json({
    success: true,
    message: "SePay webhook endpoint is ready. Use POST.",
  });
});

router.post("/bank-transfer/create", authMiddleware, async (req, res) => {
  try {
    const dossierId = resolveDossierId(req.body);
    const amount = req.body?.amount;

    if (!dossierId) {
      return res.status(400).json({ message: "Thi?u dossierId" });
    }

    if (!BANK_CODE || !BANK_ACCOUNT || !BANK_ACCOUNT_NAME) {
      return res.status(500).json({
        message: "Thi?u c?u h?nh ng?n h?ng/SePay",
      });
    }

    const dossier = await findByCode(dossierId);

    if (!dossier) {
      return res.status(404).json({ message: "Kh?ng t?m th?y h?" so" });
    }

    const payAmount = amountToVnd(amount ?? dossier.fee ?? 0);
    const paymentId = `PAY-${Date.now()}`;
    const transferContent = buildTransferContent();
    const qrUrl = buildQrUrl(payAmount, transferContent);
    const createdAt = nowIso();

    const payment = {
      paymentId,
      dossierId,
      amount: payAmount,
      provider: "SEPAY",
      method: "BANK_TRANSFER",
      status: "PENDING",
      paymentStatus: "PENDING",
      transferContent,
      qrUrl,
      bankCode: BANK_CODE,
      bankAccount: BANK_ACCOUNT,
      bankAccountName: BANK_ACCOUNT_NAME,
      transactionId: "",
      transactionDate: "",
      paidAt: "",
      createdAt,
      updatedAt: createdAt,
    };

    console.log("[SePay createPayment]", payment);

    await createPayment(payment);

    res.json({
      paymentId,
      dossierId,
      amount: payAmount,
      transferContent,
      qrUrl,
      status: "PENDING",
      paymentStatus: "PENDING",
      bankCode: BANK_CODE,
      bankAccount: BANK_ACCOUNT,
      bankAccountName: BANK_ACCOUNT_NAME,
    });
  } catch (err) {
    console.error("[bank-transfer/create] error:", err);
    res.status(500).json({
      message: err.message || "L?-i t?o thanh to?n chuy?fn kho?n",
    });
  }
});

router.get("/status/:dossierId", authMiddleware, async (req, res) => {
  try {
    const dossierId = req.params.dossierId;
    console.log("[payment-status] dossierId:", dossierId);

    const payment = await getPaymentByDossierId(dossierId);
    console.log("[payment-status] payment:", payment);

    res.json({
      paymentStatus: payment?.paymentStatus || payment?.status || "UNPAID",
      payment: payment || null,
    });
  } catch (err) {
    console.error("[payment-status] error:", err);
    res.status(500).json({
      message: err.message || "L?-i ki?fm tra tr?ng th?i thanh to?n",
    });
  }
});

router.post("/mock-complete", authMiddleware, async (req, res) => {
  try {
    const dossierId = resolveDossierId(req.body);
    if (!dossierId) {
      return res.status(400).json({ message: "Thi?u dossierId" });
    }

    const dossier = await findByCode(dossierId);
    if (!dossier) {
      return res.status(404).json({ message: "Kh?ng t?m th?y h?" so" });
    }

    const payment = await getPaymentByDossierId(dossierId);
    if (payment?.paymentId) {
      await updatePayment(payment.paymentId, {
        status: "PAID",
        paymentStatus: "PAID",
        paidAt: nowIso(),
        transactionDate: nowIso(),
        transactionId: payment.transactionId || `MOCK-${Date.now()}`,
      });
    }

    const timeline = [
      ...(dossier.timeline || dossier.history || []),
      {
        status: "PENDING",
        action: "payment",
        note: "Thanh to?n demo th?nh c?ng",
        actor: req.user?.id || req.user?.email || "user",
        createdAt: nowIso(),
      },
    ];

    const updated = await updateByCode(dossier.dossierId || dossierId, {
      ...dossier,
      status: "PENDING",
      paymentStatus: "PAID",
      paidAt: nowIso(),
      timeline,
      history: timeline,
      updatedAt: nowIso(),
    });

    res.json({
      success: true,
      message: "?? ?'?nh d?u thanh to?n th?nh c?ng",
      dossierId,
      paymentStatus: "PAID",
      application: updated,
    });
  } catch (err) {
    console.error("[mock-complete] error:", err);
    res.status(500).json({
      message: err.message || "L?-i c?p nh?t thanh to?n demo",
    });
  }
});

router.post("/sepay-webhook", async (req, res) => {
  try {
    console.log("========== SEPAY WEBHOOK ==========");
    console.log("[sepay-webhook] body:", req.body);

    const isValidSignature = verifyWebhook(req);

    if (!isValidSignature) {
      console.warn("[sepay-webhook] INVALID_SIGNATURE - v?n x? l? ?'?f test lu?"ng thanh to?n");
    }

    const body = req.body || {};

    const description = String(
      body.content || body.description || body.code || ""
    ).trim();

    const amount = amountToVnd(
      body.transferAmount ?? body.amount ?? body.totalAmount ?? body.value
    );

    const transactionId = String(
      body.referenceCode || body.transactionId || body.id || body.referenceId || ""
    ).trim();

    const transactionDate = String(
      body.transactionDate || body.time || body.createdAt || nowIso()
    ).trim();

    const transferType = String(
      body.transferType || body.direction || body.type || ""
    ).toLowerCase();

    console.log("[sepay-webhook] description:", description);
    console.log("[sepay-webhook] amount:", amount);
    console.log("[sepay-webhook] transactionId:", transactionId);
    console.log("[sepay-webhook] transferType:", transferType);

    if (transferType && transferType !== "in") {
      return res.status(200).json({
        ok: true,
        ignored: true,
        reason: "NOT_IN_TRANSACTION",
      });
    }

    if (!description || !transactionId) {
      return res.status(200).json({
        ok: true,
        ignored: true,
        reason: "MISSING_DESCRIPTION_OR_TRANSACTION_ID",
      });
    }

    if (await hasTransactionId(transactionId)) {
      return res.status(200).json({
        ok: true,
        duplicated: true,
      });
    }

    const payment = await findPendingByTransferContent(description);

    console.log(
      "[sepay-webhook] matched payment:",
      payment
        ? {
            paymentId: payment.paymentId,
            dossierId: payment.dossierId,
            transferContent: payment.transferContent,
            status: payment.status,
            amount: payment.amount,
          }
        : null
    );

    if (!payment) {
      return res.status(200).json({
        ok: true,
        matched: false,
        reason: "NO_PAYMENT_MATCHED",
      });
    }

    if (amount < Number(payment.amount || 0)) {
      return res.status(200).json({
        ok: true,
        matched: true,
        paid: false,
        reason: "AMOUNT_NOT_ENOUGH",
      });
    }

    const updatedPayment = await updatePayment(payment.paymentId, {
      status: "PAID",
      paymentStatus: "PAID",
      transactionId,
      transactionDate,
      paidAt: transactionDate || nowIso(),
      provider: "SEPAY",
      method: "BANK_TRANSFER",
      amount,
      updatedAt: nowIso(),
    });

    console.log("[sepay-webhook] UPDATED_PAYMENT:", updatedPayment);

    const dossier = await findByCode(payment.dossierId);

    if (dossier) {
      const timeline = [
        ...(dossier.timeline || []),
        {
          status: "PENDING",
          action: "payment",
          note: "Thanh to?n chuy?fn kho?n t? ?'?Tng qua SePay th?nh c?ng",
          actor: "sepay",
          createdAt: nowIso(),
        },
      ];

      await updateByCode(payment.dossierId, {
        ...dossier,
        status: "PENDING",
        paymentStatus: "PAID",
        updatedAt: nowIso(),
        timeline,
        history: timeline,
      });

      console.log("[sepay-webhook] DOSSIER_UPDATED:", payment.dossierId);

      try {
        const dossierIdentifier = dossier.dossierId || dossier.id || payment.dossierId;

        await createNotification({
          notificationId: `NTF-${Date.now()}`,
          userId: dossier.userId,
          dossierId: dossierIdentifier,
          title: "Thanh to?n th?nh c?ng",
          message: `H?" so ${dossierIdentifier} ?'? ?'u?c thanh to?n t? ?'?Tng.`,
          createdAt: nowIso(),
        });

        getIo()
          ?.to?.(`user_${dossier.userId}`)
          ?.emit?.("service-application-updated", {
            dossierId: dossierIdentifier,
            paymentStatus: "PAID",
          });
      } catch (notifyErr) {
        console.warn("[sepay-webhook] notify error:", notifyErr?.message || notifyErr);
      }
    }

    res.status(200).json({
      ok: true,
      updated: Boolean(updatedPayment),
      validSignature: isValidSignature,
      paymentId: payment.paymentId,
      dossierId: payment.dossierId,
    });
  } catch (err) {
    console.error("[sepay-webhook] error:", err);
    res.status(200).json({
      ok: true,
      errorHandled: true,
      error: err.message,
    });
  }
});

module.exports = router;
