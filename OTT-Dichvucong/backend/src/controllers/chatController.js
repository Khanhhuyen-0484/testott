const { getChatHistory, sendMessage } = require("../store/supportConversationsStore");
const userStore = require("../store/userStore");
const { getIo } = require("../socket");
const multiChatStore = require("../store/multiChatStore");
const crypto = require("crypto");
const path = require("path");
const multer = require("multer");
const { createPresignedPut, isS3Configured } = require("../config/s3");
const { getAiRules, appendAiHistory } = require("../store/adminStore");

const TOPIC_KB = {
  birth: {
    label: "?'?fng k? khai sinh",
    ask: "??y l? ?'?fng k? khai sinh ?'?ng h?n cho tr? m?>i sinh hay ?'?fng k? l?i gi?y khai sinh ?'? m?t/th?t l?c?",
    documents:
      "V?>i ?'?fng k? khai sinh ?'?ng h?n, h?" so thu?ng g?"m: gi?y ch?ng sinh ho?c gi?y t? thay th?, CCCD/c?fn cu?>c c?a cha m? ho?c ngu?i ?'i ?'?fng k?, v? th?ng tin cu tr? ?'?f x?c ?'?<nh noi ti?p nh?n. N?u tr? chua c? gi?y ch?ng sinh, co quan h?T t?<ch thu?ng s? y?u c?u gi?y x?c nh?n ho?c t?i li??u thay th? theo tru?ng h?p th?c t?.",
    steps:
      "B?n c? th?f l?m theo 3 bu?>c: 1. Chu?n b?< gi?y ch?ng sinh ho?c gi?y t? thay th? c?ng gi?y t? t?y th?n c?a ngu?i ?'i ?'?fng k?. 2. N?Tp h?" so t?i UBND c?p x? noi cu tr? c?a cha ho?c m?, ho?c th?c hi??n tr?n c?.ng d?<ch v? c?ng n?u ?'?<a phuong h?- tr?. 3. Theo d?i k?t qu? v? ?'?'i chi?u th?ng tin c?a tr?, cha m? tru?>c khi nh?n gi?y khai sinh.",
    ontime:
      "N?u l? ?'?fng k? khai sinh ?'?ng h?n, b?n n?n chu?n b?< gi?y ch?ng sinh ho?c gi?y t? thay th?, CCCD/c?fn cu?>c c?a cha, m? ho?c ngu?i ?'i ?'?fng k?, v? th?ng tin noi cu tr? ?'?f x?c ?'?<nh UBND c?p x? c? th?m quy?n ti?p nh?n. Sau ?'? b?n c? th?f n?Tp tr?c ti?p ho?c n?Tp tr?c tuy?n n?u ?'?<a phuong h?- tr?.",
    reissue:
      "N?u l? ?'?fng k? l?i khai sinh, b?n thu?ng c?n b?n cam k?t ho?c gi?y t? ch?ng minh th?ng tin khai sinh cu, gi?y t? t?y th?n c?a ngu?i y?u c?u v? t?i li??u li?n quan ?'?f co quan h?T t?<ch ?'?'i chi?u. Tru?ng h?p n?y d?. kh?c nhau theo noi ?'?fng k? tru?>c ?'?y, n?n b?n n?n chu?n b?< th?m th?ng tin noi ?'? ?'?fng k? khai sinh l?n ?'?u.",
    online:
      "N?u b?n mu?'n n?Tp ?'?fng k? khai sinh online, h?y chu?n b?< ?nh ho?c b?n scan gi?y ch?ng sinh, gi?y t? t?y th?n c?a ngu?i ?'i ?'?fng k? v? th?ng tin cu tr?. Sau ?'? ?'?fng nh?p c?.ng d?<ch v? c?ng c?a ?'?<a phuong, ch?n th? t?c ?'?fng k? khai sinh, ?'i?n th?ng tin c?a tr? v? cha m?, t?i h?" so l?n r?"i theo d?i tr?ng th?i x? l?. Khi co quan h?T t?<ch y?u c?u ?'?'i chi?u b?n g?'c, b?n c?n mang gi?y t? th?t ?'?n theo hu?>ng d?n.",
    offline:
      "N?u n?Tp tr?c ti?p ?'?fng k? khai sinh, b?n mang h?" so ?'?n UBND c?p x? c? th?m quy?n, n?Tp gi?y t? cho b?T ph?n ti?p nh?n, ki?fm tra l?i th?ng tin c?a tr? v? cha m? r?"i ch? tr? k?t qu? theo gi?y h?n ho?c hu?>ng d?n t?i ch?-.",
    authority:
      "Noi ti?p nh?n thu?ng l? UBND c?p x? noi cu tr? c?a cha ho?c m?. N?u ?'?<a phuong c? h?- tr? tr?c tuy?n, b?n v?n c?n ch?n ?'?ng co quan ti?p nh?n theo noi cu tr? th?c t?.",
    fees:
      "Nhi?u ?'?<a phuong x? l? ?'?fng k? khai sinh ?'?ng h?n v?>i m?c ph? r?t th?p ho?c kh?ng thu ph? trong m?Tt s?' tru?ng h?p, nhung b?n v?n n?n ki?fm tra bi?fu ph? t?i noi ti?p nh?n ?'?f c? th?ng tin ch?nh x?c nh?t.",
    tips: [
      "Ki?fm tra k? h? t?n, ng?y sinh, qu? qu?n c?a tr? tru?>c khi x?c nh?n h?" so.",
      "N?u thi?u gi?y ch?ng sinh, n?n h?i tru?>c co quan h?T t?<ch v? gi?y t? thay th? ?'u?c ch?p nh?n.",
      "N?u l?m online, h?y chu?n b?< ?nh ch?p ho?c b?n scan gi?y t? r? n?t."
    ]
  },
  residence: {
    label: "?'?fng k? t?m tr?",
    ask: "B?n ?'ang c?n hu?>ng d?n ph?n h?" so c?n chu?n b?< hay c?c bu?>c n?Tp t?m tr??",
    documents:
      "V?>i th? t?c t?m tr?, b?n thu?ng c?n gi?y t? t?y th?n, th?ng tin ho?c gi?y t? ch?ng minh ch?- ?Y h?p ph?p, v? bi?fu m?u/khai b?o theo hu?>ng d?n c?a ?'?<a phuong.",
    steps:
      "C?c bu?>c thu?ng l?: 1. Chu?n b?< gi?y t? t?y th?n v? gi?y t? v? noi ?Y. 2. K? khai th?ng tin t?m tr? tr?c tuy?n ho?c t?i noi ti?p nh?n. 3. Theo d?i tr?ng th?i x? l? v? b?. sung n?u co quan ti?p nh?n y?u c?u.",
    online:
      "N?u n?Tp online, b?n n?n chu?n b?< b?n scan gi?y t? t?y th?n v? gi?y t? v? ch?- ?Y h?p ph?p ?'?f t?i l?n c?.ng d?<ch v? c?ng.",
    authority:
      "Th? t?c t?m tr? thu?ng do co quan c?ng an ho?c co quan qu?n l? cu tr? t?i ?'?<a phuong ti?p nh?n, t?y m? h?nh tri?fn khai c?a noi b?n cu tr?.",
    timeline:
      "Th?i gian x? l? t?m tr? c? th?f kh?c nhau theo ?'?<a phuong v? t?nh tr?ng h?" so. B?n n?n theo d?i k?t qu? tr?n c?.ng ho?c h?i tr?c ti?p noi ti?p nh?n sau khi n?Tp.",
    tips: [
      "Chu?n b?< ?'?y ?'? gi?y t? v? ch?- ?Y h?p ph?p ?'?f tr?nh b?< y?u c?u b?. sung.",
      "N?u b?n thu? tr?, n?n ki?fm tra tru?>c gi?y t? m? ch? nh? c?n cung c?p."
    ]
  },
  license: {
    label: "?'?.i/c?p l?i gi?y ph?p l?i xe",
    ask: "B?n ?'ang h?i v? c?p ?'?.i hay c?p l?i gi?y ph?p l?i xe?",
    documents:
      "Thu?ng s? c? nh?m gi?y t? nhu GPLX hi??n c? ho?c th?ng tin GPLX cu, gi?y t? t?y th?n, ?nh ch?n dung v? ?'?i khi l? gi?y kh?m s?c kh?e t?y tru?ng h?p.",
    steps:
      "B?n n?n x?c ?'?<nh r? l? c?p ?'?.i hay c?p l?i, sau ?'? chu?n b?< h?" so, n?Tp t?i k?nh ti?p nh?n ph? h?p v? theo d?i k?t qu? x? l? theo gi?y h?n ho?c h?? th?'ng tr?c tuy?n.",
    online:
      "N?u n?Tp online ?'?.i GPLX, b?n n?n chu?n b?< ?nh ch?n dung, gi?y t? t?y th?n, th?ng tin GPLX v? c?c gi?y t? ?'u?c y?u c?u ?Y d?ng s?' h?a r? n?t.",
    authority:
      "Th? t?c GPLX thu?ng do co quan giao th?ng ho?c ?'on v?< ?'u?c ?y quy?n ti?p nh?n. B?n n?n ki?fm tra c?.ng d?<ch v? c?ng ho?c noi ti?p nh?n t?i ?'?<a phuong.",
    timeline:
      "Th?i gian x? l? ?'?.i ho?c c?p l?i GPLX t?y t?ng ?'?<a phuong v? lo?i th? t?c. B?n n?n theo d?i gi?y h?n ho?c tr?ng th?i h?" so tr?c tuy?n.",
    tips: [
      "Ki?fm tra th?i h?n GPLX hi??n t?i tru?>c khi ch?n th? t?c c?p ?'?.i hay c?p l?i.",
      "?nh ch?n dung v? gi?y t? t?i l?n n?n r?, ?'? s?ng, kh?ng c?t m?t g?c."
    ]
  },
  passport: {
    label: "c?p/?'?.i h?T chi?u",
    ask: "B?n ?'ang c?n hu?>ng d?n c?p m?>i hay c?p l?i h?T chi?u?",
    documents:
      "B?n n?n chu?n b?< ?nh ?'?ng chu?n, gi?y t? t?y th?n v? ki?fm tra y?u c?u h?" so c?a co quan qu?n l? xu?t nh?p c?nh ?'?'i v?>i tru?ng h?p c?a b?n.",
    steps:
      "C?c bu?>c thu?ng l? chu?n b?< h?" so, ch?n noi ti?p nh?n, k? khai th?ng tin ch?nh x?c v? theo d?i l?<ch h?n ho?c tr?ng th?i x? l?.",
    authority:
      "H?T chi?u thu?ng do co quan qu?n l? xu?t nh?p c?nh ti?p nh?n v? x? l?. B?n n?n ki?fm tra ?'?ng noi ti?p nh?n theo ?'?<a phuong ho?c di??n th? t?c c?a m?nh.",
    tips: [
      "?nh d?ng cho h?T chi?u n?n ?'?ng chu?n ?'?f tr?nh b?< y?u c?u n?Tp l?i.",
      "Ki?fm tra k? th?ng tin nh?n th?n tru?>c khi x?c nh?n h?" so."
    ]
  },
  identity: {
    label: "c?p/c?p ?'?.i/c?p l?i CCCD",
    ask: "B?n ?'ang l?m CCCD l?n ?'?u, c?p ?'?.i hay c?p l?i?",
    documents:
      "V?>i CCCD/C?fn cu?>c, b?n n?n chu?n b?< gi?y t? t?y th?n hi??n c?, th?ng tin cu tr? v? ki?fm tra co quan c?ng an noi ti?p nh?n.",
    steps:
      "B?n n?n x?c ?'?<nh ?'?ng lo?i th? t?c tru?>c, sau ?'? chu?n b?< gi?y t? theo tru?ng h?p c?p m?>i, c?p ?'?.i ho?c c?p l?i r?"i ?'?n ?'?ng noi ti?p nh?n.",
    authority:
      "CCCD/C?fn cu?>c thu?ng do co quan c?ng an c? th?m quy?n ti?p nh?n v? x? l? theo noi cu tr? ho?c theo ?'i?fm ti?p nh?n ?'u?c b?' tr?.",
    tips: [
      "N?u l? c?p ?'?.i, b?n n?n mang theo gi?y t? hi??n c? ?'?f ?'?'i chi?u.",
      "N?n ki?fm tra tru?>c noi ti?p nh?n ?'?f tr?nh ?'i sai ?'i?fm l?m th? t?c."
    ]
  }
};

function normalizeVietnameseChatText(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/\bko\b|\bkhong\b/g, "kh?ng")
    .replace(/\bokela\b|\boki\b|\boke\b/g, "ok")
    .replace(/\bccc?'\b/g, "cccd")
    .trim();
}

function buildBulletList(items = []) {
  if (!Array.isArray(items) || !items.length) return "";
  return items.map((item) => `- ${item}`).join("\n");
}

// ?"??"??"? FIX: emit "new-message" ?'?n t?ng user_${memberId} ?"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"?
// V?n ?'? cu: emit v?o `chat_${roomId}` nhung frontend kh?ng join room ?'?.
// Frontend ch?? join `user_${userId}` khi connect socket.
// Fix: l?y members c?a room ??' emit ?'?n `user_${memberId}` t?ng ngu?i.
// Event name ph?i l? "new-message" ?'?f kh?>p v?>i ChatPage.jsx socket listener.
async function emitToRoomMembers(room, payload) {
  try {
    const io = getIo();
    const members = room?.members || [];
    members.forEach((m) => {
      const memberId = typeof m === "object" ? m.id : m;
      if (!memberId) return;
      io.to(`user_${memberId}`).emit("new-message", payload);
    });
  } catch (e) {
    console.warn("[Socket] Kh?ng th?f emit new-message:", e.message);
  }
}

async function emitToRoomAction(room, eventName, payload) {
  try {
    const io = getIo();
    const members = room?.members || [];
    members.forEach((m) => {
      const memberId = typeof m === "object" ? m.id : m;
      if (!memberId) return;
      io.to(`user_${memberId}`).emit(eventName, payload);
    });
  } catch (e) {
    console.warn(`[Socket] Kh?ng th?f emit ${eventName}:`, e.message);
  }
}

// ?"??"??"? Staff chat ?"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"?
exports.staffHistory = async (req, res) => {
  try {
    const conversation = await getChatHistory(req.user.id);
    const messages = Array.isArray(conversation?.messages) ? conversation.messages : [];
    res.json({ messages });
  } catch (err) {
    res.status(500).json({ message: err.message || "L?-i ?'?c h?Ti tho?i" });
  }
};

exports.staffSend = async (req, res) => {
  try {
    const text = String(req.body?.text || "").trim();
    if (!text) return res.status(400).json({ message: "N?Ti dung kh?ng ?'u?c tr?'ng" });
    if (text.length > 2000) return res.status(400).json({ message: "T?'i ?'a 2000 k? t?" });

    const conversationId = req.user.id;
    const userData = await userStore.findById(req.user.id);
    const fullName = userData?.fullName || "Ngu?i d?ng";
    const avatarUrl =
      userData?.avatarUrl ||
      `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&size=128`;
    const sender = { id: req.user.id, fullName, avatarUrl };

    await sendMessage({ userId: conversationId, from: "user", text, sender });

    const conversation = await getChatHistory(conversationId);
    const messages = Array.isArray(conversation?.messages) ? conversation.messages : [];

    try {
      const io = getIo();
      const lastMessage = messages[messages.length - 1];
      if (lastMessage) {
        io.to("admin").emit("supportConversationMessage", {
          userId: conversationId,
          message: lastMessage,
        });
      }
    } catch (socketError) {
      console.warn("[Socket] supportConversationMessage:", socketError.message);
    }

    res.json({ ok: true, messages });
  } catch (err) {
    res.status(500).json({ message: err.message || "L?-i g?i tin" });
  }
};

function detectFallbackTopic(text) {
  const t = normalizeVietnameseChatText(text);
  if (/khai sinh|h?T t?<ch|gi?y khai sinh/.test(t)) return "birth";
  if (/t?m tr?|?'?fng k? cu tr?|luu tr?/.test(t)) return "residence";
  if (/gplx|l?i xe|gi?y ph?p l?i/.test(t)) return "license";
  if (/h?T chi?u|passport|xu?t nh?p c?nh/.test(t)) return "passport";
  if (/c?fn cu?>c|cccd|ch?ng minh thu/.test(t)) return "identity";
  if (/l?? ph?|ph?|bao nhi?u ti?n/.test(t)) return "fees";
  if (/th?i gian|gi? l?m|m?y gi?/.test(t)) return "hours";
  return "";
}

function detectFollowUpIntent(text) {
  const t = normalizeVietnameseChatText(text);
  if (/hu?>ng d?n ?'?ng hon|n?i r? hon|chi ti?t hon|c? th?f hon|hu?>ng d?n ti?p|gi?i th?ch th?m/.test(t)) {
    return "detail";
  }
  if (/c?n gi?y t? g?|h?" so g?"m g?|chu?n b?< g?/.test(t)) {
    return "documents";
  }
  if (/th? t?c th? n?o|c?c bu?>c|quy tr?nh/.test(t)) {
    return "steps";
  }
  if (/?'?fng k? l?i|l?m l?i/.test(t)) {
    return "reissue";
  }
  if (/?'?ng h?n/.test(t)) {
    return "ontime";
  }
  if (/n?Tp online|tr?c tuy?n|online/.test(t)) {
    return "online";
  }
  if (/n?Tp tr?c ti?p|?'?n tr?c ti?p|tr?c ti?p/.test(t)) {
    return "offline";
  }
  if (/?Y ?'?u|noi n?o|co quan n?o|ubnd n?o|n?Tp ?Y ?'?u/.test(t)) {
    return "authority";
  }
  if (/luu ?|c?n ch? ?|c?n luu ?|m?o/.test(t)) {
    return "tips";
  }
  if (/bao l?u|m?t bao l?u|th?i h?n|m?y ng?y/.test(t)) {
    return "timeline";
  }
  if (/?'?ng r?"i|?'?ng v?y|ph?i|v?ng|?|ok|oke/.test(t)) {
    return "confirm_yes";
  }
  if (/kh?ng ph?i|kh?ng|chua|sai r?"i/.test(t)) {
    return "confirm_no";
  }
  return "";
}

function isShortFollowUpAnswer(text) {
  const t = normalizeVietnameseChatText(text);
  if (!t) return false;
  if (t.length <= 30) return true;
  return /^(?'?ng h?n|?'?fng k? l?i|n?Tp online|online|tr?c ti?p|c?n gi?y t? g?|c?c bu?>c|hu?>ng d?n ti?p)$/i.test(t);
}

function inferTopicFromAssistantPrompt(text) {
  const t = normalizeVietnameseChatText(text);
  if (/khai sinh|gi?y khai sinh/.test(t)) return "birth";
  if (/t?m tr?|cu tr?/.test(t)) return "residence";
  if (/gplx|gi?y ph?p l?i|l?i xe/.test(t)) return "license";
  if (/h?T chi?u|passport/.test(t)) return "passport";
  if (/cccd|c?fn cu?>c|ch?ng minh thu/.test(t)) return "identity";
  return "";
}

function inferPendingQuestion(text) {
  const t = normalizeVietnameseChatText(text);
  if (/?'?ng h?n|?'?fng k? l?i/.test(t)) return "birth_branch";
  if (/c?p m?>i|c?p l?i|c?p ?'?.i/.test(t)) return "variant_branch";
  if (/h?" so|gi?y t?|chu?n b?</.test(t)) return "documents";
  if (/c?c bu?>c|quy tr?nh|th? t?c/.test(t)) return "steps";
  if (/online|tr?c tuy?n|tr?c ti?p/.test(t)) return "channel_branch";
  if (/?Y ?'?u|co quan n?o|ubnd/.test(t)) return "authority";
  return "";
}

function findTopicFromMessages(messages) {
  const list = Array.isArray(messages) ? messages : [];
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const content = String(list[i]?.content || "");
    const topic = detectFallbackTopic(content);
    if (topic) return topic;
  }
  return "";
}

function findLastAssistantMessage(messages) {
  const list = Array.isArray(messages) ? messages : [];
  for (let i = list.length - 1; i >= 0; i -= 1) {
    if (list[i]?.role === "assistant" && typeof list[i]?.content === "string") {
      return list[i].content;
    }
  }
  return "";
}

function buildConversationState(messages, userText) {
  const lastAssistantMessage = findLastAssistantMessage(messages.slice(0, -1));
  const assistantTopic = inferTopicFromAssistantPrompt(lastAssistantMessage);
  const previousTopic = findTopicFromMessages(messages.slice(0, -1));
  const currentTopic = detectFallbackTopic(userText);
  const topic = currentTopic || assistantTopic || previousTopic;
  const followUpIntent = detectFollowUpIntent(userText);
  const pendingQuestion = inferPendingQuestion(lastAssistantMessage);

  return {
    topic,
    followUpIntent,
    pendingQuestion,
    lastAssistantMessage
  };
}

function replyForTopic(topic, intent) {
  const kb = TOPIC_KB[topic];
  if (!kb) return "";
  if (intent === "detail") return kb.steps || kb.documents || kb.ask || "";
  if (intent === "tips") {
    return kb.tips?.length
      ? `M?Tt s?' luu ? khi l?m ${kb.label}:\n${buildBulletList(kb.tips)}`
      : kb.documents || kb.ask || "";
  }
  if (intent === "fees") {
    return kb.fees || `L?? ph? c?a ${kb.label} c? th?f thay ?'?.i theo ?'?<a phuong v? lo?i h?" so. B?n n?n ki?fm tra bi?fu ph? t?i noi ti?p nh?n ho?c tr?n c?.ng d?<ch v? c?ng ?'?f bi?t ch?nh x?c.`;
  }
  if (intent === "timeline") {
    return `Th?i h?n x? l? c?a ${kb.label} c? th?f kh?c theo t?ng ?'?<a phuong v? t?ng tru?ng h?p h?" so. B?n n?n ki?fm tra th?ng b?o t?i noi ti?p nh?n ho?c tr?n c?.ng d?<ch v? c?ng sau khi n?Tp h?" so ?'?f bi?t m?'c th?i gian ch?nh x?c.`;
  }
  return kb[intent] || kb.ask || "";
}

function composeSmartReply(topic, primaryAnswer, intent) {
  const kb = TOPIC_KB[topic];
  if (!kb) return primaryAnswer;

  const nextStepByIntent = {
    documents: "N?u b?n mu?'n, t?i c? th?f n?i ti?p ph?n c?c bu?>c n?Tp h?" so ho?c noi ti?p nh?n.",
    steps: "N?u b?n mu?'n, t?i c? th?f n?i ti?p ph?n gi?y t? c?n chu?n b?< ho?c c?ch n?Tp online.",
    ontime: "N?u b?n mu?'n, t?i c? th?f t?ch ti?p ph?n h?" so c?n chu?n b?< ho?c noi n?Tp c? th?f.",
    reissue: "N?u b?n mu?'n, t?i c? th?f n?i ti?p ph?n gi?y t? c?n ?'?'i chi?u ho?c noi ti?p nh?n.",
    online: "N?u b?n mu?'n, t?i c? th?f n?i ti?p ph?n gi?y t? c?n scan ho?c c?c l?-i thu?ng g?p khi n?Tp online.",
    offline: "N?u b?n mu?'n, t?i c? th?f n?i ti?p ph?n h?" so c?n mang theo ho?c th?i gian x? l? thu?ng g?p.",
    authority: "N?u b?n mu?'n, t?i c? th?f n?i ti?p ph?n h?" so ho?c c?c bu?>c n?Tp.",
    timeline: "N?u b?n mu?'n, t?i c? th?f n?i ti?p ph?n h?" so ho?c noi ti?p nh?n."
  };

  const nextStep = nextStepByIntent[intent] || "N?u b?n mu?'n, t?i c? th?f n?i ti?p ph?n h?" so, c?c bu?>c, noi n?Tp ho?c luu ? quan tr?ng.";
  return `${primaryAnswer}\n\n${nextStep}`;
}

function buildAiSuggestions(topic, intent = "") {
  const suggestionMap = {
    birth: [
      "C?n gi?y t? g??",
      "N?Tp online th? n?o?",
      "N?Tp ?Y ?'?u?",
      "C? luu ? g? quan tr?ng?"
    ],
    residence: [
      "H?" so c?n chu?n b?< g??",
      "C?c bu?>c n?Tp t?m tr? l? g??",
      "N?Tp online ?'u?c kh?ng?",
      "Th?i gian x? l? bao l?u?"
    ],
    license: [
      "??.i GPLX c?n gi?y t? g??",
      "N?Tp online ra sao?",
      "Th?i gian x? l? bao l?u?",
      "C? luu ? g??"
    ],
    passport: [
      "C?p h?T chi?u c?n gi?y t? g??",
      "N?Tp ?Y ?'?u?",
      "C?c bu?>c th?c hi??n th? n?o?",
      "C? luu ? g??"
    ],
    identity: [
      "L?m CCCD c?n gi?y t? g??",
      "N?Tp ?Y ?'?u?",
      "Th?i gian x? l? bao l?u?",
      "C? luu ? g??"
    ]
  };

  const generic = [
    "C?n gi?y t? g??",
    "C?c bu?>c th?c hi??n th? n?o?",
    "N?Tp ?Y ?'?u?",
    "C? luu ? g? quan tr?ng?"
  ];

  const suggestions = suggestionMap[topic] || generic;
  if (!intent) return suggestions.slice(0, 4);

  return suggestions
    .filter((item) => {
      const normalized = normalizeVietnameseChatText(item);
      if (intent === "documents") return !normalized.includes("gi?y t?");
      if (intent === "steps") return !normalized.includes("bu?>c");
      if (intent === "authority") return !normalized.includes("?Y ?'?u");
      if (intent === "tips") return !normalized.includes("luu ?");
      return true;
    })
    .slice(0, 4);
}

function replyForPendingQuestion(topic, pendingQuestion, userText, intent) {
  if (!topic) return "";
  if (pendingQuestion === "birth_branch") {
    if (intent === "ontime") return replyForTopic(topic, "ontime");
    if (intent === "reissue") return replyForTopic(topic, "reissue");
  }
  if (pendingQuestion === "channel_branch") {
    if (intent === "online") return replyForTopic(topic, "online");
    if (intent === "offline") return replyForTopic(topic, "offline");
  }
  if (pendingQuestion === "documents" && (intent === "confirm_yes" || isShortFollowUpAnswer(userText))) {
    return replyForTopic(topic, "documents");
  }
  if (pendingQuestion === "steps" && (intent === "confirm_yes" || isShortFollowUpAnswer(userText))) {
    return replyForTopic(topic, "steps");
  }
  return "";
}

function buildConversationSummary(messages, userText) {
  const state = buildConversationState(messages, userText);
  const recentUserMessages = messages
    .filter((message) => message?.role === "user" && typeof message?.content === "string")
    .slice(-3)
    .map((message) => `- ${message.content}`)
    .join("\n");

  return [
    state.topic ? `Ch? ?'? hi??n t?i suy ra: ${state.topic}` : "Chua suy ra r? ch? ?'? hi??n t?i",
    state.followUpIntent ? `? ?'?<nh g?n nh?t c?a ngu?i d?ng: ${state.followUpIntent}` : "? ?'?<nh g?n nh?t chua r?",
    state.pendingQuestion ? `C?u h?i nh?nh g?n nh?t c?a tr? l?: ${state.pendingQuestion}` : "Kh?ng c? c?u h?i nh?nh ?'ang ch?",
    state.lastAssistantMessage ? `Tin nh?n g?n nh?t c?a tr? l?: ${state.lastAssistantMessage}` : "Chua c? tin nh?n tr? l? g?n tru?>c ?'?",
    recentUserMessages ? `Ba tin nh?n ngu?i d?ng g?n nh?t:\n${recentUserMessages}` : "Chua c? ?'? l?<ch s? ngu?i d?ng"
  ].join("\n");
}

function fallbackAiReply(userText, messages = []) {
  const t = normalizeVietnameseChatText(userText);
  const state = buildConversationState(messages, userText);
  const { topic, followUpIntent, pendingQuestion } = state;

  const pendingReply = replyForPendingQuestion(topic, pendingQuestion, userText, followUpIntent);
  if (pendingReply) return composeSmartReply(topic, pendingReply, followUpIntent);

  if (topic && isShortFollowUpAnswer(userText) && followUpIntent) {
    const intentReply = replyForTopic(topic, followUpIntent);
    if (intentReply) return composeSmartReply(topic, intentReply, followUpIntent);
  }

  if (topic && followUpIntent) {
    const followUpReply = replyForTopic(topic, followUpIntent);
    if (followUpReply) return composeSmartReply(topic, followUpReply, followUpIntent);
  }

  if (/ch?o|xin ch?o|hello|hi\b/.test(t)) {
    return "Xin ch?o! T?i l? tr? l? AI h?- tr? th? t?c h?nh ch?nh tr?n C?.ng d?<ch v? c?ng. B?n c?n tra c?u th? t?c, bi?fu m?u hay hu?>ng d?n n?Tp h?" so?";
  }
  if (/c?fn cu?>c|cccd|ch?ng minh thu/.test(t)) {
    return "V?>i th? t?c li?n quan CCCD/C?fn cu?>c, b?n n?n chu?n b?< gi?y t? t?y th?n hi??n c?, th?ng tin cu tr? v? ki?fm tra co quan c?ng an noi ti?p nh?n. N?u b?n n?i r? l? c?p m?>i, c?p ?'?.i hay c?p l?i, t?i s? hu?>ng d?n s?t hon.";
  }
  if (/khai sinh|h?T t?<ch|gi?y khai sinh/.test(t)) {
    return "??fng k? khai sinh thu?ng c?n th?ng tin cha m?, gi?y ch?ng sinh ho?c gi?y t? thay th?, c?ng gi?y t? t?y th?n c?a ngu?i ?'i ?'?fng k?. B?n cho t?i bi?t l? ?'?fng k? ?'?ng h?n hay ?'?fng k? l?i ?'?f t?i hu?>ng d?n ?'?ng hon.";
  }
  if (/t?m tr?|?'?fng k? cu tr?/.test(t)) {
    return "V? t?m tr?: thu?ng c?n CMND/CCCD, gi?y t? ch?- ?Y, phi?u b?o t?m v?ng (n?u c?). B?n n?n ch?n ?'?ng c?p ti?p nh?n (x?/phu?ng) tr?n c?.ng v? ?'i?n form tr?c tuy?n.";
  }
  if (/gplx|l?i xe|gi?y ph?p l?i/.test(t)) {
    return "??.i GPLX: chu?n b?< ?nh, gi?y kh?m s?c kh?e, GPLX cu v? l?m theo hu?>ng d?n tr?n CSDL giao th?ng / c?.ng d?<ch v? c?ng ??" c? th?f n?Tp tr?c tuy?n t?y ?'?<a phuong.";
  }
  if (/h?T chi?u|passport/.test(t)) {
    return "C?p/?'?.i h?T chi?u: ki?fm tra ?nh, CMND/CCCD, l?<ch h?n (n?u c?). Nhi?u bu?>c ?'? ?'u?c ?'i??n t? h?a ??" xem m?c H?T chi?u tr?n c?.ng.";
  }
  if (/th?i gian|gi? l?m|m?y gi?/.test(t)) {
    return "Th?ng thu?ng b?T ph?n m?Tt c?a l?m vi??c gi? h?nh ch?nh (s?ng 7h30??"11h30, chi?u 13h30??"17h00), c? th?f kh?c theo ?'?<a phuong.";
  }
  if (/l?? ph?|ph?|bao nhi?u ti?n/.test(t)) {
    return "L?? ph? ph? thu?Tc t?ng th? t?c v? t?ng ?'?<a phuong. B?n h?y cho t?i bi?t t?n th? t?c v? noi n?Tp h?" so ?'?f t?i hu?>ng d?n c?ch ki?fm tra ch?nh x?c hon tr?n c?.ng ho?c t?i co quan ti?p nh?n.";
  }
  if (topic) {
    const topicReply = replyForTopic(topic, "");
    if (topicReply) return composeSmartReply(topic, topicReply, "");
  }

  return "C?m on b?n ?'? li?n h??. H?y m? t? ng?n th? t?c (v? d?: t?m tr?, GPLX, h?T t?<ch) ho?c d?ng ? t?m ki?m ?Y tr?n ?'?f tra c?u. N?u c?n trao ?'?.i v?>i c?n b?T, h?y ch?n tab ??oChat c?n b?T???.";
}

function buildKnowledgeSnippets(userText) {
  const t = String(userText || "").toLowerCase();
  const snippets = [];

  if (/t?m tr?|?'?fng k? cu tr?|luu tr?/.test(t)) {
    snippets.push(
      "Ch? ?'? cu tr?/t?m tr?: uu ti?n hu?>ng d?n theo nh?m th?ng tin g?"m gi?y t? t?y th?n, gi?y t? ch?- ?Y h?p ph?p, bu?>c k? khai tr?c tuy?n v? luu ? x?c nh?n t?i c?ng an/co quan cu tr? ?'?<a phuong."
    );
  }
  if (/gplx|gi?y ph?p l?i|l?i xe/.test(t)) {
    snippets.push(
      "Ch? ?'? GPLX: n?u r? kh?c bi??t gi?a c?p ?'?.i, c?p l?i, ?'?.i do s?p h?t h?n; nh?c ki?fm tra ?nh ch?n dung, gi?y kh?m s?c kh?e v? k?nh n?Tp h?" so tr?c tuy?n c?a ?'?<a phuong."
    );
  }
  if (/h?T chi?u|passport|xu?t nh?p c?nh/.test(t)) {
    snippets.push(
      "Ch? ?'? h?T chi?u: g?i ? ngu?i d?ng chu?n b?< ?nh ?'?ng chu?n, CCCD/c?fn cu?>c, th?ng tin nh?n th?n v? ki?fm tra noi ti?p nh?n h?" so thu?Tc co quan qu?n l? xu?t nh?p c?nh."
    );
  }
  if (/khai sinh|h?T t?<ch|k?t h?n|khai t?/.test(t)) {
    snippets.push(
      "Ch? ?'? h?T t?<ch: tr? l?i theo c?u tr?c gi?y t? c?n c?, ?'?'i tu?ng ?'i n?Tp, noi ?'?fng k?, th?i h?n x? l? v? tru?ng h?p ph?i ?'?'i chi?u b?n g?'c."
    );
  }
  if (/?'?t ?'ai|s?. ?'?|quy?n s? d?ng ?'?t/.test(t)) {
    snippets.push(
      "Ch? ?'? ?'?t ?'ai: nh?n m?nh h?" so thu?ng nhi?u bi?n th?f theo lo?i th? t?c, c?n h?i th?m ?'?<a phuong v? lo?i bi?n ?'?Tng tru?>c khi k?t lu?n."
    );
  }

  return snippets;
}

function buildSystemPrompt(rulesText, conversationSummary, snippets = []) {
  const knowledgeBlock = snippets.length
    ? `\nNg? c?nh ch? ?'? li?n quan:\n- ${snippets.join("\n- ")}`
    : "";

  return `B?n l? GOV Assistant, tr? l? AI c?a C?.ng D?<ch v? c?ng Vi??t Nam.

M?c ti?u:
- H?- tr? ngu?i d?n tra c?u th? t?c h?nh ch?nh, gi?y t?, quy tr?nh v? luu ? th?c hi??n.
- Tr? l?i gi?'ng tr? l? chat hi??n ?'?i: th?n thi??n, m?ch l?c, g?n, c? ?'?<nh hu?>ng bu?>c ti?p theo.
- Tuy??t ?'?'i kh?ng b?<a th?ng tin ph?p l? ho?c cam k?t k?t qu? x? l? h?" so.

Quy t?c tr? l?i hi??n h?nh do admin c?u h?nh:
${rulesText}${knowledgeBlock}

T?m t?t h?Ti tho?i hi??n c?:
${conversationSummary}

C?ch tr? l?i:
- Lu?n tr? l?i b?ng ti?ng Vi??t.
- Uu ti?n c?u tr?c ng?n: tr? l?i tr?c ti?p, r?"i li??t k? 2-5 ? quan tr?ng n?u c?n.
- N?u c?u h?i chua ?'? d? ki??n, h?i l?i t?'i ?'a 1-2 ? quan tr?ng nh?t.
- N?u ngu?i d?ng ?'ang tr? l?i cho c?u h?i ph?n nh?nh tru?>c ?'? c?a tr? l?, h?y n?'i ti?p ?'?ng nh?nh thay v? h?i l?i t? ?'?u.
- N?u c? r?i ro sai kh?c theo ?'?<a phuong/quy ?'?<nh m?>i, n?i r? ?'?y l? th?ng tin tham kh?o v? khuy?n x?c nh?n t?i co quan c? th?m quy?n.
- Kh?ng d?ng emoji n?u kh?ng th?t s? c?n.
- N?u ngo?i ph?m vi th? t?c h?nh ch?nh, l?<ch s? t? ch?'i v? hu?>ng sang k?nh h?- tr? ph? h?p.`;
}

async function openAiChat(messages, rulesText, userText) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;

  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const snippets = buildKnowledgeSnippets(userText);
  const conversationSummary = buildConversationSummary(messages, userText);
  const body = {
    model,
    messages: [
      {
        role: "system",
        content: buildSystemPrompt(rulesText, conversationSummary, snippets)
      },
      ...messages,
    ],
    max_tokens: 900,
    temperature: 0.4,
  };

  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify(body),
  });

  if (!r.ok) {
    const errText = await r.text();
    throw new Error(errText.slice(0, 300) || `OpenAI HTTP ${r.status}`);
  }

  const data = await r.json();
  const text = data?.choices?.[0]?.message?.content;
  return typeof text === "string" ? text.trim() : null;
}

exports.aiChat = async (req, res) => {
  try {
    const raw = req.body?.message;
    const history = req.body?.messages;
    const sessionId = String(req.body?.sessionId || "").trim() || `guest-${Date.now()}`;

    let userText = "";
    if (typeof raw === "string") {
      userText = raw.trim();
    } else if (Array.isArray(history) && history.length) {
      const last = history[history.length - 1];
      if (last?.role === "user" && typeof last.content === "string") {
        userText = last.content.trim();
      }
    }

    if (!userText) return res.status(400).json({ message: "Vui l?ng nh?p n?Ti dung c?u h?i." });
    if (userText.length > 4000) return res.status(400).json({ message: "N?Ti dung qu? d?i." });

    const msgs = Array.isArray(history)
      ? history
          .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
          .slice(-12)
          .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }))
      : [{ role: "user", content: userText }];

    const rulesText = await getAiRules().catch(() => "");
    const state = buildConversationState(msgs, userText);
    let reply = null;
    let mode = process.env.OPENAI_API_KEY ? "openai" : "fallback";
    try {
      reply = await openAiChat(msgs, rulesText, userText);
    } catch (e) {
      console.error("OpenAI error:", e.message);
      mode = "fallback";
    }

    if (!reply) {
      reply = fallbackAiReply(userText, msgs);
      mode = "fallback";
    }

    const detectedTopic = state.topic || detectFallbackTopic(reply) || "";
    const suggestions = buildAiSuggestions(detectedTopic, state.followUpIntent);

    const actorName =
      req.user?.fullName ||
      req.user?.name ||
      req.user?.email ||
      req.body?.visitorName ||
      "Kh?ch";

    await appendAiHistory({
      sessionId,
      question: userText,
      answer: reply,
      source: "home_chat",
      mode,
      userId: req.user?.id || "",
      userName: actorName,
      turnIndex: msgs.filter((message) => message.role === "user").length,
      confidenceLabel: mode === "openai" ? "assisted" : "fallback",
      note: mode === "fallback" ? "Tra loi bang bo quy tac noi bo/fallback" : "Tra loi bang mo hinh AI",
      meta: {
        turns: msgs.length,
        detectedTopic,
        suggestions,
        hasAuthenticatedUser: Boolean(req.user?.id),
        ip:
          req.headers["x-forwarded-for"] ||
          req.socket?.remoteAddress ||
          "",
        userAgent: req.headers["user-agent"] || ""
      }
    }).catch((error) => {
      console.error("appendAiHistory error:", error.message);
    });

    res.json({
      reply,
      mode,
      sessionId,
      detectedTopic,
      suggestions
    });
  } catch (err) {
    res.status(500).json({ message: err.message || "L?-i tr? l? AI" });
  }
};

// ?"??"??"? Room/Contact queries ?"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"?
exports.chatContacts = async (req, res) => {
  try {
    const q = req.query?.q ?? req.query?.query ?? "";
    const contacts = await multiChatStore.searchContacts({ keyword: q, currentUserId: req.user.id });
    return res.json({ contacts });
  } catch (err) {
    console.error("[chatContacts]", err);
    return res.status(500).json({ message: err.message || "L?-i t?i danh b?" });
  }
};

exports.friendDiscovery = async (req, res) => {
  try {
    const q = req.query?.q ?? req.query?.query ?? "";
    const users = await userStore.searchUsersForFriendAdd(req.user.id, q);
    return res.json({ users });
  } catch (err) {
    console.error("[friendDiscovery]", err);
    return res.status(500).json({ message: err.message || "L?-i t?m ngu?i d?ng" });
  }
};

exports.friendSuggestions = async (req, res) => {
  try {
    const limit = Number(req.query?.limit || 5);
    const users = await userStore.listSuggestedFriends(req.user.id, limit);
    return res.json({ users });
  } catch (err) {
    return res.status(500).json({ message: err.message || "L?-i t?i g?i ? k?t b?n" });
  }
};

exports.friendRequests = async (req, res) => {
  try {
    const [incoming, outgoing] = await Promise.all([
      userStore.listIncomingFriendRequests(req.user.id),
      userStore.listOutgoingFriendRequests(req.user.id)
    ]);
    return res.json({
      requests: incoming,
      incoming,
      outgoing,
      counts: {
        incoming: incoming.length,
        outgoing: outgoing.length
      }
    });
  } catch (err) {
    console.error("[friendRequests]", err);
    return res.status(500).json({ message: err.message || "L?-i t?i l?i m?i k?t b?n" });
  }
};

exports.sendFriendRequest = async (req, res) => {
  try {
    const targetUserId = String(req.body?.targetUserId || "").trim();
    if (!targetUserId) {
      return res.status(400).json({ message: "Thi?u ngu?i d?ng c?n k?t b?n" });
    }
    const result = await userStore.sendFriendRequest(req.user.id, targetUserId);
    return res.json(result);
  } catch (err) {
    return res.status(400).json({ message: err.message || "Kh?ng th?f g?i l?i m?i k?t b?n" });
  }
};

exports.respondFriendRequest = async (req, res) => {
  try {
    const requesterId = String(req.params.userId || "").trim();
    const action = String(req.body?.action || "accept").trim().toLowerCase();
    if (!["accept", "decline"].includes(action)) {
      return res.status(400).json({ message: "Ph?n h?"i kh?ng h?p l??" });
    }
    const result = await userStore.respondToFriendRequest(req.user.id, requesterId, action);
    return res.json(result);
  } catch (err) {
    return res.status(400).json({ message: err.message || "Kh?ng th?f ph?n h?"i l?i m?i k?t b?n" });
  }
};

exports.revokeFriendRequest = async (req, res) => {
  try {
    const targetUserId = String(req.params.userId || "").trim();
    if (!targetUserId) {
      return res.status(400).json({ message: "Thi?u ngu?i d?ng c?n thu h?"i l?i m?i" });
    }
    const result = await userStore.revokeFriendRequest(req.user.id, targetUserId);
    return res.json(result);
  } catch (err) {
    return res.status(400).json({ message: err.message || "Kh?ng th?f thu h?"i l?i m?i k?t b?n" });
  }
};

exports.removeFriend = async (req, res) => {
  try {
    const targetUserId = String(req.params.userId || "").trim();
    if (!targetUserId) return res.status(400).json({ message: "Thi?u ngu?i d?ng" });
    const result = await userStore.removeFriend(req.user.id, targetUserId);
    return res.json(result);
  } catch (err) {
    return res.status(400).json({ message: err.message || "Kh?ng th?f x?a b?n" });
  }
};

exports.blockFriend = async (req, res) => {
  try {
    const targetUserId = String(req.params.userId || "").trim();
    if (!targetUserId) return res.status(400).json({ message: "Thi?u ngu?i d?ng" });
    const result = await userStore.blockUser(req.user.id, targetUserId);
    return res.json(result);
  } catch (err) {
    return res.status(400).json({ message: err.message || "Kh?ng th?f ch?n ngu?i d?ng" });
  }
};

exports.blockedFriends = async (req, res) => {
  try {
    const users = await userStore.listBlockedUsers(req.user.id);
    return res.json({ users });
  } catch (err) {
    console.error("[blockedFriends]", err);
    return res.status(500).json({ message: err.message || "Kh?ng th?f t?i danh s?ch ?'? ch?n" });
  }
};

exports.unblockFriend = async (req, res) => {
  try {
    const targetUserId = String(req.params.userId || "").trim();
    if (!targetUserId) return res.status(400).json({ message: "Thi?u ngu?i d?ng" });
    const result = await userStore.unblockUser(req.user.id, targetUserId);
    return res.json(result);
  } catch (err) {
    return res.status(400).json({ message: err.message || "Kh?ng th?f b? ch?n ngu?i d?ng" });
  }
};

exports.chatRooms = async (req, res) => {
  try {
    const rooms = await multiChatStore.listRoomsForUser(req.user.id);
    const hydrated = await Promise.all(rooms.map((r) => multiChatStore.hydrateRoomForUser(r, req.user.id)));
    return res.json({ rooms: hydrated });
  } catch (err) {
    console.error("[chatRooms]", err);
    return res.status(500).json({ message: err.message || "L?-i t?i ph?ng chat" });
  }
};

exports.chatRoomDetail = async (req, res) => {
  try {
    const room = await multiChatStore.getRoomById(req.params.roomId);
    if (!room) return res.status(404).json({ message: "Kh?ng t?m th?y ph?ng chat" });
    const isMember = room.members?.some((m) => m.id === req.user.id);
    if (!isMember) return res.status(403).json({ message: "B?n kh?ng c? quy?n truy c?p ph?ng n?y" });
    const hydrated = await multiChatStore.hydrateRoomForUser(room, req.user.id);
    return res.json({ room: hydrated });
  } catch (err) {
    return res.status(500).json({ message: err.message || "L?-i t?i chi ti?t ph?ng chat" });
  }
};

exports.ensureDirectChat = async (req, res) => {
  try {
    const targetUserId = String(req.body?.userId || "").trim();
    if (!targetUserId) return res.status(400).json({ message: "Thi?u ID ngu?i d?ng" });
    const room = await multiChatStore.ensureDirectRoom(req.user.id, targetUserId);
    const hydrated = await multiChatStore.hydrateRoomForUser(room, req.user.id);
    return res.json({ room: hydrated });
  } catch (err) {
    return res.status(400).json({ message: err.message || "Kh?ng th?f kh?Yi t?o h?Ti tho?i" });
  }
};

exports.createGroupChat = async (req, res) => {
  try {
    const room = await multiChatStore.createGroupRoom({
      ownerId: req.user.id,
      name: req.body?.name,
      avatarUrl: req.body?.avatarUrl,
      memberIds: req.body?.memberIds,
    });
    const hydrated = await multiChatStore.hydrateRoomForUser(room, req.user.id);
    return res.json({ room: hydrated });
  } catch (err) {
    return res.status(400).json({ message: err.message || "Kh?ng th?f t?o nh?m chat" });
  }
};

exports.groupInvites = async (req, res) => {
  try {
    const rooms = await multiChatStore.listGroupInvitesForUser(req.user.id);
    const invites = await Promise.all(rooms.map((room) => multiChatStore.hydrateRoomForUser(room, req.user.id)));
    return res.json({ invites });
  } catch (err) {
    console.error("[groupInvites]", err);
    return res.status(500).json({ message: err.message || "L?-i t?i l?i m?i nh?m" });
  }
};

exports.inviteGroupMembers = async (req, res) => {
  try {
    const memberIds = Array.isArray(req.body?.memberIds) ? req.body.memberIds : [];
    const room = await multiChatStore.inviteMembersToGroup({
      roomId: req.params.roomId,
      requesterId: req.user.id,
      memberIds
    });
    const hydrated = await multiChatStore.hydrateRoomForUser(room, req.user.id);
    return res.json({ room: hydrated });
  } catch (err) {
    return res.status(400).json({ message: err.message || "Kh?ng th?f m?i b?n v?o nh?m" });
  }
};

exports.respondGroupInvite = async (req, res) => {
  try {
    const action = String(req.body?.action || "accept").trim().toLowerCase();
    if (!["accept", "decline"].includes(action)) {
      return res.status(400).json({ message: "Ph?n h?"i kh?ng h?p l??" });
    }
    const room = await multiChatStore.respondToGroupInvite({
      roomId: req.params.roomId,
      userId: req.user.id,
      action
    });
    const hydrated = await multiChatStore.hydrateRoomForUser(room, req.user.id);
    return res.json({ room: hydrated });
  } catch (err) {
    return res.status(400).json({ message: err.message || "Kh?ng th?f ph?n h?"i l?i m?i nh?m" });
  }
};

exports.sendRoomMessage = async (req, res) => {
  try {
    const text = String(req.body?.text || "").trim();
    const media = req.body?.media || null;
    const location = req.body?.location || null;
    const replyToMessageId = String(req.body?.replyToMessageId || "").trim();
    if (!text && !media && !location) return res.status(400).json({ message: "Tin nh?n kh?ng ?'u?c ?'?f tr?'ng" });

    const room = await multiChatStore.appendMessage({
      roomId: req.params.roomId,
      senderId: req.user.id,
      text,
      media,
      location,
      replyToMessageId
    });

    const hydrated = await multiChatStore.hydrateRoomForUser(room, req.user.id);
    const lastMessage = hydrated.messages[hydrated.messages.length - 1];

    // ?o. Emit ?'?ng event name + ?'?ng room
    await emitToRoomMembers(room, { roomId: req.params.roomId, message: lastMessage });

    return res.json({ room: hydrated, message: lastMessage });
  } catch (err) {
    return res.status(400).json({ message: err.message || "Kh?ng th?f g?i tin nh?n" });
  }
};

exports.presignChatMediaUpload = async (req, res) => {
  if (!isS3Configured()) {
    return res.status(503).json({
      message:
        "Chua c?u h?nh S3. ??t S3_BUCKET (ho?c AWS_S3_BUCKET), AWS_REGION v? AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY trong backend/.env."
    });
  }
  try {
    const contentType = String(req.body?.contentType || "")
      .trim()
      .toLowerCase();
    let fileName = String(req.body?.fileName || "file").trim();
    const isImageOrVideo = contentType.startsWith("image/") || contentType.startsWith("video/");
    const isDocument = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ].includes(contentType);
    if (!contentType || (!isImageOrVideo && !isDocument)) {
      return res.status(400).json({
        message: "Ch?? ch?p nh?n ?nh, video ho?c t?i li??u (.pdf/.doc/.docx)"
      });
    }

    const ext = path.extname(fileName).toLowerCase();
    if (!ext) {
      const inferred = contentType.startsWith("video/")
        ? ".mp4"
        : contentType === "application/pdf"
          ? ".pdf"
          : contentType.includes("word")
            ? ".docx"
            : ".jpg";
      fileName += inferred;
    }
    const safeName = path.basename(fileName).replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 120);
    const key = `chat-media/${req.user.id}/${Date.now()}-${crypto.randomBytes(8).toString("hex")}-${safeName}`;

    const { uploadUrl, publicUrl } = await createPresignedPut({
      key,
      contentType,
      expiresSec: 300
    });

    return res.json({
      uploadUrl,
      publicUrl,
      key,
      method: "PUT",
      headers: { "Content-Type": contentType }
    });
  } catch (err) {
    return res.status(500).json({
      message: err.message || "Kh?ng t?o ?'u?c link upload media chat"
    });
  }
};

exports.uploadChatMedia = async (req, res) => {
  if (!isS3Configured()) {
    return res.status(503).json({
      message: "Chua c?u h?nh S3."
    });
  }
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ message: "Kh?ng c? file ?'u?c upload" });
    }

    const contentType = file.mimetype;
    const isImageOrVideo = contentType.startsWith("image/") || contentType.startsWith("video/");
    const isDocument = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ].includes(contentType);
    if (!contentType || (!isImageOrVideo && !isDocument)) {
      return res.status(400).json({
        message: "Ch?? ch?p nh?n ?nh, video ho?c t?i li??u (.pdf/.doc/.docx)"
      });
    }

    const fileName = file.originalname || "file";
    const ext = path.extname(fileName).toLowerCase();
    let safeName = path.basename(fileName, ext).replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 100);
    if (!ext) {
      const inferred = contentType.startsWith("video/")
        ? ".mp4"
        : contentType === "application/pdf"
          ? ".pdf"
          : contentType.includes("word")
            ? ".docx"
            : ".jpg";
      safeName += inferred;
    } else {
      safeName += ext;
    }
    const key = `chat-media/${req.user.id}/${Date.now()}-${crypto.randomBytes(8).toString("hex")}-${safeName}`;

    const { uploadBuffer } = require("../config/s3");
    const uploaded = await uploadBuffer({
      key,
      buffer: file.buffer,
      contentType
    });

    return res.json({
      url: uploaded.publicUrl,
      publicUrl: uploaded.publicUrl,
      key: uploaded.key,
      contentType: uploaded.contentType
    });
  } catch (err) {
    return res.status(500).json({
      message: err.message || "Kh?ng upload ?'u?c media chat"
    });
  }
};

exports.unsendRoomMessage = async (req, res) => {
  try {
    const room = await multiChatStore.unsendMessage({
      roomId: req.params.roomId,
      messageId: req.params.messageId,
      requesterId: req.user.id,
    });
    const hydrated = await multiChatStore.hydrateRoomForUser(room, req.user.id);
    await emitToRoomMembers(room, { roomId: req.params.roomId });
    return res.json({ room: hydrated });
  } catch (err) {
    return res.status(400).json({ message: err.message || "Kh?ng th?f thu h?"i tin nh?n" });
  }
};

exports.deleteRoomMessageForMe = async (req, res) => {
  try {
    const room = await multiChatStore.deleteMessageForUser({
      roomId: req.params.roomId,
      messageId: req.params.messageId,
      userId: req.user.id,
    });
    const hydrated = await multiChatStore.hydrateRoomForUser(room, req.user.id);
    return res.json({ room: hydrated });
  } catch (err) {
    return res.status(400).json({ message: err.message || "Kh?ng th?f x?a tin nh?n" });
  }
};

exports.togglePinRoomMessage = async (req, res) => {
  try {
    const room = await multiChatStore.togglePinMessage({
      roomId: req.params.roomId,
      messageId: req.params.messageId,
      requesterId: req.user.id,
    });
    const hydrated = await multiChatStore.hydrateRoomForUser(room, req.user.id);
    const message = hydrated.messages.find((m) => m.id === req.params.messageId) || null;
    if (message?.isPinned || message?.pinned) {
      await emitToRoomAction(room, "message:pinned", { roomId: req.params.roomId, message });
    } else {
      await emitToRoomAction(room, "message:unpinned", { roomId: req.params.roomId, message });
    }
    await emitToRoomMembers(room, { roomId: req.params.roomId, message, action: "pin-updated" });
    return res.json({ room: hydrated, message });
  } catch (err) {
    return res.status(400).json({ message: err.message || "Kh?ng th?f ghim tin nh?n" });
  }
};

exports.forwardRoomMessage = async (req, res) => {
  try {
    const targetRoomId = String(req.body?.targetRoomId || "").trim();
    if (!targetRoomId) return res.status(400).json({ message: "Thi?u ph?ng chuy?fn ti?p" });

    const room = await multiChatStore.forwardMessage({
      sourceRoomId: req.params.roomId,
      messageId: req.params.messageId,
      targetRoomId,
      senderId: req.user.id,
    });

    const hydrated = await multiChatStore.hydrateRoomForUser(room, req.user.id);
    const lastMessage = hydrated.messages[hydrated.messages.length - 1];
    await emitToRoomMembers(room, { roomId: targetRoomId, message: lastMessage });

    return res.json({ room: hydrated });
  } catch (err) {
    return res.status(400).json({ message: err.message || "Kh?ng th?f chuy?fn ti?p tin nh?n" });
  }
};

exports.addGroupMember = async (req, res) => {
  try {
    const room = await multiChatStore.addGroupMember({
      roomId: req.params.roomId,
      requesterId: req.user.id,
      memberId: req.body?.memberId,
    });
    const hydrated = await multiChatStore.hydrateRoomForUser(room, req.user.id);
    await emitToRoomMembers(room, { roomId: req.params.roomId });
    return res.json({ room: hydrated });
  } catch (err) {
    return res.status(400).json({ message: err.message || "Kh?ng th?f th?m th?nh vi?n" });
  }
};

exports.removeGroupMember = async (req, res) => {
  try {
    const room = await multiChatStore.removeGroupMember({
      roomId: req.params.roomId,
      requesterId: req.user.id,
      memberId: req.params.memberId,
    });
    const hydrated = await multiChatStore.hydrateRoomForUser(room, req.user.id);
    await emitToRoomMembers(room, { roomId: req.params.roomId });
    return res.json({ room: hydrated });
  } catch (err) {
    return res.status(400).json({ message: err.message || "Kh?ng th?f x?a th?nh vi?n" });
  }
};

exports.assignDeputy = async (req, res) => {
  try {
    const room = await multiChatStore.assignDeputy({
      roomId: req.params.roomId,
      requesterId: req.user.id,
      memberId: req.params.memberId,
      enabled: true,
    });
    const hydrated = await multiChatStore.hydrateRoomForUser(room, req.user.id);
    return res.json({ room: hydrated });
  } catch (err) {
    return res.status(400).json({ message: err.message || "Kh?ng th?f g?n quy?n ph? nh?m" });
  }
};

exports.removeDeputy = async (req, res) => {
  try {
    const room = await multiChatStore.assignDeputy({
      roomId: req.params.roomId,
      requesterId: req.user.id,
      memberId: req.params.memberId,
      enabled: false,
    });
    const hydrated = await multiChatStore.hydrateRoomForUser(room, req.user.id);
    return res.json({ room: hydrated });
  } catch (err) {
    return res.status(400).json({ message: err.message || "Kh?ng th?f g? quy?n ph? nh?m" });
  }
};

exports.updateGroupChat = async (req, res) => {
  try {
    const name = req.body?.name;
    const avatarUrl = req.body?.avatarUrl;
    const hasName = typeof name === "string";
    const hasAvatar = typeof avatarUrl === "string";
    if (!hasName && !hasAvatar) {
      return res.status(400).json({ message: "Kh?ng c? th?ng tin c?n c?p nh?t" });
    }

    const room = await multiChatStore.updateGroupRoom({
      roomId: req.params.roomId,
      requesterId: req.user.id,
      name: hasName ? name : undefined,
      avatarUrl: hasAvatar ? avatarUrl : undefined
    });
    const hydrated = await multiChatStore.hydrateRoomForUser(room, req.user.id);
    await emitToRoomMembers(room, { roomId: req.params.roomId, action: "group-updated" });
    return res.json({ room: hydrated });
  } catch (err) {
    return res.status(400).json({ message: err.message || "Kh?ng th?f c?p nh?t nh?m" });
  }
};

exports.dissolveGroup = async (req, res) => {
  try {
    await multiChatStore.dissolveGroup({
      roomId: req.params.roomId,
      requesterId: req.user.id,
    });
    return res.json({ ok: true });
  } catch (err) {
    return res.status(400).json({ message: err.message || "Kh?ng th?f gi?i t?n nh?m" });
  }
};