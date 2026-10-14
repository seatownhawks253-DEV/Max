"use strict";

(function () {
  var STORAGE_KEY = "maxScienceVocabProgress";

  var VOCABULARY = Object.freeze([
    Object.freeze({ id: "producer", word: "Producer", definition: "A living thing that makes its own food" }),
    Object.freeze({ id: "consumer", word: "Consumer", definition: "A living thing that gets energy by eating other living things" }),
    Object.freeze({ id: "decomposer", word: "Decomposer", definition: "Breaks down once-living matter into nutrients" }),
    Object.freeze({ id: "herbivores", word: "Herbivores", definition: "Eat producers (plants)" }),
    Object.freeze({ id: "carnivores", word: "Carnivores", definition: "Eat other consumers (meat)" }),
    Object.freeze({ id: "omnivores", word: "Omnivores", definition: "Eat plants and meat" }),
    Object.freeze({ id: "photosynthesis", word: "Photosynthesis", definition: "Process by which green plants make their own food" }),
    Object.freeze({ id: "food-chain", word: "Food chain", definition: "Shows how energy moves between organisms" }),
    Object.freeze({ id: "food-web", word: "Food web", definition: "A group of connected food chains in an ecosystem" })
  ]);

  var ORIGINAL_ORDER = VOCABULARY.map(function (item) { return item.id; });
  var byId = {};
  VOCABULARY.forEach(function (item) {
    byId[item.id] = item;
  });

  var PRAISE = [
    "Nice focus, Max!",
    "That word is locked in.",
    "Your spelling is getting stronger.",
    "You remembered the science word.",
    "Wonderful concentration.",
    "Careful scientific spelling."
  ];

  var state = null;
  var lastPraise = "";
  var flashTimers = new Map();
  var lastFocused = null;

  function fisherYates(items) {
    var result = items.slice();
    for (var i = result.length - 1; i > 0; i -= 1) {
      var j = Math.floor(Math.random() * (i + 1));
      var swap = result[i];
      result[i] = result[j];
      result[j] = swap;
    }
    return result;
  }

  function orderKey(items) {
    return items.join("\u0001");
  }

  function shuffledOrder(ids, previous) {
    if (ids.length < 2) {
      return ids.slice();
    }
    var previousKey = previous ? orderKey(previous) : "";
    var next = fisherYates(ids);
    var guard = 0;
    while (previousKey && orderKey(next) === previousKey && guard < 24) {
      next = fisherYates(ids);
      guard += 1;
    }
    return next;
  }

  function retryOrder(order, completedMap) {
    var next = order.slice();
    var slots = [];
    var openIds = [];
    order.forEach(function (id, index) {
      if (!completedMap[id]) {
        slots.push(index);
        openIds.push(id);
      }
    });
    var shuffled = shuffledOrder(openIds, openIds);
    slots.forEach(function (slot, index) {
      next[slot] = shuffled[index];
    });
    return next;
  }

  function normalizeAnswer(value) {
    return String(value).trim().replace(/\s+/g, " ").toLowerCase();
  }

  function answersMatch(input, word) {
    var typed = normalizeAnswer(input);
    if (!typed) {
      return "empty";
    }
    return typed === normalizeAnswer(word) ? "correct" : "incorrect";
  }

  function buildHint(word) {
    return word.split(" ").map(function (part) {
      var dots = "";
      for (var i = 1; i < part.length; i += 1) {
        dots += "•";
      }
      var label = part.length === 1 ? "letter" : "letters";
      return part.charAt(0).toUpperCase() + dots + " (" + part.length + " " + label + ")";
    }).join(" · ");
  }

  function accuracyPercent(correctCount, incorrectCount) {
    var total = correctCount + incorrectCount;
    if (total <= 0) {
      return 0;
    }
    return Math.round((correctCount / total) * 1000) / 10;
  }

  function formatPercent(value) {
    if (Number.isInteger(value)) {
      return value + "%";
    }
    return value.toFixed(1) + "%";
  }

  var LETTERS = ["A", "B", "C", "D"];
  var TAB_ORDER = ["study", "spell", "choice", "sentence"];

  var SENTENCE_BANK = {
    producer: [
      "A green plant is called a ______ because it makes its own food.",
      "Grass uses sunlight to make food, so grass is a ______.",
      "A tree that builds its own food is a ______."
    ],
    consumer: [
      "A deer gets energy by eating plants, making it a ______.",
      "A frog eats insects to get energy, so the frog is a ______.",
      "An animal that gets energy by eating other living things is a ______."
    ],
    decomposer: [
      "Mushrooms help break down dead plants and animals. A mushroom is a ______.",
      "A worm breaks dead leaves into nutrients, so the worm is a ______.",
      "A fungus that turns once-living matter into nutrients is a ______."
    ],
    herbivores: [
      "A rabbit eats grass, so it is one of the ______.",
      "Cows eat only plants, so cows are ______.",
      "Animals that eat plants, such as grass and leaves, are ______."
    ],
    carnivores: [
      "A lion eats other animals, so it is one of the ______.",
      "A shark eats fish, so a shark is one of the ______.",
      "Animals that eat other animals for meat are ______."
    ],
    omnivores: [
      "A bear eats berries and fish, so it is one of the ______.",
      "A raccoon eats fruit and also small animals, so it is one of the ______.",
      "Animals that eat both plants and meat are ______."
    ],
    photosynthesis: [
      "Plants use sunlight, water, and carbon dioxide during ______ to make food.",
      "A leaf makes sugar from sunlight in the process called ______.",
      "Green plants make their own food through ______."
    ],
    "food-chain": [
      "Grass → Rabbit → Fox is an example of a ______.",
      "The path of energy from grass to a grasshopper to a bird is a ______.",
      "A diagram that shows how energy moves from one organism to the next is a ______."
    ],
    "food-web": [
      "Several connected food chains form a ______.",
      "In a pond, many food chains link together into a ______.",
      "Owls, mice, snakes, and plants can all be linked in one ______."
    ]
  };

  function makeChoices(correctId, previous) {
    var pool = ORIGINAL_ORDER.filter(function (id) { return id !== correctId; });
    var picked = fisherYates(pool).slice(0, 3);
    return shuffledOrder(picked.concat([correctId]), Array.isArray(previous) ? previous : null);
  }

  function pickSentence(id, previousIndex) {
    var total = SENTENCE_BANK[id].length;
    var previous = Number(previousIndex);
    if (!Number.isFinite(previous) || previous < 0 || previous >= total || total < 2) {
      return Math.floor(Math.random() * total);
    }
    var next = Math.floor(Math.random() * (total - 1));
    if (next >= previous) {
      next += 1;
    }
    return next;
  }

  function freshQuizMode(previous) {
    var order = shuffledOrder(ORIGINAL_ORDER, previous && previous.order);
    var choices = {};
    order.forEach(function (id) {
      var prior = previous && previous.choices ? previous.choices[id] : null;
      choices[id] = makeChoices(id, prior);
    });
    return {
      order: order,
      choices: choices,
      completed: {},
      incorrectById: {},
      missed: {},
      index: 0
    };
  }

  function freshSentenceMode(previous) {
    var order = shuffledOrder(ORIGINAL_ORDER, previous && previous.order);
    var picks = {};
    order.forEach(function (id) {
      var prior = previous && previous.picks ? previous.picks[id] : null;
      picks[id] = pickSentence(id, prior);
    });
    return {
      order: order,
      picks: picks,
      completed: {},
      incorrectById: {},
      index: 0
    };
  }

  function clampIndex(index) {
    var number = Number(index);
    if (!Number.isFinite(number) || number < 0 || number > VOCABULARY.length - 1) {
      return 0;
    }
    return Math.floor(number);
  }

  function copyCompleted(raw) {
    var completed = {};
    Object.keys(raw || {}).forEach(function (id) {
      if (byId[id] && raw[id]) {
        completed[id] = true;
      }
    });
    return completed;
  }

  function copyIncorrect(raw) {
    var incorrectById = {};
    Object.keys(raw || {}).forEach(function (id) {
      var count = Number(raw[id]);
      if (byId[id] && Number.isFinite(count) && count > 0) {
        incorrectById[id] = Math.floor(count);
      }
    });
    return incorrectById;
  }

  function isValidChoiceSet(correctId, options) {
    if (!Array.isArray(options) || options.length !== 4 || options.indexOf(correctId) === -1) {
      return false;
    }
    var seen = {};
    return options.every(function (option) {
      if (!byId[option] || seen[option]) {
        return false;
      }
      seen[option] = true;
      return true;
    });
  }

  function isValidQuiz(quiz) {
    if (!quiz || !isValidOrder(quiz.order) || !quiz.choices) {
      return false;
    }
    return quiz.order.every(function (id) {
      return isValidChoiceSet(id, quiz.choices[id]);
    });
  }

  function isValidSentences(round) {
    if (!round || !isValidOrder(round.order) || !round.picks) {
      return false;
    }
    return round.order.every(function (id) {
      var pick = Number(round.picks[id]);
      return SENTENCE_BANK[id] && Number.isFinite(pick) && pick >= 0 && pick < SENTENCE_BANK[id].length;
    });
  }

  function normalizeQuiz(quiz) {
    var missed = {};
    Object.keys(quiz.missed || {}).forEach(function (id) {
      if (!byId[id] || quiz.completed && quiz.completed[id]) {
        return;
      }
      var picks = {};
      Object.keys(quiz.missed[id] || {}).forEach(function (optionId) {
        if (byId[optionId] && optionId !== id && quiz.missed[id][optionId]) {
          picks[optionId] = true;
        }
      });
      if (Object.keys(picks).length) {
        missed[id] = picks;
      }
    });
    return {
      order: quiz.order.slice(),
      choices: quiz.choices,
      completed: copyCompleted(quiz.completed),
      incorrectById: copyIncorrect(quiz.incorrectById),
      missed: missed,
      index: clampIndex(quiz.index)
    };
  }

  function normalizeSentences(round) {
    return {
      order: round.order.slice(),
      picks: round.picks,
      completed: copyCompleted(round.completed),
      incorrectById: copyIncorrect(round.incorrectById),
      index: clampIndex(round.index)
    };
  }

  function correctCount() {
    return Object.keys(state.completed).length;
  }

  function totalIncorrect() {
    return Object.keys(state.incorrectById).reduce(function (sum, id) {
      return sum + state.incorrectById[id];
    }, 0);
  }

  function isValidOrder(order) {
    if (!Array.isArray(order) || order.length !== VOCABULARY.length) {
      return false;
    }
    var seen = {};
    for (var i = 0; i < order.length; i += 1) {
      if (!byId[order[i]] || seen[order[i]]) {
        return false;
      }
      seen[order[i]] = true;
    }
    return true;
  }

  function freshState() {
    return {
      order: shuffledOrder(ORIGINAL_ORDER, ORIGINAL_ORDER),
      completed: {},
      incorrectById: {},
      praise: {},
      hints: {},
      wordsHidden: false,
      tab: "study",
      quiz: freshQuizMode(null),
      sentences: freshSentenceMode(null)
    };
  }

  function loadState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return null;
      }
      var data = JSON.parse(raw);
      if (!data || (data.version !== 1 && data.version !== 2) || !isValidOrder(data.order)) {
        return null;
      }
      var completed = {};
      Object.keys(data.completed || {}).forEach(function (id) {
        if (byId[id] && data.completed[id]) {
          completed[id] = true;
        }
      });
      var incorrectById = {};
      Object.keys(data.incorrectById || {}).forEach(function (id) {
        var count = Number(data.incorrectById[id]);
        if (byId[id] && Number.isFinite(count) && count > 0) {
          incorrectById[id] = Math.floor(count);
        }
      });
      var hints = {};
      Object.keys(data.hints || {}).forEach(function (id) {
        if (byId[id] && !completed[id] && data.hints[id]) {
          hints[id] = true;
        }
      });
      var praise = {};
      Object.keys(data.praise || {}).forEach(function (id) {
        if (completed[id] && typeof data.praise[id] === "string") {
          praise[id] = data.praise[id];
        }
      });
      return {
        order: data.order.slice(),
        completed: completed,
        incorrectById: incorrectById,
        praise: praise,
        hints: hints,
        wordsHidden: Boolean(data.wordsHidden),
        tab: TAB_ORDER.indexOf(data.tab) === -1 ? "study" : data.tab,
        quiz: data.version === 2 && isValidQuiz(data.quiz) ? normalizeQuiz(data.quiz) : freshQuizMode(null),
        sentences: data.version === 2 && isValidSentences(data.sentences) ? normalizeSentences(data.sentences) : freshSentenceMode(null)
      };
    } catch (error) {
      return null;
    }
  }

  function save() {
    var payload = {
      version: 2,
      order: state.order,
      completed: state.completed,
      incorrectById: state.incorrectById,
      praise: state.praise,
      hints: state.hints,
      wordsHidden: state.wordsHidden,
      tab: state.tab,
      quiz: state.quiz,
      sentences: state.sentences
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (error) {
      // Storage can be unavailable in private browsing. The round still works.
    }
  }

  function nextPraise() {
    var choice = PRAISE[Math.floor(Math.random() * PRAISE.length)];
    if (choice === lastPraise) {
      choice = PRAISE[(PRAISE.indexOf(choice) + 1) % PRAISE.length];
    }
    lastPraise = choice;
    return choice;
  }

  function $(id) {
    return document.getElementById(id);
  }

  function cardFor(id) {
    var escaped = window.CSS && CSS.escape ? CSS.escape(id) : id;
    return document.querySelector('.question-card[data-id="' + escaped + '"]');
  }

  function renderStudy() {
    var grid = $("study-grid");
    var hidden = state.wordsHidden;
    grid.textContent = "";
    $("hide-words").classList.toggle("is-active", hidden);
    $("show-words").classList.toggle("is-active", !hidden);
    $("hide-words").setAttribute("aria-pressed", String(hidden));
    $("show-words").setAttribute("aria-pressed", String(!hidden));

    VOCABULARY.forEach(function (item, index) {
      var card = document.createElement("article");
      card.className = "study-card";

      var kicker = document.createElement("p");
      kicker.className = "study-kicker";
      kicker.textContent = "Word " + (index + 1) + " of 9";

      var word = document.createElement("h3");
      word.className = "study-word";
      if (hidden) {
        word.textContent = "••••••";
        word.classList.add("is-hidden-word");
        word.setAttribute("aria-label", "Word covered");
      } else {
        word.textContent = item.word;
      }

      var definition = document.createElement("p");
      definition.className = "study-definition";
      definition.textContent = item.definition;

      card.append(kicker, word, definition);

      if (!hidden) {
        var hear = document.createElement("button");
        hear.type = "button";
        hear.className = "btn btn-ghost";
        hear.dataset.speak = item.word;
        hear.setAttribute("aria-label", "Hear word " + item.word);
        hear.textContent = "Hear Word";
        card.append(hear);
      }

      grid.append(card);
    });
  }

  function setFeedback(card, status, message, extra) {
    var feedback = card.querySelector(".feedback");
    feedback.className = "feedback is-" + status;
    feedback.textContent = "";
    var main = document.createElement("span");
    main.className = "feedback-main";
    main.textContent = message;
    feedback.append(main);
    if (extra) {
      var small = document.createElement("span");
      small.className = "feedback-extra";
      small.textContent = extra;
      feedback.append(small);
    }
  }

  function renderChallenge() {
    flashTimers.forEach(function (timer) {
      clearTimeout(timer);
    });
    flashTimers.clear();

    var list = $("challenge-list");
    list.textContent = "";

    state.order.forEach(function (id, index) {
      var item = byId[id];
      var complete = Boolean(state.completed[id]);
      var card = document.createElement("article");
      card.className = "question-card" + (complete ? " is-correct" : "");
      card.dataset.id = id;
      card.dataset.status = complete ? "correct" : "open";

      var head = document.createElement("div");
      head.className = "question-head";
      var number = document.createElement("span");
      number.className = "q-num";
      number.textContent = String(index + 1);
      var definition = document.createElement("p");
      definition.className = "definition";
      definition.id = "def-" + id;
      definition.textContent = "Definition: " + item.definition;
      head.append(number, definition);

      var form = document.createElement("form");
      form.className = "answer-form";
      form.autocomplete = "off";
      var label = document.createElement("label");
      label.className = "answer-label";
      label.htmlFor = "answer-" + id;
      label.textContent = "Your Answer";
      var row = document.createElement("div");
      row.className = "answer-row";
      var input = document.createElement("input");
      input.id = "answer-" + id;
      input.className = "answer-input";
      input.type = "text";
      input.autocomplete = "off";
      input.autocapitalize = "none";
      input.spellcheck = false;
      input.setAttribute("autocorrect", "off");
      input.setAttribute("enterkeyhint", "done");
      input.maxLength = 60;
      input.placeholder = "Type here";
      input.setAttribute("aria-describedby", definition.id);
      var check = document.createElement("button");
      check.type = "submit";
      check.className = "btn btn-check";
      check.textContent = "Check Answer";
      row.append(input, check);
      var feedback = document.createElement("p");
      feedback.className = "feedback";
      feedback.setAttribute("aria-live", "polite");
      form.append(label, row, feedback);

      var tools = document.createElement("div");
      tools.className = "question-tools";
      var hintButton = document.createElement("button");
      hintButton.type = "button";
      hintButton.className = "btn btn-hint";
      hintButton.dataset.hint = id;
      hintButton.textContent = state.hints[id] ? "Hide Hint" : "Show Hint";
      hintButton.setAttribute("aria-expanded", state.hints[id] ? "true" : "false");
      tools.append(hintButton);

      var hint = document.createElement("p");
      hint.className = "hint";
      hint.hidden = !state.hints[id];
      if (state.hints[id]) {
        hint.textContent = "Hint: " + buildHint(item.word);
      }

      card.append(head, form, tools, hint);

      if (complete) {
        input.value = item.word;
        input.readOnly = true;
        input.tabIndex = -1;
        check.disabled = true;
        check.textContent = "Completed";
        hintButton.hidden = true;
        hint.hidden = true;
        hint.textContent = "";
        setFeedback(card, "correct", "Correct! Great job, Max!", state.praise[id] || "That word is locked in.");
      }

      list.append(card);
    });
  }

  function updateStats() {
    var correct = correctCount();
    var remaining = VOCABULARY.length - correct;
    var incorrect = totalIncorrect();
    $("correct-count").textContent = correct + "/9";
    $("remaining-count").textContent = String(remaining);
    $("incorrect-count").textContent = String(incorrect);
    $("progress-fill").style.width = ((correct / VOCABULARY.length) * 100) + "%";
    $("progress-track").setAttribute("aria-valuenow", String(correct));
    $("progress-track").setAttribute("aria-label", correct + " of 9 correct");
    $("retry-incorrect").disabled = remaining === 0;

    var celebration = $("celebration");
    if (correct === VOCABULARY.length) {
      $("final-correct").textContent = "Total correct: " + correct + "/9";
      $("final-incorrect").textContent = "Total incorrect attempts: " + incorrect;
      $("final-accuracy").textContent = "Accuracy: " + formatPercent(accuracyPercent(correct, incorrect));
      renderPracticeList();
      celebration.hidden = false;
    } else {
      celebration.hidden = true;
    }
  }

  function renderPracticeList() {
    var list = $("practice-list");
    list.textContent = "";
    var words = VOCABULARY.map(function (item) {
      return { item: item, misses: state.incorrectById[item.id] || 0 };
    }).filter(function (entry) {
      return entry.misses > 0;
    }).sort(function (a, b) {
      return b.misses - a.misses || a.item.word.localeCompare(b.item.word);
    });

    if (words.length === 0) {
      var perfect = document.createElement("li");
      perfect.textContent = "You spelled every word correctly on the first try.";
      list.append(perfect);
      return;
    }

    words.forEach(function (entry) {
      var li = document.createElement("li");
      var title = document.createElement("strong");
      title.textContent = entry.item.word;
      var noun = entry.misses === 1 ? "incorrect attempt" : "incorrect attempts";
      li.append(title, document.createTextNode(" — " + entry.misses + " " + noun + ". " + entry.item.definition));
      list.append(li);
    });
  }

  function applyCorrect(card, item) {
    card.classList.add("is-correct");
    card.dataset.status = "correct";
    var input = card.querySelector(".answer-input");
    input.value = item.word;
    input.readOnly = true;
    input.tabIndex = -1;
    input.classList.remove("flash-wrong");
    var check = card.querySelector(".btn-check");
    check.disabled = true;
    check.textContent = "Completed";
    var hintButton = card.querySelector(".btn-hint");
    hintButton.hidden = true;
    var hint = card.querySelector(".hint");
    hint.hidden = true;
    hint.textContent = "";
    setFeedback(card, "correct", "Correct! Great job, Max!", state.praise[item.id]);
  }

  function flashWrong(input) {
    input.classList.remove("flash-wrong");
    window.setTimeout(function () {
      input.classList.add("flash-wrong");
    }, 0);
    var existing = flashTimers.get(input);
    if (existing) {
      clearTimeout(existing);
    }
    flashTimers.set(input, window.setTimeout(function () {
      input.classList.remove("flash-wrong");
      flashTimers.delete(input);
    }, 800));
  }

  function focusNextOpen(currentId) {
    var inputs = Array.prototype.slice.call(document.querySelectorAll("#challenge-list .answer-input"));
    var start = inputs.findIndex(function (input) {
      return input.closest(".question-card").dataset.id === currentId;
    });
    for (var step = 1; step <= inputs.length; step += 1) {
      var candidate = inputs[(start + step) % inputs.length];
      if (!candidate.readOnly) {
        candidate.focus();
        return;
      }
    }
  }

  function focusFirstUnanswered() {
    var input = document.querySelector("#challenge-list .answer-input:not([readonly])");
    if (input) {
      input.focus();
    }
  }

  function checkAnswer(id) {
    var item = byId[id];
    if (!item || state.completed[id]) {
      return;
    }
    var card = cardFor(id);
    var input = card.querySelector(".answer-input");
    var result = answersMatch(input.value, item.word);

    if (result === "empty") {
      setFeedback(card, "empty", "Type the science word, then check it.");
      input.focus();
      return;
    }

    if (result === "correct") {
      state.completed[id] = true;
      state.praise[id] = nextPraise();
      delete state.hints[id];
      save();
      applyCorrect(card, item);
      updateStats();
      if (correctCount() === VOCABULARY.length) {
        var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        $("celebration").scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
      } else {
        focusNextOpen(id);
      }
      return;
    }

    state.incorrectById[id] = (state.incorrectById[id] || 0) + 1;
    input.value = "";
    save();
    setFeedback(card, "incorrect", "Not quite! Try again, Max.");
    flashWrong(input);
    updateStats();
    input.focus();
  }

  function toggleHint(id) {
    if (!byId[id] || state.completed[id]) {
      return;
    }
    if (state.hints[id]) {
      delete state.hints[id];
    } else {
      state.hints[id] = true;
    }
    save();
    var card = cardFor(id);
    var hint = card.querySelector(".hint");
    var button = card.querySelector(".btn-hint");
    if (state.hints[id]) {
      hint.hidden = false;
      hint.textContent = "Hint: " + buildHint(byId[id].word);
      button.textContent = "Hide Hint";
      button.setAttribute("aria-expanded", "true");
    } else {
      hint.hidden = true;
      hint.textContent = "";
      button.textContent = "Show Hint";
      button.setAttribute("aria-expanded", "false");
    }
  }

  function showTab(tab) {
    state.tab = TAB_ORDER.indexOf(tab) === -1 ? "study" : tab;
    TAB_ORDER.forEach(function (name) {
      var selected = name === state.tab;
      $("panel-" + name).hidden = !selected;
      $("tab-" + name).setAttribute("aria-selected", String(selected));
      $("tab-" + name).tabIndex = selected ? 0 : -1;
    });
    save();
  }

  function modeCount(round) {
    return Object.keys(round.completed).length;
  }

  function modeIncorrect(round) {
    return Object.keys(round.incorrectById).reduce(function (sum, id) {
      return sum + round.incorrectById[id];
    }, 0);
  }

  function firstOpenIndex(round) {
    for (var i = 0; i < round.order.length; i += 1) {
      if (!round.completed[round.order[i]]) {
        return i;
      }
    }
    return 0;
  }

  function renderModePracticeList(listId, incorrectById) {
    var list = $(listId);
    list.textContent = "";
    var words = VOCABULARY.map(function (item) {
      return { item: item, misses: incorrectById[item.id] || 0 };
    }).filter(function (entry) {
      return entry.misses > 0;
    }).sort(function (a, b) {
      return b.misses - a.misses || a.item.word.localeCompare(b.item.word);
    });
    if (words.length === 0) {
      var perfect = document.createElement("li");
      perfect.textContent = "You got every question right on the first try.";
      list.append(perfect);
      return;
    }
    words.forEach(function (entry) {
      var li = document.createElement("li");
      var title = document.createElement("strong");
      title.textContent = entry.item.word;
      var noun = entry.misses === 1 ? "incorrect attempt" : "incorrect attempts";
      li.append(title, document.createTextNode(" — " + entry.misses + " " + noun + "."));
      list.append(li);
    });
  }

  function paintModeTracker(prefix, round) {
    var correct = modeCount(round);
    var incorrect = modeIncorrect(round);
    var remaining = VOCABULARY.length - correct;
    $(prefix + "-correct").textContent = correct + "/9";
    $(prefix + "-remaining").textContent = String(remaining);
    $(prefix + "-incorrect").textContent = String(incorrect);
    $(prefix + "-accuracy").textContent = formatPercent(accuracyPercent(correct, incorrect));
    $(prefix + "-fill").style.width = ((correct / VOCABULARY.length) * 100) + "%";
    $(prefix + "-progress").setAttribute("aria-valuenow", String(correct));
    $(prefix + "-progress").setAttribute("aria-label", correct + " of 9 correct");
    $(prefix + "-retry").disabled = remaining === 0;
    var celebration = $(prefix + "-celebration");
    if (correct === VOCABULARY.length) {
      $(prefix + "-final-correct").textContent = "Total correct: 9/9";
      $(prefix + "-final-incorrect").textContent = "Total incorrect attempts: " + incorrect;
      $(prefix + "-final-accuracy").textContent = "Accuracy: " + formatPercent(accuracyPercent(correct, incorrect));
      renderModePracticeList(prefix + "-practice-list", round.incorrectById);
      celebration.hidden = false;
    } else {
      celebration.hidden = true;
    }
  }

  function renderDots(containerId, round, onPick) {
    var container = $(containerId);
    container.textContent = "";
    round.order.forEach(function (id, index) {
      var button = document.createElement("button");
      button.type = "button";
      button.className = "quiz-dot";
      if (index === round.index) {
        button.classList.add("is-current");
      }
      if (round.completed[id]) {
        button.classList.add("is-done");
      }
      button.textContent = String(index + 1);
      button.setAttribute("aria-label", "Question " + (index + 1) + (round.completed[id] ? ", completed" : ""));
      button.addEventListener("click", function () {
        onPick(index);
      });
      container.append(button);
    });
  }

  function setQuizFeedback(status, message, withCheck) {
    var feedback = document.createElement("p");
    feedback.className = "quiz-feedback" + (status ? " is-" + status : "");
    feedback.setAttribute("aria-live", "polite");
    if (withCheck) {
      var mark = document.createElement("span");
      mark.className = "check-mark";
      mark.setAttribute("aria-hidden", "true");
      mark.textContent = "✓";
      feedback.append(mark);
    }
    feedback.append(document.createTextNode(message || ""));
    return feedback;
  }

  function renderQuiz() {
    var quiz = state.quiz;
    var id = quiz.order[quiz.index];
    var item = byId[id];
    var complete = Boolean(quiz.completed[id]);
    $( "choice-counter" ).textContent = "Question " + (quiz.index + 1) + " of 9";
    $( "choice-prev" ).disabled = quiz.index === 0;
    $( "choice-next" ).disabled = quiz.index === quiz.order.length - 1;
    renderDots("choice-dots", quiz, function (index) {
      quiz.index = index;
      save();
      renderQuiz();
    });

    var body = $("choice-body");
    body.textContent = "";
    var prompt = document.createElement("p");
    prompt.className = "quiz-prompt";
    prompt.textContent = "Which vocabulary word matches this definition?";
    var definition = document.createElement("p");
    definition.className = "quiz-definition";
    definition.textContent = item.definition;
    var list = document.createElement("div");
    list.className = "choice-list";
    list.setAttribute("role", "group");
    list.setAttribute("aria-label", "Answer choices");

    quiz.choices[id].forEach(function (optionId, optionIndex) {
      var button = document.createElement("button");
      button.type = "button";
      button.className = "choice-btn";
      var missed = quiz.missed[id] && quiz.missed[id][optionId];
      var isAnswer = optionId === id;
      if (complete && isAnswer) {
        button.classList.add("is-correct");
      } else if (missed) {
        button.classList.add("is-wrong");
      }
      if (complete || missed) {
        button.disabled = true;
      }
      var prefix = LETTERS[optionIndex] + ". ";
      button.textContent = (complete && isAnswer ? "✓ " : "") + prefix + byId[optionId].word;
      button.addEventListener("click", function () {
        selectChoice(id, optionId);
      });
      list.append(button);
    });

    body.append(prompt, definition, list);
    if (complete) {
      body.append(setQuizFeedback("correct", "Great job, Max! That's correct!", true));
    } else if (quiz.missed[id] && Object.keys(quiz.missed[id]).length) {
      body.append(setQuizFeedback("incorrect", "Not quite, Max. Try again!", false));
    }
  }

  function selectChoice(questionId, optionId) {
    var quiz = state.quiz;
    if (quiz.order[quiz.index] !== questionId || quiz.completed[questionId]) {
      return;
    }
    if (quiz.missed[questionId] && quiz.missed[questionId][optionId]) {
      return;
    }
    if (optionId === questionId) {
      quiz.completed[questionId] = true;
      if (quiz.missed[questionId]) {
        delete quiz.missed[questionId];
      }
      save();
      renderQuiz();
      paintModeTracker("choice", quiz);
      if (modeCount(quiz) === VOCABULARY.length) {
        showModeCelebration("choice-celebration");
      }
      return;
    }
    if (!quiz.missed[questionId]) {
      quiz.missed[questionId] = {};
    }
    quiz.missed[questionId][optionId] = true;
    quiz.incorrectById[questionId] = (quiz.incorrectById[questionId] || 0) + 1;
    save();
    renderQuiz();
    paintModeTracker("choice", quiz);
  }

  function showModeCelebration(id) {
    var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    $(id).scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
  }

  function moveQuiz(step) {
    var next = state.quiz.index + step;
    if (next < 0 || next >= state.quiz.order.length) {
      return;
    }
    state.quiz.index = next;
    save();
    renderQuiz();
  }

  function retryQuiz() {
    var quiz = state.quiz;
    if (modeCount(quiz) === VOCABULARY.length) {
      return;
    }
    quiz.order = retryOrder(quiz.order, quiz.completed);
    quiz.order.forEach(function (id) {
      if (!quiz.completed[id]) {
        quiz.choices[id] = makeChoices(id, quiz.choices[id]);
        delete quiz.missed[id];
      }
    });
    quiz.index = firstOpenIndex(quiz);
    save();
    renderQuiz();
    paintModeTracker("choice", quiz);
  }

  function startNewQuiz() {
    state.quiz = freshQuizMode(state.quiz);
    state.tab = "choice";
    save();
    renderQuiz();
    paintModeTracker("choice", state.quiz);
    showTab("choice");
  }

  function renderSentence() {
    var round = state.sentences;
    var id = round.order[round.index];
    var item = byId[id];
    var complete = Boolean(round.completed[id]);
    var sentence = SENTENCE_BANK[id][round.picks[id]];
    var parts = sentence.split("______");
    $("sentence-counter").textContent = "Question " + (round.index + 1) + " of 9";
    $("sentence-prev").disabled = round.index === 0;
    $("sentence-next").disabled = round.index === round.order.length - 1;
    renderDots("sentence-dots", round, function (index) {
      round.index = index;
      save();
      renderSentence();
    });

    var body = $("sentence-body");
    body.textContent = "";
    var text = document.createElement("p");
    text.className = "sentence-text";
    text.append(document.createTextNode(parts[0]));
    var blank = document.createElement("span");
    blank.className = "sentence-blank";
    blank.textContent = "________";
    text.append(blank, document.createTextNode(parts[1] || ""));

    var form = document.createElement("form");
    form.className = "answer-form";
    form.autocomplete = "off";
    var label = document.createElement("label");
    label.className = "answer-label";
    label.htmlFor = "sentence-input";
    label.textContent = "Your Answer";
    var row = document.createElement("div");
    row.className = "answer-row";
    var input = document.createElement("input");
    input.id = "sentence-input";
    input.className = "answer-input";
    input.type = "text";
    input.autocomplete = "off";
    input.autocapitalize = "none";
    input.spellcheck = false;
    input.setAttribute("autocorrect", "off");
    input.setAttribute("enterkeyhint", "done");
    input.maxLength = 60;
    input.placeholder = "Type the missing word";
    var check = document.createElement("button");
    check.type = "submit";
    check.className = "btn btn-check";
    check.textContent = "Check Answer";
    row.append(input, check);
    form.append(label, row);
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      checkSentence();
    });

    body.append(text, form);
    if (complete) {
      input.value = item.word;
      input.readOnly = true;
      input.tabIndex = -1;
      check.disabled = true;
      check.textContent = "Completed";
      body.append(setQuizFeedback("correct", "Correct! Excellent work, Max!", true));
    }
  }

  function checkSentence() {
    if (checkSentence.busy) {
      return;
    }
    checkSentence.busy = true;
    window.setTimeout(function () {
      checkSentence.busy = false;
    }, 0);
    var round = state.sentences;
    var id = round.order[round.index];
    if (round.completed[id]) {
      return;
    }
    var input = $("sentence-input");
    var result = answersMatch(input.value, byId[id].word);
    var existing = document.querySelector("#sentence-body .quiz-feedback");
    if (existing) {
      existing.remove();
    }
    if (result === "empty") {
      $("sentence-body").append(setQuizFeedback("empty", "Type the missing word, then check it.", false));
      input.focus();
      return;
    }
    if (result === "correct") {
      round.completed[id] = true;
      save();
      renderSentence();
      paintModeTracker("sentence", round);
      if (modeCount(round) === VOCABULARY.length) {
        showModeCelebration("sentence-celebration");
      }
      return;
    }
    round.incorrectById[id] = (round.incorrectById[id] || 0) + 1;
    input.value = "";
    save();
    $("sentence-body").append(setQuizFeedback("incorrect", "Good try! Check your spelling and try again.", false));
    flashWrong(input);
    paintModeTracker("sentence", round);
    input.focus();
  }

  function moveSentence(step) {
    var next = state.sentences.index + step;
    if (next < 0 || next >= state.sentences.order.length) {
      return;
    }
    state.sentences.index = next;
    save();
    renderSentence();
  }

  function retrySentences() {
    var round = state.sentences;
    if (modeCount(round) === VOCABULARY.length) {
      return;
    }
    round.order = retryOrder(round.order, round.completed);
    round.index = firstOpenIndex(round);
    save();
    renderSentence();
    paintModeTracker("sentence", round);
  }

  function startNewSentences() {
    state.sentences = freshSentenceMode(state.sentences);
    state.tab = "sentence";
    save();
    renderSentence();
    paintModeTracker("sentence", state.sentences);
    showTab("sentence");
  }

  var pendingReset = function () {
    startNewPractice();
  };

  function askToReset(options) {
    if (options.finished) {
      options.confirmAction();
      return;
    }
    $("modal-title").textContent = options.title;
    $("modal-text").textContent = options.hasProgress ? options.progressText : options.idleText;
    $("modal-reset").textContent = options.confirmLabel;
    pendingReset = options.confirmAction;
    $("confirm-modal").hidden = false;
    lastFocused = document.activeElement;
    $("modal-keep").focus();
  }

  function startNewPractice() {
    state.order = shuffledOrder(ORIGINAL_ORDER, state.order);
    state.completed = {};
    state.incorrectById = {};
    state.praise = {};
    state.hints = {};
    state.tab = "spell";
    save();
    renderChallenge();
    updateStats();
    showTab("spell");
    focusFirstUnanswered();
  }

  function retryIncorrect() {
    if (correctCount() === VOCABULARY.length) {
      return;
    }
    state.order = retryOrder(state.order, state.completed);
    save();
    renderChallenge();
    updateStats();
    focusFirstUnanswered();
  }

  function openResetModal() {
    var hasProgress = correctCount() > 0 || totalIncorrect() > 0 || hasTypedDraft();
    askToReset({
      finished: correctCount() === VOCABULARY.length,
      hasProgress: hasProgress,
      title: "Start a new practice?",
      progressText: "This round is not finished. Starting a new practice will clear your correct answers, score, and incorrect-attempt count.",
      idleText: "This will shuffle all nine definitions into a new practice round.",
      confirmLabel: "Start New Practice",
      confirmAction: startNewPractice
    });
  }

  function openChoiceReset() {
    var quiz = state.quiz;
    askToReset({
      finished: modeCount(quiz) === VOCABULARY.length,
      hasProgress: modeCount(quiz) > 0 || modeIncorrect(quiz) > 0,
      title: "Start a new quiz?",
      progressText: "This quiz is not finished. Starting over will clear your correct answers, score, and incorrect attempts.",
      idleText: "This will shuffle all nine questions and answer choices into a new quiz.",
      confirmLabel: "Start New Quiz",
      confirmAction: startNewQuiz
    });
  }

  function openSentenceReset() {
    var round = state.sentences;
    askToReset({
      finished: modeCount(round) === VOCABULARY.length,
      hasProgress: modeCount(round) > 0 || modeIncorrect(round) > 0,
      title: "Start a new practice?",
      progressText: "This round is not finished. Starting over will clear your correct sentences, score, and incorrect attempts.",
      idleText: "This will shuffle all nine sentences and choose new examples.",
      confirmLabel: "Start New Practice",
      confirmAction: startNewSentences
    });
  }

  function closeResetModal() {
    $("confirm-modal").hidden = true;
    if (lastFocused && typeof lastFocused.focus === "function") {
      lastFocused.focus();
    }
  }

  function hasTypedDraft() {
    var inputs = document.querySelectorAll("#challenge-list .answer-input:not([readonly])");
    return Array.prototype.some.call(inputs, function (input) {
      return input.value.trim() !== "";
    });
  }

  function chooseVoice() {
    if (!window.speechSynthesis) {
      return null;
    }
    var voices = window.speechSynthesis.getVoices();
    for (var i = 0; i < voices.length; i += 1) {
      var lang = (voices[i].lang || "").toLowerCase();
      if (lang.indexOf("en") === 0 && voices[i].localService) {
        return voices[i];
      }
    }
    for (var j = 0; j < voices.length; j += 1) {
      if ((voices[j].lang || "").toLowerCase().indexOf("en") === 0) {
        return voices[j];
      }
    }
    return null;
  }

  function speak(text) {
    if (!window.speechSynthesis || typeof SpeechSynthesisUtterance !== "function") {
      return false;
    }
    try {
      window.speechSynthesis.cancel();
      window.speechSynthesis.resume();
      var utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "en-US";
      utterance.rate = 0.9;
      var voice = chooseVoice();
      if (voice) {
        utterance.voice = voice;
      }
      window.speechSynthesis.speak(utterance);
      return true;
    } catch (error) {
      return false;
    }
  }

  function init() {
    state = loadState() || freshState();
    if (!state.quiz) {
      state.quiz = freshQuizMode(null);
    }
    if (!state.sentences) {
      state.sentences = freshSentenceMode(null);
    }
    renderStudy();
    renderChallenge();
    updateStats();
    renderQuiz();
    paintModeTracker("choice", state.quiz);
    renderSentence();
    paintModeTracker("sentence", state.sentences);
    showTab(state.tab);

    TAB_ORDER.forEach(function (name) {
      $("tab-" + name).addEventListener("click", function () { showTab(name); });
    });
    document.querySelector(".tabs").addEventListener("keydown", function (event) {
      if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") {
        return;
      }
      event.preventDefault();
      var index = TAB_ORDER.indexOf(state.tab);
      var step = event.key === "ArrowRight" ? 1 : -1;
      var next = TAB_ORDER[(index + step + TAB_ORDER.length) % TAB_ORDER.length];
      showTab(next);
      $("tab-" + next).focus();
    });

    $("hide-words").addEventListener("click", function () {
      state.wordsHidden = true;
      save();
      renderStudy();
    });
    $("show-words").addEventListener("click", function () {
      state.wordsHidden = false;
      save();
      renderStudy();
    });

    $("study-grid").addEventListener("click", function (event) {
      var button = event.target.closest("[data-speak]");
      if (!button) {
        return;
      }
      var note = $("speech-note");
      if (speak(button.dataset.speak)) {
        note.textContent = "";
      } else {
        note.textContent = "Hearing words is not available in this browser. You can still read them.";
      }
    });

    function checkCard(card) {
      if (!card || card.dataset.busy === "1") {
        return;
      }
      card.dataset.busy = "1";
      checkAnswer(card.dataset.id);
      window.setTimeout(function () {
        if (card.isConnected) {
          card.dataset.busy = "";
        }
      }, 0);
    }

    $("challenge-list").addEventListener("submit", function (event) {
      var form = event.target.closest("form");
      if (!form || !$("challenge-list").contains(form)) {
        return;
      }
      event.preventDefault();
      checkCard(form.closest(".question-card"));
    });

    $("challenge-list").addEventListener("keydown", function (event) {
      if (event.key !== "Enter") {
        return;
      }
      var input = event.target.closest ? event.target.closest(".answer-input") : null;
      if (!input || input.readOnly) {
        return;
      }
      event.preventDefault();
      checkCard(input.closest(".question-card"));
    });

    $("challenge-list").addEventListener("click", function (event) {
      var button = event.target.closest("[data-hint]");
      if (!button) {
        return;
      }
      toggleHint(button.dataset.hint);
    });

    $("challenge-list").addEventListener("input", function (event) {
      if (!event.target.classList || !event.target.classList.contains("answer-input")) {
        return;
      }
      var card = event.target.closest(".question-card");
      if (card.dataset.status === "correct") {
        return;
      }
      event.target.classList.remove("flash-wrong");
      var feedback = card.querySelector(".feedback");
      feedback.textContent = "";
      feedback.className = "feedback";
    });

    $("retry-incorrect").addEventListener("click", retryIncorrect);
    $("start-new").addEventListener("click", openResetModal);
    $("practice-again").addEventListener("click", startNewPractice);
    $("choice-retry").addEventListener("click", retryQuiz);
    $("choice-new").addEventListener("click", openChoiceReset);
    $("choice-again").addEventListener("click", startNewQuiz);
    $("choice-prev").addEventListener("click", function () { moveQuiz(-1); });
    $("choice-next").addEventListener("click", function () { moveQuiz(1); });
    $("sentence-retry").addEventListener("click", retrySentences);
    $("sentence-new").addEventListener("click", openSentenceReset);
    $("sentence-again").addEventListener("click", startNewSentences);
    $("sentence-prev").addEventListener("click", function () { moveSentence(-1); });
    $("sentence-next").addEventListener("click", function () { moveSentence(1); });
    $("sentence-body").addEventListener("keydown", function (event) {
      if (event.key !== "Enter") {
        return;
      }
      var input = event.target.closest ? event.target.closest(".answer-input") : null;
      if (!input || input.readOnly) {
        return;
      }
      event.preventDefault();
      checkSentence();
    });
    $("modal-keep").addEventListener("click", closeResetModal);
    $("modal-backdrop").addEventListener("click", closeResetModal);
    $("modal-reset").addEventListener("click", function () {
      var action = pendingReset;
      closeResetModal();
      action();
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && !$("confirm-modal").hidden) {
        closeResetModal();
      }
    });

    if (window.speechSynthesis) {
      window.speechSynthesis.getVoices();
    }
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = {
      VOCABULARY: VOCABULARY,
      ORIGINAL_ORDER: ORIGINAL_ORDER,
      fisherYates: fisherYates,
      shuffledOrder: shuffledOrder,
      retryOrder: retryOrder,
      normalizeAnswer: normalizeAnswer,
      answersMatch: answersMatch,
      buildHint: buildHint,
      accuracyPercent: accuracyPercent,
      formatPercent: formatPercent,
      SENTENCE_BANK: SENTENCE_BANK,
      makeChoices: makeChoices,
      pickSentence: pickSentence
    };
  }

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", init);
    } else {
      init();
    }
  }
})();
