FROM sonarqube:community

ARG LDAP_ADMIN_PASSWORD

USER root
COPY sonar.properties /opt/sonarqube/conf/sonar.properties
RUN sed -i "s|__LDAP_ADMIN_PASSWORD__|${LDAP_ADMIN_PASSWORD}|" /opt/sonarqube/conf/sonar.properties && \
    chown sonarqube:root /opt/sonarqube/conf/sonar.properties && \
    chmod 640 /opt/sonarqube/conf/sonar.properties
USER sonarqube
