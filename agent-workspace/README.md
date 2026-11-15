# PadhoSuno — External agent workspace

Teen kaam: **write** (notes), **speak** (audio), **check** (textbook verification).

**Muse pilot:** [Issue #1](https://github.com/UDAYRAJ01/classwise-listen-and-learn/issues/1) — CBSE Class 2 English, Mridang, My Bicycle (`en`), write + check. Read [material instructions](materials/pilot-my-bicycle/README.md) first; use `task: 1`. Package includes the current three-language missing inventory, exact NCERT text, source hash and three existing textbook-check-pass references (not human-approved). No audio or production import in this pilot.

1. GitHub repository → Issues → New issue → **Agent — Notes / Audio / Jaanch**.
2. Class, board, chapter, language aur official source dein. Agent ko repository read aur branch/PR access dein; owner account/token na dein.
3. Agent `AGENTS.md` aur `docs/AGENT_PIPELINE.md` padhe, apni branch mein submissions banaye aur pull request bheje. GitHub push na ho to write/check JSON files bina badle `POST /api/public/agent?action=submit` par key ke saath bhej de (details `docs/AGENT_PIPELINE.md` mein).
4. Actions → **Agent draft checks** notes ka format, audio ka format/text matching aur existing tests check karta hai. Run manually bhi kar sakte hain.
5. Owner factual review kare. Merge se repository ka code Lovable Git sync ke through aa sakta hai; notes/audio ke JSON/WAV sirf drafts rehte hain.
6. Approved PR ke baad Lovable mein boliye: **“Agent PR ke approved notes/audio review karke app mein lagao.”** Data import abhi manual reviewed step hai; is workflow mein Cloud access ya automatic import nahi hai.

**Koi paid AI/audio batch start nahi hota.** External agent ke provider aur GitHub Actions ki apni billing ho sakti hai.

## Khud kaam uthao (task queue)

Chapter ba chapter maangne ki zaroorat nahi. Agent key ke saath:

1. `GET /api/public/agent?action=tasks&status=open&limit=25` — khali chapters ki list (board/grade/subject/language se filter kar sakte ho).
2. `POST /api/public/agent?action=claim&id=N` — task apne naam karo, taaki koi aur dobara na likhe.
3. `GET /api/public/agent?action=task&id=N` — us chapter ka asli textbook text + uska SHA-256, 3 checked sample notes, aur app ke apne teacher instructions.
4. Write aur check JSON bina badle `POST /api/public/agent?action=submit` par bhejo. Dono mein `task` = GitHub issue number (pilot ke liye `1`), queue ka id nahi — queue id sirf claim aur material ke liye hai.

`status=blocked` wale chapters ke paas textbook text nahi hai — unhe mat likho. Queue row tab tak `claimed` rehti hai jab tak owner notes app mein na laga de; phir `applied`. Restart ke baad apne claimed tasks wapas paane ke liye `GET /api/public/agent?action=tasks&status=claimed`.

GitHub connection Lovable ke **More → Git** se user jodta hai. Yeh files us panel ko change nahi kartin; section GitHub repository mein milega. Agent ko live Cloud data, stored textbooks, notes/audio ya credentials automatically nahi milte. Owner sirf authorized chapter material share kare.
