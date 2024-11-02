const log = {};
const setMessage = (function () {
  const errorMessage = document.getElementById("errorMessage");
  const inner = errorMessage.children[0];
  return (msg) => { 
    errorMessage.style.display = "block";
    inner.innerHTML = msg;
  };
})();

const config = {
  DEFAULT_NUM_SONGS: 10,
  DD_MAX_ENTRIES: 10,
  BASE_URL: "https://files.catbox.moe/",
  USE_LOG: true,
  DEBUG: false,
};

const quiz = {
  currSong: null,
  nextSong: null,
  // hold the pool instead of a stack to allow for errors
  songPool: null,
  totalSongs: null,
  songData: [],
  score: null,
  played: null,
  initialise: function() {
    this.songPool = Array.from(settings.shows.reduce(
      (idxs, show) => {
        if (show.enabled ?? true) {
          show.ids.forEach(idxs.add, idxs);
        }
        return idxs;
      },
      new Set()
    ));
    log.info(`Initialising quiz pool - ${this.songPool.length} songs found`);
    // not too efficient but not many songs so doesnt matter
    this.totalSongs = Math.min(settings.numSongs, this.songPool.length);

    this._updateScore(0);
    this._updatePlayed(0);
    log.info(`Starting quiz.`);
  },
  loadNextSong: function() {
    if (this.songPool.length == 0) {
      return;
    }
    // get and remove song from pool
    const index = Math.floor(Math.random() * this.songPool.length);
    const nextSongIndex = this.songPool[index];
    this.songPool.splice(index, 1);

    const data = this.songData[nextSongIndex];
    const url = config.BASE_URL + data.mp3;
    log.debug(`Loading song from url:\n ${url}`)
    let sound = new Howl({ src: [url], html5: true, loop: true }); // loop set to false, only loop the sample on command (additional button)
    const song = {
      sound,
      songname: data.songname,
      artist: data.artist,
      show: data.romaji,
      sample: null,
    };
    sound.on("load", () => {
      log.debug(`Loaded song from url: ${url}`);
      // for now just do random samples
      // TODO: take the config from the settings and the file
/*    
      const sampleType = document.getElementById("sampleType").value;  
      const timestamp = retrieveTimestamp(data, sampleType);
      const { startSample, endSample } = splitTimestamp(timestamp);
      const duration = calculateDuration(startSample, endSample);
*/

      let songLength = sound.duration(); // = duration (in seconds)
      let startSample = Math.random() * songLength; // = startSample
      sound.seek(startSample);
      song.sample = [startSample, songLength];

      if (song.onready) {
        song.onready();
      } else {
        song.ready = true;
      }
    });
    sound.on("loaderror", (_id, errorId) => {
      log.error(`Error loading ${data.songname} (${data.mp3}): ${errorId}`);
      quiz.loadNextSong();
    });
    sound.on("play", () => {
      log.debug(`Playing "${song.songname}" by ${song.artist} (${song.show})`);
    });
    this.nextSong = song;
  },
  playNextSong: function() {
    if (this.nextSong === null) {
      this._quizOver();
      return;
    }
    if (this.nextSong.ready) {
      log.debug("Next song was ready, playing.");
      this._next();
    } else {
      log.debug("Buffering next song, playing when ready.");
      this.nextSong.onready = this._next.bind(this);
    }
  },
  updateResults: function(answer) {
    const correctAnswers = [`${this.currSong.songname} - ${this.currSong.artist}`];
    log.debug(`Correct answers: ${correctAnswers}`);
    const correct = correctAnswers.includes(answer);
    if (correct) {
      this._updateScore(this.score + 1);
    }
    this._updatePlayed(this.played + 1);
    return correct;
  },
  submitAnswer: function(answer) {
    if (this.currSong == null) {
      return;
    }
    log.debug(`Submitted answer: ${answer}`);
    this.updateResults(answer);
    this.playNextSong();
  },
  stop: function() {
    if (this.currSong && this.currSong.sound) {
      this.currSong.sound.stop();
    }
    if (this.nextSong && this.nextSong.sound) {
      this.nextSong.sound.stop();
    }
    this.currSong = null;
    this.nextSong = null;
    this.remainingSongs = null;
    // this.songPool = null; To stop loading songs when quiz ends early (remainingSongs variable not used)
  },
  _next: function() {
    if (this.currSong && this.currSong.sound) {
      this.currSong.sound.stop();
    }
    this.currSong = this.nextSong;
    this.nextSong = null;
    this.currSong.sound.play();

    this.loadNextSong();
  },
  _quizOver: function() {
    setMessage("Quiz is over.");
  },
  _updateScore: function(correct) {
    this.score = correct;
  },
  _updatePlayed: function(played) {
    this.played = played;
  },
};

const settings = { 
  minSongs: 0,
  maxSongs: 0,
  numSongs: 0,
  shows: [],
  setNumSongs: function(c) {
    this.numSongs = c;
  },
  setMaxSongs: function (max) {
    this.maxSongs = max;
    if (this.numSongs > max) {
      this.setNumSongs(max);
    }
  },
  recalculateMaxSongs: function() {
    const maxSongs = this.shows.reduce((sum, show) => sum + ((show.enabled ?? true) ? show.ids.length : 0), 0);
    this.setMaxSongs(maxSongs);
  },
  toggleShow: function(index, toggled) {
    if (index < this.shows.length) {
      this.shows[index].enabled = toggled;
      this.recalculateMaxSongs();
    }
  },
};

var answerType = document.getElementById("answerType");
var sampleType = document.getElementById("sampleType"); // redundant?
var startQuiz = document.getElementById("startQuiz"); // redundant?

const initLogger = function() {
  const divLog = document.getElementById("log-pane");
  const ulLog = document.getElementById("log-list");
  if (config.USE_LOG) {
    const addLogItem = (tag, msg, size) => {
      let ts = (new Date()).toLocaleTimeString();
      const item = document.createElement("li");
      item.classList.add("panel-block");
      item.classList.add("list-item");

      const message = document.createElement("span");
      message.classList.add("pb-1");
      message.classList.add("pl-1");
      message.textContent = `[${ts}]`
      const content = document.createElement("span");
      content.classList.add("pb-1");
      content.classList.add("pl-1");
      if (size) {
        content.classList.add(size);
      }
      content.textContent = `${msg}`;
      message.append(content);
      item.append(
        tag,
        message,
      );
      ulLog.prepend(item);
    };
    log.info = (msg) => {
      console.info(msg);
      const tag = document.createElement("span");
      tag.classList.add("tag");
      tag.classList.add("is-info");
      tag.classList.add("is-light");
      tag.textContent = "Info";

      addLogItem(tag, msg);
    };
    log.debug = (msg) => {
      console.debug(msg);
      if (config.DEBUG) {
        const tag = document.createElement("span");
        tag.classList.add("tag");
        tag.classList.add("is-primary");
        tag.textContent = "Debug";

        addLogItem(tag, msg, "is-size-7");
      }
    };
    log.error = (msg) => {
      console.error(msg);
      const tag = document.createElement("span");
      tag.classList.add("tag");
      tag.classList.add("is-danger");
      tag.classList.add("is-light");
      tag.textContent = "Error";

      addLogItem(tag, msg);
    };
  } else {
    if (divLog !== undefined) {
      divLog.style.display = "none";
    }
    log.info = console.info;
    log.debug = console.debug;
    log.error = console.error;
  }
}

const showElement = (el) => { el.style.display = "block"; };
const hideElement = (el) => { el.style.display = "none"; };

function initSettings() {
  const settingsModal = document.getElementById("settings");
  const openSettings = showElement.bind(null, settingsModal);
  const closeSettings = hideElement.bind(null, settingsModal);

  document.getElementById("openSettings").addEventListener("click", openSettings);
  settingsModal.querySelector(".modal-background").addEventListener("click", closeSettings);
  settingsModal.getElementsByClassName("close")[0].addEventListener("click", closeSettings);
  
  const inputRangeNumSongs = document.getElementById("numOfSongs");
  const inputNumSongs = document.getElementById("numOfSongsText");
  inputRangeNumSongs.min = settings.minSongs;
  inputRangeNumSongs.max = settings.maxSongs;
  inputRangeNumSongs.value = settings.numSongs;
  inputRangeNumSongs.addEventListener("input", (ev) => {
    const value = Number(ev.target.value) || settings.numSongs;
    inputNumSongs.value = value;
    settings.numSongs = value;
  });
  inputNumSongs.addEventListener("input", (ev) => {
    const value = Math.max(settings.minSongs, Math.min(Number(ev.target.value) || settings.numSongs, settings.maxSongs));
    inputRangeNumSongs.value = value;
    ev.target.value = value;
    settings.numSongs = value;
  });

  const _setMax = settings.setMaxSongs;
  settings.setMaxSongs = function (max) {
    _setMax.apply(this, [max]);
    inputRangeNumSongs.max = max;
    inputRangeNumSongs.value = settings.numSongs;
    inputNumSongs.value = settings.numSongs;
  };
  const _setNum = settings.setNumSongs;
  settings.setNumSongs = function (c) {
    _setNum.apply(this, [c]);
    inputRangeNumSongs.value = c;
    inputNumSongs.value = c;
  };
};

function setupSettings(data) {
  var showCheckboxesContainer = document.getElementById("showCheckboxes");

  quiz.songData.push(...data);
  const showMap = new Map();
  for (const [i, song] of quiz.songData.entries()) {
    if (showMap.has(song.romaji)) {
      showMap.get(song.romaji).push(i);
    } else {
      showMap.set(song.romaji, [i]);
    }
  }
  settings.shows = Array.from(showMap, ([name, ids]) => ({ name, ids }));
  for (const [i, { name, ids }] of settings.shows.entries()) {
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.id = "show" + i;
    checkbox.checked = true;
    checkbox.classList.add("ml-2");
    checkbox.addEventListener("input", (ev) => settings.toggleShow(i, ev.target.checked));
  
    const label = document.createElement("label");
    label.htmlFor = checkbox.id;
    label.appendChild(checkbox);
    label.appendChild(document.createTextNode(" " + name));
  
    showCheckboxesContainer.appendChild(label);
    showCheckboxesContainer.appendChild(document.createElement("br"));
  }
  settings.recalculateMaxSongs();
  settings.setNumSongs(config.DEFAULT_NUM_SONGS);

  return data;
};

function setupDropdown() {
  const divDropdown = document.getElementById("dropdownDiv");
  const inputDropdown = document.getElementById("dropdownInput");
  const divContent = document.getElementById("dropdownContent");
  const dropdown = {
    // trimmed sn, songname, artist
    songNames: [],
    // which entries are shown and which one is highlighted
    indices: [],
    position: 0,
  };
  dropdown.setup = function () {
    inputDropdown.addEventListener("focusin", () => divDropdown.classList.add("is-active"));
    inputDropdown.addEventListener("focusout", () => divDropdown.classList.remove("is-active"));
    inputDropdown.addEventListener("input", (ev) => dropdown.update(ev.target.value));
    inputDropdown.addEventListener("keydown", (ev) => {
      if (ev.key == "ArrowUp") {
        dropdown.position = Math.max(0, dropdown.position - 1);
      } else if (ev.key == "ArrowDown") {
        dropdown.position = Math.min(dropdown.indices.length - 1, dropdown.position + 1);
      } else if (ev.key == "Enter") {
        const value = divContent.children[dropdown.indices[dropdown.position]].text;
        if (inputDropdown.value != value) {
          inputDropdown.value = value;
        } else {
          quiz.submitAnswer(value);
        }
      } else {
        return;
      }
      dropdown.updateSelection();
      ev.preventDefault();
    });  
    log.debug("Dropdown setup complete");
  };
  dropdown.updateSelection = function() {
    for (const [i, idx] of dropdown.indices.entries()) {
      if (i == dropdown.position) {
        divContent.children[idx].classList.add("selected");
      } else {
        divContent.children[idx].classList.remove("selected");
      }
    }
  };
  dropdown.update = function (text) {
    // track the existing one before we make changes to keep the position
    const existing = divContent.children[dropdown.indices[dropdown.position]];
    const trimmed = text.toLowerCase().replace(/\W/g, '');
    dropdown.indices = [];
    for (const [i, el] of Array.from(divContent.children).entries()) {
      if (dropdown.indices.length < config.DD_MAX_ENTRIES && dropdown.songNames[i][0].includes(trimmed)) {
        el.style.display = "block";
        dropdown.indices.push(i);
      } else {
        el.style.display = "none";
      }
    }
    if (dropdown.indices.length == 0) {
      divContent.style.display = "none";
    } else {
      divContent.style.display = "block";
    }
    dropdown.position = Math.max(0, dropdown.indices.findIndex(i => divContent.children[i] == existing));
    dropdown.updateSelection();
  };
  dropdown.populateData = function(data) {
    const jsonArray = [];
    const unique = (value, index) => {
      const j = JSON.stringify(value);
      jsonArray.push(j);
      return jsonArray.indexOf(j) === index;
    };

    dropdown.songNames = data
      .map(d => [d.songname, d.artist])
      .filter(unique)
      .map(([s, a]) => [s.toLowerCase().replace(/\W/g, ''), s, a])
      .toSorted((a, b) => a[1].length - b[1].length);

    // actually populate dropdown
    for (const [trimmed, full, artist] of dropdown.songNames) {
      const element = document.createElement("a");
      element.classList.add("dropdown-item");
      element.style.display = "none";
      element.innerHTML = `${full} - ${artist.bold()}`;
      // Need to use `mousedown` instead of `click` because it has to fire before the input loses focus
      element.addEventListener("mousedown", (ev) => {
        const value = ev.currentTarget.text;
        inputDropdown.value = value;
        dropdown.position = dropdown.indices.find(i => divContent.children[i] == ev.currentTarget);
        dropdown.updateSelection();
        quiz.submitAnswer(inputDropdown.value);
      });
      divContent.appendChild(element);
    }
    dropdown.update("");
  };
  dropdown.disable = function() {
    inputDropdown.disabled = true;
  };
  dropdown.reset = function() {
    inputDropdown.disabled = false;
    inputDropdown.value = "";
    dropdown.update("");
    dropdown.updateSelection();
  };
  dropdown.focus = function() {
    inputDropdown.focus();
  };
  dropdown.setup();
  return dropdown;
}

async function fetchSongData() {
  log.info("Fetching song data");
  try {
    const response = await fetch("car_dump.json");
    if (!response.ok) {
        let message = await response.text();
        throw new Error(`Response status ${response.status}: ${message}`);
    }

    const songs = await response.json();
    log.info(`Loaded ${songs.length} songs`);
    return songs;
  } catch (error) {
      log.error(error.message);
      throw error;
  }
}

/*
async function fetchSampleData() {
    log.info("Fetching sample timestamps");
    try {
        const response = await fetch("cars sample.csv")
        if (!response.ok) {
            let message = await response.text();
            throw new Error(`Response status ${response.status}: ${message}`);
    } 

    const samplesText = await response.text();
    const samples = parseCSV(text);
    log.info(`Loaded sample timestamps of ${songs.length} songs`);
    return samples;
  } catch (error) {
      log.error(error.message);
      throw error;
  }
}

function parseCSV(data) {
    const lines = data.split('\n');
    const headers = lines[0].split(',');
    
    return lines.slice(1).map(line => {
        const values = line.split(',');
        return headers.reduce((obj, header, index) => {
            obj[header.trim()] = values[index]?.trim();
            return obj;
        }, {});
    });
}

// Sample output: 
[
    {
        "Anime Name": "Initial D",
        "Song Name": "SPACE BOY",
        "Instr1": "0:17-0:27",
        "Vocal1": "0:29-0:49",
        "Ndrop1": "0:54-0:59"
    },
    {
        "Anime Name": "Initial D",
        "Song Name": "NO ONE SLEEP IN TOKYO",
        "Instr1": "0:31-0:41",
        "Vocal1": "0:43-1:03",
        "Ndrop1": "1:11-1:16"
    }
]

async function retrieveTimestamp(data, sampleType) {
    try {
        const samples = await fetchSampleData(); 
        const matchingSample = samples.find(sample => sample["Song Name"] === data.songname);

        if (matchingSample) {
            return matchingSample[sampleType] || null;
        } else {
            log.warn(`No sample timestamp found for: ${data.songname}`);
            return null; 
        }
    } catch (error) {
        log.error(`Error retrieving sample timestamp: ${error.message}`);
        throw error;
    }
}

function splitTimestamp(timestamp) {
    const [startSample, endSample] = timestamp.split('-');
    return {
        startSample: startSample.trim(), 
        endSample: endSample.trim()
    };
}

function convertToSeconds(timestamp) {
    const [minutes, seconds] = timestamp.split(':').map(Number);
    return (minutes * 60) + seconds;
}

function calculateDuration(startSample, endSample) {
    const startSeconds = convertToSeconds(startSample);
    const endSeconds = convertToSeconds(endSample);
    const durationInSeconds = endSeconds - startSeconds;

    return durationInSeconds; 
}
*/

function initQuizUi(dropdown) {
  const btnStartQuiz = document.getElementById("startQuiz");
  const divQuizSetup = document.getElementById("quiz-setup");
  const divQuiz = document.getElementById("quiz");
  btnStartQuiz.addEventListener("click", () => {
    hideElement(divQuizSetup);
    quiz.initialise();
    quiz.loadNextSong();
    showElement(divQuiz);

    dropdown.focus();
    quiz.playNextSong();
  });

  const btnEndQuiz = document.querySelector("#endQuiz button");
  btnEndQuiz.addEventListener("click", () => {
    hideElement(divQuiz);
    quiz.stop();
    showElement(divQuizSetup);
  });

  // hook quiz functions to update dom
  const spanScore = document.getElementById("qiScore");
  const _submitAnswer = quiz.submitAnswer;
  quiz.submitAnswer = function (answer) {
    dropdown.disable();
    _submitAnswer.apply(quiz, [answer]);
  };
  const _updateScore = quiz._updateScore;
  quiz._updateScore = function (score) {
    _updateScore.apply(this, [score]);
    spanScore.innerHTML = score;
  };
  const _updatePlayed = quiz._updatePlayed;
  quiz._updatePlayed = function (played) {
    _updatePlayed.apply(this, [played]);
    if (played > 0) {
      spanScore.innerHTML = `${quiz.score}/${quiz.played}`;
    }
  };
  const _init = quiz.initialise;
  const spanTotal = document.getElementById("qiTotalSongs");
  const spanPoolSize = document.getElementById("qiPoolSize");
  quiz.initialise = function () {
    _init.apply(this);
    spanTotal.innerHTML = quiz.totalSongs;
    spanPoolSize.innerHTML = quiz.songPool.length;
  };

  const _next = quiz._next;
  quiz._next = function() {
    _next.apply(this);
    dropdown.reset();
    dropdown.focus();
  };
  const _updateResults = quiz.updateResults;
  const songname = document.getElementById("qiSongName");
  const artist = document.getElementById("qiArtist");
  const anime = document.getElementById("qiAnime");
  const answered = document.getElementById("qiAnswered");
  const sample = document.getElementById("qiSample");
  const formatTime = function(total) {
    const minutes = Math.round(total / 60.0);
    const seconds = Math.round(total % 60.0);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };
  quiz.updateResults = function (answer) {
    const correct = _updateResults.apply(this, [answer]);
    const song = quiz.currSong;
    songname.innerHTML = song.songname;
    artist.innerHTML = song.artist;
    anime.innerHTML = song.show;
    answered.innerHTML = answer;
    answered.className = correct ? "has-text-success" : "has-text-danger";
    if (song.sample !== null) {
      sample.innerHTML = `${formatTime(song.sample[0])}/${formatTime(song.sample[1])}`;
    }
    return correct;
  };

  return showElement.bind(null, btnStartQuiz);
}

window.onload = function() {
  initLogger();
  initSettings();
  const dropdown = setupDropdown();
  const quizUiReady = initQuizUi(dropdown);

  fetchSongData()
    .then(setupSettings)
    .then(dropdown.populateData)
    .then(quizUiReady)
    .catch(setMessage);
};
