"use strict";

(function () {
  var STORAGE_KEY = "maxScienceVocabProgress";

  var VOCABULARY = Object.freeze([
    Object.freeze({ id: "dehydrate", word: "Dehydrate", definition: "To dry out by losing water" }),
    Object.freeze({ id: "hydroelectric", word: "Hydroelectric", definition: "Electricity made by moving water" }),
    Object.freeze({ id: "hydrant", word: "Hydrant", definition: "A street pipe that supplies water, often for fighting fires" }),
    Object.freeze({ id: "aquatic", word: "Aquatic", definition: "Living or taking place in water" }),
    Object.freeze({ id: "aqueduct", word: "Aqueduct", definition: "A channel or bridge built to carry water" }),
    Object.freeze({ id: "aquarium", word: "Aquarium", definition: "A water-filled tank or place where water animals are kept" }),
    Object.freeze({ id: "aquifer", word: "Aquifer", definition: "An underground layer of rock that holds water" }),
    Object.freeze({ id: "marine", word: "Marine", definition: "Related to the sea" }),
    Object.freeze({ id: "marina", word: "Marina", definition: "A dock where boats are kept" }),
    Object.freeze({ id: "maritime", word: "Maritime", definition: "Related to the sea, ships, or sailing" })
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

  var SENTENCE_BANK = {
    dehydrate: [
      "When the body loses too much water, a person can ______.",
      "Grapes dry in the sun and ______ until they become raisins.",
      "Food that loses its water will ______ and become dry."
    ],
    hydroelectric: [
      "A dam uses rushing water to make ______ power.",
      "Falling water that is turned into electricity is called ______ power.",
      "A river can spin machines and create ______ energy."
    ],
    hydrant: [
      "Firefighters attach a hose to a street ______ to get water.",
      "A red ______ on the sidewalk can send water into a fire hose.",
      "The crew opened the ______ so water could fill the hose."
    ],
    aquatic: [
      "A fish is an ______ animal because it lives in water.",
      "Plants that grow underwater are ______ plants.",
      "Swimming and diving are ______ activities."
    ],
    aqueduct: [
      "Long ago, people built an ______ to carry water into a city.",
      "Water can travel across a valley on an ______.",
      "An ______ works like a bridge made for moving water."
    ],
    aquarium: [
      "The class watched colorful fish swim in the ______.",
      "A glass tank of water for pet fish is an ______.",
      "Sharks and rays live in a huge ______ at the zoo."
    ],
    aquifer: [
      "A well brings drinking water up from an ______ under the ground.",
      "Rain soaks down and is stored in an ______.",
      "An underground layer of rock that holds water is an ______."
    ],
    marine: [
      "Whales and dolphins are ______ animals that live in the ocean.",
      "A coral reef is a ______ habitat.",
      "Scientists study ocean life in ______ science."
    ],
    marina: [
      "Sailboats are tied up at the ______.",
      "The family parked their boat at a ______ near the harbor.",
      "A ______ is a dock where people keep boats."
    ],
    maritime: [
      "Ships, sailors, and sea trade are part of ______ work.",
      "A ______ museum tells stories about ships and the ocean.",
      "Rules about shipping on the sea are ______ laws."
    ]
  };

  var SCENARIO_BANK = {
    dehydrate: [
      "A hiker sweats for hours, and a lot of water leaves the body. Which word describes what is happening?",
      "Grapes sit in the sun until the water inside them is gone and they shrink into raisins. Which word tells what the grapes do?",
      "A wet towel on a hot rock loses its water and turns stiff and dry. Which word describes what the towel does?",
      "After a long soccer game, a player feels weak because too much water left the body. Which vocabulary word fits?",
      "Food left uncovered loses water and becomes dry and wrinkled. Which word describes that change?"
    ],
    hydroelectric: [
      "A town builds a dam so the river can spin machines and light the town. What kind of power is that?",
      "Falling water turns a wheel, and the wheel makes electricity. Which word names this kind of power?",
      "A river station uses rushing water to power homes. Which vocabulary word belongs on its sign?",
      "A mountain village gets its lights from a waterfall that spins generators. Which word describes that electricity?",
      "Engineers look at a plant that uses moving water to make electricity. Which word names that power?"
    ],
    hydrant: [
      "Firefighters connect a hose to a pipe on the sidewalk to spray a burning house. What is that pipe called?",
      "A red metal pipe on the curb can send water into a fire hose. Which word names it?",
      "During a fire drill, the crew opens a street pipe and water fills the hose. Which word is that pipe?",
      "A city map marks sidewalk pipes kept ready for fighting fires. Which word labels them?",
      "A worker checks a street pipe that firefighters use when they need water fast. Which word describes it?"
    ],
    aquatic: [
      "A frog spends most of its life in a pond. Which word describes this kind of animal?",
      "The swim team practices strokes in a pool. Which word describes activities that take place in water?",
      "Lily pads and plants grow underwater in a lake. Which word describes these plants?",
      "A poster shows pond animals that live in water, not on dry land. Which vocabulary word fits?",
      "Snorkeling in a lake happens in the water. Which word describes that activity?"
    ],
    aqueduct: [
      "Ancient builders made a long bridge so water could travel from the hills into a city. What is that bridge called?",
      "Water flows across a valley in a stone channel built only to carry it. Which word names that channel?",
      "A tour guide points to a tall structure whose job is to move water from one place to another. Which word is it?",
      "Long ago, farmers built a raised path so water could cross dry land. Which vocabulary word fits?",
      "A history book shows a bridge that carries water, not cars. Which word names it?"
    ],
    aquarium: [
      "Max visits a building full of tanks where water animals are kept. What is that building called?",
      "A glass box on a desk holds water and pet fish. Which word names that box?",
      "A zoo has a room of tanks where visitors look at water animals. Which word describes that room?",
      "Students watch seahorses swim behind glass in a water-filled tank. Which word names the tank?",
      "A family keeps a water-filled tank at home for a turtle and some fish. Which word describes that tank?"
    ],
    aquifer: [
      "A well pulls drinking water from wet rock deep under the ground. Where was that water stored?",
      "Rain soaks into the soil and collects in a rock layer below the surface. Which word names that layer?",
      "A scientist says the town's drinking water sits in rock under the ground. Which word is the scientist using?",
      "Workers drill down until they reach underground rock that is holding water. Which word names that supply?",
      "A diagram shows rain moving down into a hidden rock layer that stores water. Which word labels that layer?"
    ],
    marine: [
      "Dolphins live in the ocean, not in a pond. Which word describes animals of the sea?",
      "Students visit the ocean to study salt water and sea life, not a fish tank or a boat dock. Which word names this sea topic?",
      "A field trip studies ocean habitats. It is not a trip to a lake, a fish tank, or a place that parks boats. Which word fits?",
      "A poster shows ocean animals and says they belong to the sea, not to a water tank or a ship museum. Which word matches the poster?",
      "A club studies only the ocean, not pools or boat parking. Which vocabulary word describes the club's sea topic?"
    ],
    marina: [
      "A family ties their sailboat to a dock where many boats are kept. What is that place called?",
      "People walk along a pier and see boats parked in slips. Which word names this boat dock?",
      "A harbor map shows a place built for keeping boats. Which word is it?",
      "After a ride, the captain ties the boat at a dock used for storing boats. Which word names the dock?",
      "A sign points to boat parking at a dock. Which word fits that dock, not the ocean itself and not a water tank?"
    ],
    maritime: [
      "A museum is filled with old sailing ships and stories of sea travel. Which word describes the museum?",
      "A captain follows special rules for ships that cross the ocean. Which word describes those ship rules?",
      "Workers load boxes onto ships that sail across the sea. Which word describes this shipping work?",
      "A book tells about sailors and sailing ships, not about sea animals or a boat dock. Which word fits the book?",
      "A country writes laws about ships and sailing. Which word describes those laws?"
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
      return SCENARIO_BANK[id] && Number.isFinite(pick) && pick >= 0 && pick < SCENARIO_BANK[id].length && isValidChoiceSet(id, round.choices[id]);
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
      wordsHidden: false,
      tab: "study",
      quiz: freshQuizMode(null),
      sentences: freshSentenceMode(null),
      verseStarted: false,
      verseDone: false,
      verseHidden: false,
      verseDraft: "",
      verseMisses: 0,
      drillMode: "choice",
      drill: null,
      drillMemory: { misses: {}, recent: [] },
      scenarioHistory: scenarioHistory,
      scenarios: freshScenarioMode(null, scenarioHistory)
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
        wordsHidden: Boolean(data.wordsHidden),
        tab: TAB_ORDER.indexOf(data.tab) === -1 ? "study" : data.tab,
        quiz: data.version === 2 && isValidQuiz(data.quiz) ? normalizeQuiz(data.quiz) : freshQuizMode(null),
        sentences: data.version === 2 && isValidSentences(data.sentences) ? normalizeSentences(data.sentences) : freshSentenceMode(null),
        verseStarted: data.verseMode === "full" && Boolean(data.verseStarted),
        verseDone: data.verseMode === "full" && Boolean(data.verseDone),
        verseHidden: data.verseMode === "full" && Boolean(data.verseHidden) && !data.verseDone,
        verseDraft: data.verseMode === "full" && typeof data.verseDraft === "string" ? data.verseDraft.slice(0, 600) : "",
        verseMisses: Number.isFinite(Number(data.verseMisses)) && Number(data.verseMisses) > 0 ? Math.floor(Number(data.verseMisses)) : 0,
        drillMode: DRILL_MODES.indexOf(data.drillMode) === -1 ? "choice" : data.drillMode,
        drill: normalizeDrill(data.drill),
        drillMemory: normalizeDrillMemory(data.drillMemory),
        scenarioHistory: scenarioHistory,
        scenarios: scenarios
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
      sentences: state.sentences,
      verseMode: "full",
      verseStarted: state.verseStarted,
      verseDone: state.verseDone,
      verseHidden: state.verseHidden,
      verseDraft: state.verseDraft || "",
      verseMisses: state.verseMisses,
      drillMode: state.drillMode,
      drill: state.drill,
      drillMemory: state.drillMemory,
      scenarioHistory: state.scenarioHistory,
      scenarios: state.scenarios
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
      body.append(setQuizFeedback("correct", "Correct! Excellent work!", true));
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
    var prompt = document.createElement("p");
    prompt.className = "quiz-prompt";
    prompt.textContent = "Which vocabulary word fits this situation?";
    var question = document.createElement("p");
    question.className = "quiz-definition";
    question.textContent = SCENARIO_BANK[id][round.picks[id]];
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
      button.textContent = (complete && isAnswer ? "✓ " : "") + prefix + byId[optionId].word;
      button.addEventListener("click", function () {
        selectScenario(id, optionId);
      });
      list.append(button);
    });

    body.append(prompt, question, list);
    if (complete) {
      body.append(setQuizFeedback("correct", "Great job! That's correct!", true));
    } else if (round.missed[id] && Object.keys(round.missed[id]).length) {
      body.append(setQuizFeedback("incorrect", "Not quite. Try again!", false));
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

  var WEEK_VERSE = "\u2026 It is not by force nor by strength, but by my Spirit, says the Lord of Heaven's armies.";
  var WEEK_VERSE_SPOKEN = "It is not by force nor by strength, but by my Spirit, says the Lord of Heaven's armies.";

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

  function renderVerse() {
    var text = $("verse-text");
    var input = $("verse-input");
    var practicing = state.verseStarted || state.verseDone;
    if (state.verseHidden) {
      text.textContent = "";
      text.hidden = true;
    } else {
      text.textContent = WEEK_VERSE;
      text.hidden = false;
    }
    $("verse-start").hidden = practicing;
    $("verse-form").hidden = !practicing;
    $("verse-peek").hidden = !practicing;
    $("verse-peek").textContent = state.verseHidden ? "Show Verse" : "Hide Verse";
    $("verse-peek").setAttribute("aria-pressed", String(!state.verseHidden));
    $("verse-again").hidden = !state.verseDone;
    $("verse-celebrate").hidden = !state.verseDone;
    if (document.activeElement !== input) {
      input.value = state.verseDraft || "";
    }
    if (!practicing) {
      $("verse-instructions").textContent = "Read the verse. When you are ready, press Start Practice and type it from memory.";
    } else if (state.verseDone) {
      $("verse-instructions").textContent = "You typed the whole verse. Press Practice Again for a new try.";
    } else {
      $("verse-instructions").textContent = "Type the whole verse from memory. Capital letters, punctuation, and extra spaces do not matter.";
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
    $("verse-start").addEventListener("click", function () {
      state.verseStarted = true;
      state.verseHidden = true;
      state.verseDone = false;
      save();
      clearVerseResult();
      renderVerse();
      $("verse-input").focus();
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
      state.verseHidden = !state.verseHidden;
      save();
      renderVerse();
    });
    $("verse-again").addEventListener("click", function () {
      state.verseDone = false;
      state.verseStarted = true;
      state.verseHidden = true;
      state.verseDraft = "";
      save();
      clearVerseResult();
      renderVerse();
      $("verse-input").focus();
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
    } else {
      prompt.textContent = item.definition;
    }
    box.append(counter, prompt);
    if (drill.mode === "choice" || drill.mode === "scenario") {
      var choices = document.createElement("div");
      choices.className = "choice-list";
      drill.choices[id].forEach(function (choiceId, index) {
        var button = document.createElement("button");
        button.type = "button";
        button.className = "choice-btn";
        button.textContent = LETTERS[index] + ". " + byId[choiceId].word;
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
      buildPracticeOrder: buildPracticeOrder
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
