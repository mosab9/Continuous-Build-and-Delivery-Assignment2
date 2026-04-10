package com.tus.orderservice.integration;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tus.orderservice.dto.*;
import com.tus.orderservice.entity.Customer;
import com.tus.orderservice.entity.OrderItem;
import com.tus.orderservice.entity.OrderStatus;
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
@DisplayName("Order Integration Tests")
class OrderIntegrationTest {

    private MockMvc mockMvc;

    @Autowired
    private WebApplicationContext webApplicationContext;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private CustomerRepository customerRepository;

    @Autowired
    private OrderRepository orderRepository;

    private Customer testCustomer;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext).build();
        // Clean up any data from previous test runs (e.g., Karate tests)
        orderRepository.deleteAll();
        customerRepository.deleteAll();

        testCustomer = Customer.builder()
                .firstName("John")
                .lastName("Doe")
                .email("john.doe@example.com")
                .build();
        testCustomer = customerRepository.save(testCustomer);
    }

    @Nested
    @DisplayName("POST /api/orders - Create Order")
    class CreateOrderTests {

        @Test
        @DisplayName("Should create order with items and calculate total")
        void createOrder_Success() throws Exception {
            OrderItemRequest item1 = new OrderItemRequest();
            item1.setProductId(100L);
            item1.setProductName("Product A");
            item1.setQuantity(2);
            item1.setUnitPrice(new BigDecimal("25.00"));

            OrderItemRequest item2 = new OrderItemRequest();
            item2.setProductId(101L);
            item2.setProductName("Product B");
            item2.setQuantity(3);
            item2.setUnitPrice(new BigDecimal("10.00"));

            CreateOrderRequest request = new CreateOrderRequest();
            request.setCustomerId(testCustomer.getId());
            request.setItems(List.of(item1, item2));

            MvcResult result = mockMvc.perform(post("/api/orders")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.id").exists())
                    .andExpect(jsonPath("$.customerName").value("John Doe"))
                    .andExpect(jsonPath("$.status").value("PENDING"))
                    .andExpect(jsonPath("$.totalPrice").value(80.00)) // 2*25 + 3*10
                    .andExpect(jsonPath("$.items", hasSize(2)))
                    .andReturn();

            // Verify in database
            OrderResponse response = objectMapper.readValue(
                    result.getResponse().getContentAsString(), OrderResponse.class);

            assertThat(orderRepository.findById(response.getId())).isPresent();
        }

        @Test
        @DisplayName("Should return 404 when customer does not exist")
        void createOrder_CustomerNotFound() throws Exception {
            OrderItemRequest item = new OrderItemRequest();
            item.setProductId(100L);
            item.setProductName("Product A");
            item.setQuantity(1);
            item.setUnitPrice(new BigDecimal("10.00"));

            CreateOrderRequest request = new CreateOrderRequest();
            request.setCustomerId(99999L);
            request.setItems(List.of(item));

            mockMvc.perform(post("/api/orders")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.status").value(404))
                    .andExpect(jsonPath("$.message").value(containsString("Customer")));
        }

        @Test
        @DisplayName("Should return 400 when items list is empty")
        void createOrder_EmptyItems() throws Exception {
            CreateOrderRequest request = new CreateOrderRequest();
            request.setCustomerId(testCustomer.getId());
            request.setItems(List.of());

            mockMvc.perform(post("/api/orders")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isBadRequest());
        }
    }

    @Nested
    @DisplayName("GET /api/orders/{id} - Get Order by ID")
    class GetOrderByIdTests {

        @Test
        @DisplayName("Should return order with all details")
        void getOrder_Success() throws Exception {
            // Create order first
            com.tus.orderservice.entity.Order order = createTestOrder();

            mockMvc.perform(get("/api/orders/{id}", order.getId()))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.id").value(order.getId()))
                    .andExpect(jsonPath("$.customerName").value("John Doe"))
                    .andExpect(jsonPath("$.status").value("PENDING"))
                    .andExpect(jsonPath("$.items", hasSize(1)))
                    .andExpect(jsonPath("$.items[0].productName").value("Test Product"));
        }

        @Test
        @DisplayName("Should return 404 when order does not exist")
        void getOrder_NotFound() throws Exception {
            mockMvc.perform(get("/api/orders/{id}", 99999L))
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.status").value(404));
        }
    }

    @Nested
    @DisplayName("GET /api/orders - Get All Orders")
    class GetAllOrdersTests {

        @Test
        @DisplayName("Should return paginated orders")
        void getAllOrders_Pagination() throws Exception {
            // Create multiple orders
            createTestOrder();
            createTestOrder();
            createTestOrder();

            mockMvc.perform(get("/api/orders")
                            .param("page", "0")
                            .param("size", "2"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data", hasSize(2)))
                    .andExpect(jsonPath("$.page").value(0))
                    .andExpect(jsonPath("$.size").value(2))
                    .andExpect(jsonPath("$.totalElements").value(3))
                    .andExpect(jsonPath("$.totalPages").value(2));
        }

        @Test
        @DisplayName("Should return empty page when no orders exist")
        void getAllOrders_Empty() throws Exception {
            mockMvc.perform(get("/api/orders"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data", hasSize(0)))
                    .andExpect(jsonPath("$.totalElements").value(0));
        }
    }

    @Nested
    @DisplayName("PATCH /api/orders/{id}/status - Update Order Status")
    class UpdateOrderStatusTests {

        @Test
        @DisplayName("Should update status from PENDING to CONFIRMED")
        void updateOrderStatus_PendingToConfirmed() throws Exception {
            com.tus.orderservice.entity.Order order = createTestOrder();

            UpdateOrderStatusRequest request = new UpdateOrderStatusRequest();
            request.setStatus("CONFIRMED");

            mockMvc.perform(patch("/api/orders/{id}/status", order.getId())
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("CONFIRMED"));

            // Verify in database
            com.tus.orderservice.entity.Order updated = orderRepository.findById(order.getId()).orElseThrow();
            assertThat(updated.getStatus()).isEqualTo(OrderStatus.CONFIRMED);
        }

        @Test
        @DisplayName("Should update status from PENDING to CANCELLED")
        void updateOrderStatus_PendingToCancelled() throws Exception {
            com.tus.orderservice.entity.Order order = createTestOrder();

            UpdateOrderStatusRequest request = new UpdateOrderStatusRequest();
            request.setStatus("CANCELLED");

            mockMvc.perform(patch("/api/orders/{id}/status", order.getId())
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("CANCELLED"));
        }

        @Test
        @DisplayName("Should reject invalid transition from CONFIRMED to PENDING")
        void updateOrderStatus_InvalidTransition() throws Exception {
            com.tus.orderservice.entity.Order order = createTestOrder();
            order.setStatus(OrderStatus.CONFIRMED);
            orderRepository.save(order);

            UpdateOrderStatusRequest request = new UpdateOrderStatusRequest();
            request.setStatus("PENDING");

            mockMvc.perform(patch("/api/orders/{id}/status", order.getId())
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.message").value(containsString("cannot be reverted")));
        }

        @Test
        @DisplayName("Should reject update on cancelled order")
        void updateOrderStatus_CancelledOrder() throws Exception {
            com.tus.orderservice.entity.Order order = createTestOrder();
            order.setStatus(OrderStatus.CANCELLED);
            orderRepository.save(order);

            UpdateOrderStatusRequest request = new UpdateOrderStatusRequest();
            request.setStatus("CONFIRMED");

            mockMvc.perform(patch("/api/orders/{id}/status", order.getId())
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.message").value(containsString("cancelled")));
        }
    }

    @Nested
    @DisplayName("PUT /api/orders/{id} - Update Order")
    class UpdateOrderTests {

        @Test
        @DisplayName("Should update order items and recalculate total")
        void updateOrder_Success() throws Exception {
            com.tus.orderservice.entity.Order order = createTestOrder();

            OrderItemRequest newItem = new OrderItemRequest();
            newItem.setProductId(200L);
            newItem.setProductName("New Product");
            newItem.setQuantity(5);
            newItem.setUnitPrice(new BigDecimal("20.00"));

            CreateOrderRequest request = new CreateOrderRequest();
            request.setCustomerId(testCustomer.getId());
            request.setItems(List.of(newItem));

            mockMvc.perform(put("/api/orders/{id}", order.getId())
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.totalPrice").value(100.00)) // 5*20
                    .andExpect(jsonPath("$.items", hasSize(1)))
                    .andExpect(jsonPath("$.items[0].productName").value("New Product"));
        }

        @Test
        @DisplayName("Should reject update on cancelled order")
        void updateOrder_CancelledBlocked() throws Exception {
            com.tus.orderservice.entity.Order order = createTestOrder();
            order.setStatus(OrderStatus.CANCELLED);
            orderRepository.save(order);

            OrderItemRequest item = new OrderItemRequest();
            item.setProductId(100L);
            item.setProductName("Product");
            item.setQuantity(1);
            item.setUnitPrice(new BigDecimal("10.00"));

            CreateOrderRequest request = new CreateOrderRequest();
            request.setCustomerId(testCustomer.getId());
            request.setItems(List.of(item));

            mockMvc.perform(put("/api/orders/{id}", order.getId())
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.message").value(containsString("cancelled")));
        }

        @Test
        @DisplayName("Should return 404 when order does not exist")
        void updateOrder_NotFound() throws Exception {
            OrderItemRequest item = new OrderItemRequest();
            item.setProductId(100L);
            item.setProductName("Product");
            item.setQuantity(1);
            item.setUnitPrice(new BigDecimal("10.00"));

            CreateOrderRequest request = new CreateOrderRequest();
            request.setCustomerId(testCustomer.getId());
            request.setItems(List.of(item));

            mockMvc.perform(put("/api/orders/{id}", 99999L)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isNotFound());
        }
    }

    @Nested
    @DisplayName("DELETE /api/orders/{id} - Delete Order")
    class DeleteOrderTests {

        @Test
        @DisplayName("Should delete pending order successfully")
        void deleteOrder_PendingSuccess() throws Exception {
            com.tus.orderservice.entity.Order order = createTestOrder();

            mockMvc.perform(delete("/api/orders/{id}", order.getId()))
                    .andExpect(status().isNoContent());

            // Verify deleted from database
            assertThat(orderRepository.findById(order.getId())).isEmpty();
        }

        @Test
        @DisplayName("Should delete cancelled order successfully")
        void deleteOrder_CancelledSuccess() throws Exception {
            com.tus.orderservice.entity.Order order = createTestOrder();
            order.setStatus(OrderStatus.CANCELLED);
            orderRepository.save(order);

            mockMvc.perform(delete("/api/orders/{id}", order.getId()))
                    .andExpect(status().isNoContent());

            assertThat(orderRepository.findById(order.getId())).isEmpty();
        }

        @Test
        @DisplayName("Should reject deletion of confirmed order")
        void deleteOrder_ConfirmedBlocked() throws Exception {
            com.tus.orderservice.entity.Order order = createTestOrder();
            order.setStatus(OrderStatus.CONFIRMED);
            orderRepository.save(order);

            mockMvc.perform(delete("/api/orders/{id}", order.getId()))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.message").value(containsString("confirmed")));

            // Verify still exists in database
            assertThat(orderRepository.findById(order.getId())).isPresent();
        }

        @Test
        @DisplayName("Should return 404 when order does not exist")
        void deleteOrder_NotFound() throws Exception {
            mockMvc.perform(delete("/api/orders/{id}", 99999L))
                    .andExpect(status().isNotFound());
        }
    }

    // Helper method to create a test order
    private com.tus.orderservice.entity.Order createTestOrder() {
        OrderItem item = OrderItem.builder()
                .productId(100L)
                .productName("Test Product")
                .quantity(2)
                .unitPrice(new BigDecimal("25.00"))
                .build();

        com.tus.orderservice.entity.Order order = com.tus.orderservice.entity.Order.builder()
                .customer(testCustomer)
                .totalPrice(new BigDecimal("50.00"))
                .items(new java.util.ArrayList<>(List.of(item)))
                .build();

        item.setOrder(order);
        return orderRepository.save(order);
    }
}
