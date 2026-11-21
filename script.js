"use strict";

(function () {
  var STORAGE_KEY = "maxScienceVocabProgress";
  var HISTORY_KEY = "maxScienceVocabHistory";
  var WEEK_ID = "2026-12-04";

  var ROOTS = {
    cycl: { label: "cycl", meaning: "Circle", origin: "Greek" },
    circ: { label: "circ", meaning: "Around", origin: "Latin" },
    centr: { label: "centr", meaning: "Center", origin: "Latin" }
  };

  var VOCABULARY = Object.freeze([
    Object.freeze({ id: "cycle", word: "Cycle", speech: "noun", root: "cycl", pronunciation: "SY-kul", definition: "A set of events that repeats in the same order.", example: "The water cycle carries water from the ocean to the clouds and back to the ground.", rootNote: "A cycle goes around and can start again." }),
    Object.freeze({ id: "cyclical", word: "Cyclical", speech: "adjective", root: "cycl", pronunciation: "SY-kli-kul", definition: "Happening again and again in a repeating pattern.", example: "The seasons are cyclical because spring, summer, fall, and winter return every year.", rootNote: "The ending -ical means related to, so cyclical means related to a cycle." }),
    Object.freeze({ id: "cyclone", word: "Cyclone", speech: "noun", root: "cycl", pronunciation: "SY-klohn", definition: "A powerful storm with strong winds that spin in a circle.", example: "The cyclone spun over the ocean and brought heavy rain and powerful winds.", rootNote: "A cyclone is a storm that spins in a circle." }),
    Object.freeze({ id: "circumference", word: "Circumference", speech: "noun", root: "circ", pronunciation: "ser-KUM-fer-ens", definition: "The distance around the outside of a circle.", example: "We measured the circumference of the hula hoop by finding the distance around it.", rootNote: "Circum means around." }),
    Object.freeze({ id: "circuit", word: "Circuit", speech: "noun", root: "circ", pronunciation: "SER-kit", definition: "A closed path that returns to where it started, such as a route or a path for electricity.", example: "The lights turned on when the circuit was complete and electricity could travel around the loop.", rootNote: "A circuit goes around and comes back to the start." }),
    Object.freeze({ id: "circumstance", word: "Circumstance", speech: "noun", root: "circ", pronunciation: "SER-kum-stans", definition: "A fact or condition that affects what happens in a situation.", example: "The rainy weather was a circumstance that moved our picnic indoors.", rootNote: "Circumstances are the conditions around a situation." }),
    Object.freeze({ id: "circumvent", word: "Circumvent", speech: "verb", root: "circ", pronunciation: "ser-kum-VENT", definition: "To find a way around an obstacle or problem.", example: "The hikers had to circumvent the fallen tree by taking a path around it.", rootNote: "To circumvent something is to go around it." }),
    Object.freeze({ id: "central", word: "Central", speech: "adjective", root: "centr", pronunciation: "SEN-trul", definition: "In the middle, or the most important part.", example: "The library is in a central spot so every classroom can reach it easily.", rootNote: "Central describes the center." }),
    Object.freeze({ id: "concentric", word: "Concentric", speech: "adjective", root: "centr", pronunciation: "kun-SEN-trik", definition: "Sharing the same center, like circles drawn inside one another.", example: "The target had concentric circles, and each ring was drawn around the same middle point.", rootNote: "The prefix con- means together, so the shapes share one center." }),
    Object.freeze({ id: "eccentric", word: "Eccentric", speech: "adjective", root: "centr", pronunciation: "ik-SEN-trik", definition: "Off center, or unusual compared with what most people do.", example: "The eccentric wheel did not spin around the true center, so the machine wobbled.", rootNote: "The prefix ec- means out, so this is away from the center." })
  ]);

  var ORIGINAL_ORDER = VOCABULARY.map(function (item) { return item.id; });
  var byId = {};
  VOCABULARY.forEach(function (item) {
    byId[item.id] = item;
  });

  var PRAISE = [
    "Nice focus!",
    "That word is locked in.",
    "You matched the meaning.",
    "You remembered the vocabulary word.",
    "Wonderful concentration.",
    "That usage is correct."
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

  function blankExample(example, word) {
    var escaped = String(word).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return String(example).replace(new RegExp("\\b" + escaped + "\\b", "i"), "______");
  }

  function rootLine(item) {
    var root = ROOTS[item.root];
    var line = "Root: " + root.label + " — " + root.meaning + " (" + root.origin + ")";
    if (item.rootNote) {
      line += " " + item.rootNote;
    }
    return line;
  }

  function scrambleWord(word) {
    var letters = String(word).toUpperCase().split("");
    var mixed = fisherYates(letters);
    var guard = 0;
    while (mixed.join("") === String(word).toUpperCase() && guard < 8) {
      mixed = fisherYates(letters);
      guard += 1;
    }
    return mixed.join(" ");
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
  var TAB_ORDER = ["study", "spell", "choice", "sentence", "apply", "random"];
  var DRILL_MODES = ["choice", "scenario", "type", "match"];

  var SENTENCE_BANK = {};

  VOCABULARY.forEach(function (item) {
    SENTENCE_BANK[item.id] = [blankExample(item.example, item.word)];
  });

  var EXTRA_SENTENCES = {
    cycle: [
      "A washing machine runs through a cycle of wash, rinse, and spin.",
      "The moon's phases follow a cycle that repeats each month."
    ],
    cyclical: [
      "High tide and low tide are cyclical because they return on a regular pattern.",
      "The farmer planned for cyclical rains that come back every season."
    ],
    cyclone: [
      "Weather scientists tracked the cyclone as its winds spun in a giant circle.",
      "People left the coast before the cyclone arrived with spinning winds."
    ],
    circumference: [
      "Sam used a string to measure the circumference of a round clock.",
      "The circumference of the round table is the distance around its edge."
    ],
    circuit: [
      "The race follows a circuit that loops around the school and ends at the start.",
      "A battery, wires, and a bulb can form a circuit for electricity."
    ],
    circumstance: [
      "Missing the bus was a circumstance that made Maya walk to school.",
      "One circumstance, a closed pool, moved swim practice into the gym."
    ],
    circumvent: [
      "The class had to circumvent the blocked hallway by using another door.",
      "Workers decided to circumvent the muddy field instead of walking through it."
    ],
    central: [
      "A fountain stands in the central part of the park.",
      "The central idea of the story is the lesson the author wants readers to remember."
    ],
    concentric: [
      "Ripples formed concentric circles around the spot where the pebble landed.",
      "We drew concentric rings for the art project, all around one middle dot."
    ],
    eccentric: [
      "The eccentric inventor wore a different bright hat every day.",
      "An eccentric orbit is off center, so the planet's path looks stretched."
    ]
  };

  ORIGINAL_ORDER.forEach(function (id) {
    EXTRA_SENTENCES[id].forEach(function (sentence) {
      SENTENCE_BANK[id].push(blankExample(sentence, byId[id].word));
    });
  });

  var SCENARIO_BANK = {
    cycle: [
      "Water evaporates, forms clouds, falls as rain, and can start over. Which word names a set of events that repeats in the same order?",
      "A washing machine finishes wash, rinse, and spin, then can begin again. Which word fits?",
      "The moon goes through the same phases again and again. Which word names that repeating set of events?",
      "Seasons return in the same order every year. Which vocabulary word names that repeating pattern?",
      "A process that repeats in the same order is called a what?"
    ],
    cyclical: [
      "High tide and low tide return on a regular pattern. Which word means happening again and again in a cycle?",
      "The class notices that the same events keep coming back in order. Which word describes that repeating pattern?",
      "Spring, summer, fall, and winter come back every year. Which word describes that pattern?",
      "A pattern that keeps repeating, like a cycle, is described as what?",
      "Because the same steps happen over and over, the process is called what?"
    ],
    cyclone: [
      "Strong winds spin in a huge circle over the ocean and bring heavy rain. Which word names that storm?",
      "A weather report warns about a spinning storm with powerful winds. Which vocabulary word fits?",
      "Clouds whirl in a giant circle during a violent storm. Which word names that storm?",
      "A storm with winds that spin in a circle is called a what?",
      "Sailors watch a huge spinning storm form over the sea. Which word names it?"
    ],
    circumference: [
      "Students wrap a string around a hula hoop to measure the distance around it. Which word names that distance?",
      "The class finds how far it is around the outside of a circle. Which word names that measurement?",
      "A tape measure goes around the round edge of a clock. Which word is the distance around a circle?",
      "The distance around the outside of a circle is called its what?",
      "To know the distance around a round table, you measure its what?"
    ],
    circuit: [
      "Runners follow a path that loops around the school and ends where it started. Which word names that closed path?",
      "The lamp turns on when electricity can travel around a complete loop. Which word names that path?",
      "A race route returns to the starting line after going all the way around. Which word fits?",
      "A closed path that comes back to its start is called a what?",
      "Wires let electricity travel in a loop and return to the battery. Which word names that loop?"
    ],
    circumstance: [
      "A sudden storm is one fact that moves the picnic indoors. Which word names a condition that affects a situation?",
      "Missing the bus changes how Maya gets to school. Which word names a fact that affects what happens?",
      "The coach changes the plan because of one important condition. Which vocabulary word fits?",
      "A fact or condition that affects a situation is called a what?",
      "The closed pool was a condition that moved swim practice to the gym. Which word names that kind of fact?"
    ],
    circumvent: [
      "Hikers walk on a side path to get around a fallen tree. Which word means to find a way around an obstacle?",
      "The class finds a way past a blocked hallway by using another door. Which word fits?",
      "To get around a problem instead of going straight through it is to do what?",
      "Workers go around a muddy field instead of walking through it. Which word describes that choice?",
      "Finding a way around an obstacle or problem is called what?"
    ],
    central: [
      "The library sits in the middle of the school, and every class can reach it. Which word describes that middle spot?",
      "The most important idea of a paragraph is its main point. Which word can describe that most important part?",
      "A fountain stands in the middle of the park. Which word describes its place?",
      "Something in the middle, or the most important part, is described as what?",
      "The meeting place is in the middle of town. Which vocabulary word fits?"
    ],
    concentric: [
      "An art target has rings drawn around the same middle point. Which word describes circles that share a center?",
      "Each ring on the target has the same center. Which word describes those circles?",
      "Ripples spread as circles around the same spot where a pebble landed. Which word describes circles with one shared center?",
      "Shapes that share the same center are called what?",
      "The round target is made of circles inside one another around one middle point. Which word fits?"
    ],
    eccentric: [
      "A wheel sits off the true center, so the toy wobbles as it rolls. Which word describes something that is off center?",
      "The inventor wears a different bright hat every day and builds unusual machines. Which word describes someone unusual?",
      "A path that is not centered, or a person who acts in an unusual way, can be called what?",
      "The seat on the bicycle is far from the center, and the design is unusual. Which word fits?",
      "Off center, or different from what most people do, describes which word?"
    ]
  };

  function makeChoices(correctId, previous) {
    var pool = ORIGINAL_ORDER.filter(function (id) { return id !== correctId; });
    var picked = fisherYates(pool).slice(0, 3);
    return shuffledOrder(picked.concat([correctId]), Array.isArray(previous) ? previous : null);
  }

  function appendWordBank(parent, onPick) {
    var wrap = document.createElement("div");
    wrap.className = "word-bank";
    var label = document.createElement("p");
    label.className = "word-bank-label";
    label.textContent = "Word Bank";
    var list = document.createElement("div");
    list.className = "word-bank-list";
    VOCABULARY.forEach(function (item) {
      var button = document.createElement("button");
      button.type = "button";
      button.className = "word-bank-word";
      button.textContent = item.word;
      button.addEventListener("click", function () {
        onPick(item.word);
      });
      list.append(button);
    });
    wrap.append(label, list);
    parent.append(wrap);
  }

  function renderSpellBank() {
    var box = $("spell-bank");
    box.textContent = "";
    appendWordBank(box, function (word) {
      var active = document.activeElement;
      var input = active && active.closest && active.closest("#challenge-list .answer-input");
      if (!input || input.readOnly) {
        input = document.querySelector("#challenge-list .answer-input:not([readonly])");
      }
      if (!input) {
        return;
      }
      input.value = word;
      input.focus();
    });
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

  function freshScenarioHistory() {
    return { used: {}, last: {} };
  }

  function normalizeScenarioHistory(raw) {
    var used = {};
    var last = {};
    var sourceUsed = raw && raw.used ? raw.used : {};
    var sourceLast = raw && raw.last ? raw.last : {};
    ORIGINAL_ORDER.forEach(function (id) {
      var total = SCENARIO_BANK[id].length;
      var list = [];
      var incoming = Array.isArray(sourceUsed[id]) ? sourceUsed[id] : [];
      incoming.forEach(function (index) {
        var number = Number(index);
        if (Number.isFinite(number) && number >= 0 && number < total && list.indexOf(Math.floor(number)) === -1) {
          list.push(Math.floor(number));
        }
      });
      if (list.length > 0 && list.length < total) {
        used[id] = list;
      }
      var recent = Number(sourceLast[id]);
      if (Number.isFinite(recent) && recent >= 0 && recent < total) {
        last[id] = Math.floor(recent);
      }
    });
    return { used: used, last: last };
  }

  function pickScenarioIndex(wordId, history) {
    var total = SCENARIO_BANK[wordId].length;
    var used = history.used[wordId] ? history.used[wordId].slice() : [];
    var open = [];
    var index;
    for (index = 0; index < total; index += 1) {
      if (used.indexOf(index) === -1) {
        open.push(index);
      }
    }
    if (open.length === 0) {
      used = [];
      for (index = 0; index < total; index += 1) {
        open.push(index);
      }
    }
    var choices = open;
    var recent = history.last[wordId];
    if (open.length > 1 && open.indexOf(recent) !== -1) {
      choices = open.filter(function (item) { return item !== recent; });
    }
    var pick = choices[Math.floor(Math.random() * choices.length)];
    used.push(pick);
    if (used.length >= total) {
      delete history.used[wordId];
    } else {
      history.used[wordId] = used;
    }
    history.last[wordId] = pick;
    return pick;
  }

  function quizKinds(order) {
    var flags = [];
    var index;
    for (index = 0; index < order.length; index += 1) {
      flags.push(index < 5 ? "meaning" : "usage");
    }
    flags = fisherYates(flags);
    var kinds = {};
    order.forEach(function (id, flagIndex) {
      kinds[id] = flags[flagIndex];
    });
    return kinds;
  }

  function freshScenarioMode(previous, history) {
    var order = shuffledOrder(ORIGINAL_ORDER, previous && previous.order);
    var picks = {};
    var choices = {};
    order.forEach(function (id) {
      var priorPick = previous && previous.picks ? Number(previous.picks[id]) : NaN;
      if (Number.isFinite(priorPick)) {
        history.last[id] = priorPick;
      }
      picks[id] = pickScenarioIndex(id, history);
      var priorChoices = previous && previous.choices ? previous.choices[id] : null;
      choices[id] = makeChoices(id, priorChoices);
    });
    return {
      order: order,
      picks: picks,
      choices: choices,
      kinds: quizKinds(order),
      completed: {},
      incorrectById: {},
      missed: {},
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

  function isValidScenarios(round) {
    if (!round || !isValidOrder(round.order) || !round.picks || !round.choices) {
      return false;
    }
    return round.order.every(function (id) {
      var pick = Number(round.picks[id]);
      var kind = round.kinds && round.kinds[id];
      return (kind === "meaning" || kind === "usage") && SCENARIO_BANK[id] && Number.isFinite(pick) && pick >= 0 && pick < SCENARIO_BANK[id].length && isValidChoiceSet(id, round.choices[id]);
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

  function normalizeScenarios(round) {
    var missed = {};
    Object.keys(round.missed || {}).forEach(function (id) {
      if (!byId[id] || round.completed && round.completed[id]) {
        return;
      }
      var picks = {};
      Object.keys(round.missed[id] || {}).forEach(function (optionId) {
        if (byId[optionId] && optionId !== id && round.missed[id][optionId]) {
          picks[optionId] = true;
        }
      });
      if (Object.keys(picks).length) {
        missed[id] = picks;
      }
    });
    var picks = {};
    round.order.forEach(function (id) {
      picks[id] = Math.floor(Number(round.picks[id]));
    });
    return {
      order: round.order.slice(),
      picks: picks,
      choices: round.choices,
      kinds: round.kinds,
      completed: copyCompleted(round.completed),
      incorrectById: copyIncorrect(round.incorrectById),
      missed: missed,
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
    var scenarioHistory = freshScenarioHistory();
    return {
      order: shuffledOrder(ORIGINAL_ORDER, ORIGINAL_ORDER),
      completed: {},
      incorrectById: {},
      praise: {},
      hints: {},
      scrambles: {},
      wordsHidden: false,
      tab: "study",
      quiz: freshQuizMode(null),
      sentences: freshSentenceMode(null),
      versePractice: "learn",
      verseLevel: 1,
      verseBlanks: {},
      verseBlankDone: false,
      verseBlankMarks: {},
      verseSayDone: false,
      verseStarted: false,
      verseDone: false,
      verseHidden: false,
      verseDraft: "",
      verseMisses: 0,
      drillMode: "choice",
      drill: null,
      drillMemory: { misses: {}, recent: [] },
      scenarioHistory: scenarioHistory,
      scenarios: freshScenarioMode(null, scenarioHistory),
      reviewed: {}
    };
  }

  function loadState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return null;
      }
      var data = JSON.parse(raw);
      if (!data || (data.version !== 1 && data.version !== 2)) {
        return null;
      }
      if (data.weekId !== WEEK_ID || !isValidOrder(data.order)) {
        archiveStoredWeek(data);
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
      var scrambles = {};
      Object.keys(data.scrambles || {}).forEach(function (id) {
        if (byId[id] && !completed[id] && typeof data.scrambles[id] === "string") {
          scrambles[id] = data.scrambles[id];
        }
      });
      var praise = {};
      Object.keys(data.praise || {}).forEach(function (id) {
        if (completed[id] && typeof data.praise[id] === "string") {
          praise[id] = data.praise[id];
        }
      });
      var reviewed = {};
      Object.keys(data.reviewed || {}).forEach(function (id) {
        if (byId[id] && data.reviewed[id]) {
          reviewed[id] = true;
        }
      });
      var scenarioHistory = normalizeScenarioHistory(data.scenarioHistory);
      var scenarios = data.version === 2 && isValidScenarios(data.scenarios)
        ? normalizeScenarios(data.scenarios)
        : freshScenarioMode(null, scenarioHistory);
      return {
        order: data.order.slice(),
        completed: completed,
        incorrectById: incorrectById,
        praise: praise,
        hints: hints,
        scrambles: scrambles,
        wordsHidden: Boolean(data.wordsHidden),
        tab: TAB_ORDER.indexOf(data.tab) === -1 ? "study" : data.tab,
        quiz: data.version === 2 && isValidQuiz(data.quiz) ? normalizeQuiz(data.quiz) : freshQuizMode(null),
        sentences: data.version === 2 && isValidSentences(data.sentences) ? normalizeSentences(data.sentences) : freshSentenceMode(null),
        versePractice: normalizeVersePractice(data),
        verseLevel: clampVerseLevel(data.verseLevel),
        verseBlanks: normalizeVersePractice(data) === "blanks" ? normalizeVerseBlanks(data.verseBlanks) : {},
        verseBlankDone: normalizeVersePractice(data) === "blanks" && Boolean(data.verseBlankDone),
        verseBlankMarks: {},
        verseSayDone: normalizeVersePractice(data) === "say" && Boolean(data.verseSayDone),
        verseStarted: normalizeVersePractice(data) === "full" && Boolean(data.verseStarted),
        verseDone: normalizeVersePractice(data) === "full" && Boolean(data.verseDone),
        verseHidden: normalizeVersePractice(data) !== "blanks" && Boolean(data.verseHidden) && !(normalizeVersePractice(data) === "full" && data.verseDone),
        verseDraft: normalizeVersePractice(data) === "full" && typeof data.verseDraft === "string" ? data.verseDraft.slice(0, 800) : "",
        verseMisses: Number.isFinite(Number(data.verseMisses)) && Number(data.verseMisses) > 0 ? Math.floor(Number(data.verseMisses)) : 0,
        drillMode: DRILL_MODES.indexOf(data.drillMode) === -1 ? "choice" : data.drillMode,
        drill: normalizeDrill(data.drill),
        drillMemory: normalizeDrillMemory(data.drillMemory),
        scenarioHistory: scenarioHistory,
        scenarios: scenarios,
        reviewed: reviewed
      };
    } catch (error) {
      return null;
    }
  }

  function save() {
    var payload = {
      version: 2,
      weekId: WEEK_ID,
      order: state.order,
      completed: state.completed,
      incorrectById: state.incorrectById,
      praise: state.praise,
      hints: state.hints,
      scrambles: state.scrambles,
      wordsHidden: state.wordsHidden,
      tab: state.tab,
      quiz: state.quiz,
      sentences: state.sentences,
      verseMode: state.versePractice || "learn",
      verseLevel: state.verseLevel || 1,
      verseBlanks: state.verseBlanks || {},
      verseBlankDone: Boolean(state.verseBlankDone),
      verseSayDone: Boolean(state.verseSayDone),
      verseStarted: state.verseStarted,
      verseDone: state.verseDone,
      verseHidden: state.verseHidden,
      verseDraft: state.verseDraft || "",
      verseMisses: state.verseMisses,
      drillMode: state.drillMode,
      drill: state.drill,
      drillMemory: state.drillMemory,
      scenarioHistory: state.scenarioHistory,
      scenarios: state.scenarios,
      reviewed: state.reviewed
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
      var reviewed = Boolean(state.reviewed[item.id]);
      var card = document.createElement("article");
      card.className = "study-card" + (reviewed ? " is-reviewed" : "");

      var kicker = document.createElement("p");
      kicker.className = "study-kicker";
      kicker.textContent = "Word " + (index + 1) + " of " + VOCABULARY.length;

      var word = document.createElement("h3");
      word.className = "study-word";
      if (hidden) {
        word.textContent = "••••••";
        word.classList.add("is-hidden-word");
        word.setAttribute("aria-label", "Word covered");
      } else {
        word.textContent = item.word;
      }

      var speech = document.createElement("p");
      speech.className = "study-say";
      speech.textContent = "Part of speech: " + item.speech;

      var root = document.createElement("p");
      root.className = "study-say";
      root.textContent = rootLine(item);

      var definition = document.createElement("p");
      definition.className = "study-definition";
      definition.textContent = item.definition;

      card.append(kicker, word, speech, root, definition);

      if (!hidden) {
        var say = document.createElement("p");
        say.className = "study-say";
        say.textContent = "Say it: " + item.pronunciation;
        var example = document.createElement("p");
        example.className = "study-example";
        example.textContent = "Example: " + item.example;
        card.append(say, example);
        var hear = document.createElement("button");
        hear.type = "button";
        hear.className = "btn btn-ghost";
        hear.dataset.speak = item.word;
        hear.setAttribute("aria-label", "Hear word " + item.word);
        hear.textContent = "Hear Word";
        card.append(hear);
      }
      var mark = document.createElement("button");
      mark.type = "button";
      mark.className = "btn btn-secondary";
      mark.dataset.review = item.id;
      mark.textContent = reviewed ? "Reviewed" : "Mark Reviewed";
      mark.setAttribute("aria-pressed", String(reviewed));
      card.append(mark);

      grid.append(card);
    });
    paintReview();
    renderFlash();
  }

  function reviewTotal() {
    return Object.keys(state.reviewed || {}).filter(function (id) {
      return byId[id] && state.reviewed[id];
    }).length;
  }

  function paintReview() {
    var count = $("review-count");
    if (!count) {
      return;
    }
    count.textContent = reviewTotal() + " of " + VOCABULARY.length + " words reviewed";
  }

  function toggleReviewed(id) {
    if (!byId[id]) {
      return;
    }
    if (!state.reviewed) {
      state.reviewed = {};
    }
    if (state.reviewed[id]) {
      delete state.reviewed[id];
    } else {
      state.reviewed[id] = true;
    }
    save();
    renderStudy();
  }

  function clearReviewed() {
    state.reviewed = {};
    flashOn = false;
    save();
    renderStudy();
  }

  var flashOn = false;
  var flashIndex = 0;
  var flashBack = false;

  function renderFlash() {
    var stage = $("flash-stage");
    var listButton = $("view-list");
    var flashButton = $("view-flash");
    if (!stage || !listButton || !flashButton) {
      return;
    }
    listButton.classList.toggle("is-active", !flashOn);
    flashButton.classList.toggle("is-active", flashOn);
    listButton.setAttribute("aria-pressed", String(!flashOn));
    flashButton.setAttribute("aria-pressed", String(flashOn));
    $("study-grid").hidden = flashOn;
    stage.hidden = !flashOn;
    stage.textContent = "";
    if (!flashOn) {
      return;
    }
    var item = VOCABULARY[flashIndex];
    var card = document.createElement("article");
    card.className = "study-card flash-card";
    var count = document.createElement("p");
    count.className = "study-kicker";
    count.textContent = "Card " + (flashIndex + 1) + " of " + VOCABULARY.length;
    var word = document.createElement("h3");
    word.className = "study-word";
    word.textContent = item.word;
    var speech = document.createElement("p");
    speech.className = "study-say";
    speech.textContent = "Part of speech: " + item.speech;
    card.append(count, word, speech);
    if (flashBack) {
      var meaning = document.createElement("p");
      meaning.className = "study-definition";
      meaning.textContent = item.definition;
      var example = document.createElement("p");
      example.className = "study-example";
      example.textContent = "Example: " + item.example;
      var root = document.createElement("p");
      root.className = "study-say";
      root.textContent = rootLine(item);
      card.append(meaning, example, root);
    } else {
      var cue = document.createElement("p");
      cue.className = "instructions";
      cue.textContent = "Tap the card to see the meaning and example.";
      card.append(cue);
    }
    card.addEventListener("click", function () {
      flashBack = !flashBack;
      renderFlash();
    });
    var controls = document.createElement("div");
    controls.className = "quiz-move";
    var previous = document.createElement("button");
    previous.type = "button";
    previous.className = "btn btn-secondary";
    previous.textContent = "Previous";
    previous.disabled = flashIndex === 0;
    previous.addEventListener("click", function (event) {
      event.stopPropagation();
      flashIndex -= 1;
      flashBack = false;
      renderFlash();
    });
    var next = document.createElement("button");
    next.type = "button";
    next.className = "btn btn-secondary";
    next.textContent = "Next";
    next.disabled = flashIndex === VOCABULARY.length - 1;
    next.addEventListener("click", function (event) {
      event.stopPropagation();
      flashIndex += 1;
      flashBack = false;
      renderFlash();
    });
    controls.append(previous, next);
    var mark = document.createElement("button");
    mark.type = "button";
    mark.className = "btn btn-secondary";
    mark.textContent = state.reviewed[item.id] ? "Reviewed" : "Mark Reviewed";
    mark.setAttribute("aria-pressed", String(Boolean(state.reviewed[item.id])));
    mark.addEventListener("click", function (event) {
      event.stopPropagation();
      toggleReviewed(item.id);
    });
    controls.append(mark);
    stage.append(card, controls);
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
      definition.textContent = "Meaning: " + item.definition;
      var example = document.createElement("p");
      example.className = "definition";
      example.textContent = "Example: " + (complete ? item.example : blankExample(item.example, item.word));
      head.append(number, definition, example);

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
      var scrambleButton = document.createElement("button");
      scrambleButton.type = "button";
      scrambleButton.className = "btn btn-hint";
      scrambleButton.dataset.scramble = id;
      scrambleButton.textContent = state.scrambles[id] ? "Hide Scramble" : "Scramble";
      scrambleButton.setAttribute("aria-expanded", state.scrambles[id] ? "true" : "false");
      tools.append(scrambleButton);

      var hint = document.createElement("p");
      hint.className = "hint";
      hint.hidden = !state.hints[id];
      if (state.hints[id]) {
        hint.textContent = "Hint: " + buildHint(item.word);
      }
      var scramble = document.createElement("p");
      scramble.className = "hint";
      scramble.dataset.scrambleLine = id;
      scramble.hidden = !state.scrambles[id];
      if (state.scrambles[id]) {
        scramble.textContent = "Scramble: " + state.scrambles[id];
      }

      card.append(head, form, tools, hint, scramble);

      if (complete) {
        input.value = item.word;
        input.readOnly = true;
        input.tabIndex = -1;
        check.disabled = true;
        check.textContent = "Completed";
        hintButton.hidden = true;
        hint.hidden = true;
        hint.textContent = "";
        scrambleButton.hidden = true;
        scramble.hidden = true;
        scramble.textContent = "";
        setFeedback(card, "correct", "Correct! Great job!", state.praise[id] || "That word is locked in.");
      }

      list.append(card);
    });
  }

  function updateStats() {
    var correct = correctCount();
    var remaining = VOCABULARY.length - correct;
    var incorrect = totalIncorrect();
    $("correct-count").textContent = correct + "/" + VOCABULARY.length;
    $("remaining-count").textContent = String(remaining);
    $("incorrect-count").textContent = String(incorrect);
    $("progress-fill").style.width = ((correct / VOCABULARY.length) * 100) + "%";
    $("progress-track").setAttribute("aria-valuemax", String(VOCABULARY.length));
    $("progress-track").setAttribute("aria-valuenow", String(correct));
    $("progress-track").setAttribute("aria-label", correct + " of " + VOCABULARY.length + " correct");
    $("retry-incorrect").disabled = remaining === 0;

    var celebration = $("celebration");
    if (correct === VOCABULARY.length) {
      $("final-correct").textContent = "Total correct: " + correct + "/" + VOCABULARY.length;
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
      perfect.textContent = "You matched every word on the first try.";
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
    var scrambleButton = card.querySelector("[data-scramble]");
    if (scrambleButton) {
      scrambleButton.hidden = true;
    }
    card.querySelectorAll(".hint").forEach(function (line) {
      line.hidden = true;
      line.textContent = "";
    });
    var lines = card.querySelectorAll(".definition");
    if (lines[1]) {
      lines[1].textContent = "Example: " + item.example;
    }
    setFeedback(card, "correct", "Correct! Great job!", state.praise[item.id]);
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
      setFeedback(card, "empty", "Choose a word from the bank, then check it.");
      input.focus();
      return;
    }

    if (result === "correct") {
      state.completed[id] = true;
      state.praise[id] = nextPraise();
      delete state.hints[id];
      delete state.scrambles[id];
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
    setFeedback(card, "incorrect", "Not quite! Try again.");
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

  function toggleScramble(id) {
    if (!byId[id] || state.completed[id]) {
      return;
    }
    if (state.scrambles[id]) {
      delete state.scrambles[id];
    } else {
      state.scrambles[id] = scrambleWord(byId[id].word);
    }
    save();
    var card = cardFor(id);
    var line = card.querySelector("[data-scramble-line]");
    var button = card.querySelector("[data-scramble]");
    if (state.scrambles[id]) {
      line.hidden = false;
      line.textContent = "Scramble: " + state.scrambles[id];
      button.textContent = "Hide Scramble";
      button.setAttribute("aria-expanded", "true");
    } else {
      line.hidden = true;
      line.textContent = "";
      button.textContent = "Scramble";
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
      li.append(title, document.createTextNode(" — " + entry.item.definition + " Example: " + entry.item.example + " (" + entry.misses + " " + noun + ")."));
      list.append(li);
    });
  }

  function paintModeTracker(prefix, round) {
    var correct = modeCount(round);
    var incorrect = modeIncorrect(round);
    var remaining = VOCABULARY.length - correct;
    $(prefix + "-correct").textContent = correct + "/" + VOCABULARY.length;
    $(prefix + "-remaining").textContent = String(remaining);
    $(prefix + "-incorrect").textContent = String(incorrect);
    $(prefix + "-accuracy").textContent = formatPercent(accuracyPercent(correct, incorrect));
    $(prefix + "-fill").style.width = ((correct / VOCABULARY.length) * 100) + "%";
    $(prefix + "-progress").setAttribute("aria-valuemax", String(VOCABULARY.length));
    $(prefix + "-progress").setAttribute("aria-valuenow", String(correct));
    $(prefix + "-progress").setAttribute("aria-label", correct + " of " + VOCABULARY.length + " correct");
    $(prefix + "-retry").disabled = remaining === 0;
    var celebration = $(prefix + "-celebration");
    if (correct === VOCABULARY.length) {
      $(prefix + "-final-correct").textContent = "Total correct: " + VOCABULARY.length + "/" + VOCABULARY.length;
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
    $("choice-counter").textContent = "Question " + (quiz.index + 1) + " of " + VOCABULARY.length;
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
    prompt.textContent = "Which meaning matches this word?";
    var definition = document.createElement("p");
    definition.className = "quiz-definition";
    definition.textContent = item.word;
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
      button.textContent = (complete && isAnswer ? "✓ " : "") + prefix + byId[optionId].definition;
      button.addEventListener("click", function () {
        selectChoice(id, optionId);
      });
      list.append(button);
    });

    body.append(prompt, definition, list);
    if (complete) {
      body.append(setQuizFeedback("correct", "Great job! That's correct!", true));
    } else if (quiz.missed[id] && Object.keys(quiz.missed[id]).length) {
      body.append(setQuizFeedback("incorrect", "Not quite. Try again!", false));
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
    $("sentence-counter").textContent = "Question " + (round.index + 1) + " of " + VOCABULARY.length;
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
    body.append(text);
    appendWordBank(body, function (word) {
      if (complete) {
        return;
      }
      input.value = word;
      input.focus();
    });

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

    body.append(form);
    if (complete) {
      input.value = item.word;
      input.readOnly = true;
      input.tabIndex = -1;
      check.disabled = true;
      check.textContent = "Completed";
      body.append(setQuizFeedback("correct", "Correct! " + item.example, true));
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
      $("sentence-body").append(setQuizFeedback("empty", "Choose a word from the bank, then check it.", false));
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
      $("sentence-body").append(setQuizFeedback("incorrect", "Good try! Use the word bank and try again.", false));
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

  function renderScenario() {
    var round = state.scenarios;
    var id = round.order[round.index];
    var complete = Boolean(round.completed[id]);
    $("apply-counter").textContent = "Question " + (round.index + 1) + " of " + VOCABULARY.length;
    $("apply-prev").disabled = round.index === 0;
    $("apply-next").disabled = round.index === round.order.length - 1;
    renderDots("apply-dots", round, function (index) {
      round.index = index;
      save();
      renderScenario();
    });

    var body = $("apply-body");
    body.textContent = "";
    var kind = round.kinds && round.kinds[id] === "usage" ? "usage" : "meaning";
    var item = byId[id];
    var prompt = document.createElement("p");
    prompt.className = "quiz-prompt";
    prompt.textContent = kind === "usage" ? "Which word completes this sentence?" : "Which meaning matches this word?";
    var question = document.createElement("p");
    question.className = "quiz-definition";
    question.textContent = kind === "usage" ? blankExample(item.example, item.word) : item.word;
    var list = document.createElement("div");
    list.className = "choice-list";
    list.setAttribute("role", "group");
    list.setAttribute("aria-label", "Answer choices");

    round.choices[id].forEach(function (optionId, optionIndex) {
      var button = document.createElement("button");
      button.type = "button";
      button.className = "choice-btn";
      var missed = round.missed[id] && round.missed[id][optionId];
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
      var choiceLabel = kind === "usage" ? byId[optionId].word : byId[optionId].definition;
      button.textContent = (complete && isAnswer ? "✓ " : "") + prefix + choiceLabel;
      button.addEventListener("click", function () {
        selectScenario(id, optionId);
      });
      list.append(button);
    });

    body.append(prompt, question, list);
    if (complete) {
      var correctNote = kind === "usage" ? "Correct! " + item.example : "Correct! " + item.definition;
      body.append(setQuizFeedback("correct", correctNote, true));
    } else if (round.missed[id] && Object.keys(round.missed[id]).length) {
      var retryNote = kind === "usage"
        ? "That word does not complete this sentence. Try another choice."
        : "That is not the meaning of this word. Try another choice.";
      body.append(setQuizFeedback("incorrect", retryNote, false));
    }
  }

  function selectScenario(questionId, optionId) {
    var round = state.scenarios;
    if (round.order[round.index] !== questionId || round.completed[questionId]) {
      return;
    }
    if (round.missed[questionId] && round.missed[questionId][optionId]) {
      return;
    }
    if (optionId === questionId) {
      round.completed[questionId] = true;
      if (round.missed[questionId]) {
        delete round.missed[questionId];
      }
      save();
      renderScenario();
      paintModeTracker("apply", round);
      if (modeCount(round) === VOCABULARY.length) {
        showModeCelebration("apply-celebration");
      }
      return;
    }
    if (!round.missed[questionId]) {
      round.missed[questionId] = {};
    }
    round.missed[questionId][optionId] = true;
    round.incorrectById[questionId] = (round.incorrectById[questionId] || 0) + 1;
    save();
    renderScenario();
    paintModeTracker("apply", round);
  }

  function moveScenario(step) {
    var next = state.scenarios.index + step;
    if (next < 0 || next >= state.scenarios.order.length) {
      return;
    }
    state.scenarios.index = next;
    save();
    renderScenario();
  }

  function retryScenarios() {
    var round = state.scenarios;
    if (modeCount(round) === VOCABULARY.length) {
      return;
    }
    round.order = retryOrder(round.order, round.completed);
    round.order.forEach(function (id) {
      if (!round.completed[id]) {
        round.choices[id] = makeChoices(id, round.choices[id]);
        delete round.missed[id];
      }
    });
    round.index = firstOpenIndex(round);
    save();
    renderScenario();
    paintModeTracker("apply", round);
  }

  function startNewScenarios() {
    state.scenarios = freshScenarioMode(state.scenarios, state.scenarioHistory);
    state.tab = "apply";
    save();
    renderScenario();
    paintModeTracker("apply", state.scenarios);
    showTab("apply");
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
      idleText: "This will shuffle all 10 definitions into a new practice round.",
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
      idleText: "This will shuffle all 10 questions and answer choices into a new quiz.",
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
      idleText: "This will shuffle all 10 sentences and choose new examples.",
      confirmLabel: "Start New Practice",
      confirmAction: startNewSentences
    });
  }

  function openScenarioReset() {
    var round = state.scenarios;
    askToReset({
      finished: modeCount(round) === VOCABULARY.length,
      hasProgress: modeCount(round) > 0 || modeIncorrect(round) > 0,
      title: "Start a new quiz?",
      progressText: "This quiz is not finished. Starting over will clear this Multiple Choice score. Define keeps its own score.",
      idleText: "This will choose new situations and shuffle the answer choices.",
      confirmLabel: "Start New Quiz",
      confirmAction: startNewScenarios
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

  var VERSE_LINES = [
    [
      { text: "For", answer: "for", level: 0 },
      { text: "a", answer: "a", level: 0 },
      { text: "child", answer: "child", level: 1 },
      { text: "is", answer: "is", level: 0 },
      { text: "born", answer: "born", level: 2 },
      { text: "to", answer: "to", level: 0 },
      { text: "us", answer: "us", level: 0, after: "," },
      { text: "a", answer: "a", level: 0 },
      { text: "son", answer: "son", level: 2 },
      { text: "is", answer: "is", level: 0 },
      { text: "given", answer: "given", level: 3 },
      { text: "to", answer: "to", level: 0 },
      { text: "us", answer: "us", level: 0, after: "." }
    ],
    [
      { text: "The", answer: "the", level: 0 },
      { text: "government", answer: "government", level: 1 },
      { text: "will", answer: "will", level: 0 },
      { text: "rest", answer: "rest", level: 3 },
      { text: "on", answer: "on", level: 0 },
      { text: "his", answer: "his", level: 0 },
      { text: "shoulders", answer: "shoulders", level: 2, after: "." }
    ],
    [
      { text: "And", answer: "and", level: 0 },
      { text: "he", answer: "he", level: 0 },
      { text: "will", answer: "will", level: 0 },
      { text: "be", answer: "be", level: 0 },
      { text: "called", answer: "called", level: 3, after: ":" },
      { text: "Wonderful", answer: "wonderful", level: 1 },
      { text: "Counselor", answer: "counselor", level: 2, after: "," },
      { text: "Mighty", answer: "mighty", level: 2 },
      { text: "God", answer: "god", level: 3, after: "," },
      { text: "Everlasting", answer: "everlasting", level: 3 },
      { text: "Father", answer: "father", level: 3, after: "," },
      { text: "Prince", answer: "prince", level: 3 },
      { text: "of", answer: "of", level: 0 },
      { text: "Peace", answer: "peace", level: 1, after: "." }
    ]
  ];
  var VERSE_PARTS = [];
  (function () {
    var wordIndex = 0;
    VERSE_LINES.forEach(function (line, lineIndex) {
      if (lineIndex > 0) {
        VERSE_PARTS.push({ type: "break" });
      }
      line.forEach(function (token) {
        VERSE_PARTS.push({
          type: "word",
          text: token.text,
          answer: token.answer,
          level: token.level,
          after: token.after || "",
          index: String(wordIndex)
        });
        wordIndex += 1;
      });
    });
  })();

  function verseFromParts() {
    var lines = [];
    var current = [];
    VERSE_PARTS.forEach(function (part) {
      if (part.type === "break") {
        lines.push(current.join(" "));
        current = [];
        return;
      }
      current.push(part.text + part.after);
    });
    if (current.length) {
      lines.push(current.join(" "));
    }
    return lines.join("\n\n");
  }

  function blankCountForLevel(level) {
    return VERSE_PARTS.filter(function (part) {
      return part.type === "word" && part.level > 0 && part.level <= level;
    }).length;
  }

  function normalizeVersePractice(data) {
    var mode = data && data.verseMode;
    if (mode !== "blanks" && mode !== "say" && mode !== "full" && mode !== "learn") {
      return "learn";
    }
    if (mode === "full" && !(data.verseStarted || data.verseDone)) {
      return "learn";
    }
    return mode;
  }

  function clampVerseLevel(value) {
    var level = Number(value);
    if (!Number.isFinite(level) || level < 1) {
      return 1;
    }
    if (level > 3) {
      return 3;
    }
    return Math.floor(level);
  }

  function normalizeVerseBlanks(raw) {
    var blanks = {};
    if (!raw || typeof raw !== "object") {
      return blanks;
    }
    Object.keys(raw).forEach(function (key) {
      if (!/^\d+$/.test(key) || typeof raw[key] !== "string") {
        return;
      }
      blanks[key] = raw[key].slice(0, 40);
    });
    return blanks;
  }

  var WEEK_VERSE = verseFromParts();
  var WEEK_VERSE_SPOKEN = WEEK_VERSE;

  function archiveStoredWeek(data) {
    try {
      var history = [];
      var existing = localStorage.getItem(HISTORY_KEY);
      if (existing) {
        var parsed = JSON.parse(existing);
        if (Array.isArray(parsed)) {
          history = parsed;
        }
      }
      var signature = JSON.stringify(data.order || []);
      var last = history.length ? history[history.length - 1] : null;
      if (last && JSON.stringify((last.progress || {}).order || []) === signature) {
        return;
      }
      history.push({
        weekId: data.weekId || "earlier-week",
        savedAt: new Date().toISOString(),
        progress: data
      });
      if (history.length > 12) {
        history = history.slice(history.length - 12);
      }
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    } catch (error) {
      // The new week can still start if older progress cannot be archived.
    }
  }

  function verseKey(text) {
    return normalizeAnswer(text).replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
  }

  function verseWords(text) {
    var key = verseKey(text);
    return key ? key.split(" ") : [];
  }

  function diffVerseWords(expected, actual) {
    var n = expected.length;
    var m = actual.length;
    var dp = [];
    var i;
    var j;
    for (i = 0; i <= n; i += 1) {
      dp[i] = [];
      for (j = 0; j <= m; j += 1) {
        dp[i][j] = 0;
      }
    }
    for (j = 1; j <= m; j += 1) {
      dp[0][j] = j;
    }
    for (i = 1; i <= n; i += 1) {
      dp[i][0] = i;
    }
    for (i = 1; i <= n; i += 1) {
      for (j = 1; j <= m; j += 1) {
        if (expected[i - 1] === actual[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1];
        } else {
          dp[i][j] = 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
        }
      }
    }
    var ops = [];
    i = n;
    j = m;
    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && expected[i - 1] === actual[j - 1] && dp[i][j] === dp[i - 1][j - 1]) {
        ops.push({ type: "ok", word: actual[j - 1] });
        i -= 1;
        j -= 1;
      } else if (i > 0 && j > 0 && dp[i][j] === dp[i - 1][j - 1] + 1) {
        ops.push({ type: "wrong", word: actual[j - 1] });
        i -= 1;
        j -= 1;
      } else if (j > 0 && dp[i][j] === dp[i][j - 1] + 1) {
        ops.push({ type: "extra", word: actual[j - 1] });
        j -= 1;
      } else {
        ops.push({ type: "missing" });
        i -= 1;
      }
    }
    ops.reverse();
    return ops;
  }

  function clearVerseResult() {
    $("verse-result").textContent = "";
  }

  function paintVerseDiff(ops) {
    var result = $("verse-result");
    result.textContent = "";
    var message = document.createElement("p");
    message.className = "quiz-feedback is-incorrect";
    message.textContent = "Almost there! You have a few words to check.";
    var list = document.createElement("div");
    list.className = "verse-diff";
    list.setAttribute("aria-label", "Words to check");
    ops.forEach(function (op) {
      var chip = document.createElement("span");
      chip.className = "verse-chip";
      if (op.type === "ok") {
        chip.classList.add("is-ok");
        chip.textContent = op.word;
      } else if (op.type === "wrong") {
        chip.classList.add("is-wrong");
        chip.textContent = "check: " + op.word;
      } else if (op.type === "extra") {
        chip.classList.add("is-extra");
        chip.textContent = "extra: " + op.word;
      } else {
        chip.classList.add("is-missing");
        chip.textContent = "missing word";
      }
      list.append(chip);
    });
    var legend = document.createElement("p");
    legend.className = "verse-legend";
    legend.textContent = "Green words match. Marked words need a look. A missing-word spot means a word belongs there.";
    result.append(message, list, legend);
  }

  function renderVerseCloze() {
    var box = $("verse-cloze");
    var level = clampVerseLevel(state.verseLevel);
    var missing = blankCountForLevel(level);
    box.textContent = "";
    var label = document.createElement("p");
    label.className = "verse-level";
    label.textContent = "Level " + level + " of 3 · " + missing + (missing === 1 ? " word missing" : " words missing");
    box.append(label);
    var paragraph = document.createElement("p");
    paragraph.className = "verse-text";
    VERSE_PARTS.forEach(function (part) {
      if (part.type === "break") {
        box.append(paragraph);
        paragraph = document.createElement("p");
        paragraph.className = "verse-text";
        return;
      }
      if (paragraph.childNodes.length) {
        paragraph.append(document.createTextNode(" "));
      }
      var removed = part.level > 0 && part.level <= level;
      if (removed) {
        var input = document.createElement("input");
        input.type = "text";
        input.className = "verse-blank-input";
        input.autocomplete = "off";
        input.autocapitalize = "off";
        input.spellcheck = false;
        input.setAttribute("autocorrect", "off");
        input.setAttribute("aria-label", "Missing word");
        input.maxLength = 40;
        input.dataset.index = part.index;
        input.value = state.verseBlanks[part.index] || "";
        var mark = state.verseBlankMarks[part.index];
        if (mark === "ok") {
          input.classList.add("is-ok");
        } else if (mark === "wrong") {
          input.classList.add("is-wrong");
        }
        if (state.verseBlankDone) {
          input.readOnly = true;
        }
        paragraph.append(input);
      } else {
        paragraph.append(document.createTextNode(part.text));
      }
      if (part.after) {
        paragraph.append(document.createTextNode(part.after));
      }
    });
    box.append(paragraph);
    var form = document.createElement("form");
    form.className = "verse-form";
    form.autocomplete = "off";
    var check = document.createElement("button");
    check.type = "submit";
    check.className = "btn btn-check";
    check.textContent = state.verseBlankDone ? "Checked" : "Check My Answer";
    check.disabled = Boolean(state.verseBlankDone);
    form.append(check);
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      checkVerseBlanks();
    });
    box.append(form);
  }

  function renderVerse() {
    var practice = state.versePractice || "learn";
    var text = $("verse-text");
    var input = $("verse-input");
    var fullPractice = practice === "full" && (state.verseStarted || state.verseDone);
    var showFullText = practice !== "blanks" && !state.verseHidden;
    if (showFullText) {
      text.textContent = WEEK_VERSE;
      text.hidden = false;
    } else {
      text.textContent = "";
      text.hidden = true;
    }
    $("verse-form").hidden = !fullPractice;
    $("verse-cloze").hidden = practice !== "blanks";
    $("verse-blank-actions").hidden = !(practice === "blanks" && state.verseBlankDone && state.verseLevel < 3);
    $("verse-say-panel").hidden = !(practice === "say" && !state.verseSayDone);
    $("verse-peek").hidden = practice === "blanks";
    $("verse-peek").textContent = state.verseHidden ? "Show Verse" : "Hide Verse";
    $("verse-peek").setAttribute("aria-pressed", String(!state.verseHidden));
    $("verse-start").classList.toggle("is-active", practice === "blanks");
    $("verse-start").setAttribute("aria-pressed", String(practice === "blanks"));
    $("verse-whole").classList.toggle("is-active", practice === "full");
    $("verse-whole").setAttribute("aria-pressed", String(practice === "full"));
    $("verse-say").classList.toggle("is-active", practice === "say");
    $("verse-say").setAttribute("aria-pressed", String(practice === "say"));
    var finished = (practice === "full" && state.verseDone) || (practice === "blanks" && state.verseBlankDone) || (practice === "say" && state.verseSayDone);
    $("verse-again").hidden = !finished;
    $("verse-celebrate").hidden = !finished;
    var title = $("verse-celebrate").querySelector("h2");
    var note = $("verse-celebrate-note");
    if (practice === "full" && state.verseDone) {
      title.textContent = "Congratulations, Max! You got the entire verse correct!";
      note.textContent = "Capital letters and punctuation were not counted.";
    } else if (practice === "blanks" && state.verseBlankDone) {
      title.textContent = "Those missing words are correct!";
      note.textContent = state.verseLevel < 3
        ? "Level " + state.verseLevel + " of 3 is complete. Try harder blanks, or practice the whole verse from memory."
        : "You finished the hardest fill-in level. Practice the whole verse from memory when you are ready.";
    } else if (practice === "say" && state.verseSayDone) {
      title.textContent = "You marked this verse as recited.";
      note.textContent = "The app did not listen to you or check your speaking. You confirmed that you said the verse.";
    }
    if (fullPractice && document.activeElement !== input) {
      input.value = state.verseDraft || "";
    }
    if (practice === "blanks") {
      renderVerseCloze();
      $("verse-instructions").textContent = "Type the missing words from memory. There is no word box. Capital letters do not matter. Check your answer, then fix any word you missed.";
    } else if (practice === "say") {
      $("verse-instructions").textContent = state.verseSayDone
        ? "Press Practice Again to say the verse another time."
        : "Read the verse, or press Hide Verse and say it aloud. Press I Recited My Verse when you finish. Speaking is not checked automatically.";
    } else if (fullPractice && state.verseDone) {
      $("verse-instructions").textContent = "You typed the whole verse. Press Practice Again for a new try.";
    } else if (fullPractice) {
      $("verse-instructions").textContent = "Type the whole verse from memory. Capital letters, punctuation, and extra spaces do not matter.";
    } else {
      $("verse-instructions").textContent = "Read the verse. Fill in a few blanks, practice the whole verse, or practice saying it.";
    }
  }

  function checkVerse() {
    var input = $("verse-input");
    state.verseDraft = input.value;
    var typed = verseWords(input.value);
    var expected = verseWords(WEEK_VERSE);
    if (!typed.length) {
      clearVerseResult();
      var empty = document.createElement("p");
      empty.className = "quiz-feedback is-empty";
      empty.textContent = "Type the verse, then check your answer.";
      $("verse-result").append(empty);
      input.focus();
      return;
    }
    if (typed.join(" ") === expected.join(" ")) {
      state.verseDone = true;
      state.verseHidden = false;
      save();
      clearVerseResult();
      renderVerse();
      return;
    }
    state.verseDone = false;
    state.verseMisses += 1;
    save();
    renderVerse();
    paintVerseDiff(diffVerseWords(expected, typed));
    input.focus();
  }

  function readVerseBlanks() {
    var inputs = document.querySelectorAll("#verse-cloze .verse-blank-input");
    Array.prototype.forEach.call(inputs, function (input) {
      state.verseBlanks[input.dataset.index] = input.value;
    });
  }

  function checkVerseBlanks() {
    if (state.versePractice !== "blanks" || state.verseBlankDone) {
      return;
    }
    readVerseBlanks();
    var level = clampVerseLevel(state.verseLevel);
    var marks = {};
    var emptyCount = 0;
    var wrongCount = 0;
    VERSE_PARTS.forEach(function (part) {
      if (part.type !== "word" || part.level < 1 || part.level > level) {
        return;
      }
      var typed = verseKey(state.verseBlanks[part.index] || "");
      if (!typed) {
        emptyCount += 1;
        marks[part.index] = "empty";
      } else if (typed !== part.answer) {
        wrongCount += 1;
        marks[part.index] = "wrong";
      } else {
        marks[part.index] = "ok";
      }
    });
    state.verseBlankMarks = marks;
    clearVerseResult();
    if (emptyCount > 0) {
      var empty = document.createElement("p");
      empty.className = "quiz-feedback is-empty";
      empty.textContent = "Type every missing word, then check your answer.";
      $("verse-result").append(empty);
      save();
      renderVerse();
      var firstEmpty = document.querySelector("#verse-cloze .verse-blank-input:not(.is-ok)");
      if (firstEmpty) {
        firstEmpty.focus();
      }
      return;
    }
    if (wrongCount === 0) {
      state.verseBlankDone = true;
      save();
      renderVerse();
      return;
    }
    state.verseMisses += 1;
    save();
    renderVerse();
    var retry = document.createElement("p");
    retry.className = "quiz-feedback is-incorrect";
    retry.textContent = "Some words need another look. Fix the highlighted blanks and try again.";
    $("verse-result").append(retry);
    var firstWrong = document.querySelector("#verse-cloze .verse-blank-input.is-wrong");
    if (firstWrong) {
      firstWrong.focus();
    }
  }

  function startVerseBlanks() {
    state.versePractice = "blanks";
    state.verseLevel = 1;
    state.verseBlanks = {};
    state.verseBlankDone = false;
    state.verseBlankMarks = {};
    state.verseStarted = false;
    state.verseDone = false;
    state.verseSayDone = false;
    state.verseHidden = false;
    save();
    clearVerseResult();
    renderVerse();
    var first = document.querySelector("#verse-cloze .verse-blank-input");
    if (first) {
      first.focus();
    }
  }

  function startVerseWhole() {
    state.versePractice = "full";
    state.verseStarted = true;
    state.verseHidden = true;
    state.verseDone = false;
    state.verseDraft = "";
    state.verseSayDone = false;
    state.verseBlankDone = false;
    save();
    clearVerseResult();
    renderVerse();
    $("verse-input").focus();
  }

  function startVerseSay() {
    state.versePractice = "say";
    state.verseStarted = false;
    state.verseDone = false;
    state.verseHidden = false;
    state.verseSayDone = false;
    state.verseBlankDone = false;
    save();
    clearVerseResult();
    renderVerse();
  }

  function markVerseRecited() {
    state.versePractice = "say";
    state.verseSayDone = true;
    state.verseDone = false;
    save();
    clearVerseResult();
    renderVerse();
  }

  function harderVerseBlanks() {
    if (state.versePractice !== "blanks" || !state.verseBlankDone || state.verseLevel >= 3) {
      return;
    }
    state.verseLevel += 1;
    state.verseBlanks = {};
    state.verseBlankDone = false;
    state.verseBlankMarks = {};
    save();
    clearVerseResult();
    renderVerse();
    var first = document.querySelector("#verse-cloze .verse-blank-input");
    if (first) {
      first.focus();
    }
  }

  function retryCurrentVerse() {
    if (state.versePractice === "blanks") {
      state.verseBlanks = {};
      state.verseBlankDone = false;
      state.verseBlankMarks = {};
    } else if (state.versePractice === "say") {
      state.verseSayDone = false;
      state.verseHidden = false;
    } else {
      state.versePractice = "full";
      state.verseStarted = true;
      state.verseDone = false;
      state.verseHidden = true;
      state.verseDraft = "";
    }
    save();
    clearVerseResult();
    renderVerse();
    if (state.versePractice === "blanks") {
      var first = document.querySelector("#verse-cloze .verse-blank-input");
      if (first) {
        first.focus();
      }
    } else if (state.versePractice === "full") {
      $("verse-input").focus();
    }
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
    if (!state.scenarioHistory) {
      state.scenarioHistory = freshScenarioHistory();
    }
    if (!state.scenarios) {
      state.scenarios = freshScenarioMode(null, state.scenarioHistory);
    }
    if (!state.hints) {
      state.hints = {};
    }
    if (!state.scrambles) {
      state.scrambles = {};
    }
    if (!state.reviewed) {
      state.reviewed = {};
    }
    if (typeof state.verseDone !== "boolean") {
      state.verseStarted = false;
      state.verseDone = false;
      state.verseHidden = false;
      state.verseDraft = "";
      state.verseMisses = 0;
    }
    if (typeof state.verseStarted !== "boolean") {
      state.verseStarted = false;
    }
    if (typeof state.verseDraft !== "string") {
      state.verseDraft = "";
    }
    if (state.versePractice !== "learn" && state.versePractice !== "blanks" && state.versePractice !== "full" && state.versePractice !== "say") {
      state.versePractice = "learn";
    }
    state.verseLevel = clampVerseLevel(state.verseLevel);
    if (!state.verseBlanks || typeof state.verseBlanks !== "object") {
      state.verseBlanks = {};
    }
    if (!state.verseBlankMarks || typeof state.verseBlankMarks !== "object") {
      state.verseBlankMarks = {};
    }
    if (typeof state.verseBlankDone !== "boolean") {
      state.verseBlankDone = false;
    }
    if (typeof state.verseSayDone !== "boolean") {
      state.verseSayDone = false;
    }
    renderVerse();
    renderStudy();
    renderChallenge();
    renderSpellBank();
    updateStats();
    renderQuiz();
    paintModeTracker("choice", state.quiz);
    renderSentence();
    paintModeTracker("sentence", state.sentences);
    renderScenario();
    paintModeTracker("apply", state.scenarios);
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

    $("verse-hear").addEventListener("click", function () {
      var note = $("verse-speech-note");
      if (speak(WEEK_VERSE_SPOKEN)) {
        note.textContent = "";
      } else {
        note.textContent = "Hearing the verse is not available in this browser. You can still read it.";
      }
    });
    $("verse-start").addEventListener("click", startVerseBlanks);
    $("verse-whole").addEventListener("click", startVerseWhole);
    $("verse-say").addEventListener("click", startVerseSay);
    $("verse-harder").addEventListener("click", harderVerseBlanks);
    $("verse-recited").addEventListener("click", markVerseRecited);
    $("verse-cloze").addEventListener("input", function (event) {
      var blank = event.target;
      if (!blank.dataset || !blank.dataset.index) {
        return;
      }
      state.verseBlanks[blank.dataset.index] = blank.value;
      save();
    });
    $("verse-form").addEventListener("submit", function (event) {
      event.preventDefault();
      checkVerse();
    });
    $("verse-input").addEventListener("input", function () {
      state.verseDraft = $("verse-input").value;
      if (state.verseDone) {
        state.verseDone = false;
        $("verse-celebrate").hidden = true;
        $("verse-again").hidden = true;
        $("verse-instructions").textContent = "Type the whole verse from memory. Capital letters, punctuation, and extra spaces do not matter.";
      }
      save();
    });
    $("verse-peek").addEventListener("click", function () {
      if (state.versePractice === "blanks") {
        return;
      }
      state.verseHidden = !state.verseHidden;
      save();
      renderVerse();
    });
    $("verse-again").addEventListener("click", retryCurrentVerse);
    $("view-list").addEventListener("click", function () {
      flashOn = false;
      renderStudy();
    });
    $("view-flash").addEventListener("click", function () {
      flashOn = true;
      flashIndex = 0;
      flashBack = false;
      renderFlash();
    });
    $("review-reset").addEventListener("click", clearReviewed);
    $("review-again").addEventListener("click", clearReviewed);
    $("study-grid").addEventListener("click", function (event) {
      var button = event.target.closest("[data-review]");
      if (!button) {
        return;
      }
      toggleReviewed(button.dataset.review);
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
      var hintButton = event.target.closest("[data-hint]");
      if (hintButton) {
        toggleHint(hintButton.dataset.hint);
        return;
      }
      var scrambleButton = event.target.closest("[data-scramble]");
      if (scrambleButton) {
        toggleScramble(scrambleButton.dataset.scramble);
      }
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
    $("apply-retry").addEventListener("click", retryScenarios);
    $("apply-new").addEventListener("click", openScenarioReset);
    $("apply-again").addEventListener("click", startNewScenarios);
    $("apply-prev").addEventListener("click", function () { moveScenario(-1); });
    $("apply-next").addEventListener("click", function () { moveScenario(1); });
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

    DRILL_MODES.forEach(function (mode) {
      $("drill-mode-" + mode).addEventListener("click", function () {
        if (state.drill && !state.drill.finished) {
          return;
        }
        state.drillMode = mode;
        save();
        renderDrill();
      });
    });
    $("drill-start").addEventListener("click", function () {
      startDrill(state.drillMode);
    });
    $("drill-live").addEventListener("click", function (event) {
      var again = event.target.closest ? event.target.closest("#drill-again") : null;
      if (again) {
        startDrill(state.drillMode);
      }
    });
    renderDrill();
  }

  function normalizeDrillMemory(raw) {
    var misses = {};
    var source = raw && raw.misses ? raw.misses : {};
    Object.keys(source).forEach(function (id) {
      var count = Number(source[id]);
      if (byId[id] && Number.isFinite(count) && count > 0) {
        misses[id] = Math.floor(count);
      }
    });
    var recent = [];
    if (raw && Array.isArray(raw.recent)) {
      raw.recent.forEach(function (id) {
        if (byId[id] && recent.indexOf(id) === -1) {
          recent.push(id);
        }
      });
    }
    return { misses: misses, recent: recent };
  }

  function idList(raw) {
    if (!Array.isArray(raw) || raw.length !== VOCABULARY.length) {
      return null;
    }
    var seen = {};
    for (var i = 0; i < raw.length; i += 1) {
      if (!byId[raw[i]] || seen[raw[i]]) {
        return null;
      }
      seen[raw[i]] = true;
    }
    return raw.slice();
  }

  function normalizeDrill(raw) {
    if (!raw || DRILL_MODES.indexOf(raw.mode) === -1) {
      return null;
    }
    var order = idList(raw.order);
    var matchLeft = idList(raw.matchLeft);
    var matchRight = idList(raw.matchRight);
    if (!order || !matchLeft || !matchRight) {
      return null;
    }
    var choices = {};
    var wrongChoices = {};
    var prompts = {};
    order.forEach(function (id) {
      var list = raw.choices && Array.isArray(raw.choices[id]) ? raw.choices[id] : null;
      var usable = list && list.length === 4 && list.indexOf(id) !== -1 && list.every(function (choiceId) {
        return Boolean(byId[choiceId]);
      });
      choices[id] = usable ? list.slice() : makeChoices(id, null);
    });
    if (raw.mode === "scenario") {
      var promptsReady = true;
      order.forEach(function (id) {
        var promptIndex = Number(raw.prompts && raw.prompts[id]);
        if (!Number.isFinite(promptIndex) || promptIndex < 0 || promptIndex >= SCENARIO_BANK[id].length) {
          promptsReady = false;
          return;
        }
        prompts[id] = Math.floor(promptIndex);
      });
      if (!promptsReady) {
        return null;
      }
    }
    Object.keys(raw.wrongChoices || {}).forEach(function (key) {
      var parts = key.split("@");
      if (parts.length === 2 && byId[parts[0]] && byId[parts[1]] && raw.wrongChoices[key]) {
        wrongChoices[key] = true;
      }
    });
    var index = Number(raw.index);
    if (!Number.isFinite(index) || index < 0 || index > order.length) {
      index = 0;
    }
    return {
      mode: raw.mode,
      order: order,
      index: Math.floor(index),
      choices: choices,
      prompts: prompts,
      matchLeft: matchLeft,
      matchRight: matchRight,
      matchPick: byId[raw.matchPick] ? raw.matchPick : "",
      solved: copyFlagMap(raw.solved),
      hadMiss: copyFlagMap(raw.hadMiss),
      wrongChoices: wrongChoices,
      finished: Boolean(raw.finished),
      answered: clampCount(raw.answered),
      correct: clampCount(raw.correct),
      incorrect: clampCount(raw.incorrect)
    };
  }

  function copyFlagMap(raw) {
    var next = {};
    Object.keys(raw || {}).forEach(function (id) {
      if (byId[id] && raw[id]) {
        next[id] = true;
      }
    });
    return next;
  }

  function clampCount(value) {
    var number = Number(value);
    if (!Number.isFinite(number) || number < 0) {
      return 0;
    }
    return Math.floor(number);
  }

  function buildPracticeOrder(memory, previousOrder) {
    var misses = memory && memory.misses ? memory.misses : {};
    var recent = {};
    if (memory && Array.isArray(memory.recent)) {
      memory.recent.forEach(function (id) {
        if (byId[id]) {
          recent[id] = true;
        }
      });
    }
    var groups = {};
    ORIGINAL_ORDER.forEach(function (id) {
      var key = "fresh";
      if (misses[id] > 0) {
        key = "miss-" + misses[id];
      } else if (recent[id]) {
        key = "recent";
      }
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(id);
    });
    var missKeys = Object.keys(groups).filter(function (key) {
      return key.indexOf("miss-") === 0;
    });
    missKeys.sort(function (a, b) {
      return Number(b.slice(5)) - Number(a.slice(5));
    });
    var order = [];
    missKeys.forEach(function (key) {
      order = order.concat(fisherYates(groups[key]));
    });
    if (groups.fresh) {
      order = order.concat(fisherYates(groups.fresh));
    }
    if (groups.recent) {
      order = order.concat(fisherYates(groups.recent));
    }
    if (previousOrder && orderKey(order) === orderKey(previousOrder) && order.length > 1) {
      var swapAt = Math.floor(Math.random() * (order.length - 1));
      var hold = order[swapAt];
      order[swapAt] = order[swapAt + 1];
      order[swapAt + 1] = hold;
    }
    return order;
  }

  function freshMatchColumns(previous) {
    var left = shuffledOrder(ORIGINAL_ORDER, previous && previous.matchLeft);
    var right = shuffledOrder(ORIGINAL_ORDER, left);
    var guard = 0;
    while (left.every(function (id, index) { return id === right[index]; }) && guard < 8) {
      right = fisherYates(ORIGINAL_ORDER);
      guard += 1;
    }
    return { left: left, right: right };
  }

  function startDrill(mode) {
    var previous = state.drill;
    var order = buildPracticeOrder(state.drillMemory, previous && previous.order);
    var choices = {};
    var prompts = {};
    order.forEach(function (id) {
      var prior = previous && previous.choices ? previous.choices[id] : null;
      choices[id] = makeChoices(id, prior);
      if (mode === "scenario") {
        var priorPrompt = previous && previous.prompts ? Number(previous.prompts[id]) : NaN;
        if (Number.isFinite(priorPrompt)) {
          state.scenarioHistory.last[id] = priorPrompt;
        }
        prompts[id] = pickScenarioIndex(id, state.scenarioHistory);
      }
    });
    var columns = freshMatchColumns(previous);
    state.drillMode = mode;
    state.drill = {
      mode: mode,
      order: order,
      index: 0,
      choices: choices,
      prompts: prompts,
      matchLeft: columns.left,
      matchRight: columns.right,
      matchPick: "",
      solved: {},
      hadMiss: {},
      wrongChoices: {},
      finished: false,
      answered: 0,
      correct: 0,
      incorrect: 0
    };
    save();
    renderDrill();
  }

  function recordDrillResult(id) {
    var drill = state.drill;
    if (drill.solved[id]) {
      return;
    }
    drill.solved[id] = true;
    drill.answered += 1;
    if (drill.hadMiss[id]) {
      drill.incorrect += 1;
      state.drillMemory.misses[id] = (state.drillMemory.misses[id] || 0) + 1;
    } else {
      drill.correct += 1;
      if (state.drillMemory.misses[id]) {
        state.drillMemory.misses[id] -= 1;
        if (state.drillMemory.misses[id] <= 0) {
          delete state.drillMemory.misses[id];
        }
      }
    }
  }

  function finishDrillIfReady() {
    var drill = state.drill;
    if (drill.finished || drill.answered < drill.order.length) {
      return;
    }
    drill.finished = true;
    var recent = [];
    drill.order.forEach(function (id) {
      if (!drill.hadMiss[id]) {
        recent.push(id);
      }
    });
    state.drillMemory.recent = recent;
  }

  function activeDrillMode() {
    if (state.drill && !state.drill.finished) {
      return state.drill.mode;
    }
    return state.drillMode || "choice";
  }

  function renderDrill() {
    var live = $("drill-live");
    if (!live) {
      return;
    }
    var running = state.drill && !state.drill.finished;
    var mode = activeDrillMode();
    DRILL_MODES.forEach(function (name) {
      var button = $("drill-mode-" + name);
      var selected = name === mode;
      button.classList.toggle("is-active", selected);
      button.setAttribute("aria-pressed", String(selected));
      button.disabled = Boolean(running);
    });
    $("drill-start").hidden = Boolean(state.drill);
    live.textContent = "";
    if (!state.drill) {
      return;
    }
    if (state.drill.finished) {
      live.append(renderDrillResults());
      return;
    }
    if (state.drill.mode === "match") {
      live.append(renderDrillMatch());
      return;
    }
    live.append(renderDrillQuestion());
  }

  function renderDrillResults() {
    var drill = state.drill;
    var box = document.createElement("section");
    box.className = "celebration";
    var title = document.createElement("h2");
    title.textContent = "Quiz results";
    var list = document.createElement("ul");
    list.className = "final-stats";
    [
      "Total questions answered: " + drill.answered,
      "Correct answers: " + drill.correct,
      "Incorrect answers: " + drill.incorrect,
      "Percentage score: " + formatPercent(accuracyPercent(drill.correct, drill.incorrect))
    ].forEach(function (line) {
      var item = document.createElement("li");
      item.textContent = line;
      list.append(item);
    });
    var heading = document.createElement("h3");
    heading.textContent = "Words that need additional practice";
    var practice = document.createElement("ul");
    practice.className = "practice-list";
    drill.order.forEach(function (id) {
      if (!drill.hadMiss[id]) {
        return;
      }
      var item = document.createElement("li");
      item.textContent = byId[id].word + " — " + byId[id].definition;
      practice.append(item);
    });
    if (!practice.childNodes.length) {
      var clear = document.createElement("li");
      clear.textContent = "Every word was correct on the first try.";
      practice.append(clear);
    }
    var again = document.createElement("button");
    again.type = "button";
    again.className = "btn btn-primary";
    again.id = "drill-again";
    again.textContent = "Try Again";
    box.append(title, list, heading, practice, again);
    return box;
  }

  function renderDrillQuestion() {
    var drill = state.drill;
    var id = drill.order[drill.index];
    var item = byId[id];
    var box = document.createElement("div");
    box.className = "panel-card quiz-stage";
    var counter = document.createElement("p");
    counter.className = "quiz-counter";
    counter.textContent = "Question " + (drill.index + 1) + " of " + drill.order.length;
    var prompt = document.createElement("p");
    prompt.className = "sentence-text";
    if (drill.mode === "scenario") {
      prompt.textContent = SCENARIO_BANK[id][drill.prompts[id]];
    } else if (drill.mode === "choice") {
      prompt.textContent = item.word;
    } else {
      prompt.textContent = item.definition;
    }
    box.append(counter, prompt);
    if (drill.mode === "type") {
      var clue = document.createElement("p");
      clue.className = "instructions";
      clue.textContent = "Example: " + (drill.solved[id] ? item.example : blankExample(item.example, item.word));
      box.append(clue);
    }
    if (drill.mode === "choice" || drill.mode === "scenario") {
      var choices = document.createElement("div");
      choices.className = "choice-list";
      drill.choices[id].forEach(function (choiceId, index) {
        var button = document.createElement("button");
        button.type = "button";
        button.className = "choice-btn";
        var choiceLabel = drill.mode === "choice" ? byId[choiceId].definition : byId[choiceId].word;
        button.textContent = LETTERS[index] + ". " + choiceLabel;
        var solved = Boolean(drill.solved[id]);
        var wrong = Boolean(drill.wrongChoices[choiceId + "@" + id]);
        if (solved && choiceId === id) {
          button.classList.add("is-correct");
          button.disabled = true;
        } else if (wrong || solved) {
          if (wrong) {
            button.classList.add("is-wrong");
          }
          button.disabled = true;
        }
        button.addEventListener("click", function () {
          answerDrillChoice(id, choiceId);
        });
        choices.append(button);
      });
      box.append(choices);
    } else {
      var form = document.createElement("form");
      form.className = "answer-form";
      form.autocomplete = "off";
      var label = document.createElement("label");
      label.className = "answer-label";
      label.htmlFor = "drill-input";
      label.textContent = "Type the vocabulary word";
      var row = document.createElement("div");
      row.className = "answer-row";
      var input = document.createElement("input");
      input.id = "drill-input";
      input.className = "answer-input";
      input.type = "text";
      input.autocomplete = "off";
      input.autocapitalize = "off";
      input.spellcheck = false;
      input.setAttribute("autocorrect", "off");
      input.setAttribute("enterkeyhint", "done");
      input.maxLength = 40;
      input.placeholder = "Type the word";
      if (drill.solved[id]) {
        input.value = item.word;
        input.readOnly = true;
      }
      var check = document.createElement("button");
      check.type = "submit";
      check.className = "btn btn-check";
      check.textContent = drill.solved[id] ? "Correct" : "Check Answer";
      check.disabled = Boolean(drill.solved[id]);
      row.append(input, check);
      form.append(label, row);
      form.addEventListener("submit", function (event) {
        event.preventDefault();
        answerDrillType(id, input);
      });
      box.append(form);
    }
    var feedback = document.createElement("p");
    feedback.className = "quiz-feedback";
    feedback.id = "drill-feedback";
    if (drill.solved[id]) {
      feedback.classList.add("is-correct");
      feedback.textContent = "Correct!";
    }
    box.append(feedback);
    if (drill.solved[id]) {
      var next = document.createElement("button");
      next.type = "button";
      next.className = "btn btn-primary";
      next.textContent = drill.index === drill.order.length - 1 ? "See Results" : "Next Question";
      next.addEventListener("click", function () {
        if (drill.index >= drill.order.length - 1) {
          finishDrillIfReady();
        } else {
          drill.index += 1;
        }
        save();
        renderDrill();
      });
      box.append(next);
    }
    return box;
  }

  function answerDrillChoice(id, choiceId) {
    var drill = state.drill;
    if (!drill || drill.finished || drill.solved[id] || drill.order[drill.index] !== id) {
      return;
    }
    if (choiceId === id) {
      recordDrillResult(id);
      save();
      renderDrill();
      return;
    }
    drill.hadMiss[id] = true;
    drill.wrongChoices[choiceId + "@" + id] = true;
    save();
    renderDrill();
    var feedback = $("drill-feedback");
    if (feedback) {
      feedback.className = "quiz-feedback is-incorrect";
      feedback.textContent = "Not quite. Try again!";
    }
  }

  function answerDrillType(id, input) {
    var drill = state.drill;
    if (!drill || drill.finished || drill.solved[id] || drill.order[drill.index] !== id) {
      return;
    }
    var result = answersMatch(input.value, byId[id].word);
    var feedback = $("drill-feedback");
    if (result === "empty") {
      feedback.className = "quiz-feedback is-empty";
      feedback.textContent = "Type the vocabulary word, then check it.";
      input.focus();
      return;
    }
    if (result === "incorrect") {
      drill.hadMiss[id] = true;
      save();
      feedback.className = "quiz-feedback is-incorrect";
      feedback.textContent = "Not quite. Try again!";
      flashWrong(input);
      input.focus();
      return;
    }
    recordDrillResult(id);
    save();
    renderDrill();
  }

  function renderDrillMatch() {
    var drill = state.drill;
    var box = document.createElement("div");
    box.className = "panel-card quiz-stage";
    var counter = document.createElement("p");
    counter.className = "quiz-counter";
    var matched = Object.keys(drill.solved).length;
    counter.textContent = "Matched " + matched + " of " + drill.order.length;
    var help = document.createElement("p");
    help.className = "instructions";
    help.textContent = "Tap a word, then tap its definition. The two lists are shuffled.";
    var board = document.createElement("div");
    board.className = "match-board";
    board.append(
      renderMatchColumn("Words", drill.matchLeft, "word"),
      renderMatchColumn("Definitions", drill.matchRight, "definition")
    );
    var feedback = document.createElement("p");
    feedback.className = "quiz-feedback";
    feedback.id = "drill-feedback";
    box.append(counter, help, board, feedback);
    return box;
  }

  function renderMatchColumn(title, ids, kind) {
    var drill = state.drill;
    var column = document.createElement("div");
    column.className = "match-col";
    var label = document.createElement("p");
    label.className = "match-label";
    label.textContent = title;
    column.append(label);
    ids.forEach(function (id) {
      var button = document.createElement("button");
      button.type = "button";
      button.className = "match-item";
      button.textContent = kind === "word" ? byId[id].word : byId[id].definition;
      if (drill.solved[id]) {
        button.classList.add("is-solved");
        button.disabled = true;
      } else if (kind === "word" && drill.matchPick === id) {
        button.classList.add("is-picked");
      }
      button.addEventListener("click", function () {
        pickMatchItem(kind, id);
      });
      column.append(button);
    });
    return column;
  }

  function pickMatchItem(kind, id) {
    var drill = state.drill;
    if (!drill || drill.finished || drill.solved[id]) {
      return;
    }
    if (kind === "word") {
      drill.matchPick = drill.matchPick === id ? "" : id;
      save();
      renderDrill();
      return;
    }
    if (!drill.matchPick) {
      var feedback = $("drill-feedback");
      if (feedback) {
        feedback.className = "quiz-feedback is-empty";
        feedback.textContent = "Tap a word first, then tap its definition.";
      }
      return;
    }
    var wordId = drill.matchPick;
    if (wordId === id) {
      drill.matchPick = "";
      recordDrillResult(wordId);
      finishDrillIfReady();
      save();
      renderDrill();
      return;
    }
    drill.hadMiss[wordId] = true;
    drill.matchPick = "";
    save();
    renderDrill();
    var note = $("drill-feedback");
    if (note) {
      note.className = "quiz-feedback is-incorrect";
      note.textContent = "Not a match. Try again!";
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
      pickSentence: pickSentence,
      SCENARIO_BANK: SCENARIO_BANK,
      pickScenarioIndex: pickScenarioIndex,
      freshScenarioHistory: freshScenarioHistory,
      verseWords: verseWords,
      diffVerseWords: diffVerseWords,
      buildPracticeOrder: buildPracticeOrder,
      WEEK_ID: WEEK_ID,
      WEEK_VERSE: WEEK_VERSE,
      blankCountForLevel: blankCountForLevel,
      verseFromParts: verseFromParts
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
