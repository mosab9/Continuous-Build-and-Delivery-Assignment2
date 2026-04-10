package karate;

import com.intuit.karate.junit5.Karate;
import com.tus.orderservice.OrderServiceApplication;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.TestInstance;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.test.context.ActiveProfiles;

@SpringBootTest(
        classes = OrderServiceApplication.class,
        webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT
)
@ActiveProfiles("test")
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class KarateSpringBootTest {

    @LocalServerPort
    private int port;

    @BeforeAll
    void setBaseUrl() {
        System.setProperty("karate.baseUrl", "http://localhost:" + port);
    }

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
