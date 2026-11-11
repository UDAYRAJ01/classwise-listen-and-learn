# PadhoSuno — External agent workspace

Teen kaam: **write** (notes), **speak** (audio), **check** (textbook verification).

1. GitHub repository → Issues → New issue → **Agent — Notes / Audio / Jaanch**.
2. Class, board, chapter, language aur official source dein. Agent ko repository read aur branch/PR access dein; owner account/token na dein.
3. Agent `AGENTS.md` aur `docs/AGENT_PIPELINE.md` padhe, apni branch mein submissions banaye aur pull request bheje.
4. Actions → **Agent draft checks** notes ka format, audio ka format/text matching aur existing tests check karta hai. Run manually bhi kar sakte hain.
5. Owner factual review kare. Merge se repository ka code Lovable Git sync ke through aa sakta hai; notes/audio ke JSON/WAV sirf drafts rehte hain.
6. Approved PR ke baad Lovable mein boliye: **“Agent PR ke approved notes/audio review karke app mein lagao.”** Data import abhi manual reviewed step hai; is workflow mein Cloud access ya automatic import nahi hai.

**Koi paid AI/audio batch start nahi hota.** External agent ke provider aur GitHub Actions ki apni billing ho sakti hai.

GitHub connection Lovable ke **More → Git** se user jodta hai. Yeh files us panel ko change nahi kartin; section GitHub repository mein milega. Agent ko live Cloud data, stored textbooks, notes/audio ya credentials automatically nahi milte. Owner sirf authorized chapter material share kare.
