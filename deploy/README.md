# Deployment on the punkt.de proServer

Language: ASD-STE100 (Simplified Technical English)

This guide is for the person who prepares the proServer. This can be the developer or the punkt.de support (see `PLAN slotlock.md`, 20.3a).

## 1. Requirements

1. SSH access for the application user.
2. nginx with TLS for the production domain.
3. Outgoing HTTPS to the Cheese Tracker, to the Archipelago host and to `discord.com`.

## 2. Prepare the application user

1. Install nvm for the application user.
2. Install the Node version from `.nvmrc`: `nvm install 26`.
3. Install pm2 for this Node version: `npm install -g pm2@latest`.
4. Install the log rotation: `pm2 install pm2-logrotate`.
5. Activate the start of pm2 after a reboot: `pm2 startup`. Run the command that pm2 shows. This step can need root rights.

## 3. Make the folders

```
~/slotlock/
├─ releases/
├─ shared/
│  ├─ .env.production
│  ├─ data/
│  └─ backups/
└─ current -> releases/<release>
```

1. Make the folders `~/slotlock/releases`, `~/slotlock/shared/data` and `~/slotlock/shared/backups`.
2. Copy `server/.env.production.example` to `~/slotlock/shared/.env.production`.
3. Replace all placeholders `<…>` in this file. The server does not start if a placeholder stays in the file.
4. Set the file permissions to `600`.

## 4. Configure nginx

1. Use `deploy/nginx.conf.example` as template.
2. Replace `<PRODUCTION_DOMAIN>` and the certificate paths.
3. Keep the `Upgrade` and `Connection` headers for `/socket.io/`. The live updates need them.
4. Set `TRUST_PROXY=true` in `.env.production`.

## 5. Configure Discord

1. Open the Discord application in the Discord Developer Portal.
2. Add the redirect URL `https://<PRODUCTION_DOMAIN>/api/auth/discord/callback`.
3. Copy client ID and client secret into `.env.production`.

## 6. Configure GitHub

1. Make an SSH key pair only for the deployment. Add the public key to `~/.ssh/authorized_keys` of the application user.
2. Add these secrets to the GitHub environment `production`:
   - `DEPLOY_SSH_KEY`: the private key.
   - `DEPLOY_KNOWN_HOSTS`: the output of `ssh-keyscan <host>`.
   - `DEPLOY_HOST`: the host name of the proServer.
   - `DEPLOY_USER`: the application user.
3. Optional: set the variable `DEPLOY_APP_ROOT` if the application folder is not `slotlock` in the home folder.

## 7. Deploy

1. Start the workflow "Deploy" manually, or push a tag `v*`.
2. The workflow runs all CI checks first.
3. The workflow builds the application and copies the release with rsync.
4. `deploy/post-deploy.sh` installs the production packages, makes a copy of the database, runs the migrations, changes the link `current` and reloads pm2.
5. If the health check `GET /api/health` fails, the script sets `current` back to the last release.
6. The script keeps the last 5 releases.

## 8. Operation

- Logs: `pm2 logs slotlock`.
- Status: `pm2 status`.
- Database backups: `~/slotlock/shared/backups`. Delete old backups from time to time.
