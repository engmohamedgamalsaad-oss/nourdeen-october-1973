/* Uses only the Supabase publishable key; never put a service-role key in browser code. */
(() => {
  "use strict";
  const API_URL = "https://ypwprddkscnfblhftkeb.supabase.co";
  const PUBLISHABLE_KEY = "sb_publishable_JJnVwx8HQAJNxSok32L-qg_83fXk5Qn";
  const body = document.body;
  const storySlug = body.dataset.storySlug || "001";
  const storagePrefix = "story-reactions:v1:";
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
  const tr = (key, fallback) => window.I18N ? window.I18N.t(key) : fallback;
  const countNodes = {};
  document.querySelectorAll("[data-reaction-count]").forEach(node => {
    countNodes[node.dataset.reactionCount] = node;
  });
  const stateKey = type => storagePrefix + storySlug + ":" + (type === "like" ? "like" : "feedback");
  const savedLike = () => Boolean(localStorage.getItem(stateKey("like")));
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
    const liked = savedLike();
    const feedback = savedFeedback();
    if (likeButton) {
      likeButton.classList.toggle("is-selected", liked);
      likeButton.setAttribute("aria-pressed", liked ? "true" : "false");
      likeButton.disabled = liked;
      likeButton.querySelector(".reaction-label").textContent = liked ? (window.I18N ? window.I18N.t("s_liked") : "تم تسجيل إعجابك") : (window.I18N ? window.I18N.t("s_like") : "❤️ أعجبتني");
    }
    choiceButtons.forEach(button => {
      const selected = button.dataset.reactionChoice === feedback;
      button.classList.toggle("is-selected", selected);
      button.setAttribute("aria-pressed", selected ? "true" : "false");
      button.disabled = Boolean(feedback);
    });
  }
  async function submitReaction(type) {
    if (type !== "like" && savedFeedback()) {
      setStatus(tr("r_feedback_exists", "سجّلت رد فعل لهذه الحكاية بالفعل من هذا المتصفح."));
      return;
    }
    if (type === "like" && savedLike()) {
      setStatus(tr("r_like_exists", "سجّلت إعجابك بهذه الحكاية بالفعل."));
      paintSavedState();
      return;
    }
    const buttons = [likeButton, ...choiceButtons].filter(Boolean);
    buttons.forEach(button => { button.disabled = true; });
    setStatus(tr("r_saving", "جارٍ تسجيل اختيارك…"));
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
        localStorage.setItem(stateKey(type), type);
        setStatus(tr("r_saved", "شكرًا لك! تم تسجيل اختيارك."));
      } else {
        if (type === "like") {
          localStorage.setItem(stateKey("like"), "__already_liked__");
          setStatus(tr("r_already_saved", "الاختيار مسجّل بالفعل لهذه الحكاية."));
        } else {
          localStorage.setItem(stateKey("feedback"), "__already_recorded__");
          setStatus(tr("r_already_saved", "الاختيار مسجّل بالفعل لهذه الحكاية."));
        }
      }
      paintSavedState();
      try {
        await loadCounts();
      } catch (countError) {
        setStatus(tr("r_saved_count_error", "اختيارك اتسجل، لكن تعذر تحديث العدادات الآن. حدّث الصفحة لاحقًا."));
      }
    } catch (error) {
      setStatus(tr("r_save_error", "ماقدرناش نسجل الاختيار الآن. جرّب تاني بعد قليل."));
      buttons.forEach(button => { button.disabled = false; });
      paintSavedState();
    }
  }
  if (likeButton) likeButton.addEventListener("click", () => submitReaction("like"));
  choiceButtons.forEach(button => button.addEventListener("click", () => submitReaction(button.dataset.reactionChoice)));
  paintSavedState();
  loadCounts().catch(() => setStatus(tr("r_counts_error", "عدادات التفاعل غير متاحة مؤقتًا. جرّب تحديث الصفحة.")));
})();