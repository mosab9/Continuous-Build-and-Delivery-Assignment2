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
        success {
            echo "Pipeline succeeded — Order Service live at http://localhost:${APP_PORT}"
        }
        failure {
            echo 'Pipeline FAILED — check the stage logs above'
        }
    }
}
