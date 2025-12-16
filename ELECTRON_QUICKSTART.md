# FlashLearn Desktop - Quick Start Guide

This guide will help you quickly get started with the FlashLearn desktop application development.

## Quick Setup (5 minutes)

### 1. Install Electron Dependencies

```bash
cd electron
npm install
```

### 2. Start Development

You need two terminal windows:

**Terminal 1 - Frontend Dev Server:**
```bash
cd frontend
npm install  # if not already done
npm run dev
```

Wait for: `Local: http://localhost:5173/`

**Terminal 2 - Electron App:**
```bash
cd electron
npm run dev
```

The Electron app will automatically wait for the frontend server and then launch.

## What You'll See

- A desktop window opens with the FlashLearn UI
- DevTools are automatically opened
- Changes to frontend code hot-reload automatically
- Console logs appear in Terminal 2

## Project Structure

```
flashlearn/
├── electron/          # Desktop app (NEW)
│   ├── main/         # Main process
│   ├── preload/      # IPC bridge
│   ├── renderer/     # Built frontend
│   └── backend/      # Bundled Python (TBD)
├── frontend/         # React UI (existing)
├── backend/          # FastAPI server (existing)
└── ...
```

## Development Workflow

1. **Frontend changes**: Edit files in `frontend/src/` - hot reload works
2. **Electron changes**: Edit files in `electron/main/` or `electron/preload/` - restart Electron
3. **Backend changes**: Currently runs separately (will be integrated in Task 2)

## Common Commands

```bash
# Development
cd electron
npm run dev              # Start with frontend check
npm run dev:direct       # Start without frontend check

# Building (after frontend and backend are built)
npm run build            # Build for current platform
npm run build:win        # Windows
npm run build:mac        # macOS
npm run build:linux      # Linux
npm run pack             # Test packaging without installer
```

## Next Steps

The Electron project structure is now set up! The next tasks will implement:

1. ✅ **Task 1**: Electron project structure (COMPLETE)
2. ⏭️ **Task 2**: Backend Process Manager - spawn and manage Python backend
3. ⏭️ **Task 3**: Main Process features - system tray, window management
4. ⏭️ **Task 4**: Settings Manager - API key storage
5. ⏭️ **Task 5**: IPC Communication - secure renderer-main bridge

## Troubleshooting

**"Frontend dev server not available"**
- Make sure `npm run dev` is running in the `frontend/` directory
- Check that port 5173 is not blocked

**"electron: command not found"**
- Run `npm install` in the `electron/` directory

**Window doesn't open**
- Check Terminal 2 for error messages
- Ensure frontend dev server is running

## Documentation

- Full setup guide: `electron/SETUP.md`
- Electron README: `electron/README.md`
- Build resources: `electron/build/README.md`

## Getting Help

If you encounter issues:
1. Check the troubleshooting sections in `electron/SETUP.md`
2. Review Electron logs in Terminal 2
3. Check frontend dev server logs in Terminal 1
4. Consult the [Electron documentation](https://www.electronjs.org/docs)
