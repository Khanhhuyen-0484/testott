const { listServices, getService, upsertService, seedServicesToDynamo } = require("../store/serviceCatalogStore");
const { listCategories, seedDefaultCategories } = require("../store/serviceCategoryStore");
const { createNotification, getNotificationsByUser } = require("../store/notificationStore");
const { savePayment, getPaymentsByDossierId } = require("../store/paymentStore");
const { create, findByCode, readAll, updateByCode } = require("../store/serviceApplicationStore");
const { getIo } = require("../socket");

const ALLOWED_STATUSES = new Set(["PENDING", "PROCESSING", "NEED_MORE", "SUPPLEMENTED", "COMPLETED", "REJECTED"]);
const STATUS_LABELS = { PENDING: "H?" so ?'? n?Tp", PROCESSING: "?ang x? l?", NEED_MORE: "Y?u c?u b?. sung", SUPPLEMENTED: "?? b?. sung", COMPLETED: "?? ho?n th?nh", REJECTED: "?? t? ch?'i" };

const fallbackServices = {
  "ho-tich-khai-sinh": { serviceId: "ho-tich-khai-sinh", id: "ho-tich-khai-sinh", name: "??fng k? khai sinh", description: "Ti?p nh?n, x? l? v? tr? k?t qu? ?'?fng k? khai sinh tr?c tuy?n cho c?ng d?n.", categoryName: "H?T t?<ch", processingTime: "3 ng?y l?m vi??c", fee: 0, documents: [{ key: "birthCert", label: "Gi?y ch?ng sinh", required: true }, { key: "idCard", label: "CCCD/CMND ngu?i n?Tp", required: true }, { key: "marriageCert", label: "Gi?y ?'?fng k? k?t h?n (n?u c?)", required: false }], timeline: ["Ti?p nh?n h?" so", "Ki?fm tra t?nh h?p l??", "X? l? chuy?n vi?n", "Ph? duy??t / b?. sung", "Tr? k?t qu?"], faq: [] },
  "dat-dai-bien-dong": { serviceId: "dat-dai-bien-dong", id: "dat-dai-bien-dong", name: "??fng k? bi?n ?'?Tng ?'?t ?'ai", description: "Ti?p nh?n h?" so thay ?'?.i, sang t?n ho?c c?p nh?t th?ng tin quy?n s? d?ng ?'?t.", categoryName: "??t ?'ai", processingTime: "5 ng?y l?m vi??c", fee: 20000, documents: [{ key: "landCert", label: "Gi?y ch?ng nh?n quy?n s? d?ng ?'?t", required: true }, { key: "mutationForm", label: "?on ?'?fng k? bi?n ?'?Tng", required: true }, { key: "idCard", label: "CCCD/CMND", required: true }], timeline: ["Ti?p nh?n h?" so", "Ki?fm tra t?nh h?p l??", "X? l? chuy?n vi?n", "Ph? duy??t / b?. sung", "Tr? k?t qu?"], faq: [] },
  "xay-dung-cap-phep": { serviceId: "xay-dung-cap-phep", id: "xay-dung-cap-phep", name: "Xin c?p ph?p x?y d?ng", description: "N?Tp h?" so ?'? ngh?< c?p ph?p x?y d?ng v? theo d?i tr?ng th?i x? l?.", categoryName: "X?y d?ng", processingTime: "7 ng?y l?m vi??c", fee: 50000, documents: [{ key: "landCert", label: "Gi?y t? quy?n s? d?ng ?'?t", required: true }, { key: "design", label: "B?n v? thi?t k?", required: true }, { key: "idCard", label: "CCCD/CMND", required: true }], timeline: ["Ti?p nh?n h?" so", "Ki?fm tra t?nh h?p l??", "X? l? chuy?n vi?n", "Ph? duy??t / b?. sung", "Tr? k?t qu?"], faq: [] },
  "gplx-doi": { serviceId: "gplx-doi", id: "gplx-doi", name: "??.i gi?y ph?p l?i xe", description: "Ti?p nh?n h?" so ?'?.i gi?y ph?p l?i xe theo quy tr?nh ?'i??n t?.", categoryName: "Giao th?ng", processingTime: "4 ng?y l?m vi??c", fee: 150000, documents: [{ key: "oldLicense", label: "Gi?y ph?p l?i xe cu", required: true }, { key: "health", label: "Gi?y kh?m s?c kh?e", required: true }, { key: "idCard", label: "CCCD/CMND", required: true }], timeline: ["Ti?p nh?n h?" so", "Ki?fm tra t?nh h?p l??", "X? l? chuy?n vi?n", "Ph? duy??t / b?. sung", "Tr? k?t qu?"], faq: [] },
  "ho-chieu-pho-thong": { serviceId: "ho-chieu-pho-thong", id: "ho-chieu-pho-thong", name: "C?p h?T chi?u ph?. th?ng", description: "Ti?p nh?n h?" so c?p h?T chi?u ph?. th?ng cho c?ng d?n ?'? ?'i?u ki??n.", categoryName: "H?T chi?u", processingTime: "8 ng?y l?m vi??c", fee: 200000, documents: [{ key: "photo", label: "?nh ch?n dung", required: true }, { key: "idCard", label: "CCCD/CMND", required: true }], timeline: ["Ti?p nh?n h?" so", "Ki?fm tra t?nh h?p l??", "X? l? chuy?n vi?n", "Ph? duy??t / b?. sung", "Tr? k?t qu?"], faq: [] },
  "doanh-nghiep-thanh-lap": { serviceId: "doanh-nghiep-thanh-lap", id: "doanh-nghiep-thanh-lap", name: "??fng k? th?nh l?p doanh nghi??p", description: "N?Tp h?" so ?'?fng k? doanh nghi??p v? theo d?i ti?n tr?nh x? l?.", categoryName: "Doanh nghi??p", processingTime: "3-5 ng?y l?m vi??c", fee: 100000, documents: [{ key: "charter", label: "?i?u l?? c?ng ty", required: true }, { key: "memberList", label: "Danh s?ch th?nh vi?n/c?. ?'?ng", required: true }, { key: "idCard", label: "CCCD/CMND ngu?i ?'?i di??n", required: true }], timeline: ["Ti?p nh?n h?" so", "Ki?fm tra t?nh h?p l??", "X? l? chuy?n vi?n", "Ph? duy??t / b?. sung", "Tr? k?t qu?"], faq: [] }
};

/** ID demo tr?n trang ch? ??' ID d?<ch v? trong catalog backend */
const SERVICE_ALIASES = {
  "demo-ho-tich": "ho-tich-khai-sinh",
  "demo-dat-dai": "dat-dai-bien-dong",
  "demo-xay-dung": "xay-dung-cap-phep",
  "demo-gplx": "gplx-doi",
  "demo-ho-chieu": "ho-chieu-pho-thong",
  "demo-doanh-nghiep": "doanh-nghiep-thanh-lap",
};

function generateDossierCode() { const now = new Date(); return `HS-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`; }
function validateForm(formData) { const errors = {}; if (!formData?.fullName?.trim()) errors.fullName = "H? t?n l? b?t bu?Tc"; if (!/^[0-9]{12}$/.test(formData?.citizenId || "")) errors.citizenId = "CCCD ph?i ?'? 12 s?'"; if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData?.email || "")) errors.email = "Email kh?ng ?'?ng ?'?<nh d?ng"; if (!/^[0-9]{10,11}$/.test(formData?.phone || "")) errors.phone = "S?' ?'i??n tho?i kh?ng h?p l??"; if (!formData?.address?.trim()) errors.address = "??<a ch?? l? b?t bu?Tc"; return errors; }
function userId(req) { return req.user?.id || req.user?._id || req.user?.sub || req.user?.email || null; }
function nowIso() { return new Date().toISOString(); }
function normalizeStatus(status) { const s = String(status || "").trim().toUpperCase(); return ALLOWED_STATUSES.has(s) ? s : "PENDING"; }
function pushTimeline(application, entry) { const timelineItem = { status: normalizeStatus(entry.status), action: String(entry.action || "").trim(), note: String(entry.note || "").trim(), actor: String(entry.actor || "").trim(), createdAt: entry.createdAt || nowIso() }; const timeline = [...(application.timeline || application.history || []), timelineItem]; return timeline; }

function withRequestedServiceId(service, requestedId) {
  if (!service || !requestedId || requestedId === service.serviceId) return service;
  return { ...service, serviceId: requestedId, id: requestedId };
}

function resolveService(serviceId) {
  const requestedId = String(serviceId || "").trim();
  const canonicalId = SERVICE_ALIASES[requestedId] || requestedId;
  const local = fallbackServices[canonicalId];
  if (local) return Promise.resolve(withRequestedServiceId(local, requestedId));
  return getService(canonicalId).then((svc) => withRequestedServiceId(svc || null, requestedId));
}

function slugify(text) { return String(text || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""); }
function pad4() { return Math.random().toString(36).slice(2, 6).toUpperCase(); }
function todayStamp() { return new Date().toISOString().slice(0, 10).replace(/-/g, ""); }
function generateCode(prefix) { return `${prefix}-${todayStamp()}-${pad4()}`; }
function generateServiceId() { return generateCode("DV"); }
function generateRequirementId() { return generateCode("GT"); }
function generateFaqId() { return generateCode("FAQ"); }
function generateStepId() { return generateCode("STEP"); }
function validateServicePayload(body) { const errors = {}; if (!String(body?.name || "").trim()) errors.name = "T?n d?<ch v? l? b?t bu?Tc"; if (!String(body?.categoryId || "").trim()) errors.categoryId = "Danh m?c l? b?t bu?Tc"; const fee = Number(body?.fee ?? 0); if (Number.isNaN(fee) || fee < 0) errors.fee = "L?? ph? ph?i l?>n hon ho?c b?ng 0"; if (!String(body?.processingTime || "").trim()) errors.processingTime = "Th?i gian x? l? kh?ng ?'u?c ?'?f tr?'ng"; if (!String(body?.agency || "").trim()) errors.agency = "Co quan x? l? l? b?t bu?Tc"; return errors; }
exports.getServiceCategories = async (_req, res) => {
  try {
    const categories = await listCategories();
    return res.json({ categories });
  } catch (error) {
    console.error("[getServiceCategories] error:", error);
    return res.status(500).json({ message: error.message || "Kh?ng t?i ?'u?c danh m?c" });
  }
};
exports.seedServiceCategories = async (_req, res) => {
  try {
    const result = await seedDefaultCategories();
    return res.json({ message: "?? seed danh m?c m?c ?'?<nh", ...result });
  } catch (error) {
    console.error("[seedServiceCategories] error:", error);
    return res.status(500).json({ message: error.message || "Kh?ng seed ?'u?c danh m?c" });
  }
};
exports.getServices = async (req, res) => { const q = String(req.query.q || "").toLowerCase(); const category = String(req.query.category || "").toLowerCase(); const items = await listServices(); const filtered = items.filter((s) => { const text = `${s.name || ""} ${s.description || ""} ${s.categoryName || ""}`.toLowerCase(); return (!q || text.includes(q)) && (!category || String(s.categoryId || s.categoryName || "").toLowerCase() === category); }); res.json({ services: filtered }); };
exports.getServiceById = async (req, res) => { const service = await resolveService(req.params.serviceId); if (!service) return res.status(404).json({ message: "Kh?ng t?m th?y d?<ch v?" }); res.json(service); };
exports.submitApplication = async (req, res) => { const { serviceId, formData = {}, attachments = [], paymentMethod = "BANK_TRANSFER" } = req.body; if (!serviceId) return res.status(400).json({ message: "Thi?u serviceId" }); const service = await resolveService(serviceId); if (!service) return res.status(404).json({ message: "D?<ch v? kh?ng t?"n t?i" }); const errors = validateForm(formData); if (Object.keys(errors).length) return res.status(400).json({ message: "D? li??u kh?ng h?p l??", errors }); const dossierCode = generateDossierCode(); const dossierId = dossierCode; const createdAt = nowIso(); const fee = Number(service.fee || 0); const shouldGoToAdmin = fee <= 0; const status = shouldGoToAdmin ? "PENDING" : "DRAFT"; const timeline = shouldGoToAdmin ? [{ status: "PENDING", action: "submit", note: "H?" so ?'? ?'u?c n?Tp", actor: userId(req) || "user", createdAt }] : []; const application = { dossierCode, dossierId, id: dossierId, userId: userId(req), serviceId, serviceName: service.name, formData, citizenName: formData.fullName, phone: formData.phone, email: formData.email, attachments, paymentMethod, status, paymentStatus: fee <= 0 ? "PAID" : "UNPAID", progress: shouldGoToAdmin ? 10 : 0, timeline, history: timeline, createdAt, updatedAt: createdAt, fee }; await create(application); res.status(201).json({ message: shouldGoToAdmin ? "N?Tp h?" so th?nh c?ng" : "?? luu nh?p h?" so, vui l?ng thanh to?n ?'?f g?i h?" so", dossierId, dossierCode, application, isDraft: !shouldGoToAdmin }); };
exports.getApplicationByCode = async (req, res) => { const dossierId = String(req.params.dossierId || req.params.applicationCode || "").trim(); const application = await findByCode(dossierId); if (!application) return res.status(404).json({ message: "Kh?ng t?m th?y h?" so" }); const payments = await getPaymentsByDossierId(application.dossierId || dossierId); const notifications = application.userId ? await getNotificationsByUser(application.userId) : []; const paymentStatus = String(application.paymentStatus || "").toUpperCase(); const visibleApplication = Number(application.fee || 0) <= 0 || paymentStatus === "COMPLETED" || paymentStatus === "PAID" ? application : { ...application, status: "PENDING", timeline: [], history: [] }; res.json({ application: visibleApplication, payments, notifications, timeline: visibleApplication.timeline || visibleApplication.history || [], statusDescription: STATUS_LABELS[visibleApplication.status] || visibleApplication.status }); };
exports.getMyApplications = async (req, res) => { const scope = String(req.query?.scope || "submitted").toLowerCase(); const items = await readAll(); const byUser = items.filter((x) => !userId(req) || x.userId === userId(req)); const drafts = byUser.filter((x) => String(x.status || "").toUpperCase() === "DRAFT" || (Number(x.fee || 0) > 0 && !["COMPLETED", "PAID"].includes(String(x.paymentStatus || "").toUpperCase()))); const submitted = byUser.filter((x) => Number(x.fee || 0) <= 0 || ["COMPLETED", "PAID"].includes(String(x.paymentStatus || "").toUpperCase())); const applications = scope === "all" ? byUser : submitted; res.json({ applications: applications.sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)), drafts: drafts.sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)), submitted: submitted.sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)) }); };
exports.trackApplication = async (req, res) => { const dossierId = String(req.params.dossierId || req.params.applicationCode || "").trim(); const application = await findByCode(dossierId); if (!application) return res.status(404).json({ message: "Kh?ng t?m th?y h?" so" }); const payments = await getPaymentsByDossierId(application.dossierId || dossierId); const notifications = application.userId ? await getNotificationsByUser(application.userId) : []; const paymentStatus = String(application.paymentStatus || "").toUpperCase(); const visibleApplication = Number(application.fee || 0) <= 0 || paymentStatus === "COMPLETED" || paymentStatus === "PAID" ? application : { ...application, status: "PENDING", timeline: [], history: [] }; res.json({ application: visibleApplication, payments, notifications, timeline: visibleApplication.timeline || visibleApplication.history || [], statusDescription: STATUS_LABELS[visibleApplication.status] || visibleApplication.status }); };
exports.getMyServiceNotifications = async (req, res) => { const notifications = await getNotificationsByUser(userId(req)); res.json({ notifications }); };
exports.getApplicationPayments = async (req, res) => { const dossierId = String(req.params.applicationId || req.params.applicationCode || req.params.dossierId || "").trim(); const payments = await getPaymentsByDossierId(dossierId); res.json({ payments }); };
exports.payForApplication = async (req, res) => { const { dossierId, dossierCode, paymentMethod = "BANK_TRANSFER", amount } = req.body; const targetDossierId = String(dossierId || dossierCode || "").trim(); const application = await findByCode(targetDossierId); if (!application) return res.status(404).json({ message: "Kh?ng t?m th?y h?" so" });
  const paymentId = `PAY-${Date.now()}`;
  const transferContent = `DH${Date.now()}`;
  const payment = {
    paymentId,
    dossierId: application.dossierId,
    amount: Number(amount || application.fee || 0),
    paymentMethod,
    provider: "SEPAY",
    paymentStatus: "PENDING",
    transactionId: "",
    transactionDate: "",
    bankCode: "",
    bankAccount: "",
    bankAccountName: "",
    transferContent,
    qrUrl: "",
    paidAt: "",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  await savePayment(payment);
  await updateByCode(application.dossierId, { ...application, paymentStatus: "PENDING", status: "DRAFT", updatedAt: nowIso() });
  return res.status(200).json({ message: "?? t?o b?n ghi thanh to?n PENDING", payment }); };
exports.adminCreateService = async (req, res) => { const body = req.body || {}; const validationErrors = validateServicePayload(body); if (Object.keys(validationErrors).length) return res.status(400).json({ message: "D? li??u d?<ch v? kh?ng h?p l??", errors: validationErrors }); const serviceId = generateServiceId(); const requirementId = generateRequirementId(); const faqId = generateFaqId(); const stepId = generateStepId(); const item = { serviceId, id: serviceId, name: String(body.name || "").trim(), description: String(body.description || "").trim(), categoryId: String(body.categoryId || "").trim(), categoryName: String(body.categoryName || body.category || "Kh?c").trim(), fee: Number(body.fee || 0), processingTime: String(body.processingTime || ""), documents: Array.isArray(body.documents) ? body.documents.map((doc) => ({ ...doc, requirementId, id: requirementId })) : [], faq: Array.isArray(body.faq) ? body.faq.map((faq) => ({ ...faq, faqId, id: faqId })) : [], timeline: Array.isArray(body.timeline) ? body.timeline.map((step) => ({ ...(typeof step === "object" ? step : { status: step }), stepId, id: stepId })) : [], workflow: Array.isArray(body.workflow) ? body.workflow.map((step) => ({ ...(typeof step === "object" ? step : { status: step }), stepId, id: stepId })) : [], active: body.active !== false, updatedAt: new Date().toISOString(), createdAt: body.createdAt || new Date().toISOString(), agency: String(body.agency || "").trim(), level: String(body.level || "M?c 3").trim() }; await upsertService(item); res.status(201).json({ message: "?? luu d?<ch v?", service: item, serviceId, requirementId, faqId, stepId }); };
exports.seedServices = async (_req, res) => { const result = await seedServicesToDynamo(); res.json({ message: "?? seed d?<ch v? v?o DynamoDB", ...result }); };
exports.adminUpdateService = async (req, res) => { const serviceId = req.params.serviceId; const current = await resolveService(serviceId); if (!current) return res.status(404).json({ message: "Kh?ng t?m th?y d?<ch v?" }); const next = { ...current, ...req.body, serviceId, id: serviceId, updatedAt: nowIso() }; await upsertService(next); res.json({ message: "?? c?p nh?t d?<ch v?", service: next }); };

exports.updateApplicationStatus = async (req, res) => {
  try {
    const dossierId = String(req.params.applicationCode || req.params.id || req.body?.dossierId || req.body?.dossierCode || req.body?.applicationCode || "").trim();
    const application = await findByCode(dossierId);
    if (!application) return res.status(404).json({ message: "Kh?ng t?m th?y h?" so" });

    const status = normalizeStatus(req.body?.status);
    const note = String(req.body?.note || "").trim();
    const action = String(req.body?.action || req.method?.toLowerCase() || status.toLowerCase()).trim();
    if (!ALLOWED_STATUSES.has(status)) return res.status(400).json({ message: "Tr?ng th?i kh?ng h?p l??" });
    if ((status === "NEED_MORE" || status === "REJECTED") && !note) return res.status(400).json({ message: "Vui l?ng nh?p l? do" });

    const now = nowIso();
    const timeline = pushTimeline(application, { status, action, note, actor: req.user?.email || req.user?.id || "admin", createdAt: now });
    const updated = await updateByCode(application.dossierId || dossierId, { ...application, status, updatedAt: now, timeline, history: timeline, decisionNote: note || application.decisionNote || "" });
    if (!updated) return res.status(500).json({ message: "Kh?ng c?p nh?t ?'u?c h?" so" });

    try {
      if (updated.userId) {
        const isNeedMore = status === "NEED_MORE";
        const title = isNeedMore ? `H?" so ${updated.dossierId} c?n b?. sung` : `H?" so ${updated.dossierId} c?p nh?t tr?ng th?i`;
        const message = isNeedMore ? `${updated.serviceName || "H?" so"} c?n b?. sung th?ng tin. L? do: ${note}` : `${updated.serviceName || "H?" so"} ?'? chuy?fn sang tr?ng th?i ${STATUS_LABELS[status] || status}.`;
        const notification = await createNotification({ notificationId: `NTF-${Date.now()}`, userId: updated.userId, dossierId: updated.dossierId, title, message, type: isNeedMore ? "NEED_MORE" : "STATUS_UPDATE", status, actionUrl: `/my-applications/${updated.dossierId}`, createdAt: now });
        const io = getIo();
        io?.to?.(`user_${updated.userId}`)?.emit?.("service-application-updated", { dossierId: updated.dossierId, status, timeline, notification });
      }
    } catch (socketErr) {
      console.warn("[updateApplicationStatus] notification/socket error:", socketErr?.message || socketErr);
    }

    return res.json({ message: "?? c?p nh?t tr?ng th?i h?" so", application: updated });
  } catch (err) {
    console.error("[updateApplicationStatus] error:", err);
    return res.status(500).json({ message: err.message || "L?-i c?p nh?t tr?ng th?i h?" so" });
  }
};

exports.addApplicationSupplement = async (req, res) => { const dossierId = String(req.params.dossierId || req.params.applicationCode || "").trim(); const application = await findByCode(dossierId); if (!application) return res.status(404).json({ message: "Kh?ng t?m th?y h?" so" }); if (application.userId && userId(req) && String(application.userId) !== String(userId(req))) return res.status(403).json({ message: "Kh?ng c? quy?n b?. sung h?" so n?y" }); if (String(application.status || "").toUpperCase() !== "NEED_MORE") return res.status(400).json({ message: "H?" so hi??n kh?ng ?Y tr?ng th?i y?u c?u b?. sung" }); const { formData = {}, attachments = [], note = "" } = req.body || {}; const supplementNote = String(note || formData.supplementNote || "").trim(); const nextFormData = { ...(application.formData || {}), ...formData }; const nextAttachments = Array.isArray(attachments) && attachments.length ? attachments : (application.attachments || []); const timeline = pushTimeline(application, { status: "SUPPLEMENTED", action: "supplement", note: supplementNote || "Ngu?i d?n ?'? b?. sung h?" so", actor: userId(req) || "citizen", createdAt: nowIso() }); const updated = await updateByCode(application.dossierId || dossierId, { ...application, formData: nextFormData, attachments: nextAttachments, status: "SUPPLEMENTED", updatedAt: nowIso(), timeline, history: timeline }); try { const io = getIo(); io?.to?.("admin")?.emit?.("service-application-supplemented", { dossierId: updated.dossierId, status: "SUPPLEMENTED", application: updated }); } catch {} return res.json({ message: "?? b?. sung h?" so", application: updated }); };

exports.downloadApplicationResult = async (req, res) => { const dossierId = String(req.params.dossierId || req.params.applicationCode || "").trim(); const application = await findByCode(dossierId); if (!application) return res.status(404).json({ message: "Kh?ng t?m th?y h?" so" }); if (String(application.status || "").toUpperCase() !== "COMPLETED") return res.status(400).json({ message: "H?" so chua ho?n th?nh" }); const payload = { dossierId: application.dossierId, dossierCode: application.dossierCode, serviceName: application.serviceName, citizenName: application.citizenName, completedAt: nowIso(), decisionNote: application.decisionNote || "" }; res.json({ message: "T?i k?t qu? th?nh c?ng", result: payload }); };
exports.adminDeleteService = async (req, res) => { const serviceId = req.params.serviceId; const current = await resolveService(serviceId); if (!current) return res.status(404).json({ message: "Kh?ng t?m th?y d?<ch v?" }); await upsertService({ ...current, active: false, deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }); res.json({ message: "?? x?a d?<ch v?" }); };
