# LexiScramble - Fun Vocabulary Learning Web App

LexiScramble is a modern, responsive, and dynamic web application designed to help users learn and master English vocabulary in context. It supports pronunciation guides, contextual sentence worksheets, customized learning progress, and a persistent Mistake Bank.

## 🚀 Features

- **Interactive Vocabulary Review**: Study the target words in context with built-in voice pronunciation guides (using the Web Speech Synthesis API) and traditional/simplified Chinese translation guides.
- **Worksheet Practice Mode**: Active filling of vocabulary slots inside context sentences.
- **Advanced Mode**: Toggle off letter bank hints and use physical keyboard or the onscreen sequential A-Z virtual keyboard for a harder spelling challenge.
- **Pre-loaded & Custom CSV Support**: Play using one of the 9 preloaded vocabulary lists (covering topics from "Favourite Toy Shop" to "Dreaming of Holidays") or drag-and-drop your own custom vocabulary CSV.
- **Mistake Bank & Practice Progress**:
  - Automatically captures missed words so you can review and practice them again later.
  - Saves your practiced progress locally (using `localStorage`) and shows a visual progress bar.
- **Beautiful Aurora-inspired Themes**: Select from 4 premium, glassmorphism-enhanced color themes:
  - Aurora (Default Neon)
  - Jungle Breeze (Cyan/Green)
  - Sunset Amber (Orange/Red)
  - Sakura Dream (Pink/Purple)

---

## 🛠️ CSV File Format

To upload your custom vocabulary list, create a `.csv` file with the following columns (optional header row containing "單字" can be auto-detected):

```csv
"Word", "Type", "Definition/Translation", "Example Sentence"
```

*Example:*
```csv
"dolphin", "n. (名詞)", "海豚", "Dolphin is a very intelligent animal."
"castle", "n. (名詞)", "城堡", "They visited an ancient castle on the hill."
```

---

## 💻 How to Run Locally

Because the application dynamically loads local vocabulary lists via JavaScript `fetch`, opening `index.html` directly in your browser using the file protocol (`file:///...`) will trigger CORS errors.

You must run the game using a **local web server**. Here are the easiest ways to do it:

### Option A: VS Code Live Server (Easiest)
1. Open the `vocab-game` folder in Visual Studio Code.
2. Install the **Live Server** extension (by Ritwick Dey).
3. Click the **Go Live** button in the bottom-right status bar.

### Option B: Python HTTP Server (Built-in)
1. Open a terminal or PowerShell in the `vocab-game` directory.
2. Run the command:
   ```bash
   python -m http.server 8000
   ```
3. Open your browser and navigate to `http://localhost:8000`.

---

## 📦 Pushing to GitHub

To configure your remote repository and push updates:

```bash
# Link your local repo to GitHub
git remote add origin https://github.com/YOUR_GITHUB_USERNAME/vocab-game.git

# Rename branch to main
git branch -M main

# Push to GitHub
git push -u origin main
```
