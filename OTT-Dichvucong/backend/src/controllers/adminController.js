const {
  getDashboardStats,
  listDossiers,
  getDossierById,
  decideDossier,
  getOrCreateConversationByDossier,
  listConversations,
  getConversationById,
  resolveConversation,
  getAiHistory,
  getAiRules,
  updateAiRules
} = require("../store/adminStore");
const { getAdminStatistics } = require("../store/statisticsStore");
const { updateApplicationStatus } = require("./serviceController");
const { sendMessage } = require("../store/supportConversationsStore");
const { findById, updateUserRole } = require("../store/userStore");
const { getIo } = require("../socket");

exports.dashboard = async (req, res) => {
  try {
    const stats = await getDashboardStats();
    return res.json(stats);
  } catch (err) {
    return res.status(500).json({ message: err.message || "L?-i l?y dashboard" });
  }
};

exports.dossierList = async (req, res) => {
  try {
    const q = req.query.q || "";
    const dossiers = await listDossiers(q);
    return res.json({ dossiers });
  } catch (err) {
    return res.status(500).json({ message: err.message || "L?-i l?y danh s?ch h?" so" });
  }
};

exports.dossierDetail = async (req, res) => {
  try {
    const dossier = await getDossierById(req.params.id);
    if (!dossier) return res.status(404).json({ message: "Kh?ng t?m th?y h?" so" });
    return res.json({ dossier });
  } catch (err) {
    return res.status(500).json({ message: err.message || "L?-i l?y chi ti?t h?" so" });
  }
};

exports.dossierDecision = async (req, res) => {
  try {
    const action = String(req.body?.action || "");
    const note = String(req.body?.note || "").trim();
    const actionMap = { receive: "PENDING", processing: "PROCESSING", request_more: "NEED_MORE", reject: "REJECTED", complete: "COMPLETED" };
    if (!Object.prototype.hasOwnProperty.call(actionMap, action)) {
      return res.status(400).json({ message: "H?nh ?'?Tng kh?ng h?p l??" });
    }
    if ((action === "request_more" || action === "reject") && note.length < 5) {
      return res.status(400).json({ message: "Vui l?ng nh?p n?Ti dung t?'i thi?fu 5 k? t?" });
    }

    const dossier = await decideDossier({
      dossierId: req.params.id,
      action,
      note,
      adminEmail: req.user?.email
    });
    if (!dossier) return res.status(404).json({ message: "Kh?ng t?m th?y h?" so" });
    return res.json({ message: "?? c?p nh?t quy?t ?'?<nh", dossier });
  } catch (err) {
    return res.status(500).json({ message: err.message || "L?-i x? l? quy?t ?'?<nh h?" so" });
  }
};

exports.updateDossierStatus = async (req, res) => {
  try {
    return await updateApplicationStatus(req, res);
  } catch (err) {
    return res.status(500).json({ message: err.message || "L?-i c?p nh?t tr?ng th?i h?" so" });
  }
};

exports.openDossierChat = async (req, res) => {
  try {
    const conversation = await getOrCreateConversationByDossier(req.params.id);
    const normalizedMessages = Array.isArray(conversation?.messages) ? conversation.messages : [];
    return res.json({
      conversation: {
        ...conversation,
        messages: normalizedMessages
      }
    });
  } catch (err) {
    return res.status(500).json({ message: err.message || "L?-i m?Y h?Ti tho?i h?" so" });
  }
};

exports.supportConversations = async (req, res) => {
  try {
    const conversations = await listConversations();
    return res.json({ conversations });
  } catch (err) {
    return res.status(500).json({ message: err.message || "L?-i l?y danh s?ch h?Ti tho?i" });
  }
};

exports.supportConversationDetail = async (req, res) => {
  try {
    const conversation = await getConversationById(req.params.id);
    if (!conversation) return res.status(404).json({ message: "Kh?ng t?m th?y h?Ti tho?i" });
    const normalizedMessages = Array.isArray(conversation.messages)
      ? conversation.messages.map((msg) => {
          const fullName =
            msg?.sender?.fullName ||
            (msg?.from === "admin" || msg?.from === "staff"
              ? "Admin h?- tr?"
              : conversation.citizenName || "Ngu?i d?ng");
          return {
            id: msg?.id || `msg-${Date.now()}`,
            from:
              msg?.from === "admin" || msg?.from === "staff" ? "admin" : "user",
            text: String(msg?.text || ""),
            createdAt: msg?.createdAt || msg?.at || new Date().toISOString(),
            sender: {
              id: msg?.sender?.id || "",
              fullName,
              avatarUrl:
                msg?.sender?.avatarUrl ||
                `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&size=128`
            }
          };
        })
      : [];
    return res.json({
      conversation: {
        ...conversation,
        messages: normalizedMessages
      }
    });
  } catch (err) {
    return res.status(500).json({ message: err.message || "L?-i l?y chi ti?t h?Ti tho?i" });
  }
};

exports.supportSendMessage = async (req, res) => {
  try {
    const text = String(req.body?.text || "").trim();
    if (!text) return res.status(400).json({ message: "N?Ti dung kh?ng ?'u?c ?'?f tr?'ng" });

    const adminUser = await findById(req.user.id);
    const fullName = adminUser?.fullName || "Admin h?- tr?";
    const avatarUrl = adminUser?.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&size=128`;
    const sender = {
      id: req.user.id,
      fullName,
      avatarUrl
    };

    await sendMessage({
      userId: req.params.id,
      from: "admin",
      text,
      sender
    });
    const conversation = await getConversationById(req.params.id);
    if (!conversation) return res.status(404).json({ message: "Kh?ng t?m th?y h?Ti tho?i" });

    try {
      const io = getIo();
      const lastMessage = Array.isArray(conversation.messages)
        ? conversation.messages[conversation.messages.length - 1]
        : null;
      if (lastMessage) {
        io.to(`user_${req.params.id}`).emit("supportConversationMessage", {
          userId: req.params.id,
          message: lastMessage
        });
      }
    } catch (socketError) {
      console.warn("[Socket] Kh?ng th?f g?i s? ki??n supportConversationMessage:", socketError.message);
    }

    return res.json({ message: "?? g?i tin nh?n", conversation });
  } catch (err) {
    return res.status(500).json({ message: err.message || "L?-i g?i tin nh?n h?- tr?" });
  }
};

exports.supportResolve = async (req, res) => {
  try {
    const conversation = await resolveConversation(req.params.id);
    if (!conversation) return res.status(404).json({ message: "Kh?ng t?m th?y h?Ti tho?i" });
    return res.json({ message: "?? ?'?nh d?u ?'? gi?i quy?t", conversation });
  } catch (err) {
    return res.status(500).json({ message: err.message || "L?-i c?p nh?t tr?ng th?i h?Ti tho?i" });
  }
};

exports.aiHistory = async (req, res) => {
  try {
    const history = await getAiHistory();
    return res.json({ history });
  } catch (err) {
    return res.status(500).json({ message: err.message || "L?-i l?y l?<ch s? AI" });
  }
};

exports.aiRulesGet = async (req, res) => {
  try {
    const rulesText = await getAiRules();
    return res.json({ rulesText });
  } catch (err) {
    return res.status(500).json({ message: err.message || "L?-i l?y b?T quy t?c AI" });
  }
};

exports.aiRulesUpdate = async (req, res) => {
  try {
    const rulesText = String(req.body?.rulesText || "").trim();
    if (rulesText.length < 10) {
      return res.status(400).json({ message: "B?T quy t?c c?n t?'i thi?fu 10 k? t?" });
    }
    const saved = await updateAiRules(rulesText, req.user?.email);
    return res.json({ message: "C?p nh?t b?T quy t?c th?nh c?ng", rulesText: saved });
  } catch (err) {
    return res.status(500).json({ message: err.message || "L?-i c?p nh?t b?T quy t?c AI" });
  }
};

exports.getStatistics = async (req, res) => {
  try {
    const stats = await getAdminStatistics({ fromDate: req.query.fromDate, toDate: req.query.toDate });
    return res.json(stats);
  } catch (err) {
    return res.status(500).json({ message: err.message || "L?-i l?y th?'ng k?" });
  }
};

exports.updateUserRole = async (req, res) => {
  try {
    const userId = req.params.userId;
    const role = String(req.body?.role || "").trim().toLowerCase();

    if (!userId) {
      return res.status(400).json({ message: "ID ngu?i d?ng kh?ng h?p l??" });
    }

    if (!["citizen", "admin"].includes(role)) {
      return res.status(400).json({ message: "Vai tr? kh?ng h?p l??. Ph?i l? 'citizen' ho?c 'admin'" });
    }

    const user = await findById(userId);
    if (!user) {
      return res.status(404).json({ message: "Kh?ng t?m th?y ngu?i d?ng" });
    }

    const updatedUser = await updateUserRole(userId, role);
    return res.json({ message: `C?p nh?t vai tr? ngu?i d?ng th?nh c?ng`, user: updatedUser });
  } catch (err) {
    return res.status(500).json({ message: err.message || "L?-i c?p nh?t vai tr? ngu?i d?ng" });
  }
};
