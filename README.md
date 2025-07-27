# ODIA MCP Server

This repository contains a minimal backend for the **ODIA Modular Control
Platform (MCP)**, refactored for deployment on [Vercel](https://vercel.com/).
It exposes a handful of serverless API endpoints under the `/api` path:

| Endpoint | Method | Description |
| --- | --- | --- |
| `/api/healthcheck` | **GET** | Returns a simple “ODIA MCP Server is Live ✅” message. |
| `/api/claude/onboard` | **POST** | Accepts customer information and generates a friendly onboarding message using the Anthropic Claude API. Optionally synthesizes the response to speech via ElevenLabs when the `tts=true` query parameter is present. |
| `/api/voice/lexi` | **POST** | Accepts a user message, obtains a reply from Claude and returns both the text and an audio data URI. Conversation history is stored in Supabase. |
| `/api/webhook/flutterwave` | **POST** | Consumes Flutterwave payment notifications, validates the signature, verifies the transaction status and triggers onboarding. Logs the event to Supabase. |

## Project Structure

The code is organised to match Vercel’s serverless function conventions:

```
api/
├── healthcheck.js
├── claude/
│   └── onboard.js
├── voice/
│   └── lexi.js
└── webhook/
    └── flutterwave.js

lib/
├── supabase.js       # Initialise Supabase service client
├── elevenlabs.js     # ElevenLabs TTS integration
├── claude.js         # Anthropic Claude helpers
└── utils.js          # Flutterwave helpers

.env.production        # Example environment variables (do not commit secrets)
vercel.json            # Vercel build and routing configuration
package.json           # Project metadata and dependencies
README.md              # This file
```

## Deployment

1. **Create a new GitHub repository** (e.g. `odia-mcp-server`) and push the
   contents of this folder.
2. **Link the repository to Vercel:**
   - Go to [vercel.com](https://vercel.com) and create a new project.
   - Import your GitHub repo and choose the default settings. Vercel will
     detect the `vercel.json` configuration and automatically build
     serverless functions for each file under `api/`.
3. **Configure environment variables** in the Vercel dashboard under
   *Project → Settings → Environment Variables*. Use the keys defined in
   `.env.production` as a guide.
4. **Deploy**. Once deployed, your endpoints will be available under
   `https://your-project.vercel.app/api/...`.

Feel free to extend this backend to support additional providers or
custom logic. See the `lib/` modules for inspiration on how to build
new integrations."# odia-mcp-server" 
