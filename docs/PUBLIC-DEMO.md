# Public demo preparation (not published)

The [Dockerfile](../Dockerfile) builds the existing zero-dependency Node server and includes saved local and Registry-read CRE simulation transcripts. It serves only synthetic fixtures. The page shows local proof results and explicitly states that no chain transaction is represented.

Local smoke test in ordinary owner PowerShell:

```powershell
cd C:\Users\Win10_Game_OS\Pulse\projects\listproof
docker build -t listproof-demo:local .
docker run --rm -p 4173:4173 listproof-demo:local
# In another window:
Invoke-RestMethod http://127.0.0.1:4173/api/health
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:4173/evidence/cre-local-simulation.txt
```

For a free Node/Docker host the owner already controls, deploy this repository as a Docker service, expose the host-provided `PORT`, and health-check `/api/health`. The Dockerfile sets `LISTPROOF_HOST=0.0.0.0`. Use HTTPS and verify from a separate network that `/`, `/api/state`, `/dataset/2`, and the CRE evidence link load. Record the **actual** URL in the README and submission draft only after external verification. Public hosting, account creation, GitHub push and form submission require owner approval.

One currently documented free option is a [Render Free Web Service](https://render.com/docs/free) using this repository's Dockerfile. Render's [web-service guide](https://render.com/docs/web-services) supports Docker and a public `onrender.com` URL. Select **Free**, set health path `/api/health`, and verify `/api/sepolia` from outside the local network. Free services can sleep after inactivity, so open the demo shortly before judging. This is a hosting preparation step only; no Render account or service was created here.

The public Docker image runs only `scripts/server.mjs`. It does not mount the wallet, `deploy-ui`, ignored deployment evidence, or the localhost-only signing server. `data/sepolia-public.json` contains public contract addresses and transaction links; it includes six successful read-only Gate calls captured at block 12026859.

The public dataset URL for CRE must point to `/dataset/2` on that real host and return byte-identical JSON with SHA-256 `0xc2517b4c734fa5c5189324244325b5766aa534024c89b4670daf279347ca7a92`. Do not configure a live DON with `localhost`. Do not present the proof UI as a public sanctions-screening service.
