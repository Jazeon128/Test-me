# FlashLearn Desktop - User Guide

Welcome to FlashLearn Desktop! This guide will help you install, configure, and use the FlashLearn desktop application.

## Table of Contents

- [Installation](#installation)
  - [Windows](#windows)
  - [macOS](#macos)
  - [Linux](#linux)
- [Getting Started](#getting-started)
- [API Key Configuration](#api-key-configuration)
- [Using FlashLearn](#using-flashlearn)
- [Troubleshooting](#troubleshooting)
- [FAQ](#faq)

---

## Installation

### Windows

**System Requirements:**
- Windows 10 or later (64-bit)
- 4 GB RAM minimum (8 GB recommended)
- 500 MB free disk space

**Installation Steps:**

1. **Download the Installer**
   - Visit the [FlashLearn Releases](https://github.com/yourusername/flashlearn/releases) page
   - Download the latest `FlashLearn-Setup-x.x.x.exe` file

2. **Run the Installer**
   - Double-click the downloaded `.exe` file
   - If Windows SmartScreen appears, click "More info" then "Run anyway"
   - Follow the installation wizard prompts
   - Choose your installation location (default is recommended)

3. **Launch FlashLearn**
   - The installer will create a desktop shortcut
   - You can also launch from Start Menu → FlashLearn

**Portable Version:**
- Download `FlashLearn-Portable-x.x.x.exe` for a portable version
- No installation required - just run the executable
- All data is stored in the same folder as the executable

### macOS

**System Requirements:**
- macOS 12 (Monterey) or later
- 4 GB RAM minimum (8 GB recommended)
- 500 MB free disk space

**Installation Steps:**

1. **Download the DMG**
   - Visit the [FlashLearn Releases](https://github.com/yourusername/flashlearn/releases) page
   - Download the latest `FlashLearn-x.x.x.dmg` file

2. **Install the Application**
   - Double-click the downloaded `.dmg` file
   - Drag the FlashLearn icon to the Applications folder
   - Eject the DMG from Finder

3. **First Launch**
   - Open Applications folder and double-click FlashLearn
   - If you see "FlashLearn cannot be opened because it is from an unidentified developer":
     - Right-click (or Control-click) the FlashLearn icon
     - Select "Open" from the menu
     - Click "Open" in the dialog that appears
   - This only needs to be done once

4. **Grant Permissions**
   - macOS may ask for permissions to access files
   - Click "OK" to grant necessary permissions

### Linux

**System Requirements:**
- Ubuntu 20.04+ or equivalent distribution
- 4 GB RAM minimum (8 GB recommended)
- 500 MB free disk space

**Installation Options:**

#### AppImage (Recommended)

1. **Download AppImage**
   - Visit the [FlashLearn Releases](https://github.com/yourusername/flashlearn/releases) page
   - Download `FlashLearn-x.x.x.AppImage`

2. **Make Executable**
   ```bash
   chmod +x FlashLearn-x.x.x.AppImage
   ```

3. **Run the Application**
   ```bash
   ./FlashLearn-x.x.x.AppImage
   ```

#### Debian/Ubuntu (.deb)

```bash
# Download the .deb file
wget https://github.com/yourusername/flashlearn/releases/download/vx.x.x/flashlearn_x.x.x_amd64.deb

# Install
sudo dpkg -i flashlearn_x.x.x_amd64.deb

# Install dependencies if needed
sudo apt-get install -f

# Launch
flashlearn
```

#### Fedora/RHEL (.rpm)

```bash
# Download the .rpm file
wget https://github.com/yourusername/flashlearn/releases/download/vx.x.x/flashlearn-x.x.x.x86_64.rpm

# Install
sudo rpm -i flashlearn-x.x.x.x86_64.rpm

# Or using dnf
sudo dnf install flashlearn-x.x.x.x86_64.rpm

# Launch
flashlearn
```

---

## Getting Started

### First Launch

When you first launch FlashLearn, you'll see a welcome screen that guides you through initial setup:

1. **Welcome Screen**
   - Read the brief introduction to FlashLearn
   - Click "Get Started" to continue

2. **API Key Configuration**
   - You'll be prompted to configure an AI provider API key
   - This is required for generating flashcards from documents
   - See [API Key Configuration](#api-key-configuration) below for details

3. **Main Interface**
   - Once configured, you'll see the main FlashLearn interface
   - The application is now ready to use!

### Quick Start Tutorial

1. **Upload a Document**
   - Click "Upload Document" or press `Ctrl+O` (Windows/Linux) or `Cmd+O` (macOS)
   - Select a PDF, DOCX, Markdown, or other supported file
   - Wait for the document to be processed

2. **Generate Flashcards**
   - Click "Generate Questions" on your uploaded document
   - Choose the number of questions you want
   - Wait for AI to generate your flashcards

3. **Start Studying**
   - Navigate to your deck
   - Click "Study" to begin
   - Answer questions and rate your confidence
   - FlashLearn uses spaced repetition to optimize your learning

### System Tray

FlashLearn runs in the system tray for quick access:

- **Closing the Window**: Minimizes to tray (app keeps running)
- **Tray Icon Click**: Restores the main window
- **Right-Click Tray Icon**: Shows menu with options:
  - Show Window
  - Quit Application

To completely quit FlashLearn:
- Right-click the tray icon and select "Quit"
- Or use `Ctrl+Q` (Windows/Linux) or `Cmd+Q` (macOS)

---

## API Key Configuration

FlashLearn requires an API key from an AI provider to generate flashcards. We support three providers:

### Supported Providers

1. **OpenAI** (GPT-4, GPT-3.5)
2. **Anthropic** (Claude)
3. **Google** (Gemini)

### Getting an API Key

#### OpenAI

1. Visit [platform.openai.com](https://platform.openai.com)
2. Sign up or log in
3. Navigate to API Keys section
4. Click "Create new secret key"
5. Copy the key (starts with `sk-`)

#### Anthropic

1. Visit [console.anthropic.com](https://console.anthropic.com)
2. Sign up or log in
3. Navigate to API Keys
4. Click "Create Key"
5. Copy the key (starts with `sk-ant-`)

#### Google

1. Visit [makersuite.google.com](https://makersuite.google.com)
2. Sign up or log in
3. Click "Get API Key"
4. Create a new API key
5. Copy the key

### Configuring in FlashLearn

1. **Open Settings**
   - Click the gear icon in the top-right
   - Or press `Ctrl+,` (Windows/Linux) or `Cmd+,` (macOS)

2. **Select Provider**
   - Choose your AI provider from the dropdown

3. **Enter API Key**
   - Paste your API key in the text field
   - The key format will be validated automatically

4. **Save Settings**
   - Click "Save"
   - Your API key is encrypted and stored securely

5. **Test Connection** (Optional)
   - Click "Test Connection" to verify your API key works
   - You should see a success message

### Security Notes

- API keys are encrypted before being stored on your computer
- Keys are never transmitted except to the official AI provider APIs
- You can clear your API key at any time from Settings
- If you suspect your key is compromised, revoke it from the provider's website

---

## Using FlashLearn

### Uploading Documents

**Supported Formats:**
- PDF (.pdf)
- Microsoft Word (.docx)
- Markdown (.md)
- HTML (.html)
- PowerPoint (.pptx)
- Plain Text (.txt)

**Upload Process:**
1. Click "Upload Document" or use `Ctrl+O` / `Cmd+O`
2. Select one or more files
3. Wait for processing (progress shown in UI)
4. Documents appear in your library

**Tips:**
- Larger documents take longer to process
- Clear, well-formatted documents produce better flashcards
- You can upload multiple documents at once

### Generating Flashcards

1. **Select a Document**
   - Click on a document in your library

2. **Generate Questions**
   - Click "Generate Questions"
   - Choose number of questions (5-50 recommended)
   - Select difficulty level if desired

3. **Review Generated Cards**
   - Review the generated flashcards
   - Edit any cards that need refinement
   - Delete cards you don't want

4. **Add to Deck**
   - Cards are automatically added to a deck
   - You can organize cards into custom decks

### Studying with Spaced Repetition

FlashLearn uses the SM-2 algorithm for optimal learning:

1. **Start a Study Session**
   - Click "Study" on a deck
   - Cards due for review are shown first

2. **Answer Questions**
   - Read the question
   - Think of your answer
   - Click "Show Answer" to reveal

3. **Rate Your Confidence**
   - **Again**: Didn't remember - card shown again soon
   - **Hard**: Barely remembered - shorter interval
   - **Good**: Remembered correctly - normal interval
   - **Easy**: Very easy - longer interval

4. **Complete Session**
   - Study until no cards are due
   - Come back tomorrow for the next session

### Managing Decks

- **Create Deck**: Click "New Deck" button
- **Rename Deck**: Right-click deck → Rename
- **Delete Deck**: Right-click deck → Delete
- **Move Cards**: Drag cards between decks
- **Export Deck**: Right-click deck → Export to Anki/CSV

### Keyboard Shortcuts

| Action | Windows/Linux | macOS |
|--------|---------------|-------|
| New Flashcard | `Ctrl+N` | `Cmd+N` |
| Upload Document | `Ctrl+O` | `Cmd+O` |
| Settings | `Ctrl+,` | `Cmd+,` |
| Fullscreen | `F11` | `F11` |
| Quit | `Ctrl+Q` | `Cmd+Q` |
| Show Answer | `Space` | `Space` |
| Rate: Again | `1` | `1` |
| Rate: Hard | `2` | `2` |
| Rate: Good | `3` | `3` |
| Rate: Easy | `4` | `4` |

---

## Troubleshooting

### Application Won't Start

**Windows:**
- Check if Windows Defender is blocking the app
- Try running as Administrator (right-click → Run as administrator)
- Ensure you have .NET Framework 4.7.2 or later installed
- Check antivirus software isn't quarantining the app

**macOS:**
- Verify you're running macOS 12 or later
- Try the right-click → Open method described in installation
- Check System Preferences → Security & Privacy for blocks
- Ensure you have sufficient disk space

**Linux:**
- Verify the AppImage is executable: `chmod +x FlashLearn.AppImage`
- Install FUSE if needed: `sudo apt install fuse libfuse2`
- Check for missing dependencies: `ldd FlashLearn.AppImage`
- Try running from terminal to see error messages

### Backend Server Fails to Start

**Symptoms:**
- "Backend server not responding" error
- Application hangs on splash screen
- Connection errors when generating flashcards

**Solutions:**

1. **Check Port Availability**
   - FlashLearn tries ports 8000-8010
   - Close other applications using these ports
   - On Windows: `netstat -ano | findstr :8000`
   - On macOS/Linux: `lsof -i :8000`

2. **Check Firewall**
   - Allow FlashLearn through your firewall
   - The backend only listens on localhost (127.0.0.1)

3. **View Logs**
   - Open Help → View Logs
   - Look for backend startup errors
   - Share logs when reporting issues

4. **Reset Application Data**
   - Close FlashLearn completely
   - Delete the data directory:
     - Windows: `%APPDATA%\FlashLearn`
     - macOS: `~/Library/Application Support/FlashLearn`
     - Linux: `~/.config/FlashLearn`
   - Restart FlashLearn (will recreate fresh data)

### API Key Issues

**"Invalid API Key" Error:**
- Verify you copied the entire key (no spaces)
- Check the key hasn't been revoked on the provider's website
- Ensure you selected the correct provider
- Try generating a new key

**"API Rate Limit Exceeded":**
- You've exceeded your provider's rate limits
- Wait a few minutes and try again
- Consider upgrading your API plan
- Check your usage on the provider's dashboard

**"API Connection Failed":**
- Check your internet connection
- Verify the AI provider's service status
- Check if a firewall is blocking outbound connections
- Try using a different network

### Database Issues

**"Database Locked" Error:**
- Another instance of FlashLearn might be running
- Check system tray for FlashLearn icon
- Restart your computer if issue persists

**"Database Corrupted" Error:**
- FlashLearn will offer to create a backup
- Accept the backup option
- A new database will be created
- You can try to recover data from the backup later

**Missing Data:**
- Check if you're looking in the right deck
- Use the search function to find cards
- Check Help → View Logs for any errors
- Restore from backup if available

### Performance Issues

**Slow Startup:**
- First launch is slower (database initialization)
- Subsequent launches should be faster
- Check available disk space
- Close other resource-intensive applications

**High Memory Usage:**
- Normal during AI generation (processing documents)
- Memory is released after generation completes
- Restart FlashLearn if memory doesn't decrease
- Consider processing smaller documents

**Slow Document Processing:**
- Large documents take longer to process
- PDF files with images are slower
- Check your internet connection (affects AI generation)
- Be patient - complex documents need more time

### Update Issues

**Update Download Fails:**
- Check your internet connection
- Verify you have sufficient disk space
- Try downloading manually from GitHub releases
- Check if antivirus is blocking the download

**Update Installation Fails:**
- Close FlashLearn completely before updating
- Run installer as Administrator (Windows)
- Check you have write permissions to installation directory
- Try uninstalling and reinstalling

### Getting Help

If you're still experiencing issues:

1. **Check Logs**
   - Help → View Logs
   - Look for error messages
   - Note any error codes

2. **Generate Diagnostic Report**
   - Help → Generate Diagnostic Report
   - Save the report file
   - Include it when reporting issues

3. **Report an Issue**
   - Visit [GitHub Issues](https://github.com/yourusername/flashlearn/issues)
   - Search for existing issues
   - Create a new issue with:
     - Your operating system and version
     - FlashLearn version (Help → About)
     - Steps to reproduce the problem
     - Diagnostic report (if applicable)
     - Relevant log excerpts

4. **Community Support**
   - Join our Discord server
   - Check the FAQ on our website
   - Browse existing GitHub discussions

---

## FAQ

### General Questions

**Q: Is FlashLearn free?**
A: Yes, FlashLearn is free and open-source. However, you need to provide your own AI API key, which may have costs from the provider.

**Q: Do I need an internet connection?**
A: You need internet to generate flashcards (AI API calls). Studying existing flashcards works offline.

**Q: Where is my data stored?**
A: All data is stored locally on your computer in the application data directory. Nothing is sent to FlashLearn servers (we don't have any!).

**Q: Can I use FlashLearn on multiple computers?**
A: Yes, but data doesn't sync automatically. You can export/import decks to transfer data between computers.

**Q: How much does AI generation cost?**
A: Costs depend on your AI provider and usage. Typically a few cents per document. Check your provider's pricing.

### Technical Questions

**Q: What AI models are supported?**
A: OpenAI (GPT-4, GPT-3.5), Anthropic (Claude), and Google (Gemini).

**Q: Can I use my own AI model?**
A: Not currently, but this is planned for a future release.

**Q: Is my API key secure?**
A: Yes, API keys are encrypted before storage and never logged or transmitted except to the official AI provider.

**Q: Can I export my flashcards?**
A: Yes, you can export to Anki format or CSV for use in other applications.

**Q: Does FlashLearn support images in flashcards?**
A: Not yet, but this feature is planned for a future release.

**Q: Can I customize the spaced repetition algorithm?**
A: Not currently, but we're considering adding customization options in the future.

### Troubleshooting Questions

**Q: Why is the app using so much memory?**
A: Memory usage increases during document processing and AI generation. It's released afterward. If it stays high, try restarting the app.

**Q: Can I change where data is stored?**
A: Not currently through the UI, but you can set the `FLASHLEARN_DATA_DIR` environment variable before launching.

**Q: How do I completely uninstall FlashLearn?**
A: Uninstall the application, then delete the data directory (see locations in Troubleshooting section).

**Q: Why does Windows Defender flag the app?**
A: This can happen with new releases. The app is safe - we'll work on getting it whitelisted. You can add an exception in Windows Defender.

---

## Data and Privacy

### What Data is Collected?

FlashLearn does NOT collect any personal data. All data stays on your computer:

- Flashcards and study progress: Stored locally in SQLite database
- Uploaded documents: Stored locally in application data directory
- API keys: Encrypted and stored locally
- Settings: Stored locally in configuration file

### What Data is Sent to AI Providers?

When generating flashcards:
- Document text is sent to your chosen AI provider
- Your API key is used to authenticate
- No other data is transmitted

### Automatic Updates

The auto-updater checks for new versions by:
- Connecting to GitHub releases API
- Comparing your version with the latest release
- No personal data is transmitted
- You can disable auto-updates in Settings

---

## Credits and License

FlashLearn is open-source software licensed under the MIT License.

**Developed by:** [Your Name/Team]

**Built with:**
- Electron
- React
- FastAPI
- SQLite
- OpenAI/Anthropic/Google AI APIs

**Contributing:**
We welcome contributions! See our [Contributing Guide](CONTRIBUTING.md) for details.

**Support the Project:**
- Star us on GitHub
- Report bugs and suggest features
- Contribute code or documentation
- Share FlashLearn with others

---

## Version History

See [CHANGELOG.md](../CHANGELOG.md) for detailed version history and release notes.

---

**Last Updated:** December 2024
**Version:** 1.0.0
