# kawaiibot
Wowhead Forever item bot for Discord.

Watches chat for `[Item Name]` and replies with an item card: icon, quality colour, tooltip text and a link to the item on Wowhead's WoW Forever database.

```
Metra: [Cozy Sleeping Bag] #2 lol
Bot:   (embed) Cozy Sleeping Bag  -> https://www.wowhead.com/forever/item=211527/cozy-sleeping-bag
```

Name resolution uses Wowhead's Forever search page (exact name first, then the closest prefix match), the tooltip JSON for the text, and `wow.zamimg.com` for the icon. Results are cached for a day per process. No database.

## Discord setup (once)

1. https://discord.com/developers/applications -> New Application.
2. Bot tab: Reset Token and copy it (this is `DISCORD_TOKEN`). Under Privileged Gateway Intents enable **Message Content Intent**. Without it the bot sees empty messages.
3. OAuth2 -> URL Generator: scope `bot`; scope `applications.commands`, permissions `View Channels`, `Send Messages`, `Embed Links`, `Attach Files`, `Read Message History`. Open the generated URL and invite the bot to the server.

## Run locally

```bash
npm install
DISCORD_TOKEN=... npm start
npm run lookup -- "Cozy Sleeping Bag" "Thunderfury"   # resolver check without Discord
```

## Deploy on Railway

1. New project -> Deploy from GitHub repo -> this repository.
2. Chromium is needed for the tooltip pictures: use a Dockerfile based on `mcr.microsoft.com/playwright` (not added yet) or the text embed fallback is used.
3. Variables: `DISCORD_TOKEN` (required), optional `CHANNELS` (comma separated channel ids to seed the watched list) and `MAX_ITEMS_PER_MESSAGE` (default 3).
4. No public domain is needed; the bot is a worker that connects out to Discord. `railway.json` sets the start command and a restart on failure.

## Behaviour

- Nothing is watched by default. Someone with Manage Channels runs `/watch` in a channel (or `/watch channel:#name`), `/unwatch` to stop, `/watched` to list. The list is saved in `data/watched.json` (`WATCHED_FILE` overrides); `CHANNELS` seeds it.
- Up to `MAX_ITEMS_PER_MESSAGE` distinct `[...]` names per message; brackets with no letters (`[1]`) are ignored, as are messages from bots.
- Unknown names get no reply (nothing is posted for `[lol]`).
- Replies do not ping the author.
