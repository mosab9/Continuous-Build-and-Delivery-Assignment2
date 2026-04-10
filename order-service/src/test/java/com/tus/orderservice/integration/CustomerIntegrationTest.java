package com.tus.orderservice.integration;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tus.orderservice.dto.*;
import com.tus.orderservice.entity.Customer;
import com.tus.orderservice.entity.OrderItem;
import com.tus.orderservice.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;

import java.math.BigDecimal;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
@Transactional
@DisplayName("Customer Integration Tests")
class CustomerIntegrationTest {

    private MockMvc mockMvc;

    @Autowired
    private WebApplicationContext webApplicationContext;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private CustomerRepository customerRepository;

    @Autowired
    private OrderRepository orderRepository;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext).build();
        // Clean up any data from previous test runs (e.g., Karate tests)
        orderRepository.deleteAll();
        customerRepository.deleteAll();
    }

    @Nested
    @DisplayName("POST /api/customers - Create Customer")
    class CreateCustomerTests {

        @Test
        @DisplayName("Should create customer successfully")
        void createCustomer_Success() throws Exception {
            CreateCustomerRequest request = new CreateCustomerRequest();
            request.setFirstName("John");
            request.setLastName("Doe");
            request.setEmail("john.doe@example.com");

            MvcResult result = mockMvc.perform(post("/api/customers")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.id").exists())
                    .andExpect(jsonPath("$.firstName").value("John"))
                    .andExpect(jsonPath("$.lastName").value("Doe"))
                    .andExpect(jsonPath("$.email").value("john.doe@example.com"))
                    .andExpect(jsonPath("$.createdAt").exists())
                    .andReturn();

            // Verify in database
            CustomerResponse response = objectMapper.readValue(
                    result.getResponse().getContentAsString(), CustomerResponse.class);

            assertThat(customerRepository.findById(response.getId())).isPresent();
        }

        @Test
        @DisplayName("Should return 409 when email already exists")
        void createCustomer_DuplicateEmail() throws Exception {
            // Create first customer
            Customer existing = Customer.builder()
                    .firstName("Jane")
                    .lastName("Doe")
                    .email("jane.doe@example.com")
                    .build();
            customerRepository.save(existing);

            // Try to create another with same email
            CreateCustomerRequest request = new CreateCustomerRequest();
            request.setFirstName("John");
            request.setLastName("Smith");
            request.setEmail("jane.doe@example.com");

            mockMvc.perform(post("/api/customers")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isConflict())
                    .andExpect(jsonPath("$.status").value(409))
                    .andExpect(jsonPath("$.message").value(containsString("already exists")));
        }

        @Test
        @DisplayName("Should return 400 when firstName is blank")
        void createCustomer_BlankFirstName() throws Exception {
            CreateCustomerRequest request = new CreateCustomerRequest();
            request.setFirstName("");
            request.setLastName("Doe");
            request.setEmail("test@example.com");

            mockMvc.perform(post("/api/customers")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isBadRequest());
        }

        @Test
        @DisplayName("Should return 400 when email is invalid")
        void createCustomer_InvalidEmail() throws Exception {
            CreateCustomerRequest request = new CreateCustomerRequest();
            request.setFirstName("John");
            request.setLastName("Doe");
            request.setEmail("invalid-email");

            mockMvc.perform(post("/api/customers")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isBadRequest());
        }
    }

    @Nested
    @DisplayName("GET /api/customers/{id} - Get Customer by ID")
    class GetCustomerByIdTests {

        @Test
        @DisplayName("Should return customer with all details")
        void getCustomer_Success() throws Exception {
            Customer customer = Customer.builder()
                    .firstName("John")
                    .lastName("Doe")
                    .email("john.doe@example.com")
                    .build();
            customer = customerRepository.save(customer);

            mockMvc.perform(get("/api/customers/{id}", customer.getId()))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.id").value(customer.getId()))
                    .andExpect(jsonPath("$.firstName").value("John"))
                    .andExpect(jsonPath("$.lastName").value("Doe"))
                    .andExpect(jsonPath("$.email").value("john.doe@example.com"))
                    .andExpect(jsonPath("$.createdAt").exists());
        }

        @Test
        @DisplayName("Should return 404 when customer does not exist")
        void getCustomer_NotFound() throws Exception {
            mockMvc.perform(get("/api/customers/{id}", 99999L))
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.status").value(404))
                    .andExpect(jsonPath("$.message").value(containsString("Customer")));
        }
    }

    @Nested
    @DisplayName("GET /api/customers - Get All Customers")
    class GetAllCustomersTests {

        @Test
        @DisplayName("Should return paginated customers")
        void getAllCustomers_Pagination() throws Exception {
            // Create multiple customers
            for (int i = 1; i <= 5; i++) {
                Customer customer = Customer.builder()
                        .firstName("User" + i)
                        .lastName("Test")
                        .email("user" + i + "@example.com")
                        .build();
                customerRepository.save(customer);
            }

            mockMvc.perform(get("/api/customers")
                            .param("page", "0")
                            .param("size", "3"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data", hasSize(3)))
                    .andExpect(jsonPath("$.page").value(0))
                    .andExpect(jsonPath("$.size").value(3))
                    .andExpect(jsonPath("$.totalElements").value(5))
                    .andExpect(jsonPath("$.totalPages").value(2));
        }

        @Test
        @DisplayName("Should return second page of customers")
        void getAllCustomers_SecondPage() throws Exception {
            // Create multiple customers
            for (int i = 1; i <= 5; i++) {
                Customer customer = Customer.builder()
                        .firstName("User" + i)
                        .lastName("Test")
                        .email("user" + i + "@example.com")
                        .build();
                customerRepository.save(customer);
            }

            mockMvc.perform(get("/api/customers")
                            .param("page", "1")
                            .param("size", "3"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data", hasSize(2)))
                    .andExpect(jsonPath("$.page").value(1));
        }

        @Test
        @DisplayName("Should return empty page when no customers exist")
        void getAllCustomers_Empty() throws Exception {
            mockMvc.perform(get("/api/customers"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data", hasSize(0)))
                    .andExpect(jsonPath("$.totalElements").value(0));
        }
    }

    @Nested
    @DisplayName("PUT /api/customers/{id} - Update Customer")
    class UpdateCustomerTests {

        @Test
        @DisplayName("Should update customer name successfully")
        void updateCustomer_Success() throws Exception {
            Customer customer = Customer.builder()
                    .firstName("John")
                    .lastName("Doe")
                    .email("john.doe@example.com")
                    .build();
            customer = customerRepository.save(customer);

            CreateCustomerRequest request = new CreateCustomerRequest();
            request.setFirstName("Johnny");
            request.setLastName("Updated");
            request.setEmail("john.doe@example.com"); // Same email

            mockMvc.perform(put("/api/customers/{id}", customer.getId())
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.firstName").value("Johnny"))
                    .andExpect(jsonPath("$.lastName").value("Updated"))
                    .andExpect(jsonPath("$.email").value("john.doe@example.com"));

            // Verify in database
            Customer updated = customerRepository.findById(customer.getId()).orElseThrow();
            assertThat(updated.getFirstName()).isEqualTo("Johnny");
            assertThat(updated.getLastName()).isEqualTo("Updated");
        }

        @Test
        @DisplayName("Should update customer email to new unique email")
        void updateCustomer_NewEmail() throws Exception {
            Customer customer = Customer.builder()
                    .firstName("John")
                    .lastName("Doe")
                    .email("john.doe@example.com")
                    .build();
            customer = customerRepository.save(customer);

            CreateCustomerRequest request = new CreateCustomerRequest();
            request.setFirstName("John");
            request.setLastName("Doe");
            request.setEmail("john.new@example.com");

            mockMvc.perform(put("/api/customers/{id}", customer.getId())
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.email").value("john.new@example.com"));
        }

        @Test
        @DisplayName("Should return 409 when updating to existing email")
        void updateCustomer_DuplicateEmail() throws Exception {
            // Create two customers
            Customer customer1 = Customer.builder()
                    .firstName("John")
                    .lastName("Doe")
                    .email("john@example.com")
                    .build();
            customer1 = customerRepository.save(customer1);

            Customer customer2 = Customer.builder()
                    .firstName("Jane")
                    .lastName("Doe")
                    .email("jane@example.com")
                    .build();
            customerRepository.save(customer2);

            // Try to update customer1's email to customer2's email
            CreateCustomerRequest request = new CreateCustomerRequest();
            request.setFirstName("John");
            request.setLastName("Doe");
            request.setEmail("jane@example.com");

            mockMvc.perform(put("/api/customers/{id}", customer1.getId())
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isConflict())
                    .andExpect(jsonPath("$.message").value(containsString("already exists")));
        }

        @Test
        @DisplayName("Should return 404 when customer does not exist")
        void updateCustomer_NotFound() throws Exception {
            CreateCustomerRequest request = new CreateCustomerRequest();
            request.setFirstName("John");
            request.setLastName("Doe");
            request.setEmail("john@example.com");

            mockMvc.perform(put("/api/customers/{id}", 99999L)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isNotFound());
        }
    }

    @Nested
    @DisplayName("DELETE /api/customers/{id} - Delete Customer")
    class DeleteCustomerTests {

        @Test
        @DisplayName("Should delete customer successfully")
        void deleteCustomer_Success() throws Exception {
            Customer customer = Customer.builder()
                    .firstName("John")
                    .lastName("Doe")
                    .email("john.doe@example.com")
                    .build();
            customer = customerRepository.save(customer);

            mockMvc.perform(delete("/api/customers/{id}", customer.getId()))
                    .andExpect(status().isNoContent());

            // Verify deleted from database
            assertThat(customerRepository.findById(customer.getId())).isEmpty();
        }

        @Test
        @DisplayName("Should return 404 when customer does not exist")
        void deleteCustomer_NotFound() throws Exception {
            mockMvc.perform(delete("/api/customers/{id}", 99999L))
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.status").value(404));
        }
    }

    @Nested
    @DisplayName("GET /api/customers/{customerId}/orders - Get Customer Orders")
    class GetOrdersByCustomerTests {

        @Test
        @DisplayName("Should return customer orders with pagination")
        void getOrdersByCustomer_Success() throws Exception {
            // Create customer
            Customer customer = Customer.builder()
                    .firstName("John")
                    .lastName("Doe")
                    .email("john@example.com")
                    .build();
            customer = customerRepository.save(customer);

            // Create orders for customer
            for (int i = 0; i < 3; i++) {
                createOrderForCustomer(customer);
            }

            mockMvc.perform(get("/api/customers/{customerId}/orders", customer.getId())
                            .param("page", "0")
                            .param("size", "2"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data", hasSize(2)))
                    .andExpect(jsonPath("$.totalElements").value(3))
                    .andExpect(jsonPath("$.data[0].customerName").value("John Doe"));
        }

        @Test
        @DisplayName("Should return empty page when customer has no orders")
        void getOrdersByCustomer_Empty() throws Exception {
            Customer customer = Customer.builder()
                    .firstName("John")
                    .lastName("Doe")
                    .email("john@example.com")
                    .build();
            customer = customerRepository.save(customer);

            mockMvc.perform(get("/api/customers/{customerId}/orders", customer.getId()))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data", hasSize(0)))
                    .andExpect(jsonPath("$.totalElements").value(0));
        }

        @Test
        @DisplayName("Should return 404 when customer does not exist")
        void getOrdersByCustomer_CustomerNotFound() throws Exception {
            mockMvc.perform(get("/api/customers/{customerId}/orders", 99999L))
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.status").value(404));
        }
    }

    // Helper method to create an order for a customer
    private com.tus.orderservice.entity.Order createOrderForCustomer(Customer customer) {
        OrderItem item = OrderItem.builder()
                .productId(100L)
                .productName("Test Product")
                .quantity(1)
                .unitPrice(new BigDecimal("10.00"))
                .build();

        com.tus.orderservice.entity.Order order = com.tus.orderservice.entity.Order.builder()
                .customer(customer)
                .totalPrice(new BigDecimal("10.00"))
                .items(new java.util.ArrayList<>(List.of(item)))
                .build();

        item.setOrder(order);
        return orderRepository.save(order);
    }
}
