# Continuous Build and Delivery — Assignment 2

A complete CI/CD pipeline demonstration for the **Order Service** microservice, covering version control, automated build, static code analysis, multi-level testing, containerisation, and automated Ansible deployment — all running locally.

---

## Microservice: Order Service

A Spring Boot REST API for managing customers and orders.

| Property | Value |
|---|---|
| Framework | Spring Boot 4.0.3 |
| Language | Java 21 |
| Build Tool | Maven |
| Database | H2 (dev/test), MySQL (prod) |
| Port | 8081 |
| Service Discovery | Spring Cloud Eureka Client |

### REST Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/customers` | Create a customer |
| `GET` | `/api/customers/{id}` | Get customer by ID |
| `GET` | `/api/customers?page=0&size=10` | List all customers (paginated) |
| `PUT` | `/api/customers/{id}` | Update a customer |
| `DELETE` | `/api/customers/{id}` | Delete a customer |
| `GET` | `/api/customers/{id}/orders` | Get orders for a customer |
| `POST` | `/api/orders` | Place a new order |
| `GET` | `/api/orders/{id}` | Get order by ID |
| `GET` | `/api/orders?page=0&size=10` | List all orders (paginated) |
| `PUT` | `/api/orders/{id}` | Update an order |
| `PATCH` | `/api/orders/{id}/status` | Update order status |
| `DELETE` | `/api/orders/{id}` | Delete an order |

### Order Status Lifecycle

```
PENDING → CONFIRMED
PENDING → CANCELLED
(CONFIRMED and CANCELLED orders cannot be reverted to PENDING)
```

---

## Project Structure

```
.
├── order-service/                        # Spring Boot microservice
│   ├── src/
│   │   ├── main/java/com/tus/orderservice/
│   │   │   ├── controller/               # REST controllers
│   │   │   ├── service/                  # Business logic
│   │   │   ├── repository/               # JPA repositories
│   │   │   ├── entity/                   # JPA entities
│   │   │   ├── dto/                      # Request/Response DTOs
│   │   │   └── exception/                # Global exception handling
│   │   └── test/java/com/tus/orderservice/
│   │       ├── service/                  # Unit tests (Mockito)
│   │       ├── controller/               # Controller tests (MockMvc)
│   │       ├── integration/              # Integration tests (H2)
│   │       └── karate/                   # End-to-end API tests (Karate)
│   ├── Dockerfile
│   └── pom.xml
├── ansible/                              # Ansible deployment
│   ├── inventory.ini
│   ├── deploy.yml
│   └── vars/
│       └── main.yml
├── Jenkinsfile                           # Pipeline definition
└── README.md
```

---

## CI/CD Architecture

```
Developer pushes code to GitHub
          │
          ▼
    GitHub Webhook
          │
          ▼
  Jenkins (localhost:9001)
          │
          ├─ Stage 1: Checkout
          ├─ Stage 2: Build (Maven → .jar)
          ├─ Stage 3: Unit Tests (JUnit + JaCoCo)
          ├─ Stage 4: Integration Tests
          ├─ Stage 5: E2E Tests (Karate)
          ├─ Stage 6: Code Analysis + Quality Gate (SonarQube)
          ├─ Stage 7: Docker Build
          └─ Stage 8: Deploy (Ansible)
                    │
                    ▼
          App live at http://localhost:8081
```

Every stage failure stops the pipeline immediately.

---

## Local Infrastructure Setup

All CI/CD infrastructure runs locally via Docker Compose. No cloud account required.

### Step 1 — Start Jenkins and SonarQube

Create `~/cicd-infra/docker-compose.yml`:

```yaml
version: '3.8'

services:
  jenkins:
    image: jenkins/jenkins:lts
    container_name: jenkins
    ports:
      - "9001:8080"
      - "50000:50000"
    volumes:
      - jenkins_home:/var/jenkins_home
      - /var/run/docker.sock:/var/run/docker.sock
    environment:
      - JAVA_OPTS=-Djenkins.install.runSetupWizard=false

  sonarqube:
    image: sonarqube:community
    container_name: sonarqube
    ports:
      - "9000:9000"
    environment:
      - SONAR_JDBC_URL=jdbc:postgresql://sonar_db:5432/sonar
      - SONAR_JDBC_USERNAME=sonar
      - SONAR_JDBC_PASSWORD=sonar
    depends_on:
      - sonar_db
    volumes:
      - sonarqube_data:/opt/sonarqube/data

  sonar_db:
    image: postgres:15
    environment:
      - POSTGRES_USER=sonar
      - POSTGRES_PASSWORD=sonar
      - POSTGRES_DB=sonar
    volumes:
      - sonar_db_data:/var/lib/postgresql/data

volumes:
  jenkins_home:
  sonarqube_data:
  sonar_db_data:
```

```bash
cd ~/cicd-infra
docker compose up -d
```

| Service | URL | Default Credentials |
|---|---|---|
| Jenkins | http://localhost:9001 | admin / admin |
| SonarQube | http://localhost:9000 | admin / admin |

---

## Test Strategy

The test suite follows the **Test Pyramid** with three levels:

### Level 1 — Unit Tests (Service layer)

Located in `order-service/src/test/java/com/tus/orderservice/service/`

- `OrderServiceTest` — 14 tests covering order creation, retrieval, status transitions, update, and delete
- `CustomerServiceTest` — covers customer CRUD and duplicate email validation

Uses **Mockito** to isolate the service from the database. Fast, no Spring context needed.

```bash
cd order-service
./mvnw test -Dtest="OrderServiceTest,CustomerServiceTest"
```

### Level 2 — Controller Tests (API layer)

Located in `order-service/src/test/java/com/tus/orderservice/controller/`

- `OrderControllerTest` — tests HTTP request/response mappings via MockMvc
- `CustomerControllerTest` — tests HTTP request/response mappings via MockMvc

Uses **MockMvc** with mocked services. Tests JSON serialisation and HTTP status codes without a running server.

```bash
./mvnw test -Dtest="OrderControllerTest,CustomerControllerTest"
```

### Level 3 — Integration Tests

Located in `order-service/src/test/java/com/tus/orderservice/integration/`

- `CustomerIntegrationTest` — full Spring context with real H2 database
- `OrderIntegrationTest` — full Spring context with real H2 database
- `OrderWorkflowIntegrationTest` — end-to-end order lifecycle (PENDING → CONFIRMED → CANCELLED)

```bash
./mvnw test -Dtest="CustomerIntegrationTest,OrderIntegrationTest,OrderWorkflowIntegrationTest"
```

### Level 4 — End-to-End API Tests (Karate)

Located in `order-service/src/test/java/karate/`

- `customers.feature` — BDD-style HTTP tests against the running app
- `orders.feature` — BDD-style HTTP tests against the running app
- `KarateSpringBootTest` — boots the embedded server automatically for CI

```bash
./mvnw test -Dtest="KarateSpringBootTest"
```

### Run All Tests

```bash
cd order-service
./mvnw verify
```

---

## Jenkins Pipeline

The full pipeline is defined in `Jenkinsfile` at the repo root:

```groovy
pipeline {
    agent any

    environment {
        SONAR_HOST_URL = 'http://sonarqube:9000'
        SONAR_TOKEN    = credentials('sonar-token')
        APP_NAME       = 'order-service'
        APP_PORT       = '8081'
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Build') {
            steps {
                dir('order-service') {
                    sh './mvnw clean package -DskipTests'
                    archiveArtifacts artifacts: 'target/*.jar', fingerprint: true
                }
            }
        }

        stage('Unit Tests') {
            steps {
                dir('order-service') {
                    sh './mvnw test -Dtest="OrderServiceTest,CustomerServiceTest,OrderControllerTest,CustomerControllerTest"'
                }
            }
            post {
                always {
                    junit 'order-service/target/surefire-reports/*.xml'
                }
            }
        }

        stage('Integration Tests') {
            steps {
                dir('order-service') {
                    sh './mvnw test -Dtest="CustomerIntegrationTest,OrderIntegrationTest,OrderWorkflowIntegrationTest"'
                }
            }
        }

        stage('E2E Tests (Karate)') {
            steps {
                dir('order-service') {
                    sh './mvnw test -Dtest="KarateSpringBootTest"'
                }
            }
        }

        stage('Code Analysis & Quality Gate') {
            steps {
                dir('order-service') {
                    sh """
                        ./mvnw sonar:sonar \
                            -Dsonar.projectKey=${APP_NAME} \
                            -Dsonar.host.url=${SONAR_HOST_URL} \
                            -Dsonar.login=${SONAR_TOKEN}
                    """
                }
            }
        }

        stage('Docker Build') {
            steps {
                dir('order-service') {
                    sh "docker build -t ${APP_NAME}:${BUILD_NUMBER} ."
                    sh "docker tag ${APP_NAME}:${BUILD_NUMBER} ${APP_NAME}:latest"
                }
            }
        }

        stage('Deploy') {
            steps {
                sh """
                    ansible-playbook ansible/deploy.yml \
                        -i ansible/inventory.ini \
                        -e "app_image=${APP_NAME}:${BUILD_NUMBER}"
                """
            }
        }
    }

    post {
        success { echo "Pipeline succeeded — Order Service live at http://localhost:${APP_PORT}" }
        failure { echo 'Pipeline FAILED — check the stage logs above' }
    }
}
```

### Pipeline Stage Summary

| Stage | Tool | Fails Pipeline? |
|---|---|---|
| Checkout | Git | Yes |
| Build | Maven | Yes |
| Unit Tests | JUnit 5 + Mockito | Yes |
| Integration Tests | JUnit 5 + H2 | Yes |
| E2E Tests | Karate | Yes |
| Code Analysis & Quality Gate | SonarQube | Yes |
| Docker Build | Docker | Yes |
| Deploy | Ansible | Yes |

---

## Jenkins Setup

### Required Plugins

Install via **Manage Jenkins → Plugins**:

- Git
- Pipeline
- SonarQube Scanner
- JUnit
- Docker Pipeline
- Ansible

### Credentials

Add via **Manage Jenkins → Credentials**:

| ID | Type | Value |
|---|---|---|
| `sonar-token` | Secret text | Token from http://localhost:9000/account/security |
| `github-token` | Username/Password | GitHub personal access token |

### SonarQube Server

In **Manage Jenkins → Configure System → SonarQube servers**:

- Name: `SonarQube`
- URL: `http://sonarqube:9000`
- Authentication token: select `sonar-token`

### Pipeline Job

1. **New Item → Pipeline**
2. Definition: **Pipeline script from SCM**
3. SCM: Git → your GitHub repo URL
4. Script Path: `Jenkinsfile`

### GitHub Webhook

In your GitHub repo → **Settings → Webhooks → Add webhook**:

- Payload URL: `http://<your-ip>:9001/github-webhook/`
- Content type: `application/json`
- Event: **Just the push event**

> Use `ngrok http 9001` to expose localhost to GitHub if needed.

---

## SonarQube Quality Gate

### Add SonarQube Plugin to pom.xml

The `order-service/pom.xml` already includes JaCoCo. Add the SonarQube plugin:

```xml
<plugin>
    <groupId>org.sonarsource.scanner.maven</groupId>
    <artifactId>sonar-maven-plugin</artifactId>
    <version>3.10.0.2594</version>
</plugin>
```

### Configure Quality Gate

In SonarQube (http://localhost:9000):

1. **Quality Gates → Create** — name it `Order Service Gate`
2. Add conditions:

| Metric | Condition | Threshold |
|---|---|---|
| Coverage | Less than | 80% |
| Blocker Issues | Greater than | 0 |
| Critical Issues | Greater than | 0 |

3. **Project Settings → Quality Gate** → assign `Order Service Gate`

The pipeline fails automatically if any condition is not met.

---

## Ansible Deployment

Ansible handles the deploy stage. It is idempotent — running it twice has the same effect as running it once.

### Install Ansible

```bash
brew install ansible
ansible-galaxy collection install community.docker
```

### File Structure

```
ansible/
├── inventory.ini      # Target hosts (localhost)
├── deploy.yml         # Deployment playbook
└── vars/
    └── main.yml       # Configurable variables
```

### inventory.ini

```ini
[local]
localhost ansible_connection=local
```

`ansible_connection=local` runs all tasks directly on the same machine — no SSH required.

### vars/main.yml

```yaml
app_name: order-service
app_image: order-service:latest
app_port: 8081
container_port: 8081
app_env: production
health_check_retries: 10
health_check_delay: 5
```

### deploy.yml

```yaml
---
- name: Deploy Order Service locally
  hosts: local
  become: false
  vars_files:
    - vars/main.yml

  tasks:
    - name: Stop existing container (if running)
      community.docker.docker_container:
        name: "{{ app_name }}"
        state: stopped
      ignore_errors: true

    - name: Remove existing container
      community.docker.docker_container:
        name: "{{ app_name }}"
        state: absent
      ignore_errors: true

    - name: Start new container
      community.docker.docker_container:
        name: "{{ app_name }}"
        image: "{{ app_image }}"
        state: started
        restart_policy: unless-stopped
        ports:
          - "{{ app_port }}:{{ container_port }}"
        env:
          SPRING_PROFILES_ACTIVE: "{{ app_env }}"

    - name: Wait for Order Service to be healthy
      uri:
        url: "http://localhost:{{ app_port }}/actuator/health"
        method: GET
        status_code: 200
      register: health_check
      retries: "{{ health_check_retries }}"
      delay: "{{ health_check_delay }}"
      until: health_check.status == 200

    - name: Confirm deployment
      debug:
        msg: "Order Service deployed successfully at http://localhost:{{ app_port }}"
```

### Run Deployment Manually

```bash
# Deploy
ansible-playbook ansible/deploy.yml -i ansible/inventory.ini

# Dry run (no changes applied)
ansible-playbook ansible/deploy.yml -i ansible/inventory.ini --check

# Override image tag
ansible-playbook ansible/deploy.yml -i ansible/inventory.ini \
    -e "app_image=order-service:42"
```

### Why Ansible Over a Shell Script

| | Shell script | Ansible playbook |
|---|---|---|
| Readable | Hard to follow | Self-documenting YAML |
| Idempotent | Must handle failures manually | Built-in (`state: started/absent`) |
| Health check | `sleep` hacks | `uri` module with configurable retries |
| Meets assignment requirement | No | Yes — Ansible is explicitly required |
| Reusable (local → cloud) | No | Yes — swap `inventory.ini` |

---

## Dockerfile

Located at `order-service/Dockerfile`. Multi-stage, non-root user:

```dockerfile
FROM eclipse-temurin:21-jre-jammy AS base
WORKDIR /app
RUN addgroup --system --gid 1001 appuser && \
    adduser --system --uid 1001 --ingroup appuser appuser

FROM base AS runtime
COPY --chown=appuser:appuser target/*.jar app.jar
USER appuser
EXPOSE 8081
ENTRYPOINT ["java", "-jar", "app.jar"]
```

Build and run manually:

```bash
cd order-service
./mvnw clean package -DskipTests
docker build -t order-service:latest .
docker run -p 8081:8081 order-service:latest
```

---

## Build Commands

```bash
cd order-service

./mvnw clean package              # Build the .jar
./mvnw clean package -DskipTests  # Build without tests
./mvnw test                        # Run all tests
./mvnw verify                      # Build + all tests
./mvnw spring-boot:run             # Run locally (H2)
```

---

## Quickstart

```bash
# 1. Start Jenkins and SonarQube
cd ~/cicd-infra && docker compose up -d

# 2. Install Ansible
brew install ansible
ansible-galaxy collection install community.docker

# 3. Push your code
git add . && git commit -m "feat: order service with pipeline" && git push

# 4. Watch the pipeline at http://localhost:9001

# 5. Check the deployed app
curl http://localhost:8081/actuator/health
curl http://localhost:8081/api/orders
```
