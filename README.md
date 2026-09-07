# War Prize

Four-player card game. Choose one of two cards — one you can see, one you can't —
matching numbers cancel, and the highest unique number takes the Prize Card.

## Running it

Needs Node. No install step, no dependencies.

```bash
node server.js 8421
```

Then open <http://localhost:8421>.

`server.js` serves the game *and* runs accounts, friends, invites and online 1v1
matches. There is no separate static server any more.

## Playing with friends on your Wi-Fi

**Do not send anyone `localhost:8421`.** `localhost` always means *"the computer I am
using right now"*, so on their device that address points at their own machine, which
isn't running the server. It works for you and fails for everyone else.

Find your machine's local IP (`ipconfig` on Windows — look for IPv4 Address), then
have them open `http://YOUR-IP:8421`. They must be on the same Wi-Fi, and Windows
Firewall will ask you to allow Node the first time.

That still only covers people in the same building. For anyone further away — a
parent at work, a friend across town — there is no shortcut: the game has to be
hosted somewhere public, as below.

## Putting it online

Any host that runs Node works — Render, Railway, Fly.io. The server reads `PORT`
from the environment, so most hosts need no configuration beyond:

- **Build command:** none
- **Start command:** `node server.js`

**One thing to watch:** accounts live in `data.json` next to the server. Most free
tiers use an ephemeral filesystem, which means *that file is wiped on every deploy
and restart* — everyone's account and progress disappears. Before relying on it,
either attach a persistent disk (Render and Fly both offer one) and keep `data.json`
on it, or move accounts to a hosted database. This is fine for messing about with
friends; it is not fine if you want progress to actually stick.

Also use a host that terminates HTTPS (all of the above do). Passwords are hashed
before storage, but they still travel over the wire on the way in.

## Sharing it right now (temporary link)

`cloudflared` is installed. With the server running, in a second terminal:

```bash
cloudflared tunnel --url http://localhost:8421
```

It prints a `https://….trycloudflare.com` address that works from anywhere. Caveats:
it only lives while your PC, the server and the tunnel are all running, and **the
URL changes every time you restart it**.

## How multiplayer works

The server is authoritative. It deals the cards, collects every pick, decides the
winner and sends the result to all players. A client is only ever told its **own**
visible card, so nothing useful leaks into devtools and edited local state can't
change a result. Bots run on the server too, and no bot flag is ever sent to a
client — players shouldn't be able to tell who is real.

Events reach clients by **long-polling** (`/api/poll` is held open until something
happens, up to 20s). This started as Server-Sent Events, which worked locally but
died behind Cloudflare: CDNs buffer a streaming response until enough bytes pile up,
so an idle stream never flushed and no match ever started. Padding the stream didn't
help. A held request/response looks ordinary to every proxy, so long-polling works
through tunnels, CDNs and hosts alike — don't "optimise" it back to SSE.

Clients ping every 20 seconds. Miss them for 150 and the server treats you as gone
and hands your opponent the win. That window is deliberately generous because
browsers throttle background tabs to about one timer a minute. On startup a client
calls `/api/sync`, which returns any match already in progress — without it, a
refresh mid-match leaves you locked out of a match the server still has you in.

## Files

| file | what it does |
|---|---|
| `server.js` | static hosting, accounts, friends, invites, live matches |
| `data.json` | the database (created on first run) |
| `index.html` | all screens |
| `data.js` | arenas, modes, cosmetics, bots, challenges |
| `game.js` | local matches vs bots, UI, menus |
| `net.js` | server connection, friends, online matches |
| `save.js` | account + progression, synced to the server |
| `audio.js` | all sound, synthesized at runtime |
| `style.css` | flat 2D styling |
