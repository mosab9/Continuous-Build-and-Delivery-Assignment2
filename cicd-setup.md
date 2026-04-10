# CI/CD Setup Guide — Step by Step

Follow these steps in order. Each step must be completed before moving to the next.

---

## Prerequisites

Make sure these are installed before starting:

```bash
brew install ansible
brew install --cask docker
ansible-galaxy collection install community.docker
```

Verify:

```bash
docker --version
ansible --version
```

---

## Step 1 — Start Jenkins and SonarQube

From the repo root, run:

```bash
docker compose up -d
```

Wait about 60 seconds for both services to fully start, then verify:

```bash
docker ps
```

You should see three containers running:

```
jenkins      → http://localhost:9001
sonarqube    → http://localhost:9000
sonar_db     → (internal, no browser access)
```

---

## Step 2 — Unlock Jenkins

1. Open http://localhost:9001 in your browser
2. You will see an **"Unlock Jenkins"** screen asking for an initial admin password
3. Get the password by running:

```bash
docker exec jenkins cat /var/jenkins_home/secrets/initialAdminPassword
```

4. Copy the output and paste it into the browser
5. Click **Continue**

---

## Step 3 — Install Suggested Plugins

1. On the **"Customize Jenkins"** screen, click **"Install suggested plugins"**
2. Wait for all plugins to finish installing (this takes 2–3 minutes)
3. Once done, you will be taken to the **"Create First Admin User"** screen

---

## Step 4 — Create Admin User

Fill in the form:

| Field | Value |
|---|---|
| Username | `admin` |
| Password | choose a password |
| Full name | your name |
| Email | your email |

Click **Save and Continue → Save and Finish → Start using Jenkins**

---

## Step 5 — Install Additional Plugins

Some required plugins are not included in the suggested set.

1. Go to **Manage Jenkins** (left sidebar)
2. Click **Plugins**
3. Click the **Available plugins** tab
4. Search and install each of the following (tick all, then click **Install** once):

| Plugin | Why |
|---|---|
| `SonarQube Scanner` | Sends analysis results to SonarQube |
| `Docker Pipeline` | Allows Docker commands inside pipeline |
| `Ansible` | Allows Ansible playbook steps in pipeline |

5. Tick **"Restart Jenkins when installation is complete"** at the bottom
6. Wait for Jenkins to restart and log back in

---

## Step 6 — Generate a SonarQube Token

Before configuring Jenkins, you need a token from SonarQube.

1. Open http://localhost:9000 in your browser
2. Log in with `admin` / `admin`
3. You will be prompted to change the password — set a new one and remember it
4. Click your avatar (top right) → **My Account**
5. Click the **Security** tab
6. Under **"Generate Tokens"**:
   - Name: `jenkins-token`
   - Type: `Global Analysis Token`
   - Expiry: `No expiration`
7. Click **Generate**
8. **Copy the token immediately** — it will not be shown again

---

## Step 7 — Add SonarQube Token to Jenkins Credentials

1. In Jenkins, go to **Manage Jenkins → Credentials**
2. Click **(global)** under the "Stores scoped to Jenkins" section
3. Click **Add Credentials** (left sidebar)
4. Fill in the form:

| Field | Value |
|---|---|
| Kind | `Secret text` |
| Secret | paste the SonarQube token you copied |
| ID | `sonar-token` |
| Description | `SonarQube analysis token` |

5. Click **Create**

---

## Step 8 — Add GitHub Token to Jenkins Credentials (if repo is private)

Skip this step if your repo is public.

1. Go to https://github.com/settings/tokens
2. Click **Generate new token (classic)**
3. Give it a name, set expiry, and tick `repo` scope
4. Click **Generate token** and copy it
5. Back in Jenkins → **Manage Jenkins → Credentials → (global) → Add Credentials**:

| Field | Value |
|---|---|
| Kind | `Username with password` |
| Username | your GitHub username |
| Password | paste the GitHub token |
| ID | `github-token` |
| Description | `GitHub access token` |

6. Click **Create**

---

## Step 9 — Configure SonarQube Server in Jenkins

1. Go to **Manage Jenkins → System**
2. Scroll down to the **SonarQube servers** section
3. Tick **"Environment variables"** checkbox if not already ticked
4. Click **Add SonarQube**
5. Fill in:

| Field | Value |
|---|---|
| Name | `SonarQube` |
| Server URL | `http://sonarqube:9000` |
| Server authentication token | select `sonar-token` from dropdown |

> Use `http://sonarqube:9000` (not `localhost`) because Jenkins runs inside Docker and uses the container name to reach SonarQube.

6. Click **Save**

---

## Step 10 — Configure SonarQube Scanner Tool

1. Go to **Manage Jenkins → Tools**
2. Scroll down to **SonarQube Scanner installations**
3. Click **Add SonarQube Scanner**
4. Fill in:

| Field | Value |
|---|---|
| Name | `SonarScanner` |
| Install automatically | ticked |

5. Click **Save**

---

## Step 11 — Create the Pipeline Job

1. From the Jenkins home page, click **New Item**
2. Enter name: `order-service-pipeline`
3. Select **Pipeline** and click **OK**
4. In the configuration page:

**General section:**
- Tick **"GitHub project"**
- Enter your repo URL: `https://github.com/<your-username>/Continuous-Build-and-Delivery-Assignment2`

**Build Triggers section:**
- Tick **"GitHub hook trigger for GITScm polling"**

**Pipeline section:**
- Definition: `Pipeline script from SCM`
- SCM: `Git`
- Repository URL: `https://github.com/<your-username>/Continuous-Build-and-Delivery-Assignment2`
- Credentials: select `github-token` (or leave empty if repo is public)
- Branch: `*/main`
- Script Path: `Jenkinsfile`

5. Click **Save**

---

## Step 12 — Set Up GitHub Webhook (Auto-trigger on Push)

This makes Jenkins automatically run the pipeline every time you push code to GitHub.

### Get your machine's IP

```bash
ipconfig getifaddr en0
```

Example output @: `192.168.1.45`

### Add the webhook in GitHub

1. Go to your GitHub repo → **Settings → Webhooks → Add webhook**
2. Fill in:

| Field | Value |
|---|---|
| Payload URL | `http://192.168.1.45:9001/github-webhook/` |
| Content type | `application/json` |
| Which events | `Just the push event` |

3. Click **Add webhook**
4. GitHub will send a ping — you should see a green tick next to the webhook

> If GitHub cannot reach your machine (e.g. you are on a university network), use ngrok:
> ```bash
> brew install ngrok
> ngrok http 9001
> ```
> Use the `https://xxxx.ngrok.io` URL as the Payload URL instead.

---

## Step 13 — Add SonarQube Plugin to order-service pom.xml

The SonarQube Maven plugin is not yet in the `order-service/pom.xml`. Add it inside the `<plugins>` section:

```xml
<plugin>
    <groupId>org.sonarsource.scanner.maven</groupId>
    <artifactId>sonar-maven-plugin</artifactId>
    <version>3.10.0.2594</version>
</plugin>
```

---

## Step 14 — Configure SonarQube Quality Gate

1. Open http://localhost:9000
2. Go to **Quality Gates** (top menu)
3. Click **Create**
4. Name it: `Order Service Gate`
5. Click **Add Condition** and add these two:

| Metric | Operator | Value |
|---|---|---|
| Coverage | is less than | `80` |
| Blocker Issues | is greater than | `0` |

6. Click **Set as Default** or assign it to your project:
   - Go to your project → **Project Settings → Quality Gate**
   - Select `Order Service Gate`

---

## Step 15 — Run the Pipeline

### Option A — Trigger manually

1. Go to Jenkins home → click `order-service-pipeline`
2. Click **Build Now** (left sidebar)
3. Click the build number that appears under **Build History**
4. Click **Console Output** to watch it run live

### Option B — Trigger via git push

```bash
git add .
git commit -m "trigger pipeline"
git push
```

Jenkins will pick it up automatically via the webhook.

---

## Verify Everything Works

After a successful pipeline run:

```bash
# App is running
curl http://localhost:8081/actuator/health

# List orders
curl http://localhost:8081/api/orders

# SonarQube report
open http://localhost:9000/dashboard?id=order-service
```

---

## Troubleshooting

| Problem | Fix |
|---|---|
| Jenkins not loading at :9001 | Run `docker compose up -d` and wait 60 seconds |
| SonarQube not loading at :9000 | Run `docker logs sonarqube` to check for errors |
| Pipeline fails at SonarQube stage | Check that `sonar-token` credential ID matches exactly |
| `sonarqube:9000` unreachable from Jenkins | Ensure both containers are on the same Docker network (docker compose handles this automatically) |
| Ansible step fails | Run `ansible-galaxy collection install community.docker` on the Jenkins container |
| Docker build fails inside Jenkins | Ensure `/var/run/docker.sock` is mounted in `docker-compose.yml` |
| GitHub webhook not triggering | Check your machine IP and ensure port 9001 is reachable, or use ngrok |
