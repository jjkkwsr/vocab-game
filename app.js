document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const dropZone = document.getElementById('drop-zone');
    const csvInput = document.getElementById('csv-input');
    const views = {
        upload: document.getElementById('view-upload'),
        game: document.getElementById('view-game'),
        result: document.getElementById('view-result')
    };

    // Game state
    let fullVocabList = [];        // Master parsed array of vocabulary objects
    let unpracticedVocabList = []; // Pool of words from CSV that haven't been practiced yet
    let tempVocabList = [];        // Selected vocabulary subset for the active round
    let mistakeList = [];          // Subset of tempVocabList answered incorrectly this round
    let desiredPracticeSize = 5;   // Remembers the user's desired word count configured on landing
    let practicedVocabSet = new Set(); // Set of unique lowercase words historically practiced for active CSV
    let isAdvancedMode = localStorage.getItem('lexiscramble_advanced_mode') === 'true';

    // Advanced Mode Toggle Setup
    const advancedToggle = document.getElementById('advanced-mode-toggle');
    if (advancedToggle) {
        advancedToggle.checked = isAdvancedMode;
        advancedToggle.addEventListener('change', (e) => {
            isAdvancedMode = e.target.checked;
            localStorage.setItem('lexiscramble_advanced_mode', isAdvancedMode);
        });
    }

    // App Theme Setup
    let currentTheme = localStorage.getItem('lexiscramble_theme') || 'default';
    
    function applyTheme(themeName) {
        document.body.classList.remove('theme-jungle', 'theme-sunset', 'theme-sakura');
        if (themeName !== 'default') {
            document.body.classList.add(`theme-${themeName}`);
        }
        
        document.querySelectorAll('.theme-btn').forEach(btn => {
            if (btn.dataset.theme === themeName) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }
    
    // Initial Application
    applyTheme(currentTheme);
    
    // Bind Theme Button Clicks
    document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const selected = btn.dataset.theme;
            currentTheme = selected;
            localStorage.setItem('lexiscramble_theme', selected);
            applyTheme(selected);
        });
    });
    
    // Active worksheet pointer states
    let activeSentenceIndex = 0;   // Index of the sentence card currently selected for typing/letter slots
    let answersState = [];         // Array of arrays: answersState[i] = array of chars representing current user inputs
    
    // Demo Hardcoded fallback list for direct browser verification and offline study
    const demoData = [
        { word: "about", type: "prep. (介係詞)", translation: "關於", sentence: "Tell me about it." },
        { word: "add", type: "v. (動詞)", translation: "增加/相加", sentence: "Add two and three." },
        { word: "balloon", type: "n. (名詞)", translation: "氣球", sentence: "Balloons filled the clear blue sky." },
        { word: "castle", type: "n. (名詞)", translation: "城堡", sentence: "They visited an ancient castle on the hill." },
        { word: "dolphin", type: "n. (名詞)", translation: "海豚", sentence: "Dolphin is a very intelligent animal." },
        { word: "read a newspaper", type: "v. (動詞)", translation: "看報紙", sentence: "He reads a newspaper every morning." }
    ];

    // Mistake Bank Active Identifier
    let activeFileName = 'offline_demo';
    let mistakeBank = JSON.parse(localStorage.getItem('lexiscramble_mistakes_' + activeFileName)) || [];

    // --- CSV Parsing ---
    function parseCSV(text) {
        // Basic CSV parser that respects double quotes
        const rows = [];
        let row = [];
        let field = "";
        let insideQuote = false;

        for (let i = 0; i < text.length; i++) {
            let char = text[i];
            let nextChar = text[i + 1];

            if (char === '"') {
                if (insideQuote && nextChar === '"') {
                    field += '"';
                    i++; // skip next quote
                } else {
                    insideQuote = !insideQuote;
                }
            } else if (char === ',' && !insideQuote) {
                row.push(field.trim());
                field = "";
            } else if ((char === '\r' || char === '\n') && !insideQuote) {
                if (char === '\r' && nextChar === '\n') i++; // handling CRLF
                row.push(field.trim());
                if (row.some(c => c.length > 0)) rows.push(row);
                row = [];
                field = "";
            } else {
                field += char;
            }
        }
        // push residual
        if (field || row.length > 0) {
            row.push(field.trim());
            if (row.some(c => c.length > 0)) rows.push(row);
        }

        // Map to objects, skipping header if detected
        const data = [];
        let startIndex = 0;
        if (rows.length > 0 && rows[0][0].includes("單字")) {
            startIndex = 1;
        }

        for (let i = startIndex; i < rows.length; i++) {
            const r = rows[i];
            if (r.length >= 4) {
                data.push({
                    word: r[0],
                    type: r[1],
                    translation: r[2],
                    sentence: r[3]
                });
            }
        }
        return data;
    }

    // --- Utility Helpers ---
    function shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    function generateScrambles(word, count = 3) {
        const uniqueDistractors = new Set();
        const maxAttempts = 100;
        let attempts = 0;
        
        const vowelsList = ['a','e','i','o','u','A','E','I','O','U'];

        function attemptVowelReorder() {
            const chars = word.split('');
            const vowelIndices = [];
            const wordVowels = [];
            chars.forEach((c, idx) => {
                if (vowelsList.includes(c)) {
                    vowelIndices.push(idx);
                    wordVowels.push(c);
                }
            });

            if (vowelIndices.length < 2) return null; // Needs >=2 vowels to reorder

            shuffleArray(wordVowels);
            const result = [...chars];
            vowelIndices.forEach((idx, i) => {
                result[idx] = wordVowels[i];
            });
            return result.join('');
        }

        function attemptFullReorder() {
            const chars = word.split('');
            shuffleArray(chars);
            return chars.join('');
        }

        // Priority 1: Try to generate Vowel-Only Swaps for higher challenge
        while (uniqueDistractors.size < count && attempts < maxAttempts / 2) {
            const candidate = attemptVowelReorder();
            if (candidate && candidate.toLowerCase() !== word.toLowerCase()) {
                uniqueDistractors.add(candidate);
            }
            attempts++;
        }

        // Priority 2: Fill remaining slots with full random scrambles if vowel reorder was exhausted
        while (uniqueDistractors.size < count && attempts < maxAttempts) {
            const candidate = attemptFullReorder();
            if (candidate && candidate.toLowerCase() !== word.toLowerCase()) {
                uniqueDistractors.add(candidate);
            }
            attempts++;
        }

        return Array.from(uniqueDistractors);
    }

    function getPermutationCount(word) {
        // simplified check for small strings
        let fact = 1;
        for(let i = 1; i <= word.length; i++) fact *= i;
        return fact;
    }

    // --- Unified Input & Backspace Helpers ---
    function handleLetterInput(char, qIdx = activeSentenceIndex) {
        const activeAns = answersState[qIdx];
        if (!activeAns) return;
        const maxLen = activeAns.length;
        
        const emptyIdx = activeAns.indexOf('');
        if (emptyIdx !== -1 && emptyIdx < maxLen) {
            const item = tempVocabList[qIdx];
            const targetChar = item.practiceWord.replace(/\s+/g, '')[emptyIdx];
            const isUpper = targetChar === targetChar.toUpperCase();
            activeAns[emptyIdx] = isUpper ? char.toUpperCase() : char.toLowerCase();
            renderVisualSlots(qIdx);
        }
    }

    function handleBackspace(qIdx = activeSentenceIndex) {
        const activeAns = answersState[qIdx];
        if (!activeAns) return;
        const maxLen = activeAns.length;
        
        let lastFilledIdx = -1;
        for (let i = maxLen - 1; i >= 0; i--) {
            if (activeAns[i] !== '') {
                lastFilledIdx = i;
                break;
            }
        }
        if (lastFilledIdx !== -1) {
            activeAns[lastFilledIdx] = '';
            renderVisualSlots(qIdx);
        }
    }

    // --- Sequential Virtual Keyboard Renderer ---
    function renderVirtualKeyboard() {
        const keyboardContainer = document.getElementById('virtual-keyboard');
        if (!keyboardContainer) return;
        
        keyboardContainer.innerHTML = '';
        
        const alphabet = 'abcdefghijklmnopqrstuvwxyz'.split('');
        
        alphabet.forEach(char => {
            const keyBtn = document.createElement('div');
            keyBtn.className = 'virtual-key';
            keyBtn.textContent = char.toUpperCase();
            
            keyBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                handleLetterInput(char, activeSentenceIndex);
                
                // Re-focus typing input to keep keyboard captures active
                const input = document.getElementById('hidden-typing-input');
                if (input) input.focus();
            });
            
            keyboardContainer.appendChild(keyBtn);
        });
        
        // Add Backspace Key
        const backspaceKey = document.createElement('div');
        backspaceKey.className = 'virtual-key backspace-key';
        backspaceKey.textContent = '⌫';
        backspaceKey.title = 'Backspace';
        
        backspaceKey.addEventListener('click', (e) => {
            e.stopPropagation();
            handleBackspace(activeSentenceIndex);
            
            // Re-focus typing input to keep keyboard captures active
            const input = document.getElementById('hidden-typing-input');
            if (input) input.focus();
        });
        
        keyboardContainer.appendChild(backspaceKey);
    }

    // --- Game Stage 1: Review List ---
    function startReviewStage(data) {
        tempVocabList = [...data];
        switchView('game');
        
        // Set visual displays
        document.getElementById('stage-review').classList.remove('hidden');
        document.getElementById('stage-practice').classList.add('hidden');
        
        const container = document.getElementById('review-list');
        container.innerHTML = '';
        
        tempVocabList.forEach((item, index) => {
            const safeWord = item.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const fuzzyWord = safeWord.split(/\s+/).map(w => w + '[a-z]*').join('\\s+');
            const regex = new RegExp(`\\b${fuzzyWord}\\b`, 'gi');
            let displaySentence = item.sentence.replace(regex, '<u>$&</u>');
            if (displaySentence === item.sentence) {
                displaySentence = item.sentence.replace(new RegExp(safeWord, 'gi'), '<u>$&</u>');
            }
            if (displaySentence === item.sentence) {
                displaySentence = item.sentence + ` <u>${item.word}</u>`;
            }
            
            const card = document.createElement('div');
            card.className = 'review-card';
            card.innerHTML = `
                <div class="review-vocab-header">
                    <div class="review-vocab-meta" style="display:flex; align-items:center; flex-wrap:wrap; gap:8px;">
                        <span class="review-vocab-word">${item.word}</span>
                        <span class="review-vocab-type">${item.type}</span>
                        <span class="review-vocab-translation" style="margin-top:0; font-size:1rem; color:var(--text-muted); font-weight:400;">${item.translation}</span>
                    </div>
                    <button class="inline-speak-btn" title="Listen to pronunciation">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
                    </button>
                </div>
                <div class="review-sentence-text">${displaySentence}</div>
            `;
            
            card.querySelector('.inline-speak-btn').onclick = (e) => {
                e.stopPropagation();
                speakCustomSentence(item.sentence);
            };
            
            container.appendChild(card);
        });
    }

    function speakCustomSentence(text) {
        if (!('speechSynthesis' in window)) {
            showToast("Speech Synthesis not supported", "#ef4444");
            return;
        }
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.85;
        
        const voices = window.speechSynthesis.getVoices();
        const engVoice = voices.find(v => v.lang.startsWith('en-'));
        if (engVoice) utterance.voice = engVoice;
        
        window.speechSynthesis.speak(utterance);
    }

    function switchView(viewName) {
        Object.values(views).forEach(v => v.classList.remove('active'));
        setTimeout(() => {
            Object.values(views).forEach(v => v.style.display = 'none');
            views[viewName].style.display = 'block';
            void views[viewName].offsetWidth;
            views[viewName].classList.add('active');
        }, 50);
    }

    // --- Game Stage 2: Practice Worksheet ---
    function startPracticeStage() {
        document.getElementById('stage-review').classList.add('hidden');
        document.getElementById('stage-practice').classList.remove('hidden');
        
        const keyboardContainer = document.getElementById('virtual-keyboard');
        const practiceStage = document.getElementById('stage-practice');
        
        if (isAdvancedMode) {
            practiceStage.classList.add('advanced-mode-active');
            if (keyboardContainer) {
                keyboardContainer.classList.remove('hidden');
                renderVirtualKeyboard();
            }
        } else {
            practiceStage.classList.remove('advanced-mode-active');
            if (keyboardContainer) {
                keyboardContainer.classList.add('hidden');
            }
        }
        
        // Compute actual matched words in sentence context to accurately handle tenses & plurals
        tempVocabList.forEach(item => {
            const safeWord = item.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const fuzzyWord = safeWord.split(/\s+/).map(w => w + '[a-z]*').join('\\s+');
            const regex = new RegExp(`\\b${fuzzyWord}\\b`, 'gi');
            const match = item.sentence.match(regex);
            item.practiceWord = match ? match[0] : item.word;
        });
        
        answersState = tempVocabList.map(item => {
            const len = item.practiceWord.replace(/\s+/g, '').length;
            return new Array(len).fill('');
        });
        
        const container = document.getElementById('practice-list');
        container.innerHTML = '';
        
        tempVocabList.forEach((item, qIdx) => {
            const slotHtml = `<span class="vocab-slots-container" id="vocab-slots-q-${qIdx}"></span>`;
            const safeWord = item.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const fuzzyWord = safeWord.split(/\s+/).map(w => w + '[a-z]*').join('\\s+');
            const regex = new RegExp(`\\b${fuzzyWord}\\b`, 'gi');
            let displaySentence = item.sentence.replace(regex, slotHtml);
            if (displaySentence === item.sentence) {
                displaySentence = item.sentence.replace(new RegExp(safeWord, 'gi'), slotHtml);
            }
            if (displaySentence === item.sentence) {
                displaySentence = item.sentence + " " + slotHtml;
            }
            
            const card = document.createElement('div');
            card.className = 'practice-card';
            card.dataset.qIndex = qIdx;
            card.innerHTML = `
                <div class="practice-card-header">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <span style="font-size:1.05rem; font-weight:700; color:var(--accent-secondary);">【${item.type}】${item.translation}</span>
                        <button class="inline-speak-btn practice-speak-btn" title="Listen to pronunciation" style="width:28px; height:28px; padding:0;">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
                        </button>
                    </div>
                    <span class="practice-card-status-icon" id="practice-status-icon-q-${qIdx}"></span>
                </div>
                <div class="practice-sentence-text">${displaySentence}</div>
                <div class="practice-card-letter-bank" id="letter-bank-q-${qIdx}"></div>
            `;
            
            card.addEventListener('click', () => {
                selectActiveCard(qIdx);
            });
            
            container.appendChild(card);
            
            card.querySelector('.practice-speak-btn').onclick = (e) => {
                e.stopPropagation();
                speakCustomSentence(item.sentence);
            };
            
            const letterBank = card.querySelector('.practice-card-letter-bank');
            const chars = item.practiceWord.replace(/\s+/g, '').split('');
            shuffleArray(chars);
            
            chars.forEach(char => {
                const chip = document.createElement('span');
                chip.className = 'practice-letter-chip';
                chip.textContent = char;
                chip.dataset.char = char;
                
                chip.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (activeSentenceIndex !== qIdx) {
                        selectActiveCard(qIdx);
                    }
                    handleLetterInput(char, qIdx);
                });
                
                letterBank.appendChild(chip);
            });
            
            renderVisualSlots(qIdx);
        });
        
        selectActiveCard(0);
    }

    function renderVisualSlots(qIdx) {
        const item = tempVocabList[qIdx];
        const targetContainer = document.getElementById(`vocab-slots-q-${qIdx}`);
        if (!targetContainer) return;
        
        targetContainer.innerHTML = '';
        const activeAns = answersState[qIdx];
        let firstEmptyIdx = activeAns.indexOf('');
        
        const words = item.practiceWord.split(/\s+/);
        let overallIdx = 0;
        words.forEach(w => {
            if (w.length === 0) return;
            const group = document.createElement('span');
            group.className = 'word-group';
            for (let char of w) {
                const slot = document.createElement('span');
                slot.className = 'char-slot';
                
                const filledChar = activeAns[overallIdx];
                if (filledChar) {
                    slot.textContent = filledChar;
                    slot.className += ' filled';
                } else {
                    slot.textContent = '';
                    if (overallIdx === firstEmptyIdx && activeSentenceIndex === qIdx) {
                        slot.className += ' active';
                    }
                }
                group.appendChild(slot);
                overallIdx++;
            }
            targetContainer.appendChild(group);
        });
        
        const card = document.querySelector(`.practice-card[data-q-index="${qIdx}"]`);
        if (card) {
            const consumed = {};
            activeAns.forEach(c => {
                if (c) consumed[c.toLowerCase()] = (consumed[c.toLowerCase()] || 0) + 1;
            });
            
            card.querySelectorAll('.practice-letter-chip').forEach(chip => {
                const chipChar = chip.dataset.char.toLowerCase();
                if (consumed[chipChar] > 0) {
                    chip.classList.add('used');
                    consumed[chipChar]--;
                } else {
                    chip.classList.remove('used');
                }
            });
        }
    }

    function selectActiveCard(qIdx) {
        activeSentenceIndex = qIdx;
        document.querySelectorAll('.practice-card').forEach((card, idx) => {
            if (idx === qIdx) {
                card.classList.add('active');
            } else {
                card.classList.remove('active');
            }
            renderVisualSlots(idx);
        });
        
        const input = document.getElementById('hidden-typing-input');
        input.value = '';
        input.focus();
    }

    function submitPractice() {
        let roundScore = 0;
        mistakeList = [];
        
        tempVocabList.forEach((item, qIdx) => {
            const userAns = answersState[qIdx].join('').replace(/\s+/g, '').toLowerCase();
            const actualClean = item.practiceWord.replace(/\s+/g, '').toLowerCase();
            
            const card = document.querySelector(`.practice-card[data-q-index="${qIdx}"]`);
            const statusIcon = document.getElementById(`practice-status-icon-q-${qIdx}`);
            
            if (userAns === actualClean) {
                roundScore++;
                if (card) {
                    card.classList.add('success-answered');
                    card.classList.remove('error-answered');
                }
                if (statusIcon) {
                    statusIcon.innerHTML = `<span style="color:var(--success)">Correct ✓</span>`;
                }
            } else {
                mistakeList.push(item);
                addToMistakes(item);
                if (card) {
                    card.classList.add('error-answered');
                    card.classList.remove('success-answered');
                }
                if (statusIcon) {
                    statusIcon.innerHTML = `<span style="color:var(--error)">Wrong ✗ (Correction: ${item.word})</span>`;
                }
            }
        });
        
        // Record and save unique practiced words in localStorage
        tempVocabList.forEach(item => {
            practicedVocabSet.add(item.word.toLowerCase());
        });
        localStorage.setItem('lexiscramble_practiced_' + activeFileName, JSON.stringify(Array.from(practicedVocabSet)));
        
        setTimeout(() => {
            switchView('result');
            const percentage = Math.round((roundScore / tempVocabList.length) * 100) || 0;
            document.getElementById('final-score-text').textContent = `${percentage}%`;
            
            const retryMistakesBtn = document.getElementById('retry-mistakes-btn');
            if (mistakeList.length > 0) {
                retryMistakesBtn.style.display = 'block';
            } else {
                retryMistakesBtn.style.display = 'none';
            }
            
            document.getElementById('summary-text').innerHTML = `
                Round Complete!<br>
                You answered <strong>${roundScore}</strong> out of <strong>${tempVocabList.length}</strong> questions correctly.
            `;
        }, 2000);
    }

    function showToast(msg, color) {
        const toast = document.getElementById('feedback');
        toast.textContent = msg;
        toast.style.background = color;
        toast.style.color = "white";
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 1200);
    }



    // --- Event Handlers ---
    dropZone.addEventListener('click', () => csvInput.click());

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragging');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragging');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragging');
        const file = e.dataTransfer.files[0];
        if (file && file.name.endsWith('.csv')) {
            processFile(file);
        }
    });

    csvInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) processFile(file);
    });

    function processFile(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const data = parseCSV(e.target.result);
            if (data.length > 0) {
                // Cache raw parsed lists
                fullVocabList = [...data];
                unpracticedVocabList = [...data];
                
                // Update active filename identifier and reload mistake bank
                activeFileName = file.name;
                mistakeBank = JSON.parse(localStorage.getItem('lexiscramble_mistakes_' + activeFileName)) || [];
                syncMistakeUI();
                syncPracticedProgress();
                
                // Populate configuration panel information
                document.getElementById('config-file-name').textContent = file.name;
                document.getElementById('config-max-words').textContent = `${data.length} vocabulary words found`;
                
                // Configure range inputs limits
                const slider = document.getElementById('vocab-count-slider');
                const numInput = document.getElementById('vocab-count-number');
                
                slider.max = data.length;
                numInput.max = data.length;
                
                // Default practice size (e.g. min of 5 or max count)
                const defaultVal = Math.min(5, data.length);
                slider.value = defaultVal;
                numInput.value = defaultVal;
                
                // Transition UI elements in view-upload
                document.getElementById('upload-subtitle').textContent = "Configure your vocabulary session limits.";
                document.getElementById('upload-zone-container').classList.add('hidden');
                document.getElementById('practice-config').classList.remove('hidden');
            } else {
                alert("No valid vocabulary rows found in the CSV.");
            }
        };
        reader.readAsText(file);
    }

    // --- Speech Functionality ---
    function speakSentence() {
        if (!('speechSynthesis' in window)) {
            showToast("Speech Synthesis not supported", "#ef4444");
            return;
        }

        // Stop any ongoing speech
        window.speechSynthesis.cancel();

        if (vocabData.length === 0 || currentIndex >= vocabData.length) return;

        const textToRead = vocabData[currentIndex].sentence;
        const utterance = new SpeechSynthesisUtterance(textToRead);
        
        // Explicitly prefer English voice
        const voices = window.speechSynthesis.getVoices();
        const englishVoice = voices.find(voice => voice.lang.startsWith('en'));
        if (englishVoice) {
            utterance.voice = englishVoice;
        }
        utterance.rate = 0.9; // slightly slower for learning clarity

        // Add visual response
        const btn = document.getElementById('speak-btn');
        btn.style.background = 'var(--accent-primary)';
        btn.style.boxShadow = '0 0 20px rgba(99, 102, 241, 0.8)';
        
        utterance.onend = () => {
            btn.style.background = '';
            btn.style.boxShadow = '';
        };

        window.speechSynthesis.speak(utterance);
    }

    function safeExit() {
        window.speechSynthesis.cancel();
        
        const cap = document.getElementById('hidden-typing-input');
        if (cap) {
            cap.oninput = null;
            cap.onkeydown = null;
            cap.value = '';
        }

        tempVocabList = [];
        mistakeList = [];
        answersState = [];
        activeSentenceIndex = 0;
        csvInput.value = ''; 
    }

    // Reset Button Listener (Immediate Exit)
    document.getElementById('reset-btn').addEventListener('click', () => {
        safeExit();
        document.getElementById('upload-subtitle').textContent = "Upload your vocabulary CSV to begin the challenge.";
        document.getElementById('upload-zone-container').classList.remove('hidden');
        document.getElementById('practice-config').classList.add('hidden');
        switchView('upload');
    });

    // Stage Selection Configurations slider link
    const slider = document.getElementById('vocab-count-slider');
    const numInput = document.getElementById('vocab-count-number');

    slider.addEventListener('input', (e) => {
        numInput.value = e.target.value;
    });

    numInput.addEventListener('input', (e) => {
        let val = parseInt(e.target.value);
        if (isNaN(val)) return;
        if (val < 1) val = 1;
        if (val > fullVocabList.length) val = fullVocabList.length;
        slider.value = val;
    });

    // Start Challenge Button Listener
    document.getElementById('start-challenge-btn').addEventListener('click', () => {
        const count = parseInt(numInput.value) || 5;
        desiredPracticeSize = count; // Save desired practice size
        const shuffled = shuffleArray([...fullVocabList]);
        const selection = shuffled.slice(0, count);
        
        // Initialize remaining pool
        unpracticedVocabList = unpracticedVocabList.filter(item => !selection.includes(item));
        startReviewStage(selection);
    });

    // Change File Button Listener
    document.getElementById('change-file-btn').addEventListener('click', () => {
        safeExit();
        document.getElementById('upload-subtitle').textContent = "Upload your vocabulary CSV to begin the challenge.";
        document.getElementById('upload-zone-container').classList.remove('hidden');
        document.getElementById('practice-config').classList.add('hidden');
    });

    // Load Demo Button Listener
    document.getElementById('load-demo-btn').addEventListener('click', () => {
        fullVocabList = [...demoData];
        unpracticedVocabList = [...demoData];
        
        // Set active filename to offline_demo and reload mistake bank
        activeFileName = 'offline_demo';
        mistakeBank = JSON.parse(localStorage.getItem('lexiscramble_mistakes_' + activeFileName)) || [];
        syncMistakeUI();
        syncPracticedProgress();
        
        document.getElementById('config-file-name').textContent = "Offline Demo List";
        document.getElementById('config-max-words').textContent = `${demoData.length} vocabulary words loaded`;
        
        const slider = document.getElementById('vocab-count-slider');
        const numInput = document.getElementById('vocab-count-number');
        
        slider.max = demoData.length;
        numInput.max = demoData.length;
        
        const defaultVal = Math.min(3, demoData.length);
        slider.value = defaultVal;
        numInput.value = defaultVal;
        
        document.getElementById('upload-subtitle').textContent = "Configure your offline vocabulary session.";
        document.getElementById('upload-zone-container').classList.add('hidden');
        document.getElementById('practice-config').classList.remove('hidden');
    });



    // Start Practice Button Listener
    document.getElementById('start-practice-btn').addEventListener('click', () => {
        startPracticeStage();
    });

    // Submit Practice Button Listener
    document.getElementById('submit-practice-btn').addEventListener('click', () => {
        submitPractice();
    });

    // Global Worksheet Keyboard Captures
    const captureInput = document.getElementById('hidden-typing-input');

    captureInput.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace') {
            e.preventDefault();
            handleBackspace(activeSentenceIndex);
        }
    });

    captureInput.addEventListener('input', (e) => {
        const typedVal = e.target.value;
        e.target.value = ''; // clear buffer
        
        if (typedVal) {
            const char = typedVal[typedVal.length - 1];
            handleLetterInput(char, activeSentenceIndex);
        }
    });

    // Result Post-Actions listeners
    document.getElementById('retry-mistakes-btn').addEventListener('click', () => {
        if (mistakeList.length > 0) {
            startReviewStage(mistakeList);
        }
    });

    document.getElementById('retry-round-btn').addEventListener('click', () => {
        startReviewStage(tempVocabList);
    });

    document.getElementById('next-round-btn').addEventListener('click', () => {
        const currentSize = desiredPracticeSize;
        if (unpracticedVocabList.length < currentSize) {
            unpracticedVocabList = [...fullVocabList];
        }
        const shuffled = shuffleArray([...unpracticedVocabList]);
        const selection = shuffled.slice(0, currentSize);
        unpracticedVocabList = unpracticedVocabList.filter(item => !selection.includes(item));
        
        startReviewStage(selection);
    });

    document.getElementById('go-home-btn').addEventListener('click', () => {
        safeExit();
        syncPracticedProgress();
        document.getElementById('upload-subtitle').textContent = "Upload your vocabulary CSV to begin the challenge.";
        document.getElementById('upload-zone-container').classList.remove('hidden');
        document.getElementById('practice-config').classList.add('hidden');
        switchView('upload');
    });

    // Pre-populate voice synthesis engines
    if ('speechSynthesis' in window) {
        window.speechSynthesis.getVoices();
        if (window.speechSynthesis.onvoiceschanged !== undefined) {
            window.speechSynthesis.onvoiceschanged = window.speechSynthesis.getVoices;
        }
    }

    // --- Mistake Bank Logic ---
    function addToMistakes(item) {
        const exists = mistakeBank.some(v => v.word.toLowerCase() === item.word.toLowerCase());
        if (!exists) {
            mistakeBank.push(item);
            saveMistakes();
        }
    }

    function removeFromMistakes(word) {
        const normalized = word.toLowerCase();
        const initialLen = mistakeBank.length;
        mistakeBank = mistakeBank.filter(v => v.word.toLowerCase() !== normalized);
        if (mistakeBank.length !== initialLen) saveMistakes();
    }

    function saveMistakes() {
        localStorage.setItem('lexiscramble_mistakes_' + activeFileName, JSON.stringify(mistakeBank));
        syncMistakeUI();
    }

    function syncPracticedProgress() {
        const raw = localStorage.getItem('lexiscramble_practiced_' + activeFileName);
        const list = raw ? JSON.parse(raw) : [];
        practicedVocabSet = new Set(list.map(w => w.toLowerCase()));
        
        const maxCount = fullVocabList.length;
        if (maxCount === 0) {
            document.getElementById('config-progress-container').classList.add('hidden');
            return;
        }
        
        const matchingWords = fullVocabList.filter(item => practicedVocabSet.has(item.word.toLowerCase()));
        const practicedCount = matchingWords.length;
        const percentage = Math.round((practicedCount / maxCount) * 100) || 0;
        
        document.getElementById('config-progress-container').classList.remove('hidden');
        document.getElementById('config-progress-text').textContent = `Practiced: ${practicedCount} / ${maxCount} words`;
        document.getElementById('config-progress-percent').textContent = `${percentage}%`;
        document.getElementById('config-progress-bar').style.width = `${percentage}%`;
    }

    function syncProgressDrawerUI() {
        const list = document.getElementById('progress-list-items');
        list.innerHTML = '';
        
        const matchingWords = fullVocabList.filter(item => practicedVocabSet.has(item.word.toLowerCase()));
        if (matchingWords.length === 0) {
            list.innerHTML = '<li class="drawer-hint">No words practiced historically yet. Start a challenge!</li>';
            return;
        }
        
        const seen = new Set();
        const uniqueMatching = [];
        matchingWords.forEach(item => {
            const wordKey = item.word.toLowerCase();
            if (!seen.has(wordKey)) {
                seen.add(wordKey);
                uniqueMatching.push(item);
            }
        });
        
        uniqueMatching.forEach(item => {
            const li = document.createElement('li');
            li.className = 'mistake-item';
            li.innerHTML = `
                <div class="mistake-info">
                    <span class="word-title" style="color: var(--accent-primary);">${item.word}</span>
                    <span class="word-sub">【${item.type}】${item.translation}</span>
                </div>
                <button class="delete-item-btn" title="Remove practiced word">&times;</button>
            `;
            
            li.querySelector('.delete-item-btn').onclick = (e) => {
                e.stopPropagation();
                practicedVocabSet.delete(item.word.toLowerCase());
                localStorage.setItem('lexiscramble_practiced_' + activeFileName, JSON.stringify(Array.from(practicedVocabSet)));
                
                syncPracticedProgress();
                syncProgressDrawerUI();
            };
            
            list.appendChild(li);
        });
    }

    // --- Progress Sidebar Drawer Logic ---
    const progressDrawer = document.getElementById('progress-drawer');
    const progressToggleBtn = document.getElementById('progress-toggle-btn');
    const closeProgressBtn = document.getElementById('close-progress-drawer');
    const clearProgressBtn = document.getElementById('clear-progress');

    progressToggleBtn.addEventListener('click', () => {
        progressDrawer.classList.add('open');
        syncProgressDrawerUI();
    });

    closeProgressBtn.addEventListener('click', () => {
        progressDrawer.classList.remove('open');
    });

    window.addEventListener('click', (e) => {
        if (progressDrawer.classList.contains('open') && !progressDrawer.contains(e.target) && !progressToggleBtn.contains(e.target)) {
            progressDrawer.classList.remove('open');
        }
    });

    clearProgressBtn.addEventListener('click', () => {
        if (confirm("Are you sure you want to clear all practiced progress for this list?")) {
            practicedVocabSet = new Set();
            localStorage.setItem('lexiscramble_practiced_' + activeFileName, JSON.stringify([]));
            syncPracticedProgress();
            syncProgressDrawerUI();
        }
    });

    function syncMistakeUI() {
        const badge = document.getElementById('mistake-badge');
        const list = document.getElementById('mistake-list-items');
        const practiceBtn = document.getElementById('practice-mistakes-btn');

        const count = mistakeBank.length;
        badge.textContent = count;
        badge.style.display = count > 0 ? 'flex' : 'none';
        practiceBtn.disabled = count === 0;

        list.innerHTML = '';
        if (count === 0) {
            list.innerHTML = '<li class="drawer-hint">No failures recorded yet. Keep practicing!</li>';
        } else {
            mistakeBank.forEach((item, idx) => {
                const li = document.createElement('li');
                li.className = 'mistake-item';
                li.innerHTML = `
                    <div class="mistake-info">
                        <span class="word-title">${item.word}</span>
                        <span class="word-sub">【${item.type}】${item.translation}</span>
                    </div>
                    <button class="delete-item-btn" title="Remove word" data-index="${idx}">&times;</button>
                `;
                
                li.querySelector('.delete-item-btn').onclick = (e) => {
                    e.stopPropagation();
                    mistakeBank.splice(idx, 1);
                    saveMistakes();
                };
                
                list.appendChild(li);
            });
        }
    }

    const drawer = document.getElementById('mistake-drawer');
    const toggleBtn = document.getElementById('mistake-toggle-btn');
    const closeBtn = document.getElementById('close-drawer');
    const clearBtn = document.getElementById('clear-mistakes');
    const practiceNow = document.getElementById('practice-mistakes-btn');

    toggleBtn.addEventListener('click', () => {
        drawer.classList.add('open');
        syncMistakeUI();
    });

    closeBtn.addEventListener('click', () => {
        drawer.classList.remove('open');
    });

    window.addEventListener('click', (e) => {
        if (drawer.classList.contains('open') && !drawer.contains(e.target) && !toggleBtn.contains(e.target)) {
            drawer.classList.remove('open');
        }
    });

    clearBtn.addEventListener('click', () => {
        if (confirm("Are you sure you want to empty your Mistake Bank?")) {
            mistakeBank = [];
            saveMistakes();
        }
    });

    practiceNow.addEventListener('click', () => {
        if (mistakeBank.length === 0) return;
        drawer.classList.remove('open');
        setTimeout(() => {
            safeExit();
            startReviewStage([...mistakeBank]);
            showToast("Loaded Mistake List!", "var(--accent-primary)");
        }, 300);
    });

    syncMistakeUI();
});

