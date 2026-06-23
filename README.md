# Vocab Defender - Arcade Typing Game

Vocab Defender is a retro, arcade-style typing game built with HTML5 Canvas. Learn and practice English vocabulary across 9 different topics with Chinese translation guides.

## Features

- **9 Pre-loaded Vocabulary Topics**: Covers categories from toys and parties to medicine, weather, and town vocabulary.
- **Cyber-Arcade Aesthetics**: Glow effects, space particles, laser fire, and neon typography powered by Google Fonts.
- **Interactive Controls**: Adjustable speed settings, custom starting lives, time limits, and real-time score tracking.
- **Robust CSV Parser**: Supports custom CSV vocabulary imports (retaining complex strings, quotes, and punctuation).

---

## How to Play and Run Locally

Because the game dynamically loads vocabulary CSV lists via JavaScript `fetch`, opening `index.html` directly in your browser using the file protocol (`file:///...`) will trigger CORS errors.

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

## Pushing to GitHub

To publish this project to GitHub:

1. Go to [github.com](https://github.com) and create a new repository named `vocab-game`. Leave it empty (do not initialize with a README, gitignore, or license).
2. Open your terminal in the `vocab-game` directory on your computer and run the following commands:

```bash
# Initialize local git repository
git init

# Stage all files
git add .

# Create initial commit
git commit -m "Initial commit of vocab-game"

# Rename default branch to main
git branch -M main

# Link your local repo to GitHub (replace with your GitHub username)
git remote add origin https://github.com/YOUR_GITHUB_USERNAME/vocab-game.git

# Push to GitHub
git push -u origin main
```

Once pushed, you can also easily host it for free on **GitHub Pages** by going to `Repository Settings -> Pages -> Deploy from branch (main)`.
