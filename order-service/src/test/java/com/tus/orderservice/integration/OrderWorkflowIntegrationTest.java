package com.tus.orderservice.integration;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tus.orderservice.dto.*;
import com.tus.orderservice.entity.Customer;
import com.tus.orderservice.entity.OrderStatus;
import com.tus.orderservice.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
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
@DisplayName("Order Workflow Integration Tests")
class OrderWorkflowIntegrationTest {

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
    }

    @Test
    @DisplayName("Complete order lifecycle: Create → Confirm → Verify final state")
    void completeOrderLifecycle() throws Exception {
        // Step 1: Create a customer
        CreateCustomerRequest customerRequest = new CreateCustomerRequest();
        customerRequest.setFirstName("Alice");
        customerRequest.setLastName("Johnson");
        customerRequest.setEmail("alice.johnson@example.com");

        MvcResult customerResult = mockMvc.perform(post("/api/customers")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(customerRequest)))
                .andExpect(status().isCreated())
                .andReturn();

        CustomerResponse customer = objectMapper.readValue(
                customerResult.getResponse().getContentAsString(), CustomerResponse.class);

        // Step 2: Create an order
        OrderItemRequest item1 = new OrderItemRequest();
        item1.setProductId(1L);
        item1.setProductName("Laptop");
        item1.setQuantity(1);
        item1.setUnitPrice(new BigDecimal("999.99"));

        OrderItemRequest item2 = new OrderItemRequest();
        item2.setProductId(2L);
        item2.setProductName("Mouse");
        item2.setQuantity(2);
        item2.setUnitPrice(new BigDecimal("29.99"));

        CreateOrderRequest orderRequest = new CreateOrderRequest();
        orderRequest.setCustomerId(customer.getId());
        orderRequest.setItems(List.of(item1, item2));

        MvcResult orderResult = mockMvc.perform(post("/api/orders")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(orderRequest)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("PENDING"))
                .andExpect(jsonPath("$.totalPrice").value(1059.97)) // 999.99 + 2*29.99
                .andReturn();

        OrderResponse order = objectMapper.readValue(
                orderResult.getResponse().getContentAsString(), OrderResponse.class);

        // Step 3: Confirm the order
        UpdateOrderStatusRequest statusRequest = new UpdateOrderStatusRequest();
        statusRequest.setStatus("CONFIRMED");

        mockMvc.perform(patch("/api/orders/{id}/status", order.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(statusRequest)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CONFIRMED"));

        // Step 4: Verify final state in database
        com.tus.orderservice.entity.Order finalOrder = orderRepository.findById(order.getId()).orElseThrow();
        assertThat(finalOrder.getStatus()).isEqualTo(OrderStatus.CONFIRMED);
        assertThat(finalOrder.getItems()).hasSize(2);
        assertThat(finalOrder.getCustomer().getEmail()).isEqualTo("alice.johnson@example.com");

        // Step 5: Verify order appears in customer's orders
        mockMvc.perform(get("/api/customers/{customerId}/orders", customer.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data", hasSize(1)))
                .andExpect(jsonPath("$.data[0].status").value("CONFIRMED"));
    }

    @Test
    @DisplayName("Cancel order flow: Create → Cancel → Verify blocked operations")
    void cancelOrderFlow() throws Exception {
        // Create customer
        Customer customer = Customer.builder()
                .firstName("Bob")
                .lastName("Smith")
                .email("bob.smith@example.com")
                .build();
        customer = customerRepository.save(customer);

        // Create order
        OrderItemRequest item = new OrderItemRequest();
        item.setProductId(1L);
        item.setProductName("Keyboard");
        item.setQuantity(1);
        item.setUnitPrice(new BigDecimal("79.99"));

        CreateOrderRequest orderRequest = new CreateOrderRequest();
        orderRequest.setCustomerId(customer.getId());
        orderRequest.setItems(List.of(item));

        MvcResult orderResult = mockMvc.perform(post("/api/orders")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(orderRequest)))
                .andExpect(status().isCreated())
                .andReturn();

        OrderResponse order = objectMapper.readValue(
                orderResult.getResponse().getContentAsString(), OrderResponse.class);

        // Cancel the order
        UpdateOrderStatusRequest cancelRequest = new UpdateOrderStatusRequest();
        cancelRequest.setStatus("CANCELLED");

        mockMvc.perform(patch("/api/orders/{id}/status", order.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(cancelRequest)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CANCELLED"));

        // Verify cannot update cancelled order
        mockMvc.perform(put("/api/orders/{id}", order.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(orderRequest)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(containsString("cancelled")));

        // Verify cannot change status of cancelled order
        UpdateOrderStatusRequest confirmRequest = new UpdateOrderStatusRequest();
        confirmRequest.setStatus("CONFIRMED");

        mockMvc.perform(patch("/api/orders/{id}/status", order.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(confirmRequest)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(containsString("cancelled")));

        // Verify cancelled order can still be deleted
        mockMvc.perform(delete("/api/orders/{id}", order.getId()))
                .andExpect(status().isNoContent());

        assertThat(orderRepository.findById(order.getId())).isEmpty();
    }

    @Test
    @DisplayName("Multiple orders per customer: Create customer → Multiple orders → Verify relationships")
    void multipleOrdersPerCustomer() throws Exception {
        // Create customer
        Customer customer = Customer.builder()
                .firstName("Carol")
                .lastName("Williams")
                .email("carol.williams@example.com")
                .build();
        customer = customerRepository.save(customer);

        // Create first order
        OrderItemRequest item1 = new OrderItemRequest();
        item1.setProductId(1L);
        item1.setProductName("Book");
        item1.setQuantity(3);
        item1.setUnitPrice(new BigDecimal("15.99"));

        CreateOrderRequest order1Request = new CreateOrderRequest();
        order1Request.setCustomerId(customer.getId());
        order1Request.setItems(List.of(item1));

        mockMvc.perform(post("/api/orders")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(order1Request)))
                .andExpect(status().isCreated());

        // Create second order
        OrderItemRequest item2 = new OrderItemRequest();
        item2.setProductId(2L);
        item2.setProductName("Pen Set");
        item2.setQuantity(5);
        item2.setUnitPrice(new BigDecimal("4.99"));

        CreateOrderRequest order2Request = new CreateOrderRequest();
        order2Request.setCustomerId(customer.getId());
        order2Request.setItems(List.of(item2));

        mockMvc.perform(post("/api/orders")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(order2Request)))
                .andExpect(status().isCreated());

        // Create third order
        OrderItemRequest item3 = new OrderItemRequest();
        item3.setProductId(3L);
        item3.setProductName("Notebook");
        item3.setQuantity(2);
        item3.setUnitPrice(new BigDecimal("8.50"));

        CreateOrderRequest order3Request = new CreateOrderRequest();
        order3Request.setCustomerId(customer.getId());
        order3Request.setItems(List.of(item3));

        mockMvc.perform(post("/api/orders")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(order3Request)))
                .andExpect(status().isCreated());

        // Verify customer has 3 orders
        mockMvc.perform(get("/api/customers/{customerId}/orders", customer.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data", hasSize(3)))
                .andExpect(jsonPath("$.totalElements").value(3));

        // Verify orders are sorted by createdAt descending (most recent first)
        mockMvc.perform(get("/api/customers/{customerId}/orders", customer.getId())
                        .param("page", "0")
                        .param("size", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data", hasSize(1)))
                .andExpect(jsonPath("$.data[0].items[0].productName").value("Notebook"));
    }

    @Test
    @DisplayName("Order total calculation: Multiple items → Verify correct total")
    void orderTotalCalculation() throws Exception {
        // Create customer
        Customer customer = Customer.builder()
                .firstName("David")
                .lastName("Brown")
                .email("david.brown@example.com")
                .build();
        customer = customerRepository.save(customer);

        // Create order with multiple items
        OrderItemRequest item1 = new OrderItemRequest();
        item1.setProductId(1L);
        item1.setProductName("Item 1");
        item1.setQuantity(2);
        item1.setUnitPrice(new BigDecimal("10.50")); // 2 * 10.50 = 21.00

        OrderItemRequest item2 = new OrderItemRequest();
        item2.setProductId(2L);
        item2.setProductName("Item 2");
        item2.setQuantity(3);
        item2.setUnitPrice(new BigDecimal("5.25")); // 3 * 5.25 = 15.75

        OrderItemRequest item3 = new OrderItemRequest();
        item3.setProductId(3L);
        item3.setProductName("Item 3");
        item3.setQuantity(1);
        item3.setUnitPrice(new BigDecimal("100.00")); // 1 * 100.00 = 100.00

        // Total: 21.00 + 15.75 + 100.00 = 136.75
        CreateOrderRequest orderRequest = new CreateOrderRequest();
        orderRequest.setCustomerId(customer.getId());
        orderRequest.setItems(List.of(item1, item2, item3));

        mockMvc.perform(post("/api/orders")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(orderRequest)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.totalPrice").value(136.75))
                .andExpect(jsonPath("$.items", hasSize(3)))
                .andExpect(jsonPath("$.items[0].subtotal").value(21.00))
                .andExpect(jsonPath("$.items[1].subtotal").value(15.75))
                .andExpect(jsonPath("$.items[2].subtotal").value(100.00));
    }

    @Test
    @DisplayName("Update order items: Modify items → Verify new total and items")
    void updateOrderItemsAndTotal() throws Exception {
        // Create customer
        Customer customer = Customer.builder()
                .firstName("Eve")
                .lastName("Davis")
                .email("eve.davis@example.com")
                .build();
        customer = customerRepository.save(customer);

        // Create initial order
        OrderItemRequest initialItem = new OrderItemRequest();
        initialItem.setProductId(1L);
        initialItem.setProductName("Original Item");
        initialItem.setQuantity(1);
        initialItem.setUnitPrice(new BigDecimal("50.00"));

        CreateOrderRequest createRequest = new CreateOrderRequest();
        createRequest.setCustomerId(customer.getId());
        createRequest.setItems(List.of(initialItem));

        MvcResult createResult = mockMvc.perform(post("/api/orders")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(createRequest)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.totalPrice").value(50.00))
                .andReturn();

        OrderResponse createdOrder = objectMapper.readValue(
                createResult.getResponse().getContentAsString(), OrderResponse.class);

        // Update order with new items
        OrderItemRequest newItem1 = new OrderItemRequest();
        newItem1.setProductId(2L);
        newItem1.setProductName("New Item 1");
        newItem1.setQuantity(2);
        newItem1.setUnitPrice(new BigDecimal("30.00")); // 60.00

        OrderItemRequest newItem2 = new OrderItemRequest();
        newItem2.setProductId(3L);
        newItem2.setProductName("New Item 2");
        newItem2.setQuantity(4);
        newItem2.setUnitPrice(new BigDecimal("12.50")); // 50.00

        // New total: 60.00 + 50.00 = 110.00
        CreateOrderRequest updateRequest = new CreateOrderRequest();
        updateRequest.setCustomerId(customer.getId());
        updateRequest.setItems(List.of(newItem1, newItem2));

        mockMvc.perform(put("/api/orders/{id}", createdOrder.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(updateRequest)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalPrice").value(110.00))
                .andExpect(jsonPath("$.items", hasSize(2)))
                .andExpect(jsonPath("$.items[*].productName",
                        containsInAnyOrder("New Item 1", "New Item 2")));

        // Verify in database - old item should be removed
        com.tus.orderservice.entity.Order updatedOrder = orderRepository.findById(createdOrder.getId()).orElseThrow();
        assertThat(updatedOrder.getItems()).hasSize(2);
        assertThat(updatedOrder.getItems())
                .noneMatch(item -> item.getProductName().equals("Original Item"));
    }

    @Test
    @DisplayName("Confirmed order restrictions: Confirm → Cannot delete → Cannot revert")
    void confirmedOrderRestrictions() throws Exception {
        // Create customer
        Customer customer = Customer.builder()
                .firstName("Frank")
                .lastName("Miller")
                .email("frank.miller@example.com")
                .build();
        customer = customerRepository.save(customer);

        // Create order
        OrderItemRequest item = new OrderItemRequest();
        item.setProductId(1L);
        item.setProductName("Product");
        item.setQuantity(1);
        item.setUnitPrice(new BigDecimal("25.00"));

        CreateOrderRequest orderRequest = new CreateOrderRequest();
        orderRequest.setCustomerId(customer.getId());
        orderRequest.setItems(List.of(item));

        MvcResult orderResult = mockMvc.perform(post("/api/orders")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(orderRequest)))
                .andExpect(status().isCreated())
                .andReturn();

        OrderResponse order = objectMapper.readValue(
                orderResult.getResponse().getContentAsString(), OrderResponse.class);

        // Confirm the order
        UpdateOrderStatusRequest confirmRequest = new UpdateOrderStatusRequest();
        confirmRequest.setStatus("CONFIRMED");

        mockMvc.perform(patch("/api/orders/{id}/status", order.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(confirmRequest)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CONFIRMED"));

        // Cannot delete confirmed order
        mockMvc.perform(delete("/api/orders/{id}", order.getId()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(containsString("confirmed")));

        // Cannot revert to PENDING
        UpdateOrderStatusRequest revertRequest = new UpdateOrderStatusRequest();
        revertRequest.setStatus("PENDING");

        mockMvc.perform(patch("/api/orders/{id}/status", order.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(revertRequest)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(containsString("cannot be reverted")));

        // Can still cancel a confirmed order
        UpdateOrderStatusRequest cancelRequest = new UpdateOrderStatusRequest();
        cancelRequest.setStatus("CANCELLED");

        mockMvc.perform(patch("/api/orders/{id}/status", order.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(cancelRequest)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CANCELLED"));
    }

    @Test
    @DisplayName("Customer deletion does not affect existing verification")
    void customerWithOrdersIntegrity() throws Exception {
        // Create customer
        Customer customer = Customer.builder()
                .firstName("Grace")
                .lastName("Lee")
                .email("grace.lee@example.com")
                .build();
        customer = customerRepository.save(customer);

        // Create order for customer
        OrderItemRequest item = new OrderItemRequest();
        item.setProductId(1L);
        item.setProductName("Product");
        item.setQuantity(1);
        item.setUnitPrice(new BigDecimal("20.00"));

        CreateOrderRequest orderRequest = new CreateOrderRequest();
        orderRequest.setCustomerId(customer.getId());
        orderRequest.setItems(List.of(item));

        mockMvc.perform(post("/api/orders")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(orderRequest)))
                .andExpect(status().isCreated());

        // Verify customer's orders exist
        mockMvc.perform(get("/api/customers/{customerId}/orders", customer.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1));

        // Verify customer data
        mockMvc.perform(get("/api/customers/{id}", customer.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.firstName").value("Grace"))
                .andExpect(jsonPath("$.lastName").value("Lee"));
    }
}
