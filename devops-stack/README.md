# devops-stack

Local docker-compose lab simulating a CI/CD pipeline: GitLab (SCM), Jenkins (CI/CD), SonarQube (code quality), and an OpenLDAP directory that simulates a corporate Active Directory so the same "domain user" can log into all three tools.

## Services

| Service | URL | Purpose |
|---|---|---|
| GitLab | http://localhost:9003 | Source code management |
| Jenkins | http://localhost:9001 | CI/CD server |
| SonarQube | http://localhost:9000 | Code quality analysis |
| OpenLDAP | ldap://localhost:389 | Simulated Active Directory |

SSH for git operations: `localhost:2222`.

## Prerequisites

- Docker + Docker Compose
- A `.env` file in this directory with `LDAP_ADMIN_PASSWORD` set (see below)

## Quick start

```bash
docker compose up -d
```

Bring `openldap` up first if you want to confirm seeding before the other services start:

```bash
docker compose up -d openldap
```

GitLab and Jenkins can take a few minutes to fully boot on first start.

## Simulated Active Directory (OpenLDAP)

Rather than standing up a full IdP (Keycloak/OIDC/SAML) or a real AD domain controller (Samba), this stack uses a lightweight **OpenLDAP** directory as the shared identity source. "Login with your domain user" is fundamentally an LDAP bind, and GitLab CE, Jenkins, and SonarQube Community can all authenticate against plain LDAP directly — no extra IdP layer needed.

- Image: `osixia/openldap:1.5.0`
- Base DN: `dc=devops,dc=lab`
- People: `ou=people,dc=devops,dc=lab`
- Groups: `ou=groups,dc=devops,dc=lab`
- Bind DN (admin): `cn=admin,dc=devops,dc=lab`

Seed data lives in `ldap/bootstrap.ldif` and is auto-imported on first container start (mounted into the image's custom bootstrap LDIF path). It defines 4 sample domain users, all in a `developers` group:

| uid | Name | Password |
|---|---|---|
| jdoe | Jane Doe | `DomainUser123!` |
| asmith | Alice Smith | `DomainUser123!` |
| bwayne | Bruce Wayne | `DomainUser123!` |
| ckent | Clark Kent | `DomainUser123!` |

To add more users/groups, edit `ldap/bootstrap.ldif` and recreate the `openldap` container (seeding only happens when the underlying volumes are empty):

```bash
docker compose down -v openldap
docker compose up -d openldap
```

Verify seeding directly against the directory:

```bash
docker exec openldap ldapsearch -x -b dc=devops,dc=lab \
  -D cn=admin,dc=devops,dc=lab -w "$LDAP_ADMIN_PASSWORD"
```

### GitLab

LDAP is configured via `gitlab_rails['ldap_servers']` inside the `GITLAB_OMNIBUS_CONFIG` block in `docker-compose.yml` (no plugin needed — GitLab CE supports LDAP natively). A "Domain Login" tab appears on the sign-in page at http://localhost:9003.

The local `root` account still works as a fallback — it is unaffected by enabling LDAP.

### Jenkins

Jenkins needs plugins that aren't in the base image, so it's built from `jenkins/Dockerfile`:

```dockerfile
FROM jenkins/jenkins:lts
RUN jenkins-plugin-cli --plugins ldap configuration-as-code
```

The LDAP security realm is declared as code in `jenkins/casc.yaml` (Jenkins Configuration as Code), mounted into the container and loaded via the `CASC_JENKINS_CONFIG` env var — no manual UI configuration required.

**Caveat:** JCasC's `securityRealm` replaces Jenkins' authentication realm wholesale (unlike SonarQube, where local and LDAP auth coexist). If you need a break-glass account, capture Jenkins' initial admin credentials before this realm takes effect.

### SonarQube

No plugin or custom image needed. SonarQube Community Edition has had LDAP support built into core since v8.0 (the older standalone `sonar-ldap-plugin` only works up to 7.9.x and is not used here). LDAP is configured purely through environment variables on the `sonarqube` service:

```
SONAR_SECURITY_REALM=LDAP
SONAR_LDAP_URL=ldap://openldap:389
SONAR_LDAP_BINDDN=cn=admin,dc=devops,dc=lab
SONAR_LDAP_BINDPASSWORD=${LDAP_ADMIN_PASSWORD}
SONAR_LDAP_USER_BASEDN=ou=people,dc=devops,dc=lab
SONAR_LDAP_USER_REQUEST=(&(objectClass=inetOrgPerson)(uid={login}))
```

Unlike Jenkins, SonarQube allows local and LDAP accounts to authenticate side by side — the built-in `admin` account keeps working.

## Environment variables

Create a `.env` file (git-ignored) in this directory:

```
LDAP_ADMIN_PASSWORD=<choose-a-lab-password>
```

This single value is reused as the LDAP admin/bind password across the `openldap`, `gitlab`, `jenkins`, and `sonarqube` services.

## Verifying the login simulation

1. `docker exec openldap ldapsearch -x -b dc=devops,dc=lab -D cn=admin,dc=devops,dc=lab -w "$LDAP_ADMIN_PASSWORD"` — confirms the directory is seeded.
2. Log into GitLab (http://localhost:9003) as `jdoe` / `DomainUser123!` via the "Domain Login" tab.
3. Log into Jenkins (http://localhost:9001) as `jdoe` / `DomainUser123!`.
4. Log into SonarQube (http://localhost:9000) as `jdoe` / `DomainUser123!`, and confirm `admin`/`admin` still works as local fallback.
5. The same domain user/password should work across all three — this simulates shared corporate credentials (not a single browser SSO session, just a shared identity source).

## Repository layout

```
devops-stack/
├── docker-compose.yml       # All services: openldap, gitlab, jenkins, sonarqube, sonar_db
├── Jenkinsfile               # Pipeline for the order-service app built by this stack
├── .env                       # LDAP_ADMIN_PASSWORD (not committed)
├── ldap/
│   └── bootstrap.ldif        # Seed users/groups for the simulated AD directory
└── jenkins/
    ├── Dockerfile             # Preinstalls the ldap + configuration-as-code plugins
    └── casc.yaml               # JCasC: LDAP security realm configuration
```

## Summary
```
Docker daemon isn't running locally, so I couldn't do a live build/bring-up test, but docker compose config fully validates the compose file (services, env substitution, volumes) with no errors.

Summary of what was added:
- openldap service (osixia/openldap:1.5.0) seeded via ldap/bootstrap.ldif with 4 sample domain users (jdoe, asmith, bwayne, ckent, password DomainUser123!) in a developers group.
- GitLab: gitlab_rails['ldap_servers'] added to the omnibus config, binding to openldap. root login still works as fallback.
- Jenkins: now builds from jenkins/Dockerfile (preinstalls ldap + configuration-as-code plugins) and loads jenkins/casc.yaml, which sets the LDAP security realm. Note: this replaces Jenkins' local user database — grab the initial admin password before this takes effect if you need a break-glass account.
- SonarQube: LDAP auth configured purely via env vars (SONAR_LDAP_*) — no plugin needed since Community Edition has had LDAP built in since v8. The local admin account still works alongside it.
- .env holds LDAP_ADMIN_PASSWORD once, referenced everywhere; added to .gitignore so it isn't committed.

To actually try it: start Docker Desktop, then docker compose up -d (openldap needs to come up first and get seeded — the depends_on ordering handles that, but GitLab/Jenkins can take a few minutes to boot). Then log into all three at localhost:9003, localhost:9001, localhost:9000 with the same jdoe / DomainUser123! credentials to see the shared-directory login working.
```



## tokens

```

SonarQube token

1. Open http://localhost:9000
2. Log in with an LDAP user — e.g. jdoe / DomainUser123! (this uses the LDAP realm we fixed earlier). First login auto-creates the SonarQube account for that user.
3. Click your avatar (top right) → My Account → Security tab
4. Under "Generate Tokens": give it a name (e.g. mcp-server), leave type as "User Token", click Generate
5. Copy the token immediately — it's shown only once (format squ_...)
6. Paste it into ../mcp-servers/config.json under sonarqube.token


Jenkins token

1. Open http://localhost:9001
2. On the login page, sign in with an LDAP user — e.g. jdoe / DomainUser123! (Jenkins CasC already wires up the LDAP realm against openldap, per jenkins/casc.yaml)
3. Click your username (top right) → Configure (or go directly to http://localhost:9001/user/jdoe/configure)
4. Under API Token, click Add new Token, give it a name (e.g. mcp-server), click Generate
5. Copy the token immediately — shown only once
6. Paste it into ../mcp-servers/config.json under jenkins.token, and set jenkins.user to jdoe


GitLab token

1. Open http://localhost:9003
2. On the sign-in page you should see two tabs — Standard and LDAP (or a single form if GitLab auto-detects LDAP as primary). Use the LDAP/Domain Login tab with jdoe / DomainUser123!
  - Note: GitLab's base for LDAP in docker-compose.yml is ou=people,dc=devops,dc=lab, matching the bootstrap users, so this should just work
3. Once logged in, go to User avatar → Edit profile → Access Tokens (or http://localhost:9003/-/user_settings/personal_access_tokens)
4. Give it a name (e.g. mcp-server), pick an expiration date, select scopes — check api (this covers read/write repo, issues, MRs, pipelines)
5. Click Create personal access token, copy it immediately (glpat-... format)
6. Paste it into ../mcp-servers/config.json under gitlab.token

```


## MCP requests

```
Jenkins MCP (10 tools)

┌──────────────────────────┬───────────────────────────────────────────────────────┐
│           Tool           │                     What it does                      │
├──────────────────────────┼───────────────────────────────────────────────────────┤
│ jenkins_health_check     │ Confirm Jenkins is reachable                          │
├──────────────────────────┼───────────────────────────────────────────────────────┤
│ jenkins_list_jobs        │ List jobs (optionally by folder), with status         │
├──────────────────────────┼───────────────────────────────────────────────────────┤
│ jenkins_get_job          │ Job details: build history, last status, next build # │
├──────────────────────────┼───────────────────────────────────────────────────────┤
│ jenkins_get_job_config   │ Job's XML config                                      │
├──────────────────────────┼───────────────────────────────────────────────────────┤
│ jenkins_trigger_build    │ Trigger a build (supports parameters)                 │
├──────────────────────────┼───────────────────────────────────────────────────────┤
│ jenkins_get_build        │ Build details: status, duration, params, result       │
├──────────────────────────┼───────────────────────────────────────────────────────┤
│ jenkins_get_build_log    │ Console output of a build                             │
├──────────────────────────┼───────────────────────────────────────────────────────┤
│ jenkins_get_test_results │ Pass/fail counts + test case details                  │
├──────────────────────────┼───────────────────────────────────────────────────────┤
│ jenkins_abort_build      │ Stop a running build                                  │
├──────────────────────────┼───────────────────────────────────────────────────────┤
│ jenkins_get_queue        │ Status of a queued build item                         │
└──────────────────────────┴───────────────────────────────────────────────────────┘

GitLab MCP (19 tools)

┌─────────────────────────────┬─────────────────────────────────────────────┐
│            Tool             │                What it does                 │
├─────────────────────────────┼─────────────────────────────────────────────┤
│ gitlab_health_check         │ Confirm GitLab is reachable + current user  │
├─────────────────────────────┼─────────────────────────────────────────────┤
│ gitlab_list_projects        │ List projects (owned/member/search filters) │
├─────────────────────────────┼─────────────────────────────────────────────┤
│ gitlab_get_project          │ Project details                             │
├─────────────────────────────┼─────────────────────────────────────────────┤
│ gitlab_list_branches        │ List branches                               │
├─────────────────────────────┼─────────────────────────────────────────────┤
│ gitlab_create_branch        │ Create a branch                             │
├─────────────────────────────┼─────────────────────────────────────────────┤
│ gitlab_list_merge_requests  │ List MRs by state                           │
├─────────────────────────────┼─────────────────────────────────────────────┤
│ gitlab_get_merge_request    │ MR details                                  │
├─────────────────────────────┼─────────────────────────────────────────────┤
│ gitlab_create_merge_request │ Open a new MR                               │
├─────────────────────────────┼─────────────────────────────────────────────┤
│ gitlab_list_issues          │ List issues by state/labels                 │
├─────────────────────────────┼─────────────────────────────────────────────┤
│ gitlab_create_issue         │ Create an issue                             │
├─────────────────────────────┼─────────────────────────────────────────────┤
│ gitlab_list_pipelines       │ List CI/CD pipelines by status/ref          │
├─────────────────────────────┼─────────────────────────────────────────────┤
│ gitlab_get_pipeline         │ Pipeline details incl. jobs                 │
├─────────────────────────────┼─────────────────────────────────────────────┤
│ gitlab_trigger_pipeline     │ Trigger a pipeline run                      │
├─────────────────────────────┼─────────────────────────────────────────────┤
│ gitlab_cancel_pipeline      │ Cancel a running pipeline                   │
├─────────────────────────────┼─────────────────────────────────────────────┤
│ gitlab_retry_pipeline       │ Retry a failed pipeline                     │
├─────────────────────────────┼─────────────────────────────────────────────┤
│ gitlab_get_job_log          │ Log output of a CI job                      │
├─────────────────────────────┼─────────────────────────────────────────────┤
│ gitlab_list_commits         │ List commits                                │
├─────────────────────────────┼─────────────────────────────────────────────┤
│ gitlab_get_file             │ Read a file's content                       │
├─────────────────────────────┼─────────────────────────────────────────────┤
│ gitlab_list_tree            │ List files/dirs in repo                     │
├─────────────────────────────┼─────────────────────────────────────────────┤
│ gitlab_compare              │ Diff two branches/tags/commits              │
└─────────────────────────────┴─────────────────────────────────────────────┘

SonarQube MCP (13 tools)

┌────────────────────────────┬──────────────────────────────────────────────┐
│            Tool            │                 What it does                 │
├────────────────────────────┼──────────────────────────────────────────────┤
│ sonar_health_check         │ Confirm SonarQube is reachable + version     │
├────────────────────────────┼──────────────────────────────────────────────┤
│ sonar_list_projects        │ List projects (search/paginate)              │
├────────────────────────────┼──────────────────────────────────────────────┤
│ sonar_get_quality_gate     │ Pass/fail status + failing conditions        │
├────────────────────────────┼──────────────────────────────────────────────┤
│ sonar_get_metrics          │ Coverage, bugs, vulnerabilities, code smells │
├────────────────────────────┼──────────────────────────────────────────────┤
│ sonar_get_issues           │ Bugs/vulnerabilities/code smells, filterable │
├────────────────────────────┼──────────────────────────────────────────────┤
│ sonar_get_hotspots         │ Security hotspots needing review             │
├────────────────────────────┼──────────────────────────────────────────────┤
│ sonar_get_coverage         │ Line/branch coverage, uncovered lines        │
├────────────────────────────┼──────────────────────────────────────────────┤
│ sonar_get_duplications     │ Duplicate code for a file/component          │
├────────────────────────────┼──────────────────────────────────────────────┤
│ sonar_get_source           │ Source code with optional line range         │
├────────────────────────────┼──────────────────────────────────────────────┤
│ sonar_get_analysis_history │ Past analyses + quality gate changes         │
├────────────────────────────┼──────────────────────────────────────────────┤
│ sonar_get_tasks            │ Background analysis task status              │
├────────────────────────────┼──────────────────────────────────────────────┤
│ sonar_get_quality_gates    │ List configured quality gates                │
├────────────────────────────┼──────────────────────────────────────────────┤
│ sonar_get_rules            │ Search active analysis rules                 │
└────────────────────────────┴──────────────────────────────────────────────┘

Once you've got the three API tokens generated, send them over and I'll wire up config.json and smoke-test each of these (e.g. the three *_health_check tools first, since they're the quickest way to confirm end-to-end connectivity).

```
