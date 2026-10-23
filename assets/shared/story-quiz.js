(function () {
  "use strict";
  var match = location.pathname.match(/\/(\d{3})\/?$/);
  var id = match && match[1];
  if (!id) return;

  var lang = ((window.I18N && window.I18N.lang && window.I18N.lang()) || document.documentElement.lang || "ar").slice(0, 2);
  /* Keep the quiz in sync when the reader changes the story language before starting it. */
  document.addEventListener("site-language-change", function () {
    lang = ((window.I18N && window.I18N.lang && window.I18N.lang()) || document.documentElement.lang || "ar").slice(0, 2);
  });
  var TEXT = {
    ar: {
      progress: function (n, total) { return "السؤال " + n + " من " + total; },
      choose: "اختر إجابة واحدة", confirm: "تأكيد الإجابة", chooseFirst: "اختر إجابة أولًا.",
      correct: "إجابة صحيحة", incorrect: "إجابة غير صحيحة", answer: "الإجابة الصحيحة:",
      explanation: "التوضيح:", show: "عرض النتيجة", next: "السؤال التالي",
      excellent: "ممتاز! أداء رائع.", well: "أحسنت، واصل التعلّم.",
      retry: "محاولة جيدة؛ راجع الإجابات وجرّب مجددًا.", final: "نتيجتك النهائية",
      review: "مراجعة الإجابات", again: "جرّب مرة أخرى", unavailable: "الاختبار غير متاح مؤقتًا"
    },
    en: {
      progress: function (n, total) { return "Question " + n + " of " + total; },
      choose: "Choose one answer", confirm: "Submit answer", chooseFirst: "Choose an answer first.",
      correct: "Correct answer", incorrect: "Incorrect answer", answer: "Correct answer:",
      explanation: "Explanation:", show: "Show results", next: "Next question",
      excellent: "Excellent work!", well: "Well done—keep learning.",
      retry: "Good attempt. Review the answers and try again.", final: "Your final score",
      review: "Review answers", again: "Try again", unavailable: "The quiz is temporarily unavailable"
    },
    fr: {
      progress: function (n, total) { return "Question " + n + " sur " + total; },
      choose: "Choisis une réponse", confirm: "Valider la réponse", chooseFirst: "Choisis d’abord une réponse.",
      correct: "Bonne réponse", incorrect: "Réponse incorrecte", answer: "Bonne réponse :",
      explanation: "Explication :", show: "Voir le résultat", next: "Question suivante",
      excellent: "Excellent travail !", well: "Bravo, continue à apprendre.",
      retry: "Bel essai. Relis les réponses et réessaie.", final: "Résultat final",
      review: "Révision des réponses", again: "Réessayer", unavailable: "Le quiz est temporairement indisponible"
    },
    it: {
      progress: function (n, total) { return "Domanda " + n + " di " + total; },
      choose: "Scegli una risposta", confirm: "Conferma la risposta", chooseFirst: "Scegli prima una risposta.",
      correct: "Risposta corretta", incorrect: "Risposta errata", answer: "Risposta corretta:",
      explanation: "Spiegazione:", show: "Mostra il risultato", next: "Domanda successiva",
      excellent: "Ottimo lavoro!", well: "Ben fatto, continua a imparare.",
      retry: "Bel tentativo. Rivedi le risposte e riprova.", final: "Risultato finale",
      review: "Rivedi le risposte", again: "Riprova", unavailable: "Il quiz non è temporaneamente disponibile"
    },
    de: {
      progress: function (n, total) { return "Frage " + n + " von " + total; },
      choose: "Wähle eine Antwort", confirm: "Antwort bestätigen", chooseFirst: "Wähle zuerst eine Antwort.",
      correct: "Richtige Antwort", incorrect: "Falsche Antwort", answer: "Richtige Antwort:",
      explanation: "Erklärung:", show: "Ergebnis anzeigen", next: "Nächste Frage",
      excellent: "Ausgezeichnet!", well: "Gut gemacht – lerne weiter.",
      retry: "Guter Versuch. Überprüfe die Antworten und versuche es erneut.", final: "Dein Endergebnis",
      review: "Antworten überprüfen", again: "Noch einmal versuchen", unavailable: "Das Quiz ist vorübergehend nicht verfügbar"
    }
  };
  function hasTranslation(q, locale) {
    var tr = q.i18n && q.i18n[locale];
    return !!(tr && typeof tr.q === "string" && Array.isArray(tr.o) && tr.o.length === q.o.length && typeof tr.e === "string");
  }
  function questionPool(locale) {
    if (locale === "ar") return all;
    var translated = all.filter(function (q) { return hasTranslation(q, locale); });
    return translated.length >= Math.min(5, all.length) ? translated : all;
  }
  function t(key) {
    var locale = lang;
    if (lang !== "ar") {
      var pool = questionPool(lang);
      if (!pool.length || !pool.every(function (q) { return hasTranslation(q, lang); })) locale = "ar";
    }
    return (TEXT[locale] || TEXT.ar)[key] || TEXT.ar[key] || key;
  }
  document.addEventListener("site-language-change", function (event) {
    lang = ((event.detail && event.detail.lang) || document.documentElement.lang || "ar").slice(0, 2);
  });

  var start = document.getElementById("story-quiz-start");
  var app = document.getElementById("story-quiz-app");
  if (!start || !app) return;
  var all = [], run = [], answers = [], current = 0, chosen = null, submitted = false;
  var esc = function (value) {
    return String(value).replace(/[&<>"]/g, function (char) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[char];
    });
  };
  function shuffle(values) {
    var result = values.slice();
    for (var i = result.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = result[i]; result[i] = result[j]; result[j] = tmp;
    }
    return result;
  }
  function begin() {
    run = shuffle(questionPool(lang)).slice(0, Math.min(5, questionPool(lang).length));
    answers = []; current = 0; chosen = null; submitted = false;
    start.hidden = true; app.hidden = false; question();
  }
  function question() {
    var q = run[current];
    var translated = (q.i18n && q.i18n[lang]) || q;
    q.displayOptions = shuffle(translated.o.map(function (text, originalIndex) {
      return { text: text, originalIndex: originalIndex };
    }));
    chosen = null; submitted = false;
    app.innerHTML =
      '<div class="story-quiz-progress">' + esc(t("progress")(current + 1, run.length)) + '</div>' +
      '<h3 class="story-quiz-question">' + esc(translated.q) + '</h3>' +
      '<div class="story-quiz-options">' + q.displayOptions.map(function (option, index) {
        return '<button type="button" class="story-quiz-option" data-option="' + index + '" aria-pressed="false"><span>' +
          (index + 1) + '.</span><span>' + esc(option.text) + '</span></button>';
      }).join("") + '</div><div id="story-quiz-feedback" aria-live="polite"></div>' +
      '<div class="story-quiz-controls"><span class="story-quiz-muted">' + esc(t("choose")) +
      '</span><button class="story-quiz-action" id="story-quiz-submit" type="button">' + esc(t("confirm")) + '</button></div>';
    app.querySelectorAll("[data-option]").forEach(function (button) {
      button.addEventListener("click", function () {
        if (submitted) return;
        chosen = Number(button.dataset.option);
        app.querySelectorAll("[data-option]").forEach(function (other) {
          other.setAttribute("aria-pressed", String(other === button));
        });
      });
    });
    document.getElementById("story-quiz-submit").addEventListener("click", submit);
  }
  function submit() {
    if (submitted) {
      current++;
      if (current < run.length) question(); else result();
      return;
    }
    if (chosen === null) {
      document.getElementById("story-quiz-feedback").textContent = t("chooseFirst");
      return;
    }
    submitted = true;
    var q = run[current];
    var translated = (q.i18n && q.i18n[lang]) || q;
    var isCorrect = q.displayOptions[chosen].originalIndex === q.a;
    answers.push({ q: q, correct: isCorrect });
    app.querySelectorAll("[data-option]").forEach(function (button) {
      button.disabled = true;
      var index = Number(button.dataset.option);
      if (q.displayOptions[index].originalIndex === q.a) button.style.borderColor = "#69d6a4";
      if (index === chosen && !isCorrect) button.style.borderColor = "#ff9b85";
    });
    var feedback = document.getElementById("story-quiz-feedback");
    feedback.className = "story-quiz-feedback " + (isCorrect ? "correct" : "incorrect");
    feedback.innerHTML = '<strong>' + esc(isCorrect ? t("correct") : t("incorrect")) + '</strong><br><strong>' +
      esc(t("answer")) + '</strong> ' + esc(translated.o[q.a]) + '<br><strong>' +
      esc(t("explanation")) + '</strong> ' + esc(translated.e);
    document.getElementById("story-quiz-submit").textContent = current === run.length - 1 ? t("show") : t("next");
  }
  function result() {
    var score = answers.filter(function (answer) { return answer.correct; }).length;
    var percent = Math.round(score / answers.length * 100);
    var message = percent >= 80 ? t("excellent") : percent >= 60 ? t("well") : t("retry");
    app.innerHTML = '<div class="story-quiz-result"><div class="story-quiz-kicker">' + esc(t("final")) +
      '</div><div class="story-quiz-score">' + score + ' / ' + answers.length + '</div><p>' + percent +
      '%</p><h3>' + esc(message) + '</h3><button class="story-quiz-action" id="story-quiz-retry" type="button">' +
      esc(t("again")) + '</button></div><div class="story-quiz-review"><h3>' + esc(t("review")) + '</h3>' +
      answers.map(function (answer) {
        var q = answer.q;
        var translated = (q.i18n && q.i18n[lang]) || q;
        return '<details ' + (!answer.correct ? 'open' : '') + '><summary>' +
          (answer.correct ? '✓ ' : '✗ ') + esc(translated.q) + '</summary><p><strong>' +
          esc(t("answer")) + '</strong> ' + esc(translated.o[q.a]) + '</p><p><strong>' +
          esc(t("explanation")) + '</strong> ' + esc(translated.e) + '</p></details>';
      }).join("") + '</div>';
    document.getElementById("story-quiz-retry").addEventListener("click", begin);
  }
  start.addEventListener("click", begin);
  var root = location.pathname.split("/stories/")[0] + "/";
  fetch(root + "stories/quizzes/" + id + ".json", { cache: "no-store" }).then(function (response) {
    if (!response.ok) throw new Error("HTTP " + response.status);
    return response.json();
  }).then(function (data) {
    all = data.questions || [];
    if (all.length < 5) throw new Error("Insufficient quiz questions");
  }).catch(function () {
    start.disabled = true;
    start.textContent = t("unavailable");
  });
})();