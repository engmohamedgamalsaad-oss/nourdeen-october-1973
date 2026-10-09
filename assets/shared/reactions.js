/* Uses only the Supabase publishable key; never put a service-role key in browser code. */
(() => {
  "use strict";
  const API_URL = "https://ypwprddkscnfblhftkeb.supabase.co";
  const PUBLISHABLE_KEY = "sb_publishable_JJnVwx8HQAJNxSok32L-qg_83fXk5Qn";
  const body = document.body;
  const storySlug = body.dataset.storySlug || "001";
  const storagePrefix = "story-reactions:v1:";
  const reactionLabels = {
    like: "إعجاب",
    loved: "حكاية أعجبتني كثيرًا",
    unknown_before: "حكاية لم أكن أعرفها من قبل",
    inspiring: "حكاية ملهمة",
    more_stories: "أحب أقرأ حكايات تانية"
  };
  const visitorKey = storagePrefix + "visitor";
  const getVisitorId = () => {
    let id = localStorage.getItem(visitorKey);
    if (!id) {
      if (window.crypto && typeof window.crypto.randomUUID === "function") id = window.crypto.randomUUID();
      else id = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        return (c === "x" ? r : (r & 3 | 8)).toString(16);
      });
      localStorage.setItem(visitorKey, id);
    }
    return id;
  };
  const status = document.getElementById("reaction-status");
  const likeButton = document.getElementById("reaction-like");
  const choiceButtons = Array.from(document.querySelectorAll("[data-reaction-choice]"));
  const setStatus = message => { if (status) status.textContent = message; };
  const countNodes = {};
  document.querySelectorAll("[data-reaction-count]").forEach(node => {
    countNodes[node.dataset.reactionCount] = node;
  });
  const stateKey = type => storagePrefix + storySlug + ":" + (type === "like" ? "like" : "feedback");
  const savedLike = () => localStorage.getItem(stateKey("like")) === "1";
  const savedFeedback = () => localStorage.getItem(stateKey("feedback")) || "";
  const headers = {
    "Content-Type": "application/json",
    "apikey": PUBLISHABLE_KEY,
    "Authorization": "Bearer " + PUBLISHABLE_KEY
  };
  async function loadCounts() {
    const response = await fetch(API_URL + "/rest/v1/rpc/get_story_reaction_counts", {
      method: "POST", headers, body: JSON.stringify({ p_story_slug: storySlug })
    });
    if (!response.ok) throw new Error("تعذر تحميل الأعداد");
    const rows = await response.json();
    Object.keys(countNodes).forEach(type => { countNodes[type].textContent = "0"; });
    rows.forEach(row => {
      if (countNodes[row.reaction_type]) countNodes[row.reaction_type].textContent = String(row.total);
    });
  }
  function paintSavedState() {
    if (savedLike() && likeButton) {
      likeButton.classList.add("is-selected");
      likeButton.setAttribute("aria-pressed", "true");
      likeButton.disabled = true;
      likeButton.querySelector(".reaction-label").textContent = "تم تسجيل إعجابك";
    }
    const feedback = savedFeedback();
    choiceButtons.forEach(button => {
      const selected = button.dataset.reactionChoice === feedback;
      button.classList.toggle("is-selected", selected);
      button.setAttribute("aria-pressed", selected ? "true" : "false");
      if (feedback) button.disabled = true;
    });
  }
  async function submitReaction(type) {
    if (type !== "like" && savedFeedback()) {
      setStatus("سجّلت رد فعل لهذه الحكاية بالفعل من هذا المتصفح.");
      return;
    }
    if (type === "like" && savedLike()) return;
    const buttons = [likeButton, ...choiceButtons].filter(Boolean);
    buttons.forEach(button => { button.disabled = true; });
    setStatus("جارٍ تسجيل اختيارك…");
    try {
      const response = await fetch(API_URL + "/rest/v1/rpc/record_story_reaction", {
        method: "POST",
        headers,
        body: JSON.stringify({ p_story_slug: storySlug, p_visitor_id: getVisitorId(), p_reaction_type: type })
      });
      if (!response.ok) {
        const detail = await response.text();
        throw new Error(detail || "تعذر تسجيل الاختيار");
      }
      const inserted = await response.json();
      if (inserted === true) {
        localStorage.setItem(stateKey(type), type === "like" ? "1" : type);
        setStatus("شكرًا لك! تم تسجيل اختيارك.");
      } else {
        if (type === "like") localStorage.setItem(stateKey("like"), "1");
        else localStorage.setItem(stateKey("feedback"), type);
        setStatus("الاختيار مسجّل بالفعل لهذه الحكاية.");
      }
      paintSavedState();
      await loadCounts();
    } catch (error) {
      setStatus("ماقدرناش نسجل الاختيار الآن. جرّب تاني بعد قليل.");
      buttons.forEach(button => { button.disabled = false; });
      paintSavedState();
    }
  }
  if (likeButton) likeButton.addEventListener("click", () => submitReaction("like"));
  choiceButtons.forEach(button => button.addEventListener("click", () => submitReaction(button.dataset.reactionChoice)));
  paintSavedState();
  loadCounts().catch(() => setStatus("عدادات التفاعل غير متاحة مؤقتًا. جرّب تحديث الصفحة."));
})();