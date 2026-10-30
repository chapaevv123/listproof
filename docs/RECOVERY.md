# Environment recovery on the owner's Windows session

In an earlier restricted session, npm DNS resolved but TCP/443 and `npm ping` returned `EACCES`. The owner subsequently reported Bun 1.4.4, CRE CLI 1.39.0 and Docker 29.9.2 available in ordinary PowerShell. In this sandbox, Bun is executable by absolute path and TypeScript typecheck passes; CRE is absent from PATH and Docker's named pipe returns permission denied. This does not establish a VPN, proxy or certificate problem. Avoid changing boot settings, antivirus, firewall or execution policy for this project.

From an ordinary PowerShell session with permitted internet access, verify the transport first:

```powershell
Resolve-DnsName registry.npmjs.org
Test-NetConnection registry.npmjs.org -Port 443
npm.cmd ping --fetch-retries=0 --fetch-timeout=5000
```

The owner already has Bun and authenticated CRE CLI in ordinary PowerShell. If a tool is missing in a fresh session, consult the [official CRE Windows installer](https://docs.chain.link/cre/getting-started/cli-installation/windows), [Bun installer](https://bun.com/docs/installation), and [Foundry installation guide](https://getfoundry.sh/introduction/installation). Install only under your own user profile where possible. Exact project commands are in the README.

The repository itself is currently uncommitted. `.git/index.lock` is absent and no Git process was found. The sandbox has explicit DENY write permissions on `.git`; `safe.directory` resolves ownership trust but **cannot** override that denial. From the owner's normal PowerShell session, in this ListProof directory:

```powershell
git -c safe.directory=C:/Users/Win10_Game_OS/Pulse/projects/listproof status --short
git -c safe.directory=C:/Users/Win10_Game_OS/Pulse/projects/listproof add .
git -c safe.directory=C:/Users/Win10_Game_OS/Pulse/projects/listproof commit -m "Build ListProof proof pipeline, CRE workflow and demo"
```

Review `git status --short` before staging. Do not remove `.git/index.lock` unless a future lock exists, is proven stale, and no Git process is running. The current blocker is directory write permission, not a lock file.
