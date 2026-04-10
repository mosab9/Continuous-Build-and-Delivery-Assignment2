package karate;

import com.intuit.karate.junit5.Karate;
import org.junit.jupiter.api.Disabled;

/**
 * Standalone Karate test runner - requires the application to be running externally.
 * Use KarateSpringBootTest instead for automated testing with embedded server.
 *
 * To use this runner:
 * 1. Start the application: ./mvnw spring-boot:run
 * 2. Run tests: ./mvnw test -Dtest=KarateTestRunner#testAll
 */
@Disabled("Use KarateSpringBootTest for automated testing - this runner requires external server")
class KarateTestRunner {

    @Karate.Test
    Karate testAll() {
        return Karate.run().relativeTo(getClass());
    }

    @Karate.Test
    Karate testCustomers() {
        return Karate.run("customers/customers").relativeTo(getClass());
    }

    @Karate.Test
    Karate testOrders() {
        return Karate.run("orders/orders").relativeTo(getClass());
    }

    @Karate.Test
    Karate testSmoke() {
        return Karate.run().tags("@smoke").relativeTo(getClass());
    }
}
