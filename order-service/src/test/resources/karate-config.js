function fn() {
  var env = karate.env; // get system property 'karate.env'
  karate.log('karate.env system property is:', env);

  if (!env) {
    env = 'dev';
  }

  // Check for baseUrl system property (set by Spring Boot test)
  var baseUrlProp = java.lang.System.getProperty('karate.baseUrl');

  var config = {
    env: env,
    baseUrl: baseUrlProp ? baseUrlProp : 'http://localhost:8080'
  };

  karate.log('Using baseUrl:', config.baseUrl);

  // Configure timeouts
  karate.configure('connectTimeout', 10000);
  karate.configure('readTimeout', 30000);

  return config;
}
